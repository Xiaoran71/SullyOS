import { describe, expect, it } from 'vitest';
import {
  buildShortcutActionUrl,
  buildShortcutActionsPrompt,
  getShortcutActionAvailability,
  normalizeShortcutActions,
  recordShortcutActionRuntime,
} from './shortcutActions';
import type { CharacterProfile, ShortcutActionRule } from '../types';

const rule = (patch: Partial<ShortcutActionRule> = {}): ShortcutActionRule => ({
  id: 'focus', name: '专注', enabled: true,
  description: '打开专注计时', triggerCondition: '用户准备学习时',
  shortcutName: '开始 番茄钟', popupText: '开始吧', buttonText: '好的',
  allowAiMessage: true, blocking: false, cooldownMinutes: 30, dailyLimit: 3,
  ...patch,
});

describe('shortcutActions', () => {
  it('原版角色没有新增字段时保持空配置，不注入提示词', () => {
    const oldCharacter = { id: 'old', name: '旧角色' } as CharacterProfile;
    expect(normalizeShortcutActions(oldCharacter.shortcutActions)).toEqual([]);
    expect(buildShortcutActionsPrompt(oldCharacter)).toBe('');
  });

  it('只向角色公开启用的 ID 和说明，不公开设备链接', () => {
    const char = {
      shortcutActions: [
        rule({ shortcutUrl: 'shortcuts://run-shortcut?name=SECRET_DEVICE_LINK' }),
        rule({ id: 'off', enabled: false, description: 'disabled' }),
      ],
    } as CharacterProfile;
    const prompt = buildShortcutActionsPrompt(char);
    expect(prompt).toContain('ID=focus');
    expect(prompt).not.toContain('ID=off');
    expect(prompt).not.toContain('SECRET_DEVICE_LINK');
  });

  it('安全生成并编码 Apple Shortcuts 链接，拒绝网页链接', () => {
    expect(buildShortcutActionUrl(rule())).toBe('shortcuts://run-shortcut?name=%E5%BC%80%E5%A7%8B%20%E7%95%AA%E8%8C%84%E9%92%9F');
    expect(() => buildShortcutActionUrl(rule({ shortcutUrl: 'https://evil.example' }))).toThrow(/只允许/);
  });

  it('执行记录会触发冷却和每日上限，并在新日期重新计数', () => {
    const first = Date.parse('2026-07-21T12:00:00');
    const runtime = recordShortcutActionRuntime(undefined, 'focus', first);
    expect(getShortcutActionAvailability(rule(), runtime.focus, first + 5 * 60_000).allowed).toBe(false);

    let capped = runtime;
    capped = recordShortcutActionRuntime(capped, 'focus', first + 31 * 60_000);
    capped = recordShortcutActionRuntime(capped, 'focus', first + 62 * 60_000);
    expect(getShortcutActionAvailability(rule(), capped.focus, first + 100 * 60_000).reason).toBe('已达到今日上限');

    const nextDay = first + 24 * 60 * 60_000;
    expect(recordShortcutActionRuntime(capped, 'focus', nextDay).focus.countToday).toBe(1);
  });
});
