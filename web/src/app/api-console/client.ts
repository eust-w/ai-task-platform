import type { UserSession } from "./types";
import { parseError } from "./utils";

export function trustedUrl(session: UserSession, path: string): string {
  const url = new URL(path, window.location.origin);
  if (!path.startsWith("/v1/") || url.origin !== window.location.origin || session.baseUrl !== window.location.origin) {
    throw new Error("拒绝向其他站点发送登录凭据");
  }
  return url.toString();
}

export async function requestJson<T>(session: UserSession, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.key}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(trustedUrl(session, path), { ...init, headers, cache: "no-store", redirect: "error" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("atp-session-expired"));
    throw new Error(parseError(data, `HTTP ${response.status}`));
  }
  return data as T;
}

export function requestForm<T>(session: UserSession, path: string, formData: FormData): Promise<T> {
  return requestJson<T>(session, path, { method: "POST", body: formData });
}

export async function verifyUserSession(session: UserSession) {
  const data = await requestJson<{ role: "admin" | "user"; name: string; history_enabled: boolean; provider_configured: boolean; image_model: string; chat_model: string }>(session, "/v1/session");
  return { role: data.role, name: data.name, historyEnabled: data.history_enabled,
    providerConfigured: data.provider_configured, imageModel: data.image_model, chatModel: data.chat_model };
}

export async function artifactBlob(session: UserSession, path: string, signal?: AbortSignal) {
  if (!/^\/v1\/artifacts\/[a-f0-9]{48}$/.test(path)) throw new Error("无效的下载地址");
  const response = await fetch(trustedUrl(session, path), { signal, headers: { Authorization: `Bearer ${session.key}` }, cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("文件已过期或无访问权限");
  return response.blob();
}
