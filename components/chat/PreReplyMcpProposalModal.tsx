import React from 'react';
import Modal from '../os/Modal';
import type { CharacterProfile, PreReplyMcpRule } from '../../types';

interface Props {
  char: CharacterProfile;
  rule: PreReplyMcpRule;
  durationMinutes: number;
  message?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} 分钟`;
  if (minutes % 1440 === 0) return `${minutes / 1440} 天`;
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
};

const PreReplyMcpProposalModal: React.FC<Props> = ({ char, rule, durationMinutes, message, onConfirm, onClose }) => (
  <Modal isOpen title="临时监控确认" onClose={onClose} footer={<>
    <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 py-3 font-bold text-slate-500">暂不开启</button>
    <button onClick={onConfirm} className="flex-1 rounded-2xl bg-violet-500 py-3 font-bold text-white">确认开启</button>
  </>}>
    <div className="space-y-4 text-center">
      <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-violet-100">
        {char.avatar ? <img src={char.avatar} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">🔌</div>}
      </div>
      <div>
        <div className="text-lg font-bold text-slate-800">{char.name} 想临时开启</div>
        <div className="mt-1 text-xl font-black text-violet-600">{rule.name}</div>
      </div>
      {message && <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">“{message}”</p>}
      <div className="grid grid-cols-2 gap-2 text-left text-xs">
        <div className="rounded-2xl bg-violet-50 p-3"><div className="text-[10px] text-violet-400">持续时间</div><div className="mt-1 font-bold text-violet-700">{formatDuration(durationMinutes)}</div></div>
        <div className="rounded-2xl bg-violet-50 p-3"><div className="text-[10px] text-violet-400">自动工具</div><div className="mt-1 truncate font-bold text-violet-700">{rule.toolName}</div></div>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-400">确认后，在有效期内每次你主动触发普通私聊回复时都会使用这条规则。到期自动停止，你也可以随时在“自动 MCP”中手动结束。</p>
    </div>
  </Modal>
);

export default PreReplyMcpProposalModal;
