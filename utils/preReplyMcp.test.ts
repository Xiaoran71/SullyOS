import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callMcpTool, loadMcpServers } = vi.hoisted(() => ({
  callMcpTool: vi.fn(),
  loadMcpServers: vi.fn(),
}));
vi.mock('./mcpClient', () => ({ callMcpTool, loadMcpServers }));

import {
  clearPreReplyMcpCache,
  isPreReplyMcpRuleActiveNow,
  normalizePreReplyMcpRules,
  parsePreReplyMcpArguments,
  runPreReplyMcpRules,
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

  it('在回复前直接调用白名单工具并渲染本轮上下文', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: { total: 2, apps: ['抖音', '微博'] } });
    const result = await runPreReplyMcpRules(char([rule()]), undefined, new Date(2026, 6, 22, 12));
    expect(callMcpTool).toHaveBeenCalledWith(server, 'query_events', { hours: 6 });
    expect(result.context).toContain('回复前自动 MCP 上下文');
    expect(result.context).toContain('"total": 2');
    expect(result.context).toContain('query_events');
    expect(result.ran).toBe(1);
  });

  it('最短间隔内复用内存缓存，不重复请求 MCP', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: '第一次数据' });
    const cachedRule = rule({ minIntervalMinutes: 30 });
    const first = new Date(2026, 6, 22, 12, 0);
    await runPreReplyMcpRules(char([cachedRule]), undefined, first);
    const second = await runPreReplyMcpRules(char([cachedRule]), undefined, new Date(2026, 6, 22, 12, 5));
    expect(callMcpTool).toHaveBeenCalledTimes(1);
    expect(second.context).toContain('第一次数据');
  });

  it('关键规则失败时标记中止，默认规则则软失败继续', async () => {
    callMcpTool.mockResolvedValue({ success: false, error: 'VPN 不通' });
    const result = await runPreReplyMcpRules(char([rule({ onFailure: 'abort' })]));
    expect(result.abort).toBe(true);
    expect(result.errors[0]).toContain('VPN 不通');
  });
});
