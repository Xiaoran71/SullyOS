import React, { useEffect, useState } from 'react';
import Modal from '../os/Modal';
import { ShortcutActionRule } from '../../types';
import { DEFAULT_SHORTCUT_ACTIONS, buildShortcutActionUrl, normalizeShortcutActions } from '../../utils/shortcutActions';

interface Props {
  isOpen: boolean;
  rules?: ShortcutActionRule[];
  onClose: () => void;
  onSave: (rules: ShortcutActionRule[]) => void;
  onTest: (rule: ShortcutActionRule) => void;
}

const blankRule = (): ShortcutActionRule => ({
  id: `action_${Date.now()}`, name: '新动作', enabled: true,
  description: '', triggerCondition: '仅在用户明确要求时使用。',
  shortcutName: '', popupText: '要现在执行吗？', buttonText: '执行',
  allowAiMessage: true, blocking: false, cooldownMinutes: 30, dailyLimit: 5,
});

const ShortcutActionsModal: React.FC<Props> = ({ isOpen, rules, onClose, onSave, onTest }) => {
  const [draft, setDraft] = useState<ShortcutActionRule[]>([]);
  useEffect(() => { if (isOpen) setDraft(normalizeShortcutActions(rules)); }, [isOpen, rules]);
  const patch = (idx: number, updates: Partial<ShortcutActionRule>) => setDraft(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));

  return <Modal
    isOpen={isOpen}
    title="快捷动作"
    onClose={onClose}
    footer={<>
      <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl">取消</button>
      <button onClick={() => { onSave(normalizeShortcutActions(draft)); onClose(); }} className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-2xl">保存</button>
    </>}
  >
    <div className="space-y-4">
      <p className="text-[11px] text-slate-500 leading-relaxed">角色只能请求你在这里启用的动作 ID。真正的快捷指令链接只会在你点击弹窗按钮后打开。</p>
      {draft.length === 0 && <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-400 text-center">还没有动作规则</div>}
      {draft.map((rule, idx) => <div key={rule.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex items-center gap-2">
          <input value={rule.name} onChange={e => patch(idx, { name: e.target.value })} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold" placeholder="动作名称" />
          <label className="text-[11px] text-slate-500 flex items-center gap-1"><input type="checkbox" checked={rule.enabled} onChange={e => patch(idx, { enabled: e.target.checked })}/>启用</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={rule.id} onChange={e => patch(idx, { id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="动作 ID" />
          <input value={rule.shortcutName} onChange={e => patch(idx, { shortcutName: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" placeholder="快捷指令名称" />
        </div>
        <textarea value={rule.description} onChange={e => patch(idx, { description: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none" rows={2} placeholder="给角色看的动作说明" />
        <textarea value={rule.triggerCondition} onChange={e => patch(idx, { triggerCondition: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none" rows={3} placeholder="触发条件与不应触发的情况" />
        <input value={rule.shortcutUrl || ''} onChange={e => patch(idx, { shortcutUrl: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" placeholder="可选：完整 shortcuts:// 链接" />
        <div className="grid grid-cols-2 gap-2">
          <input value={rule.popupText} onChange={e => patch(idx, { popupText: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" placeholder="固定弹窗文字" />
          <input value={rule.buttonText} onChange={e => patch(idx, { buttonText: e.target.value })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs" placeholder="按钮文字" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-slate-500">冷却（分钟）<input type="number" min="0" value={rule.cooldownMinutes} onChange={e => patch(idx, { cooldownMinutes: Number(e.target.value) })} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2" /></label>
          <label className="text-[11px] text-slate-500">每日上限（0=不限）<input type="number" min="0" value={rule.dailyLimit} onChange={e => patch(idx, { dailyLimit: Number(e.target.value) })} className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2" /></label>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
          <label><input type="checkbox" checked={!!rule.allowAiMessage} onChange={e => patch(idx, { allowAiMessage: e.target.checked })}/> 允许角色临时写弹窗台词</label>
          <label><input type="checkbox" checked={rule.blocking} onChange={e => patch(idx, { blocking: e.target.checked })}/> 不执行就锁住聊天</label>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { try { buildShortcutActionUrl(rule); onTest(rule); } catch (e: any) { alert(e.message); } }} className="flex-1 py-2 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold">测试弹窗</button>
          <button onClick={() => setDraft(prev => prev.filter((_, i) => i !== idx))} className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold">删除</button>
        </div>
      </div>)}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setDraft(prev => [...prev, blankRule()])} className="py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">＋ 新建动作</button>
        <button onClick={() => setDraft(DEFAULT_SHORTCUT_ACTIONS.map(r => ({ ...r })))} className="py-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">载入三个示例</button>
      </div>
    </div>
  </Modal>;
};

export default ShortcutActionsModal;
