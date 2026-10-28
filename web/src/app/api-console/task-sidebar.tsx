"use client";

import { Bot, ImageIcon, ImagePlus, MessageSquare, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { ActivePanel, StatusFilter, UnifiedTask } from "./types";
import { formatElapsed, statusIcon, statusLabel, statusVariant } from "./utils";

function PanelSwitch({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition",
        active ? "bg-white text-zinc-950 shadow-sm dark:bg-white/15 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function TaskSidebar({
  activePanel,
  selectedTask,
  visibleTasks,
  searchText,
  setSearchText,
  statusFilter,
  setStatusFilter,
  historyEnabled,
  onPanelChange,
  onTaskSelect,
}: {
  activePanel: ActivePanel;
  selectedTask: UnifiedTask | null;
  visibleTasks: UnifiedTask[];
  searchText: string;
  setSearchText: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  historyEnabled: boolean;
  onPanelChange: (panel: ActivePanel) => void;
  onTaskSelect: (task: UnifiedTask) => void;
}) {
  return (
    <aside className="order-last min-w-0 border-t border-zinc-200 pt-4 lg:order-first lg:border-r lg:border-t-0 lg:pt-0 lg:pr-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">任务列表</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {historyEnabled ? "当前用户" : "当前页面会话"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" title="新图片任务" aria-label="新图片任务" variant={activePanel === "image" ? "default" : "outline"} className="size-10 rounded-lg" onClick={() => onPanelChange("image")}>
            <ImagePlus className="size-4" />
          </Button>
          <Button size="icon" title="文本对话" aria-label="文本对话" variant={activePanel === "chat" ? "default" : "outline"} className="size-10 rounded-lg" onClick={() => onPanelChange("chat")}>
            <MessageSquare className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
          <PanelSwitch active={activePanel === "image"} onClick={() => onPanelChange("image")} icon={<ImageIcon className="size-3.5" />} label="生图" />
          <PanelSwitch active={activePanel === "chat"} onClick={() => onPanelChange("chat")} icon={<Bot className="size-3.5" />} label="对话" />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索任务、备注、ID" className="pl-10" />
        </div>
        <div className="grid gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">进行中</SelectItem>
              <SelectItem value="success">已完成</SelectItem>
              <SelectItem value="error">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3 max-h-[180px] overflow-auto pr-1 lg:max-h-[720px]">
        {visibleTasks.length ? (
          visibleTasks.map((task) => {
            const Icon = statusIcon(task.status);
            const active = activePanel === "detail" && selectedTask?.key === task.key;
            return (
              <button
                key={task.key}
                type="button"
                onClick={() => onTaskSelect(task)}
                className={cn(
                  "mb-2 w-full rounded-lg border px-3 py-3 text-left transition",
                  active
                    ? "border-zinc-950 bg-white shadow-sm dark:border-white/50 dark:bg-white/10"
                    : "border-zinc-200 bg-zinc-50/70 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{task.title}</div>
                    <div className="mt-1 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{task.id}</div>
                  </div>
                  <Icon className={cn("size-4 shrink-0", task.status === "success" ? "text-emerald-500" : task.status === "error" ? "text-rose-500" : "text-amber-500")} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={task.category === "image" ? "info" : "violet"}>{task.kindLabel}</Badge>
                  <Badge variant={statusVariant(task.status)}>{statusLabel(task.status)}</Badge>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatElapsed(task.elapsedSeconds)}</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-10 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
            {historyEnabled ? "没有匹配的任务。" : "历史记录已关闭，当前页面暂无临时任务。"}
          </div>
        )}
      </div>
    </aside>
  );
}
