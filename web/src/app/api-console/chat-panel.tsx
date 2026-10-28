import { LoaderCircle, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ChatMessage } from "./types";

export function ChatPanel({
  messages,
  input,
  setInput,
  model,
  setModel,
  isSubmitting,
  onSubmit,
  onClear,
  onCopy,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClear: () => void;
  onCopy: (value: string, message?: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-white">文本对话</h2>
        </div>
        <Badge variant="success">{model}</Badge>
      </div>
      <div className="min-h-[300px] max-h-[520px] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-white/5">
        {messages.length ? (
          <div className="grid gap-3">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[86%] rounded-lg border px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200",
                )}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-[11px] opacity-70">
                    <span>{message.role === "user" ? "你" : "助手"}</span>
                    <button type="button" onClick={() => void onCopy(message.content, "消息已复制")}>复制</button>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            输入内容后开始对话。
          </div>
        )}
      </div>
      <div className="grid gap-3 border-t border-zinc-200 pt-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">模型</span>
          <Input value={model} readOnly />
        </label>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit();
          }}
          className="min-h-28"
          placeholder="输入要生成、改写、分析或总结的内容"
        />
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" className="h-10 rounded-lg" onClick={onClear} disabled={!messages.length}>
            <Trash2 className="size-4" />
            清空记录
          </Button>
          <Button className="h-10 rounded-lg" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
