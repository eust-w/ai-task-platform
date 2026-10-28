"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "./client";
import type { UserSession } from "./types";

type UserKey = { id: string; name: string; enabled: boolean; daily_quota: number; concurrency_limit: number; min_interval_seconds: number; daily_usage_count: number };

function KeyRow({ item, session, refresh }: { item: UserKey; session: UserSession; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function change(remove = false) {
    setBusy(true);
    try {
      const { name, enabled, daily_quota, concurrency_limit, min_interval_seconds } = draft;
      await requestJson(session, `/v1/admin/keys/${item.id}`, { method: remove ? "DELETE" : "PATCH", body: remove ? undefined : JSON.stringify({ name, enabled, daily_quota, concurrency_limit, min_interval_seconds }) });
      await refresh();
      toast.success(remove ? "密钥已删除" : "密钥设置已保存");
    } catch (error) { toast.error(error instanceof Error ? error.message : "操作失败"); }
    finally { setBusy(false); }
  }
  return <div className="grid items-end gap-3 border-b border-zinc-200 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(130px,1fr)_90px_90px_110px_70px_auto]">
    <label className="grid gap-1 text-xs text-zinc-500">名称<Input value={draft.name} maxLength={80} onChange={e => setDraft({ ...draft, name: e.target.value })} /><span>今日 {item.daily_usage_count} 次</span></label>
    <label className="grid gap-1 text-xs text-zinc-500">每日额度<Input type="number" min={1} max={10000} value={draft.daily_quota} onChange={e => setDraft({ ...draft, daily_quota: Number(e.target.value) })} /></label>
    <label className="grid gap-1 text-xs text-zinc-500">并发数<Input type="number" min={1} max={8} value={draft.concurrency_limit} onChange={e => setDraft({ ...draft, concurrency_limit: Number(e.target.value) })} /></label>
    <label className="grid gap-1 text-xs text-zinc-500">间隔（秒）<Input type="number" min={0} max={3600} value={draft.min_interval_seconds} onChange={e => setDraft({ ...draft, min_interval_seconds: Number(e.target.value) })} /></label>
    <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />启用</label>
    <div className="flex gap-1"><Button variant="outline" size="icon" title="保存密钥设置" aria-label="保存密钥设置" disabled={busy} onClick={() => void change()}><Save className="size-4" /></Button><Button variant="ghost" size="icon" title="删除密钥" aria-label="删除密钥" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4 text-rose-600" /></Button></div>
    {confirmDelete ? <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-2 xl:col-span-6"><span>永久删除“{item.name}”？现有 Key 将立即失效。</span><Button variant="destructive" size="sm" disabled={busy} onClick={() => void change(true)}>确认删除</Button><Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>取消</Button></div> : null}
  </div>;
}

export function SettingsPanel({ session, onHistoryChange }: { session: UserSession; onHistoryChange: (enabled: boolean) => void }) {
  const [keys, setKeys] = useState<UserKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { const result = await requestJson<{ items: UserKey[] }>(session, "/v1/admin/keys"); setKeys(result.items); }, [session]);
  useEffect(() => { void refresh().catch(error => toast.error(error.message)); }, [refresh]);
  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try { const result = await requestJson<{ key: string }>(session, "/v1/admin/keys", { method: "POST", body: JSON.stringify({ name: name.trim() }) }); setNewKey(result.key); setName(""); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "创建失败"); }
    finally { setBusy(false); }
  }
  async function history(enabled: boolean) {
    try { await requestJson(session, "/v1/admin/settings", { method: "PATCH", body: JSON.stringify({ history_enabled: enabled }) }); onHistoryChange(enabled); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); }
  }
  return <div className="grid gap-8"><section className="border-b border-zinc-200 pb-6"><h2 className="mb-4 text-xl font-semibold">运行设置</h2><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">图片模型</dt><dd className="mt-1 font-mono">{session.imageModel}</dd></div><div><dt className="text-zinc-500">对话模型</dt><dd className="mt-1 font-mono">{session.chatModel}</dd></div></dl><label className="mt-6 flex items-center gap-3 text-sm"><input type="checkbox" checked={session.historyEnabled} onChange={e => void history(e.target.checked)} />启用历史记录</label></section><section><h2 className="text-xl font-semibold">用户密钥</h2><div className="mt-4 flex gap-2"><Input placeholder="新密钥名称" aria-label="新密钥名称" value={name} maxLength={80} onChange={e => setName(e.target.value)} className="max-w-xs" /><Button disabled={busy || !name.trim()} onClick={() => void create()}><Plus className="size-4" />创建</Button></div>{newKey ? <div className="my-4 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3"><label className="min-w-0 flex-1 text-sm">新密钥（仅显示一次）<Input type="password" readOnly value={newKey} autoComplete="off" /></label><Button variant="outline" title="复制新密钥" onClick={() => { void navigator.clipboard.writeText(newKey).then(() => toast.success("已复制")); }}><Copy className="size-4" />复制</Button><Button size="icon" variant="ghost" title="关闭新密钥" aria-label="关闭新密钥" onClick={() => setNewKey("")}><X className="size-4" /></Button></div> : null}<div className="mt-3">{keys.map(item => <KeyRow key={item.id} item={item} session={session} refresh={refresh} />)}{!keys.length ? <p className="py-10 text-sm text-zinc-500">暂无用户密钥</p> : null}</div></section></div>;
}
