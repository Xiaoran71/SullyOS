import React, { useEffect, useState } from 'react';
import { CharacterProfile, PendingShortcutAction, ShortcutActionRule } from '../../types';

interface Props {
  char: CharacterProfile;
  pending: PendingShortcutAction;
  rule: ShortcutActionRule;
  onRun: () => void;
  onEmergencyUnlock: () => void;
}

const ShortcutActionOverlay: React.FC<Props> = ({ char, pending, rule, onRun, onEmergencyUnlock }) => {
  const [canUnlock, setCanUnlock] = useState(!rule.blocking);
  useEffect(() => {
    setCanUnlock(!rule.blocking);
    if (!rule.blocking) return;
    const elapsed = Date.now() - pending.createdAt;
    const timer = window.setTimeout(() => setCanUnlock(true), Math.max(0, 10_000 - elapsed));
    return () => window.clearTimeout(timer);
  }, [pending.createdAt, rule.blocking]);

  return <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
    <div className="w-full max-w-sm rounded-[2.5rem] bg-white p-7 shadow-2xl text-center border border-white/30">
      <div className="mx-auto mb-4 w-16 h-16 rounded-full overflow-hidden bg-amber-100 flex items-center justify-center text-3xl">
        {char.avatar ? <img src={char.avatar} className="w-full h-full object-cover" alt="" /> : '⚡'}
      </div>
      <p className="text-xs font-bold text-amber-600 mb-2">{rule.name}</p>
      <h2 className="text-xl font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{pending.message || rule.popupText || '要现在执行吗？'}</h2>
      {rule.blocking && <p className="mt-3 text-[11px] text-slate-400">完成这个动作后才能继续聊天</p>}
      <button onClick={onRun} className="mt-6 w-full py-4 rounded-2xl bg-amber-500 text-white font-bold shadow-lg active:scale-95 transition-transform">
        {rule.buttonText || '执行'}
      </button>
      {canUnlock && <button onClick={onEmergencyUnlock} className="mt-3 text-[10px] text-slate-400 underline underline-offset-2">
        快捷指令没有打开？解除锁定
      </button>}
    </div>
  </div>;
};

export default ShortcutActionOverlay;
