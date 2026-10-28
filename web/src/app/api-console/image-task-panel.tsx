import { LoaderCircle, Sparkles } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { ImageTaskCard } from "./image-task-card";
import { ReferenceImagePicker } from "./reference-image-picker";
import type { ImageTask, ImageTaskMode, ReferenceImage } from "./types";
import { taskIdOf } from "./utils";

export function ImageTaskPanel({
  imageMode,
  setImageMode,
  imagePrompt,
  setImagePrompt,
  imageModel,
  setImageModel,
  imageSize,
  setImageSize,
  imageQuality,
  setImageQuality,
  references,
  inputRef,
  onAdd,
  onRemove,
  onClear,
  onSubmit,
  isSubmitting,
  tasks,
  baseUrl,
  onSelectTask,
  onCopy,
}: {
  imageMode: ImageTaskMode;
  setImageMode: (value: ImageTaskMode) => void;
  imagePrompt: string;
  setImagePrompt: (value: string) => void;
  imageModel: string;
  setImageModel: (value: string) => void;
  imageSize: string;
  setImageSize: (value: string) => void;
  imageQuality: string;
  setImageQuality: (value: string) => void;
  references: ReferenceImage[];
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  tasks: ImageTask[];
  baseUrl: string;
  onSelectTask: (task: ImageTask) => void;
  onCopy: (value: string, message?: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">图片创作</h2>
        </div>
        <Badge variant="info">{imageMode === "edit" ? "参考图编辑" : "文本生成图片"}</Badge>
      </div>
      <div className="grid gap-4 border-b border-zinc-200 pb-5">
        <div className="grid gap-3 lg:grid-cols-[160px_1fr_150px_130px]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">模式</span>
            <Select value={imageMode} onValueChange={(value) => setImageMode(value as ImageTaskMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generate">文生图</SelectItem>
                <SelectItem value="edit">图生图</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">模型</span>
            <Input value={imageModel} readOnly />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">尺寸</span>
            <Select value={imageSize} onValueChange={setImageSize}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动</SelectItem>
                <SelectItem value="1024x1024">1024x1024</SelectItem>
                <SelectItem value="1024x1536">1024x1536</SelectItem>
                <SelectItem value="1536x1024">1536x1024</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">质量</span>
            <Select value={imageQuality} onValueChange={setImageQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto</SelectItem>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="high">high</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">提示词</span>
          <Textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} className="min-h-36" placeholder="描述画面主体、风格、比例、光线、背景和输出要求" />
        </label>
        {imageMode === "edit" ? <ReferenceImagePicker
          title="参考图片"
          description="PNG / JPEG / WebP · 最多 8 张 · 合计 24 MiB"
          references={references}
          inputRef={inputRef}
          onAdd={onAdd}
          onRemove={onRemove}
          onClear={onClear}
        /> : null}
        <Button onClick={onSubmit} disabled={isSubmitting} className="h-11 rounded-lg">
          {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          提交图片任务
        </Button>
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">最近图片任务</h3>
          <Badge variant="outline">{tasks.length}</Badge>
        </div>
        {tasks.length ? (
          tasks.slice(0, 8).map((task) => (
            <ImageTaskCard
              key={taskIdOf(task)}
              task={task}
              baseUrl={baseUrl}
              onSelect={() => onSelectTask(task)}
              onCopy={onCopy}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-10 text-center text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
            还没有图片任务。
          </div>
        )}
      </div>
    </div>
  );
}
