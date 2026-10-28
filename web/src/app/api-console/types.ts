export type ImageTaskMode = "generate" | "edit";
export type TaskStatus = "queued" | "running" | "success" | "error" | string;
export type ActivePanel = "image" | "chat" | "detail" | "downloads" | "settings";
export type TaskCategory = "image";
export type StatusFilter = "all" | "active" | "success" | "error";

export type ImageTask = {
  text?: string;
  id?: string;
  status?: TaskStatus;
  mode?: ImageTaskMode | string;
  model?: string;
  size?: string;
  quality?: string;
  title?: string;
  note?: string;
  prompt_preview?: string;
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  usage?: Record<string, unknown>;
  error?: string;
  progress?: string;
  elapsed_secs?: number;
  duration_ms?: number;
  created_at?: string;
  updated_at?: string;
};

export type UnifiedTask = {
  key: string;
  id: string;
  category: TaskCategory;
  status?: TaskStatus;
  kindLabel: string;
  title: string;
  prompt?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  elapsedSeconds?: number;
  raw: ImageTask;
};

export type UserSession = {
  baseUrl: string;
  key: string;
  historyEnabled: boolean;
  role?: "admin" | "user";
  name?: string;
  providerConfigured?: boolean;
  imageModel?: string;
  chatModel?: string;
};

export type ReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
