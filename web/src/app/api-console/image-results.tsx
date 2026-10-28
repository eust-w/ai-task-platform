"use client";

import { useEffect, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { artifactBlob } from "./client";
import { useSession } from "./session-context";
import type { ImageTask } from "./types";
import { isRunningStatus, taskIdOf } from "./utils";

function ProtectedImage({ path, filename }: { path: string; filename: string }) {
  const session = useSession();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let objectUrl = "";
    void artifactBlob(session, path, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [session, path]);
  return <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-2">
    {url ? <img src={url} alt="生成结果" className="aspect-square w-full rounded-md object-contain" /> : <div className="flex aspect-square items-center justify-center text-sm text-zinc-500">{error || <LoaderCircle className="size-5 animate-spin" />}</div>}
    <Button asChild size="sm" className="mt-2" disabled={!url}>
      <a href={url || undefined} download={filename} aria-disabled={!url}><Download className="size-4" />下载 PNG</a>
    </Button>
  </div>;
}

export function ImageResultGrid({ task }: { task: ImageTask; baseUrl?: string; compact?: boolean; onCopy?: (value: string, message?: string) => void }) {
  if (task.mode === "chat") return <p className="whitespace-pre-wrap break-words text-sm leading-7">{task.text || "此会话未保留文本内容"}</p>;
  if (!task.data?.length) return <div className="py-8 text-center text-sm text-zinc-500">{isRunningStatus(task.status) ? "等待生成结果" : "暂无图片结果"}</div>;
  return <div className="grid gap-3 sm:grid-cols-2">{task.data.map((item, index) => <ProtectedImage key={item.url} path={item.url || ""} filename={`image-${taskIdOf(task)}-${index + 1}.png`} />)}</div>;
}
