"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChatPanel } from "./chat-panel";
import { SettingsPanel } from "./settings-panel";
import { ImageResultGrid } from "./image-results";
import { SessionContext } from "./session-context";
import { requestForm as apiRequestForm, requestJson as apiRequestJson, verifyUserSession } from "./client";
import { useReferenceImages, useSessionChat } from "./hooks";
import { ImageTaskPanel } from "./image-task-panel";
import { DashboardHeader, DeleteTaskDialog, LoginView } from "./shell";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskSidebar } from "./task-sidebar";
import type {
  ActivePanel,
  ChatMessage,
  ImageTask,
  ImageTaskMode,
  StatusFilter,
  UnifiedTask,
  UserSession,
} from "./types";
import {
  buildUnifiedTasks,
  createClientTaskId,
  createId,
  isRunningStatus,
  taskEndpoint,
  taskIdOf,
  taskKey,
} from "./utils";

export default function ApiConsolePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const sessionEpoch = useRef(0);
  const [loginKey, setLoginKey] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const imageTasksRef = useRef<ImageTask[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>("image");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [imageMode, setImageMode] = useState<ImageTaskMode>("generate");
  const [imagePrompt, setImagePrompt] = useState("生成一张干净、专业、适合产品介绍的图片，主体清晰，背景简洁。");
  const [imageModel, setImageModel] = useState("auto");
  const [imageSize, setImageSize] = useState("1024x1024");
  const [imageQuality, setImageQuality] = useState("auto");
  const {
    references: imageReferences,
    inputRef: imageInputRef,
    addReferenceImages: addImageReferenceImages,
    removeReferenceImage: removeImageReferenceImage,
    clearReferenceImages: clearImageReferenceImages,
  } = useReferenceImages();
  const [isSubmittingImage, setIsSubmittingImage] = useState(false);

  const { chatMessages, setChatMessages } = useSessionChat(session);
  const [chatInput, setChatInput] = useState("帮我把这个需求拆成可以执行的步骤。");
  const [chatModel, setChatModel] = useState("auto");
  const [isChatting, setIsChatting] = useState(false);

  const [titleDraft, setTitleDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedTask | null>(null);

  const requestJson = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!session) throw new Error("未登录");
    return apiRequestJson<T>(session, path, init);
  }, [session]);

  const requestForm = useCallback(async <T,>(path: string, formData: FormData): Promise<T> => {
    if (!session) throw new Error("未登录");
    return apiRequestForm<T>(session, path, formData);
  }, [session]);

  const allTasks = useMemo(() => buildUnifiedTasks(imageTasks), [imageTasks]);
  const selectedTask = useMemo(() => allTasks.find((task) => task.key === selectedKey) || null, [allTasks, selectedKey]);

  const visibleTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allTasks.filter((task) => {
      if (statusFilter === "active" && !isRunningStatus(task.status)) return false;
      if (statusFilter === "success" && task.status !== "success") return false;
      if (statusFilter === "error" && task.status !== "error") return false;
      if (!query) return true;
      return [task.id, task.title, task.note, task.prompt, task.kindLabel, task.status, task.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [allTasks, searchText, statusFilter]);

  const stats = useMemo(() => {
    const active = allTasks.filter((task) => isRunningStatus(task.status)).length;
    const success = allTasks.filter((task) => task.status === "success").length;
    const failed = allTasks.filter((task) => task.status === "error").length;
    return { total: allTasks.length, active, success, failed };
  }, [allTasks]);

  const latestImageTasks = useMemo(() => {
    return [...imageTasks].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  }, [imageTasks]);

  useEffect(() => {
    imageTasksRef.current = imageTasks;
  }, [imageTasks]);

  const loadTasks = useCallback(async (silent = false) => {
    if (!session) return;
    const epoch = sessionEpoch.current;
    const historyEnabled = session.historyEnabled !== false;
    const currentImages = imageTasksRef.current;
    const currentIds = currentImages.map((task) => taskIdOf(task)).filter(Boolean);
    if (!historyEnabled && currentIds.length === 0) {
      setImageTasks([]);
      if (!silent) toast.info("历史记录已关闭");
      return;
    }
    setIsRefreshing(true);
    try {
      const query = !historyEnabled && currentIds.length
        ? `?ids=${currentIds.map((id) => encodeURIComponent(id)).join(",")}`
        : "";
      const imageData = await requestJson<{ items: ImageTask[]; history_enabled?: boolean }>(`/v1/tasks${query}`);
      if (epoch !== sessionEpoch.current) return;
      if (imageData.history_enabled !== undefined && imageData.history_enabled !== session.historyEnabled) {
        setSession(current => current ? { ...current, historyEnabled: imageData.history_enabled! } : null);
      }
      const nextImages = Array.isArray(imageData.items) ? imageData.items : [];
      const mergedImages = historyEnabled
        ? nextImages
        : currentImages.map((task) => nextImages.find((item) => taskIdOf(item) === taskIdOf(task)) || task);
      setImageTasks(mergedImages);
      const nextUnified = buildUnifiedTasks(mergedImages);
      setSelectedKey((current) => current && nextUnified.some((task) => task.key === current) ? current : "");
      if (!silent) toast.success(nextUnified.length ? "任务已刷新" : historyEnabled ? "暂无任务" : "历史记录已关闭");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "任务刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [requestJson, session]);

  const clearSession = useCallback(() => {
    sessionEpoch.current++;
    setSession(null);
    setLoginKey("");
    setImageTasks([]);
    imageTasksRef.current = [];
    setSelectedKey("");
    setActivePanel("image");
    setImagePrompt("");
    setChatInput("");
    setChatMessages([]);
    setSearchText("");
    setStatusFilter("all");
    setTitleDraft("");
    setNoteDraft("");
    setDeleteTarget(null);
    clearImageReferenceImages();
  }, [clearImageReferenceImages, setChatMessages]);

  useEffect(() => {
    const expire = () => clearSession();
    window.addEventListener("atp-session-expired", expire);
    return () => window.removeEventListener("atp-session-expired", expire);
  }, [clearSession]);

  useEffect(() => {
    if (!session) return;
    if (session.historyEnabled === false) {
      setImageTasks([]);
      return;
    }
    void loadTasks(true);
  }, [loadTasks, session]);

  useEffect(() => {
    if (!session || !allTasks.some((task) => isRunningStatus(task.status))) return;
    const timer = window.setInterval(() => void loadTasks(true), 5000);
    return () => window.clearInterval(timer);
  }, [allTasks, loadTasks, session]);

  useEffect(() => {
    if (!selectedTask) {
      setTitleDraft("");
      setNoteDraft("");
      return;
    }
    setTitleDraft(selectedTask.title);
    setNoteDraft(selectedTask.note || "");
  }, [selectedTask]);

  const login = async () => {
    const baseUrl = window.location.origin;
    const key = loginKey.trim();
    if (!baseUrl) {
      toast.error("请填写 Base URL");
      return;
    }
    if (!key) {
      toast.error("请填写用户 API Key");
      return;
    }
    setIsLoggingIn(true);
    try {
      const sessionInfo = await verifyUserSession({ baseUrl, key, historyEnabled: true });
      const nextSession = { baseUrl, key, ...sessionInfo };
      sessionEpoch.current++;
      setImageModel(sessionInfo.imageModel);
      setChatModel(sessionInfo.chatModel);
      setLoginKey("");
      setSession(nextSession);
      setActivePanel("image");
      toast.success("登录成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    clearSession();
    toast.success("已退出");
  };

  const upsertImageTask = (task: ImageTask) => {
    setImageTasks((current) => [task, ...current.filter((item) => taskIdOf(item) !== taskIdOf(task))]);
  };

  const submitImageTask = async () => {
    if (!session) return;
    const epoch = sessionEpoch.current;
    const cleanPrompt = imagePrompt.trim();
    if (!cleanPrompt) {
      toast.error("请填写图片提示词");
      return;
    }
    if (imageMode === "edit" && !imageReferences.length) {
      toast.error("图生图需要至少一张参考图");
      return;
    }
    setIsSubmittingImage(true);
    try {
      let task: ImageTask;
      const clientTaskId = createClientTaskId(imageMode === "edit" ? "image-edit" : "image");
      if (imageMode === "edit") {
        const formData = new FormData();
        imageReferences.forEach((item) => formData.append("image", item.file));
        formData.append("client_task_id", clientTaskId);
        formData.append("prompt", cleanPrompt);
        formData.append("model", imageModel.trim() || "auto");
        if (imageSize !== "auto") formData.append("size", imageSize);
        formData.append("quality", imageQuality);
        task = await requestForm<ImageTask>("/v1/image-tasks/edits", formData);
      } else {
        task = await requestJson<ImageTask>("/v1/image-tasks/generations", {
          method: "POST",
          body: JSON.stringify({
            client_task_id: clientTaskId,
            prompt: cleanPrompt,
            model: imageModel.trim() || "auto",
            ...(imageSize !== "auto" ? { size: imageSize } : {}),
            quality: imageQuality,
          }),
        });
      }
      if (epoch !== sessionEpoch.current) return;
      const nextTask = { ...task, prompt_preview: task.prompt_preview || cleanPrompt };
      upsertImageTask(nextTask);
      setSelectedKey(taskKey("image", taskIdOf(nextTask)));
      setActivePanel("detail");
      toast.success("图片任务已提交");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setIsSubmittingImage(false);
    }
  };

  const sendChatMessage = async () => {
    if (!session) return;
    const epoch = sessionEpoch.current;
    const cleanText = chatInput.trim();
    if (!cleanText) {
      toast.error("请填写对话内容");
      return;
    }
    const userMessage: ChatMessage = { id: createId("msg"), role: "user", content: cleanText, createdAt: new Date().toISOString() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsChatting(true);
    try {
      const data = await requestJson<{ id: string; choices?: Array<{ message?: { content?: string } }> }>("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: chatModel.trim() || "auto",
          messages: nextMessages.map((item) => ({ role: item.role, content: item.content })).slice(-20),
          stream: false,
        }),
      });
      if (epoch !== sessionEpoch.current) return;
      const content = data.choices?.[0]?.message?.content || "没有返回内容";
      setChatMessages((current) => [...current, { id: createId("msg"), role: "assistant", content, createdAt: new Date().toISOString() }]);
      upsertImageTask({ id: data.id, mode: "chat", status: "success", title: cleanText.slice(0, 80), prompt_preview: cleanText, text: content, created_at: new Date().toISOString() });
    } catch (error) {
      if (epoch !== sessionEpoch.current) return;
      setChatMessages((current) => [...current, { id: createId("msg"), role: "assistant", content: error instanceof Error ? error.message : "对话请求失败", createdAt: new Date().toISOString() }]);
      toast.error(error instanceof Error ? error.message : "对话请求失败");
    } finally {
      setIsChatting(false);
    }
  };

  const saveTask = async () => {
    if (!selectedTask || selectedTask.category !== "image") return;
    const epoch = sessionEpoch.current;
    setIsSaving(true);
    try {
      const updated = await requestJson<ImageTask>(`${taskEndpoint()}/${encodeURIComponent(selectedTask.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ title: titleDraft.trim(), note: noteDraft.trim() }),
      });
      if (epoch !== sessionEpoch.current) return;
      upsertImageTask(updated);
      toast.success("任务信息已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const epoch = sessionEpoch.current;
    try {
      await requestJson<{ ok: boolean }>(`${taskEndpoint()}/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
      if (epoch !== sessionEpoch.current) return;
      setImageTasks((current) => current.filter((task) => taskIdOf(task) !== deleteTarget.id));
      setSelectedKey((current) => current === deleteTarget.key ? "" : current);
      setActivePanel("image");
      toast.success("任务记录已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleteTarget(null);
    }
  };

  const copyText = async (value: string, message = "已复制") => {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  };

  if (!session) {
    return (
      <LoginView
        loginKey={loginKey}
        setLoginKey={setLoginKey}
        isLoggingIn={isLoggingIn}
        onLogin={() => void login()}
      />
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1540px] flex-col px-3 pb-6 sm:px-6">
        <DashboardHeader
          session={session}
          stats={stats}
          isRefreshing={isRefreshing}
          historyEnabled={session.historyEnabled !== false}
          onRefresh={() => void loadTasks(false)}
          onLogout={logout}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />

        <section className="grid min-h-0 flex-1 gap-6 py-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <TaskSidebar
            activePanel={activePanel}
            selectedTask={selectedTask}
            visibleTasks={visibleTasks}
            searchText={searchText}
            setSearchText={setSearchText}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            historyEnabled={session.historyEnabled !== false}
            onPanelChange={setActivePanel}
            onTaskSelect={(task) => {
              setSelectedKey(task.key);
              setActivePanel("detail");
            }}
          />

          <main className="min-w-0">
            {activePanel === "image" ? (
              <ImageTaskPanel
                imageMode={imageMode}
                setImageMode={setImageMode}
                imagePrompt={imagePrompt}
                setImagePrompt={setImagePrompt}
                imageModel={imageModel}
                setImageModel={setImageModel}
                imageSize={imageSize}
                setImageSize={setImageSize}
                imageQuality={imageQuality}
                setImageQuality={setImageQuality}
                references={imageReferences}
                inputRef={imageInputRef}
                onAdd={(event) => void addImageReferenceImages(event)}
                onRemove={removeImageReferenceImage}
                onClear={clearImageReferenceImages}
                onSubmit={() => void submitImageTask()}
                isSubmitting={isSubmittingImage}
                tasks={latestImageTasks.filter(task => task.mode !== "chat")}
                baseUrl={session.baseUrl}
                onSelectTask={(task) => {
                  setSelectedKey(taskKey("image", taskIdOf(task)));
                  setActivePanel("detail");
                }}
                onCopy={copyText}
              />
            ) : null}

            {activePanel === "settings" && session.role === "admin" ? <SettingsPanel session={session} onHistoryChange={enabled => { setSession(current => current ? { ...current, historyEnabled: enabled } : null); setImageTasks([]); }} /> : null}
            {activePanel === "downloads" ? <div className="grid gap-6"><h2 className="text-xl font-semibold">下载管理</h2>{latestImageTasks.filter(task => task.data?.length).map(task => <section key={task.id} className="border-b border-zinc-200 pb-5"><h3 className="mb-3 text-sm font-medium">{task.title || task.prompt_preview}</h3><ImageResultGrid task={task} /></section>)}{!latestImageTasks.some(task => task.data?.length) ? <p className="py-16 text-center text-sm text-zinc-500">暂无生成文件</p> : null}</div> : null}

            {activePanel === "chat" ? (
              <ChatPanel
                messages={chatMessages}
                input={chatInput}
                setInput={setChatInput}
                model={chatModel}
                setModel={setChatModel}
                isSubmitting={isChatting}
                onSubmit={() => void sendChatMessage()}
                onClear={() => setChatMessages([])}
                onCopy={copyText}
              />
            ) : null}

            {activePanel === "detail" ? (
              selectedTask ? (
                <TaskDetailPanel
                  task={selectedTask}
                  baseUrl={session.baseUrl}
                  titleDraft={titleDraft}
                  setTitleDraft={setTitleDraft}
                  noteDraft={noteDraft}
                  setNoteDraft={setNoteDraft}
                  isSaving={isSaving}
                  onSave={() => void saveTask()}
                  onDelete={() => setDeleteTarget(selectedTask)}
                  onCopy={copyText}
                />
              ) : (
                <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
                  从左侧选择一个图片任务，或创建新的生图、图生图、对话。
                </div>
              )
            ) : null}
          </main>
        </section>
      </div>

      <DeleteTaskDialog
        task={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </SessionContext.Provider>
  );
}
