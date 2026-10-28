import { Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { ImageResultGrid } from "./image-results";
import type { ImageTask } from "./types";
import { imageModeLabel, imageTaskTitle, statusLabel, statusVariant, taskIdOf } from "./utils";

export function ImageTaskCard({
  task,
  baseUrl,
  onSelect,
  onCopy,
}: {
  task: ImageTask;
  baseUrl: string;
  onSelect: () => void;
  onCopy: (value: string, message?: string) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{imageModeLabel(task.mode)}</Badge>
            <Badge variant={statusVariant(task.status)}>{statusLabel(task.status)}</Badge>
            {task.progress ? <Badge variant="outline">{task.progress}</Badge> : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-white">{imageTaskTitle(task)}</p>
          <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{taskIdOf(task)}</p>
        </button>
        <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => void onCopy(taskIdOf(task), "任务 ID 已复制")}>
          <Copy className="size-4" />
        </Button>
      </div>
      <ImageResultGrid task={task} baseUrl={baseUrl} compact onCopy={onCopy} />
    </div>
  );
}
