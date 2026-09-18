"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { conversationStore } from "@/lib/storage/conversationStore";
import { streamChat } from "@/lib/stream";
import {
  AttachedFile,
  ConversationSummary,
  Message,
  ModelInfo,
  SearchSource,
} from "@/types/chat";

export type BackendStatus = "checking" | "online" | "offline";

export function useChat() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("qwen3:1.7b");
  const [isSwitchingModel, setIsSwitchingModel] = useState<boolean>(false);
  const [switchingModelTarget, setSwitchingModelTarget] = useState<string | null>(null);
  const [modelSwitchSuccess, setModelSwitchSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [isProviderConnected, setIsProviderConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // File Intelligence state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileStatusLabel, setFileStatusLabel] = useState<string | null>(null);

  // Web Search state
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
  // Live search progress for UI indicators
  const [webSearchStatus, setWebSearchStatus] = useState<
    "idle" | "searching" | "reading" | "generating"
  >("idle");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived boolean for backward compatibility
  const isBackendConnected = backendStatus === "online";

  // Load local conversations from IndexedDB and server health/models
  const refreshData = useCallback(async () => {
    try {
      setError(null);
      setBackendStatus("checking");

      // Concurrently query backend health/models and local IndexedDB conversations
      const [healthData, modelsData, localConvs] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getModels().catch(() => null),
        conversationStore.listConversations().catch(() => []),
      ]);

      if (healthData) {
        setBackendStatus("online");
        setIsProviderConnected(healthData.provider_connected);
      } else {
        setBackendStatus("offline");
      }

      if (modelsData) {
        setModels(modelsData.models);
        if (modelsData.default_model) {
          setCurrentModel(modelsData.default_model);
        }
      }

      setConversations(localConvs);
    } catch (err: any) {
      console.error("Initialization error:", err);
      setBackendStatus("offline");
      setError(err.message || "Unable to connect to Solix backend.");
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Periodic lightweight background health polling (every 20s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const healthData = await api.getHealth();
        if (healthData) {
          setBackendStatus("online");
          setIsProviderConnected(healthData.provider_connected);
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // Load messages from local IndexedDB whenever activeConversationId changes
  const selectConversation = useCallback(async (id: string) => {
    // If currently generating, abort stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setWebSearchStatus("idle");
    }

    setActiveConversationId(id);
    setIsLoadingHistory(true);
    setError(null);

    try {
      const storedMessages = await conversationStore.getMessages(id);
      const validMessages = storedMessages.filter(
        (m: Message) => m.content && m.content.trim() !== ""
      );
      setMessages(validMessages);
    } catch (err: any) {
      console.error("Failed to load local conversation:", err);
      setError(err.message || "Failed to load local conversation messages.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Start a new blank chat session
  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setWebSearchStatus("idle");
    }
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  // Delete a conversation from local IndexedDB
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await conversationStore.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          startNewChat();
        }
      } catch (err: any) {
        console.error("Failed to delete local conversation:", err);
        setError(err.message || "Failed to delete conversation from storage.");
      }
    },
    [activeConversationId, startNewChat]
  );

  // Rename a conversation in local IndexedDB
  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await conversationStore.updateConversationTitle(id, newTitle);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
        );
      } catch (err: any) {
        console.error("Failed to rename conversation:", err);
        setError(err.message || "Failed to rename conversation.");
      }
    },
    []
  );

  // Clear all local conversations from device IndexedDB
  const clearAllLocalChats = useCallback(async () => {
    try {
      await conversationStore.clearAllConversations();
      setConversations([]);
      startNewChat();
    } catch (err: any) {
      console.error("Failed to clear local chat history:", err);
      setError("Failed to clear local chat history.");
    }
  }, [startNewChat]);

  // Stop generation
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setWebSearchStatus("idle");
  }, []);

  // Toggle web search on/off
  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
  }, []);

  // File Intelligence upload and attachment management
  const uploadFiles = useCallback(async (incoming: FileList | File[]) => {
    const fileArray = Array.from(incoming);
    if (!fileArray.length) return;

    if (attachedFiles.length + fileArray.length > 10) {
      setError("Maximum 10 files allowed per request.");
      return;
    }

    const newItems: AttachedFile[] = fileArray.map((f) => {
      const isImg = f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name);
      let blobPreview: string | undefined = undefined;
      if (isImg && typeof window !== "undefined") {
        try {
          blobPreview = URL.createObjectURL(f);
        } catch {
          // ignore
        }
      }
      return {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: isImg ? "image" : (f.name.split(".").pop()?.toLowerCase() || "file"),
        status: "uploading",
        progress: 0,
        previewUrl: blobPreview,
      };
    });

    setAttachedFiles((prev) => [...prev, ...newItems]);

    fileArray.forEach(async (file, idx) => {
      const tempId = newItems[idx].id;
      try {
        const result = await api.uploadFile(file, (percent) => {
          setAttachedFiles((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    progress: percent,
                    status: percent >= 100 ? "processing" : "uploading",
                  }
                : item
            )
          );
        });

        const backendContent = result.url ? api.getFileContentUrl(result.file_id) : undefined;
        const backendPreview = result.preview_url ? api.getFileContentUrl(result.file_id) : undefined;

        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  id: result.file_id,
                  name: result.filename,
                  type: result.detected_type || item.type,
                  status: result.status === "ready" ? "ready" : "error",
                  chunkCount: result.chunk_count,
                  error: result.error,
                  progress: 100,
                  url: backendContent,
                  previewUrl: item.previewUrl || backendPreview,
                }
              : item
          )
        );
      } catch (err: any) {
        setAttachedFiles((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: "error",
                  error: err.message || "Upload failed",
                  progress: 0,
                }
              : item
          )
        );
      }
    });
  }, [attachedFiles.length]);

  const removeFile = useCallback(async (fileId: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.id === fileId);
      if (target?.previewUrl && target.previewUrl.startsWith("blob:") && typeof window !== "undefined") {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((f) => f.id !== fileId);
    });

    if (!fileId.startsWith("temp-")) {
      try {
        await api.deleteFile(fileId);
      } catch {
        // ignore
      }
    }
  }, []);

  const retryFile = useCallback((fileId: string) => {
    removeFile(fileId);
  }, [removeFile]);

  // Switch AI model with real backend confirmation and VRAM allocation
  const selectModel = useCallback(
    async (modelId: string) => {
      if (modelId === currentModel || isSwitchingModel) return;
      setIsSwitchingModel(true);
      setSwitchingModelTarget(modelId);
      setError(null);
      try {
        const switchRes = await api.switchModel(modelId);
        if (switchRes.status === "ready") {
          const resolved = switchRes.model || modelId;
          setCurrentModel(resolved);
          setModelSwitchSuccess(resolved);
          setTimeout(() => {
            setModelSwitchSuccess((prev) => (prev === resolved ? null : prev));
          }, 2500);
        } else {
          setError(switchRes.message || `Failed to switch to ${modelId}`);
        }
      } catch (err: any) {
        console.error("Failed to switch model:", err);
        setError(err.message || `Failed to switch model to ${modelId}.`);
      } finally {
        setIsSwitchingModel(false);
        setSwitchingModelTarget(null);
      }
    },
    [currentModel, isSwitchingModel]
  );

  // Send a message & stream response, persisting to IndexedDB locally
  const sendMessage = useCallback(
    async (
      content: string,
      options?: { systemPrompt?: string; temperature?: number }
    ) => {
      if (!content.trim() || isGenerating || isSwitchingModel) return;

      const isWebSearch = webSearchEnabled;
      const userMessageId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;
      const now = new Date().toISOString();

      let targetConvId = activeConversationId;

      // Extract ready attached files
      const readyFiles = attachedFiles.filter((f) => f.status === "ready");
      const fileSummaries = readyFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        url: f.url || api.getFileContentUrl(f.id),
        previewUrl: f.previewUrl || (f.type === "image" ? api.getFileContentUrl(f.id) : undefined),
      }));
      const fileIds = readyFiles.map((f) => f.id);

      // Clear composer attachment tray once submitted
      setAttachedFiles([]);
      if (fileIds.length > 0) {
        setFileStatusLabel("Processing attached files…");
      }

      const userMessage: Message = {
        id: userMessageId,
        conversation_id: targetConvId || "",
        role: "user",
        content: content.trim(),
        timestamp: now,
        files: fileSummaries.length > 0 ? fileSummaries : undefined,
      };

      const placeholderAssistantMsg: Message = {
        id: assistantMsgId,
        conversation_id: targetConvId || "",
        role: "assistant",
        content: "",
        timestamp: now,
        webSearch: isWebSearch,
        sources: undefined,
      };

      // Optimistically append messages to UI
      setMessages((prev) => [...prev, userMessage, placeholderAssistantMsg]);
      setIsGenerating(true);
      setError(null);
      if (isWebSearch) setWebSearchStatus("searching");

      // If activeConversationId is already present, save user message to IndexedDB immediately
      if (targetConvId) {
        await conversationStore.addMessage(userMessage);
      }

      // Create new abort controller for this stream
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = "";
      let finalSources: SearchSource[] | undefined = undefined;

      await streamChat({
        message: content.trim(),
        conversationId: targetConvId || undefined,
        model: currentModel,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature,
        webSearch: isWebSearch,
        fileIds: fileIds.length > 0 ? fileIds : undefined,
        signal: controller.signal,

        onStart: async (data) => {
          if (!targetConvId && data.conversation_id) {
            targetConvId = data.conversation_id;
            setActiveConversationId(data.conversation_id);

            // Generate clean title (from backend or user message)
            const chatTitle =
              data.title && data.title !== "New Conversation"
                ? data.title
                : content.trim().length > 38
                ? `${content.trim().slice(0, 38)}...`
                : content.trim();

            // Save conversation entry to local IndexedDB
            await conversationStore.createConversation(
              data.conversation_id,
              chatTitle
            );

            // Update user message with assigned conversation_id and save to IndexedDB
            userMessage.conversation_id = data.conversation_id;
            placeholderAssistantMsg.conversation_id = data.conversation_id;
            await conversationStore.addMessage(userMessage);

            // Refresh conversation list in sidebar
            setConversations((prev) => [
              {
                id: data.conversation_id,
                title: chatTitle,
                created_at: now,
                updated_at: now,
                message_count: 1,
              },
              ...prev.filter((c) => c.id !== data.conversation_id),
            ]);
          }
        },

        onSearchStarted: () => {
          setWebSearchStatus("searching");
        },

        onSearchResults: ({ count }) => {
          // Switch indicator to "reading" when results come back
          if (count > 0) setWebSearchStatus("reading");
        },

        onSources: (sources) => {
          // Store authoritative sources from backend
          finalSources = sources;
          // Update the placeholder message with sources so they show immediately
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, sources }
                : msg
            )
          );
        },

        onToken: (token) => {
          if (isWebSearch && webSearchStatus !== "generating") {
            setWebSearchStatus("generating");
          }
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },

        onFileStatus: (data) => {
          if (data.chunk_count && data.chunk_count > 0) {
            setFileStatusLabel(`Indexed ${data.chunk_count} relevant sections from files`);
          } else {
            setFileStatusLabel("Reading attached files…");
          }
        },

        onDone: async (data) => {
          setIsGenerating(false);
          setWebSearchStatus("idle");
          setFileStatusLabel(null);
          abortControllerRef.current = null;

          // Sources may arrive via onSources or inside done payload
          if (data.sources && data.sources.length > 0) {
            finalSources = data.sources;
          }

          const finalAssistantContent =
            accumulatedContent ||
            "I was unable to generate a response. Please check your model status and try again.";

          const finalAssistantMsg: Message = {
            id: data.message_id || assistantMsgId,
            conversation_id: targetConvId || activeConversationId || "",
            role: "assistant",
            content: finalAssistantContent,
            timestamp: new Date().toISOString(),
            webSearch: isWebSearch,
            sources: finalSources,
          };

          // Save final assistant message to local IndexedDB (includes sources)
          if (finalAssistantMsg.conversation_id) {
            await conversationStore.addMessage(finalAssistantMsg);
            const freshList = await conversationStore.listConversations();
            setConversations(freshList);
          }

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                return finalAssistantMsg;
              }
              return msg;
            })
          );
        },

        onError: async (err) => {
          setIsGenerating(false);
          setWebSearchStatus("idle");
          setFileStatusLabel(null);
          abortControllerRef.current = null;
          setError(err);

          const errorMessageText = `⚠️ **Error:** ${err}\n\nPlease ensure the Solix backend service is online and accessible.`;

          // If assistant message was empty, show error inside assistant message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId && !msg.content
                ? {
                    ...msg,
                    content: errorMessageText,
                  }
                : msg
            )
          );

          // Save error assistant message so user has record of failure in this chat
          if (targetConvId) {
            await conversationStore.addMessage({
              id: assistantMsgId,
              conversation_id: targetConvId,
              role: "assistant",
              content: errorMessageText,
              timestamp: new Date().toISOString(),
            });
          }
        },
      });
    },
    [activeConversationId, attachedFiles, currentModel, isGenerating, isSwitchingModel, webSearchEnabled, webSearchStatus]
  );

  return {
    conversations,
    activeConversationId,
    messages,
    models,
    currentModel,
    isSwitchingModel,
    switchingModelTarget,
    modelSwitchSuccess,
    selectModel,
    isGenerating,
    isLoadingHistory,
    backendStatus,
    isBackendConnected,
    isProviderConnected,
    error,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    clearAllLocalChats,
    stopGenerating,
    sendMessage,
    setCurrentModel,
    refreshData,
    // File Intelligence
    attachedFiles,
    uploadFiles,
    removeFile,
    retryFile,
    fileStatusLabel,
    // Web Search
    webSearchEnabled,
    toggleWebSearch,
    webSearchStatus,
  };
}
