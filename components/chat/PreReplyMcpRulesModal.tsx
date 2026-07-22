import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../os/Modal';
import type { PreReplyMcpRule, TemporaryPreReplyMcpSession } from '../../types';
import { callMcpTool, loadMcpServers } from '../../utils/mcpClient';
import {
  DEFAULT_PRE_REPLY_MCP_PROMPT,
  normalizePreReplyMcpRules,
  parsePreReplyMcpArguments,
} from '../../utils/preReplyMcp';

interface Props {
  isOpen: boolean;
  rules?: PreReplyMcpRule[];
  sessions?: TemporaryPreReplyMcpSession[];
  onClose: () => void;
  onSave: (rules: PreReplyMcpRule[]) => void;
  onStopSession: (ruleId: string) => void;
}

const newRule = (): PreReplyMcpRule => ({
  id: `pre_mcp_${Date.now()}`,
  name: '回复前检查', activationDescription: '当用户明确要求在一段时间内持续检查这类数据时，可以提议临时开启。', enabled: true, serverId: '', toolName: '', argumentsJson: '{}',
  promptTemplate: DEFAULT_PRE_REPLY_MCP_PROMPT, maxResultChars: 8000,
  minIntervalMinutes: 0, activeTimeStart: '', activeTimeEnd: '', onFailure: 'continue',
});

const PreReplyMcpRulesModal: React.FC<Props> = ({ isOpen, rules, sessions, onClose, onSave, onStopSession }) => {
  const [draft, setDraft] = useState<PreReplyMcpRule[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const servers = useMemo(() => loadMcpServers().filter(server => server.enabled && server.tools?.length), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setDraft(normalizePreReplyMcpRules(rules));
      setPreview('');
    }
  }, [isOpen, rules]);

  const patch = (index: number, value: Partial<PreReplyMcpRule>) =>
    setDraft(previous => previous.map((rule, i) => i === index ? { ...rule, ...value } : rule));

  const testRule = async (rule: PreReplyMcpRule) => {
    try {
      const server = servers.find(item => item.id === rule.serverId);
      if (!server) throw new Error('请选择一个已启用且已发现工具的 MCP 服务器');
      if (!server.tools?.some(tool => tool.name === rule.toolName)) throw new Error('请选择工具');
      const args = parsePreReplyMcpArguments(rule.argumentsJson);
      setTestingId(rule.id); setPreview('正在调用…');
      const result = await callMcpTool(server, rule.toolName, args);
      if (!result.success) throw new Error(result.error || '调用失败');
      const data = result.data ?? result.rawText ?? '';
      setPreview(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch (error: any) {
      setPreview(`❌ ${error?.message || String(error)}`);
    } finally {
      setTestingId(null);
    }
  };

  const save = () => {
    try {
      const ids = new Set<string>();
      for (const rule of draft) {
        if (!rule.id || ids.has(rule.id)) throw new Error('每条规则需要唯一的规则 ID');
        ids.add(rule.id);
        parsePreReplyMcpArguments(rule.argumentsJson);
        if (rule.enabled && (!rule.serverId || !rule.toolName)) throw new Error(`规则“${rule.name}”尚未选择服务器或工具`);
      }
      onSave(normalizePreReplyMcpRules(draft));
      onClose();
    } catch (error: any) { window.alert(error?.message || String(error)); }
  };

  return <Modal isOpen={isOpen} title="回复前自动 MCP" onClose={onClose} footer={<>
    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl">取消</button>
    <button onClick={save} className="flex-1 py-3 bg-violet-500 text-white font-bold rounded-2xl">保存</button>
  </>}>
    <div className="space-y-4">
      <div className="rounded-2xl bg-violet-50 p-3 text-[11px] leading-relaxed text-violet-700">
        打开“永久启用”时，每次你主动触发普通私聊回复都会调用；关闭后规则仍保留，角色可在你口头要求持续监控时提出限时开启，并由你确认。不会伪造用户消息，也不会把原始结果写进聊天记录。自动调用前请确认工具是只读的，或确实允许它自动执行。
      </div>
      {!servers.length && <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-700">还没有可用服务器。请先到“设置 → MCP 工具服务器”添加服务器、测试连接并启用。</div>}
      {(sessions || []).filter(session => session.expiresAt > Date.now()).length > 0 && <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
        <div className="text-xs font-bold text-emerald-700">正在临时监控</div>
        {(sessions || []).filter(session => session.expiresAt > Date.now()).map(session => {
          const activeRule = draft.find(rule => rule.id === session.ruleId);
          return <div key={session.ruleId} className="flex items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
            <div className="min-w-0"><div className="truncate text-xs font-bold text-slate-700">{activeRule?.name || session.ruleId}</div><div className="text-[10px] text-slate-400">到 {new Date(session.expiresAt).toLocaleString()} 自动结束</div></div>
            <button onClick={() => onStopSession(session.ruleId)} className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500">立即停止</button>
          </div>;
        })}
      </div>}
      {draft.map((rule, index) => {
        const server = servers.find(item => item.id === rule.serverId);
        return <section key={rule.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2">
            <input value={rule.name} onChange={event => patch(index, { name: event.target.value })} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold" placeholder="规则名称" />
            <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={rule.enabled} onChange={event => patch(index, { enabled: event.target.checked })}/>永久启用</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={rule.serverId} onChange={event => {
              const next = servers.find(item => item.id === event.target.value);
              patch(index, { serverId: event.target.value, toolName: next?.tools?.[0]?.name || '' });
            }} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs">
              <option value="">选择服务器</option>{servers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={rule.toolName} onChange={event => patch(index, { toolName: event.target.value })} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs">
              <option value="">选择工具</option>{(server?.tools || []).map(tool => <option key={tool.name} value={tool.name}>{tool.name}</option>)}
            </select>
          </div>
          <label className="block text-[10px] font-bold text-slate-500">给角色看的临时开启条件
            <textarea value={rule.activationDescription || ''} onChange={event => patch(index, { activationDescription: event.target.value })} rows={2} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" placeholder="例如：用户要求监督手机使用一段时间时，可以提议开启。" />
          </label>
          {server?.tools?.find(tool => tool.name === rule.toolName)?.description && <p className="text-[10px] leading-relaxed text-slate-400">{server.tools.find(tool => tool.name === rule.toolName)?.description}</p>}
          {server?.tools?.find(tool => tool.name === rule.toolName)?.inputSchema && <details className="rounded-xl bg-white px-3 py-2 text-[10px] text-slate-500">
            <summary className="cursor-pointer font-bold">查看工具参数格式</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">{JSON.stringify(server.tools.find(tool => tool.name === rule.toolName)?.inputSchema, null, 2)}</pre>
          </details>}
          <label className="block text-[10px] font-bold text-slate-500">工具参数（JSON 对象）
            <textarea value={rule.argumentsJson} onChange={event => patch(index, { argumentsJson: event.target.value })} rows={4} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" placeholder={'{"hours": 6, "type": "app.open"}'} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold text-slate-500">每日开始（可选）<input type="time" value={rule.activeTimeStart || ''} onChange={event => patch(index, { activeTimeStart: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-bold text-slate-500">每日结束（可选）<input type="time" value={rule.activeTimeEnd || ''} onChange={event => patch(index, { activeTimeEnd: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs" /></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] font-bold text-slate-500">间隔(分钟)<input type="number" min="0" value={rule.minIntervalMinutes} onChange={event => patch(index, { minIntervalMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-bold text-slate-500">最大字符<input type="number" min="500" max="30000" value={rule.maxResultChars} onChange={event => patch(index, { maxResultChars: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-bold text-slate-500">失败时<select value={rule.onFailure} onChange={event => patch(index, { onFailure: event.target.value as 'continue' | 'abort' })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-1 py-2 text-xs"><option value="continue">继续</option><option value="abort">中止</option></select></label>
          </div>
          <label className="block text-[10px] font-bold text-slate-500">给角色的提示词
            <textarea value={rule.promptTemplate} onChange={event => patch(index, { promptTemplate: event.target.value })} rows={6} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed" />
            <span className="mt-1 block font-normal text-slate-400">可用：{'{{result}}'} {'{{server}}'} {'{{tool}}'} {'{{time}}'}</span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => void testRule(rule)} disabled={testingId === rule.id} className="flex-1 rounded-xl bg-violet-100 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">{testingId === rule.id ? '测试中…' : '测试调用'}</button>
            <button onClick={() => setDraft(previous => previous.filter((_, i) => i !== index))} className="rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-500">删除</button>
          </div>
        </section>;
      })}
      {preview && <div><div className="mb-1 text-[10px] font-bold text-slate-500">最近一次测试结果</div><pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-slate-900 p-3 text-[10px] text-emerald-300">{preview}</pre></div>}
      <button onClick={() => setDraft(previous => [...previous, newRule()])} className="w-full rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600">＋ 新建自动规则</button>
    </div>
  </Modal>;
};

export default PreReplyMcpRulesModal;
