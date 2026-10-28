import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatMessage, ReferenceImage, UserSession } from "./types";
import { readImageFile } from "./utils";

function revokeReferenceImages(items: ReferenceImage[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}

export function useReferenceImages() {
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const generation = useRef(0);

  useEffect(() => {
    referencesRef.current = references;
  }, [references]);

  useEffect(() => {
    return () => revokeReferenceImages(referencesRef.current);
  }, []);

  const addReferenceImages = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const epoch = generation.current;
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!imageFiles.length) {
      if (files.length) toast.error("请选择图片文件");
      return;
    }
    if (imageFiles.length + referencesRef.current.length > 8 || imageFiles.some(file => file.size > 12 * 1024 * 1024) || [...referencesRef.current.map(item => item.file), ...imageFiles].reduce((total, file) => total + file.size, 0) > 24 * 1024 * 1024) {
      toast.error("最多 8 张参考图，单张不超过 12 MiB，总计不超过 24 MiB");
      return;
    }
    try {
      const nextImages = await Promise.all(imageFiles.map(readImageFile));
      if (epoch !== generation.current) {
        revokeReferenceImages(nextImages);
        return;
      }
      setReferences((current) => [...current, ...nextImages]);
      if (imageFiles.length !== files.length) toast.warning("已忽略非图片文件");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片读取失败");
    }
  }, []);

  const removeReferenceImage = useCallback((id: string) => {
    setReferences((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const clearReferenceImages = useCallback(() => {
    generation.current++;
    referencesRef.current = [];
    setReferences((current) => {
      revokeReferenceImages(current);
      return [];
    });
  }, []);

  return {
    references,
    inputRef,
    addReferenceImages,
    removeReferenceImage,
    clearReferenceImages,
  };
}

export function useSessionChat(session: UserSession | null) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setChatMessages([]);
  }, [session?.key]);
  return { chatMessages, setChatMessages };
}
