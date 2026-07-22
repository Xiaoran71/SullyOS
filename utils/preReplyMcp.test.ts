import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callMcpTool, loadMcpServers } = vi.hoisted(() => ({
  callMcpTool: vi.fn(),
  loadMcpServers: vi.fn(),
}));
vi.mock('./mcpClient', () => ({ callMcpTool, loadMcpServers }));

import {
  clearPreReplyMcpCache,
  buildPreReplyMcpProposalPrompt,
  getPreReplyMcpReservedTools,
  isPreReplyMcpRuleActiveNow,
  isPreReplyMcpRuleEnabledForCharacter,
  normalizePreReplyMcpRules,
  parsePreReplyMcpArguments,
  runPreReplyMcpRules,
  PRE_REPLY_MCP_PROPOSAL_TAG_RE,
} from './preReplyMcp';
import type { CharacterProfile, PreReplyMcpRule } from '../types';

const rule = (patch: Partial<PreReplyMcpRule> = {}): PreReplyMcpRule => ({
  id: 'usage', name: '检查手机使用', enabled: true, serverId: 'server-1', toolName: 'query_events',
  argumentsJson: '{"hours": 6}', promptTemplate: '设备数据：{{result}}（{{tool}}）',
  maxResultChars: 8000, minIntervalMinutes: 0, onFailure: 'continue', ...patch,
});
const char = (rules?: PreReplyMcpRule[]) => ({ id: 'char-1', name: '猫猫', preReplyMcpRules: rules }) as CharacterProfile;
const server = { id: 'server-1', name: '设备记录', url: 'https://example.test/mcp', enabled: true, updatedAt: 1, tools: [{ name: 'query_events' }] };

beforeEach(() => {
  clearPreReplyMcpCache();
  callMcpTool.mockReset();
  loadMcpServers.mockReset();
  loadMcpServers.mockReturnValue([server]);
});

describe('preReplyMcp', () => {
  it('原版角色没有规则时不调用、不产生上下文', async () => {
    const result = await runPreReplyMcpRules(char());
    expect(result.context).toBe('');
    expect(callMcpTool).not.toHaveBeenCalled();
    expect(normalizePreReplyMcpRules(undefined)).toEqual([]);
  });

  it('校验任意 MCP 参数必须是 JSON 对象', () => {
    expect(parsePreReplyMcpArguments('{"hours":6}')).toEqual({ hours: 6 });
    expect(() => parsePreReplyMcpArguments('[1,2]')).toThrow(/JSON 对象/);
  });

  it('支持普通与跨午夜的每日生效区间', () => {
    expect(isPreReplyMcpRuleActiveNow(rule({ activeTimeStart: '08:00', activeTimeEnd: '20:00' }), new Date(2026, 6, 22, 12))).toBe(true);
    expect(isPreReplyMcpRuleActiveNow(rule({ activeTimeStart: '22:00', activeTimeEnd: '06:00' }), new Date(2026, 6, 22, 23))).toBe(true);
    expect(isPreReplyMcpRuleActiveNow(rule({ activeTimeStart: '22:00', activeTimeEnd: '06:00' }), new Date(2026, 6, 22, 12))).toBe(false);
  });

  it('临时会话只在确认后的有效期内启用关闭规则', () => {
    const disabled = rule({ enabled: false });
    const now = Date.parse('2026-07-22T12:00:00');
    expect(isPreReplyMcpRuleEnabledForCharacter(char([disabled]), disabled, now)).toBe(false);
    const active = { ...char([disabled]), temporaryPreReplyMcpSessions: [{ ruleId: disabled.id, startedAt: now - 1000, expiresAt: now + 1000 }] };
    expect(isPreReplyMcpRuleEnabledForCharacter(active, disabled, now)).toBe(true);
    expect(isPreReplyMcpRuleEnabledForCharacter(active, disabled, now + 2000)).toBe(false);
  });

  it('给角色的提议协议只公开关闭规则的 ID/用途，不公开参数或服务器', () => {
    const prompt = buildPreReplyMcpProposalPrompt(char([
      rule({ enabled: false, activationDescription: '监督手机使用' }),
      rule({ id: 'always', enabled: true, argumentsJson: '{"secret":"x"}' }),
    ]));
    expect(prompt).toContain('ID=usage');
    expect(prompt).toContain('监督手机使用');
    expect(prompt).not.toContain('ID=always');
    expect(prompt).not.toContain('secret');
    const match = '[[MCP_MONITOR:usage|180|接下来我会看着你。]]'.match(PRE_REPLY_MCP_PROPOSAL_TAG_RE);
    expect(match).not.toBeNull();
  });

  it('自动规则默认独占工具，只有明确允许时才继续暴露给模型', () => {
    expect(getPreReplyMcpReservedTools(char([rule()]))).toEqual([{ serverId: 'server-1', toolName: 'query_events' }]);
    expect(getPreReplyMcpReservedTools(char([rule({ allowManualModelCall: true })]))).toEqual([]);
  });

  it('关闭规则仅在临时会话有效时执行', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: '临时数据' });
    const disabled = rule({ enabled: false });
    const now = new Date(2026, 6, 22, 12);
    await runPreReplyMcpRules(char([disabled]), undefined, now);
    expect(callMcpTool).not.toHaveBeenCalled();
    const active = { ...char([disabled]), temporaryPreReplyMcpSessions: [{ ruleId: disabled.id, startedAt: now.getTime() - 1, expiresAt: now.getTime() + 60_000 }] };
    const result = await runPreReplyMcpRules(active, undefined, now);
    expect(callMcpTool).toHaveBeenCalledTimes(1);
    expect(result.context).toContain('临时数据');
  });

  it('在回复前直接调用白名单工具并渲染本轮上下文', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: { total: 2, apps: ['抖音', '微博'] } });
    const result = await runPreReplyMcpRules(char([rule()]), undefined, new Date(2026, 6, 22, 12));
    expect(callMcpTool).toHaveBeenCalledWith(server, 'query_events', { hours: 6 });
    expect(result.context).toContain('回复前自动 MCP 上下文');
    expect(result.context).toContain('"total": 2');
    expect(result.context).toContain('query_events');
    expect(result.ran).toBe(1);
    expect(result.usedRuleNames).toEqual(['检查手机使用']);
  });

  it('最短间隔内复用内存缓存，不重复请求 MCP', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: '第一次数据' });
    const cachedRule = rule({ minIntervalMinutes: 30 });
    const first = new Date(2026, 6, 22, 12, 0);
    await runPreReplyMcpRules(char([cachedRule]), undefined, first);
    const second = await runPreReplyMcpRules(char([cachedRule]), undefined, new Date(2026, 6, 22, 12, 5));
    expect(callMcpTool).toHaveBeenCalledTimes(1);
    expect(second.context).toContain('第一次数据');
    expect(second.usedRuleNames).toEqual(['检查手机使用']);
  });

  it('关键规则失败时标记中止，默认规则则软失败继续', async () => {
    callMcpTool.mockResolvedValue({ success: false, error: 'VPN 不通' });
    const result = await runPreReplyMcpRules(char([rule({ onFailure: 'abort' })]));
    expect(result.abort).toBe(true);
    expect(result.errors[0]).toContain('VPN 不通');
  });
});
