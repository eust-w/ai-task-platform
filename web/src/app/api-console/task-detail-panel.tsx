import { Copy, LoaderCircle, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ImageResultGrid } from "./image-results";
import type { ImageTask, UnifiedTask } from "./types";
import { formatElapsed, statusLabel, statusVariant } from "./utils";

export function TaskDetailPanel({
  task,
  baseUrl,
  titleDraft,
  setTitleDraft,
  noteDraft,
  setNoteDraft,
  isSaving,
  onSave,
  onDelete,
  onCopy,
}: {
  task: UnifiedTask;
  baseUrl: string;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onDelete: () => void;
  onCopy: (value: string, message?: string) => void;
}) {
  const imageTask = task.category === "image" ? task.raw as ImageTask : null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={task.category === "image" ? "info" : "violet"}>{task.kindLabel}</Badge>
            <Badge variant={statusVariant(task.status)}>{statusLabel(task.status)}</Badge>
            <Badge variant="outline">{formatElapsed(task.elapsedSeconds)}</Badge>
          </div>
          <h2 className="truncate text-xl font-semibold text-zinc-950 dark:text-white">{task.title}</h2>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">{task.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-lg" onClick={() => void onCopy(task.id, "任务 ID 已复制")}>
            <Copy className="size-4" />
            复制 ID
          </Button>
          <Button variant="ghost" className="h-10 rounded-lg text-rose-600 hover:text-rose-700" onClick={onDelete}>
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">标题</span>
          <Input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} maxLength={120} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">更新时间</span>
          <Input value={task.updatedAt || task.createdAt || ""} readOnly />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">备注</span>
        <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} className="min-h-24" maxLength={1000} placeholder="记录客户、用途、修改意见或交付状态" />
      </label>
      <Button onClick={onSave} disabled={isSaving} className="h-10 w-fit rounded-lg">
        {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
        保存任务信息
      </Button>

      {task.prompt ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">任务说明</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600 dark:text-zinc-300">{task.prompt}</p>
        </div>
      ) : null}

      {task.raw.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {task.raw.error}
        </div>
      ) : null}

      {imageTask ? (
        <div className="grid gap-3">
          <ImageResultGrid task={imageTask} baseUrl={baseUrl} onCopy={onCopy} />
        </div>
      ) : null}

    </div>
  );
}
