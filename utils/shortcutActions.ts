import { CharacterProfile, ShortcutActionRule, ShortcutActionRuntime } from '../types';

export const SHORTCUT_ACTION_EVENT = 'sully-shortcut-action';
export const SHORTCUT_ACTION_TAG_RE = /\[\[SHORTCUT_ACTION:\s*([a-zA-Z0-9_-]+)(?:\|([^\]]{0,160}))?\]\]/g;

export const DEFAULT_SHORTCUT_ACTIONS: ShortcutActionRule[] = [
  {
    id: 'phone_lock', name: '禁止玩手机', enabled: false,
    description: '阻止继续刷手机，让用户暂时离开屏幕。',
    triggerCondition: '用户明确要求监督，或有充分依据确认用户玩手机过久时使用。不要因为普通闲聊或一次熬夜就说教。',
    shortcutName: '锁屏', popupText: '不许再玩手机了！！', buttonText: '好的……',
    allowAiMessage: true, blocking: true, cooldownMinutes: 120, dailyLimit: 3,
  },
  {
    id: 'focus_timer', name: '开始番茄钟', enabled: false,
    description: '打开用户的专注计时快捷指令。',
    triggerCondition: '用户说准备学习、请求督促，或双方已经约定到学习时间时使用。',
    shortcutName: '开始番茄钟', popupText: '该学习了。现在就开始。', buttonText: '现在就去',
    allowAiMessage: true, blocking: false, cooldownMinutes: 30, dailyLimit: 8,
  },
  {
    id: 'play_music', name: '播放音乐', enabled: false,
    description: '播放用户预先设置的歌单或音乐。',
    triggerCondition: '气氛适合庆祝、用户主动要求，或播放音乐能自然回应当下情绪时使用。',
    shortcutName: '播放音乐', popupText: '给你放首歌。', buttonText: '一起听',
    allowAiMessage: true, blocking: false, cooldownMinutes: 20, dailyLimit: 10,
  },
];

export function normalizeShortcutActions(rules?: ShortcutActionRule[]): ShortcutActionRule[] {
  if (!Array.isArray(rules)) return [];
  return rules
    .filter(r => r && typeof r.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(r.id))
    .map(r => ({
      ...r,
      enabled: r.enabled !== false,
      blocking: !!r.blocking,
      allowAiMessage: !!r.allowAiMessage,
      cooldownMinutes: Math.max(0, Number(r.cooldownMinutes) || 0),
      dailyLimit: Math.max(0, Number(r.dailyLimit) || 0),
    }));
}

export function buildShortcutActionUrl(rule: ShortcutActionRule): string {
  const explicit = (rule.shortcutUrl || '').trim();
  if (explicit) {
    if (!/^shortcuts:\/\//i.test(explicit)) throw new Error('第一版只允许 shortcuts:// 链接');
    return explicit;
  }
  const name = rule.shortcutName.trim();
  if (!name) throw new Error('请填写快捷指令名称');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

export function getShortcutActionAvailability(
  rule: ShortcutActionRule,
  runtime?: ShortcutActionRuntime,
  now = Date.now(),
): { allowed: boolean; reason?: string } {
  if (!rule.enabled) return { allowed: false, reason: '动作未启用' };
  const today = new Date(now).toISOString().slice(0, 10);
  const todayCount = runtime?.dateKey === today ? (runtime.countToday || 0) : 0;
  if (rule.dailyLimit > 0 && todayCount >= rule.dailyLimit) return { allowed: false, reason: '已达到今日上限' };
  const cooldownMs = rule.cooldownMinutes * 60_000;
  if (cooldownMs > 0 && runtime?.lastTriggeredAt && now - runtime.lastTriggeredAt < cooldownMs) {
    return { allowed: false, reason: '动作仍在冷却中' };
  }
  return { allowed: true };
}

export function recordShortcutActionRuntime(
  runtime: Record<string, ShortcutActionRuntime> | undefined,
  actionId: string,
  now = Date.now(),
): Record<string, ShortcutActionRuntime> {
  const today = new Date(now).toISOString().slice(0, 10);
  const prev = runtime?.[actionId];
  return {
    ...(runtime || {}),
    [actionId]: {
      lastTriggeredAt: now,
      dateKey: today,
      countToday: prev?.dateKey === today ? (prev.countToday || 0) + 1 : 1,
    },
  };
}

export function buildShortcutActionsPrompt(char: CharacterProfile): string {
  const rules = normalizeShortcutActions(char.shortcutActions).filter(r => r.enabled);
  if (rules.length === 0) return '';
  const lines = rules.map(r =>
    `- ID=${r.id}；名称=${r.name}；含义=${r.description || '未填写'}；触发条件=${r.triggerCondition || '仅在用户明确要求时'}；${r.allowAiMessage ? '可在 | 后写一句不超过80字的弹窗台词' : '不要生成弹窗台词'}`
  );
  return `\n\n### 你可以请求的快捷动作\n这些动作由用户预先配置。只有确实满足条件或用户明确要求时才使用；不要为了展示功能而触发。你只能请求下列 ID，不能编造 URL、ID 或修改按钮。每条回复最多请求一个动作。\n${lines.join('\n')}\n格式：[[SHORTCUT_ACTION:动作ID]]；若允许临时台词：[[SHORTCUT_ACTION:动作ID|一句符合你语气的话]]`;
}
