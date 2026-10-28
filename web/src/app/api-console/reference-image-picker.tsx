import { Images, Trash2 } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

import { Button } from "@/components/ui/button";

import type { ReferenceImage } from "./types";
import { formatSize } from "./utils";

export function ReferenceImagePicker({
  title,
  description,
  references,
  inputRef,
  onAdd,
  onRemove,
  onClear,
}: {
  title: string;
  description: string;
  references: ReferenceImage[];
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-zinc-200 pt-4">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="参考图片文件" multiple className="hidden" onChange={onAdd} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{title}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <div className="flex gap-2">
          {references.length ? (
            <Button variant="ghost" className="h-10 rounded-lg" onClick={onClear}>
              清空
            </Button>
          ) : null}
          <Button variant="outline" className="h-10 rounded-lg" onClick={() => inputRef.current?.click()}>
            <Images className="size-4" />
            添加图片
          </Button>
        </div>
      </div>
      {references.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {references.map((item, index) => (
            <div key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg border border-zinc-200 bg-white/80 p-2 dark:border-white/10 dark:bg-zinc-950/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt={item.file.name || `参考图 ${index + 1}`} className="size-14 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.file.name}</p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  参考图 {index + 1} · {formatSize(item.file.size)}
                </p>
              </div>
              <Button variant="ghost" size="icon" title="移除参考图片" aria-label={`移除参考图 ${index + 1}`} className="size-8 rounded-lg text-zinc-400 hover:text-rose-600" onClick={() => onRemove(item.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
