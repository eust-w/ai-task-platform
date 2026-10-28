"use client";

import { Layers3, ImagePlus, MessageSquare, Download, Settings, LogOut, RefreshCw, KeyRound, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActivePanel, UnifiedTask, UserSession } from "./types";

export type ConsoleStats = { total: number; active: number; success: number; failed: number };

export function LoginView({ loginKey, setLoginKey, isLoggingIn, onLogin }: {
  loginKey: string; setLoginKey: (value: string) => void; isLoggingIn: boolean; onLogin: () => void;
}) {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
    <Layers3 className="mb-6 size-10 text-teal-700" />
    <h1 className="text-3xl font-semibold">AI任务平台</h1>
    <p className="mt-2 text-sm text-zinc-500">AI Task Platform <span className="ml-2 text-xs">Alpha</span></p>
    <form className="mt-10 grid gap-5" onSubmit={event => { event.preventDefault(); onLogin(); }}>
      <label className="grid gap-2 text-sm font-medium">平台 API Key<Input type="password" value={loginKey} onChange={event => setLoginKey(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Button type="submit" disabled={isLoggingIn} className="h-11 bg-teal-700 hover:bg-teal-800">{isLoggingIn ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}登录工作台</Button>
    </form>
    <div className="mt-10 flex items-center justify-between border-t border-zinc-200 pt-4 text-xs text-zinc-500"><span>Self-hosted · MIT</span><a href="https://github.com/eust-w/ai-task-platform" target="_blank" rel="noreferrer">GitHub</a></div>
  </main>;
}

export function DashboardHeader({ session, stats, isRefreshing, historyEnabled, onRefresh, onLogout, activePanel, onPanelChange }: {
  session: UserSession; stats: ConsoleStats; isRefreshing: boolean; historyEnabled: boolean;
  onRefresh: () => void; onLogout: () => void; activePanel: ActivePanel; onPanelChange: (value: ActivePanel) => void;
}) {
  const tabs: Array<[ActivePanel, string, typeof ImagePlus]> = [["image", "图片创作", ImagePlus], ["chat", "文本对话", MessageSquare], ["downloads", "下载管理", Download]];
  if (session.role === "admin") tabs.push(["settings", "设置", Settings]);
  return <header className="border-b border-zinc-200">
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="flex items-center gap-3"><Layers3 className="size-6 text-teal-700" /><h1 className="text-xl font-semibold">AI任务平台</h1><span className="text-xs text-zinc-500">Alpha</span></div>
      <div className="flex items-center gap-3 text-xs text-zinc-500"><span>{session.role === "admin" ? "管理员" : session.name}</span><Button variant="ghost" size="icon" title="刷新任务" aria-label="刷新任务" onClick={onRefresh} disabled={isRefreshing}><RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} /></Button><Button variant="ghost" size="icon" title="退出登录" aria-label="退出登录" onClick={onLogout}><LogOut className="size-4" /></Button></div>
    </div>
    <nav className="flex flex-wrap gap-1" aria-label="工作区">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => onPanelChange(id)} aria-current={activePanel === id ? "page" : undefined} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${activePanel === id ? "border-teal-700 font-medium text-teal-800" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}><Icon className="size-4" />{label}</button>)}</nav>
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 py-3 text-xs text-zinc-500"><span>全部 {stats.total}</span><span>进行中 {stats.active}</span><span className="text-teal-700">完成 {stats.success}</span><span className="text-rose-600">失败 {stats.failed}</span><span className="ml-auto">历史记录{historyEnabled ? "开启" : "关闭"}</span><span className={session.providerConfigured ? "text-teal-700" : "text-amber-700"}>{session.providerConfigured ? "API 已配置" : "API 未配置"}</span></div>
  </header>;
}

export function DeleteTaskDialog({ task, onCancel, onConfirm }: { task: UnifiedTask | null; onCancel: () => void; onConfirm: () => void }) {
  return <Dialog open={!!task} onOpenChange={open => { if (!open) onCancel(); }}><DialogContent><DialogHeader><DialogTitle>删除任务及生成文件？</DialogTitle><DialogDescription>此操作不可撤销。正在执行的任务需等待结束后再删除。</DialogDescription></DialogHeader><p className="break-words text-sm">{task?.title}</p><DialogFooter><Button variant="outline" onClick={onCancel}>取消</Button><Button variant="destructive" onClick={onConfirm}>确认删除</Button></DialogFooter></DialogContent></Dialog>;
}
