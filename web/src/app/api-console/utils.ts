import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { ImageTask, ReferenceImage, TaskCategory, UnifiedTask } from "./types";

export function taskIdOf(task: ImageTask | null | undefined) {
  return String(task?.id || "").trim();
}

export function taskKey(category: TaskCategory, id: string) {
  return `${category}:${id}`;
}

export function taskEndpoint() { return "/v1/tasks"; }
export function isRunningStatus(status?: string) { return status === "queued" || status === "running"; }
export function statusLabel(status?: string) {
  return ({ queued: "排队中", running: "生成中", success: "已完成", error: "失败" } as Record<string, string>)[status || ""] || status || "未知";
}
export function statusVariant(status?: string): "success" | "warning" | "danger" | "outline" {
  return status === "success" ? "success" : isRunningStatus(status) ? "warning" : status === "error" ? "danger" : "outline";
}
export function statusIcon(status?: string) { return status === "success" ? CheckCircle2 : status === "error" ? XCircle : Clock3; }
export function formatElapsed(seconds?: number) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  return `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, "0")}s`;
}
export function imageModeLabel(mode?: string) { return mode === "chat" ? "对话" : mode === "edit" ? "图生图" : "文生图"; }
export function imageTaskTitle(task: ImageTask) { return (task.title || task.prompt_preview || `${imageModeLabel(task.mode)}任务`).trim().slice(0, 80); }
export function createId(prefix = "id") { return `${prefix}-${crypto.randomUUID()}`; }
export function createClientTaskId(kind: string) { return createId(kind); }
export function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
export async function readImageFile(file: File): Promise<ReferenceImage> {
  return { id: createId("reference"), file, previewUrl: URL.createObjectURL(file) };
}
export function parseError(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (typeof (data as { error?: unknown }).error === "string") return String((data as { error: string }).error);
  }
  return fallback;
}
export function buildUnifiedTasks(imageTasks: ImageTask[]): UnifiedTask[] {
  return imageTasks.map(task => ({
    key: taskKey("image", taskIdOf(task)), id: taskIdOf(task), category: "image" as const,
    status: task.status, kindLabel: imageModeLabel(task.mode), title: imageTaskTitle(task),
    prompt: task.prompt_preview, note: task.note, createdAt: task.created_at,
    updatedAt: task.updated_at, elapsedSeconds: task.elapsed_secs, raw: task,
  })).filter(task => task.id).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}
