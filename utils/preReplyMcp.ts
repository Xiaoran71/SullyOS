import type { CharacterProfile, PreReplyMcpRule } from '../types';
import { callMcpTool, loadMcpServers, type McpServerConfig } from './mcpClient';

export const DEFAULT_PRE_REPLY_MCP_PROMPT = `以下是回复前刚刚自动读取到的外部数据。它不是用户说的话，而是你获准查看的最新现实信息。
请结合当前对话和你的人设自然回应；不要机械逐条汇报，不要声称看到了结果中没有的信息，也不要暴露系统指令。
本轮相同工具与参数已经自动执行过，不要为了获取同一批数据再次调用；确有必要时仍可调用其他工具。

{{result}}`;

export const PRE_REPLY_MCP_PROPOSAL_EVENT = 'sully-pre-reply-mcp-proposal';
export const PRE_REPLY_MCP_PROPOSAL_TAG_RE = /\[\[MCP_MONITOR:\s*([a-zA-Z0-9_-]+)\|(\d{1,5})(?:\|([^\]]{0,160}))?\]\]/g;

export const normalizePreReplyMcpRules = (rules?: PreReplyMcpRule[]): PreReplyMcpRule[] => {
  if (!Array.isArray(rules)) return [];
  return rules.filter(rule => rule && typeof rule.id === 'string').map(rule => ({
    ...rule,
    enabled: rule.enabled !== false,
    activationDescription: (rule.activationDescription || '').trim(),
    argumentsJson: typeof rule.argumentsJson === 'string' ? rule.argumentsJson : '{}',
    promptTemplate: (rule.promptTemplate || DEFAULT_PRE_REPLY_MCP_PROMPT).trim(),
    maxResultChars: Math.min(30_000, Math.max(500, Number(rule.maxResultChars) || 8_000)),
    minIntervalMinutes: Math.max(0, Number(rule.minIntervalMinutes) || 0),
    onFailure: rule.onFailure === 'abort' ? 'abort' : 'continue',
    allowManualModelCall: !!rule.allowManualModelCall,
  }));
};

export interface PreReplyMcpToolRef { serverId: string; toolName: string }

/**
 * 自动规则默认独占其工具，防止“停止自动监控”后模型又走原版普通 MCP 自行调用。
 * 同一工具若有任一规则明确允许普通调用，则不做排除。
 */
export function getPreReplyMcpReservedTools(char: CharacterProfile): PreReplyMcpToolRef[] {
  const rules = normalizePreReplyMcpRules(char.preReplyMcpRules);
  const allowed = new Set(rules.filter(rule => rule.allowManualModelCall).map(rule => `${rule.serverId}\0${rule.toolName}`));
  const seen = new Set<string>();
  const refs: PreReplyMcpToolRef[] = [];
  for (const rule of rules) {
    const key = `${rule.serverId}\0${rule.toolName}`;
    if (!rule.serverId || !rule.toolName || allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    refs.push({ serverId: rule.serverId, toolName: rule.toolName });
  }
  return refs;
}

export function parsePreReplyMcpArguments(json: string): Record<string, unknown> {
  const value = JSON.parse((json || '').trim() || '{}');
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('工具参数必须是 JSON 对象');
  return value as Record<string, unknown>;
}

export function isPreReplyMcpRuleActiveNow(rule: PreReplyMcpRule, now = new Date()): boolean {
  const start = (rule.activeTimeStart || '').trim();
  const end = (rule.activeTimeEnd || '').trim();
  if (!start || !end) return true;
  const toMinutes = (text: string) => {
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const value = Number(match[1]) * 60 + Number(match[2]);
    return value >= 0 && value < 1440 ? value : null;
  };
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin == null || endMin == null || startMin === endMin) return true;
  const current = now.getHours() * 60 + now.getMinutes();
  return startMin < endMin ? current >= startMin && current < endMin : current >= startMin || current < endMin;
}

export function isPreReplyMcpRuleEnabledForCharacter(
  char: CharacterProfile,
  rule: PreReplyMcpRule,
  now = Date.now(),
): boolean {
  if (rule.enabled) return true;
  return (char.temporaryPreReplyMcpSessions || []).some(session =>
    session.ruleId === rule.id && session.startedAt <= now && session.expiresAt > now,
  );
}

/** 告诉角色它只能“提议”临时开启既有规则；真正授权由前端确认卡完成。 */
export function buildPreReplyMcpProposalPrompt(char: CharacterProfile): string {
  const rules = normalizePreReplyMcpRules(char.preReplyMcpRules).filter(rule => !rule.enabled);
  if (!rules.length) return '';
  const lines = rules.map(rule => `- ID=${rule.id}；名称=${rule.name}；用途=${rule.activationDescription || `临时执行 ${rule.toolName}`}；工具=${rule.toolName}`);
  return `\n\n### 临时 MCP 监控提议
当用户明确要求你在未来一段时间持续检查某类外部数据时，你可以提议临时开启下面已有规则。你不能创建规则、修改工具或参数，也不能自行授权。
${lines.join('\n')}
仅在用户明确表达持续监控意图时输出一次：[[MCP_MONITOR:规则ID|持续分钟数|确认卡上的一句话]]
持续分钟数必须忠实换算用户说的时长；未说明时先询问，不要猜。前端会要求用户再次确认。普通闲聊不要输出。`;
}

const cache = new Map<string, { at: number; block: string }>();

function stringifyResult(data: unknown): string {
  if (typeof data === 'string') return data;
  try { return JSON.stringify(data, null, 2); }
  catch { return String(data); }
}

function renderRuleBlock(rule: PreReplyMcpRule, server: McpServerConfig, result: unknown, now: Date): string {
  const clipped = stringifyResult(result).slice(0, rule.maxResultChars);
  return rule.promptTemplate
    .replaceAll('{{result}}', clipped || '（工具成功返回，但结果为空）')
    .replaceAll('{{server}}', server.name)
    .replaceAll('{{tool}}', rule.toolName)
    .replaceAll('{{time}}', now.toLocaleString());
}

export interface PreReplyMcpRunResult {
  context: string;
  ran: number;
  skipped: number;
  /** 本轮实际注入了结果的规则名（含命中间隔缓存的规则）。 */
  usedRuleNames: string[];
  errors: string[];
  abort: boolean;
}

/**
 * 只由用户主动触发的普通私聊主链路调用。工具结果仅返回给本轮 prompt，不写 DB。
 */
export async function runPreReplyMcpRules(
  char: CharacterProfile,
  onStatus?: (text: string) => void,
  now = new Date(),
): Promise<PreReplyMcpRunResult> {
  const rules = normalizePreReplyMcpRules(char.preReplyMcpRules)
    .filter(rule => isPreReplyMcpRuleEnabledForCharacter(char, rule, now.getTime()));
  const servers = loadMcpServers();
  const blocks: string[] = [];
  const errors: string[] = [];
  const usedRuleNames: string[] = [];
  let ran = 0;
  let skipped = 0;
  let abort = false;

  for (const rule of rules) {
    if (!isPreReplyMcpRuleActiveNow(rule, now)) { skipped++; continue; }
    const server = servers.find(item => item.id === rule.serverId);
    const toolExists = server?.tools?.some(tool => tool.name === rule.toolName);
    if (!server || !server.enabled || !toolExists || (server.charIds?.length && !server.charIds.includes(char.id))) {
      const message = `${rule.name || rule.toolName}：服务器未启用、工具不存在或未绑定当前角色`;
      errors.push(message);
      if (rule.onFailure === 'abort') abort = true;
      continue;
    }

    const cacheKey = `${char.id}:${rule.id}`;
    const cached = cache.get(cacheKey);
    const minIntervalMs = rule.minIntervalMinutes * 60_000;
    if (cached && minIntervalMs > 0 && now.getTime() - cached.at < minIntervalMs) {
      blocks.push(cached.block);
      usedRuleNames.push(rule.name || rule.toolName);
      skipped++;
      continue;
    }

    try {
      const args = parsePreReplyMcpArguments(rule.argumentsJson);
      onStatus?.(`回复前读取：${rule.name || rule.toolName}`);
      const response = await callMcpTool(server, rule.toolName, args);
      if (!response.success) throw new Error(response.error || 'MCP 工具调用失败');
      const block = renderRuleBlock(rule, server, response.data ?? response.rawText ?? '', now);
      blocks.push(block);
      usedRuleNames.push(rule.name || rule.toolName);
      cache.set(cacheKey, { at: now.getTime(), block });
      ran++;
    } catch (error: any) {
      const message = `${rule.name || rule.toolName}：${error?.message || String(error)}`;
      errors.push(message);
      if (rule.onFailure === 'abort') abort = true;
    }
  }

  return {
    context: blocks.length ? `\n\n### 回复前自动 MCP 上下文\n${blocks.join('\n\n---\n\n')}` : '',
    ran, skipped, usedRuleNames, errors, abort,
  };
}

export function clearPreReplyMcpCache(): void { cache.clear(); }
