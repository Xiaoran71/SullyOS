import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callMcpTool, loadMcpServers } = vi.hoisted(() => ({
  callMcpTool: vi.fn(),
  loadMcpServers: vi.fn(),
}));
vi.mock('./mcpClient', () => ({ callMcpTool, loadMcpServers }));

import {
  clearPreReplyMcpCache,
  getPreReplyMcpReservedTools,
  normalizePreReplyMcpRules,
  parsePreReplyMcpArguments,
  runPreReplyMcpRules,
} from './preReplyMcp';
import type { CharacterProfile, PreReplyMcpRule } from '../types';

const rule = (patch: Partial<PreReplyMcpRule> = {}): PreReplyMcpRule => ({
  id: 'usage', name: '检查手机使用', mode: 'always', serverId: 'server-1', toolName: 'query_events',
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

  it('只有强制与禁用模式独占工具，按需模式保持原版暴露', () => {
    expect(getPreReplyMcpReservedTools(char([rule()]))).toEqual([{ serverId: 'server-1', toolName: 'query_events' }]);
    expect(getPreReplyMcpReservedTools(char([rule({ mode: 'disabled' })]))).toEqual([{ serverId: 'server-1', toolName: 'query_events' }]);
    expect(getPreReplyMcpReservedTools(char([rule({ mode: 'on_demand' })]))).toEqual([]);
    expect(getPreReplyMcpReservedTools(char())).toEqual([]);
  });

  it('按需与禁用模式都不会走回复前强制调用', async () => {
    const now = new Date(2026, 6, 22, 12);
    await runPreReplyMcpRules(char([rule({ mode: 'on_demand' }), rule({ id: 'off', mode: 'disabled' })]), undefined, now);
    expect(callMcpTool).not.toHaveBeenCalled();
  });

  it('在回复前直接调用白名单工具并渲染本轮上下文', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: { total: 2, apps: ['抖音', '微博'] } });
    const now = new Date(2026, 6, 22, 12);
    const result = await runPreReplyMcpRules(char([rule()]), undefined, now);
    expect(callMcpTool).toHaveBeenCalledWith(server, 'query_events', { hours: 6 });
    expect(result.context).toContain('回复前自动 MCP 上下文');
    expect(result.context).toContain('"total": 2');
    expect(result.context).toContain('query_events');
    expect(result.ran).toBe(1);
    expect(result.usedRuleNames).toEqual(['检查手机使用']);
  });

  it('强制模式每次回复都真实调用，不复用旧版间隔缓存', async () => {
    callMcpTool.mockResolvedValue({ success: true, data: '最新数据' });
    const forcedRule = rule({ minIntervalMinutes: 30 });
    const first = new Date(2026, 6, 22, 12, 0);
    await runPreReplyMcpRules(char([forcedRule]), undefined, first);
    const second = await runPreReplyMcpRules(char([forcedRule]), undefined, new Date(2026, 6, 22, 12, 5));
    expect(callMcpTool).toHaveBeenCalledTimes(2);
    expect(second.context).toContain('最新数据');
    expect(second.usedRuleNames).toEqual(['检查手机使用']);
  });

  it('关键规则失败时标记中止，默认规则则软失败继续', async () => {
    callMcpTool.mockResolvedValue({ success: false, error: 'VPN 不通' });
    const now = new Date();
    const failedRule = rule({ onFailure: 'abort' });
    const result = await runPreReplyMcpRules(char([failedRule]), undefined, now);
    expect(result.abort).toBe(true);
    expect(result.errors[0]).toContain('VPN 不通');
  });

  it('旧版双开关与短暂 monitor 配置会迁移为单一模式并移除旧字段', () => {
    const migratedAuto = normalizePreReplyMcpRules([rule({ mode: undefined, enabled: true })])[0];
    const migratedOff = normalizePreReplyMcpRules([rule({ mode: undefined, enabled: false })])[0];
    const migratedManual = normalizePreReplyMcpRules([rule({ mode: undefined, allowManualModelCall: true })])[0];
    const migratedMonitor = normalizePreReplyMcpRules([{ ...rule(), mode: 'monitor' } as any])[0];
    expect(migratedAuto.mode).toBe('always');
    expect(migratedOff.mode).toBe('disabled');
    expect(migratedManual.mode).toBe('on_demand');
    expect(migratedMonitor.mode).toBe('always');
    expect(migratedAuto).not.toHaveProperty('enabled');
    expect(migratedManual).not.toHaveProperty('allowManualModelCall');
  });
});
