"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { streamChat } from "@/lib/stream";
import {
  ConversationSummary,
  Message,
  ModelInfo,
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

  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived boolean for backward compatibility
  const isBackendConnected = backendStatus === "online";

  // Load conversations, models, and initial health check
  const refreshData = useCallback(async () => {
    try {
      setError(null);
      setBackendStatus("checking");

      const [healthData, modelsData, convsData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getModels().catch(() => null),
        api.getConversations().catch(() => []),
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

      setConversations(convsData);
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

  // Load messages whenever activeConversationId changes
  const selectConversation = useCallback(async (id: string) => {
    // If currently generating, abort stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }

    setActiveConversationId(id);
    setIsLoadingHistory(true);
    setError(null);

    try {
      const detail = await api.getConversation(id);
      const validMessages = (detail.messages || []).filter(
        (m: Message) => m.content && m.content.trim() !== ""
      );
      setMessages(validMessages);
    } catch (err: any) {
      console.error("Failed to load conversation:", err);
      setError(err.message || "Failed to load conversation messages.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Start a new blank chat session
  const startNewChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          startNewChat();
        }
      } catch (err: any) {
        console.error("Failed to delete conversation:", err);
        setError(err.message || "Failed to delete conversation.");
      }
    },
    [activeConversationId, startNewChat]
  );

  // Rename a conversation
  const renameConversation = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await api.updateConversationTitle(id, newTitle);
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

  // Stop generation
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

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

  // Send a message & stream response
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isGenerating || isSwitchingModel) return;

      const userMessageId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;
      const now = new Date().toISOString();

      const userMessage: Message = {
        id: userMessageId,
        conversation_id: activeConversationId || "",
        role: "user",
        content: content.trim(),
        timestamp: now,
      };

      const placeholderAssistantMsg: Message = {
        id: assistantMsgId,
        conversation_id: activeConversationId || "",
        role: "assistant",
        content: "",
        timestamp: now,
      };

      // Optimistically append messages to UI
      setMessages((prev) => [...prev, userMessage, placeholderAssistantMsg]);
      setIsGenerating(true);
      setError(null);

      // Create new abort controller for this stream
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = "";

      await streamChat({
        message: content.trim(),
        conversationId: activeConversationId || undefined,
        model: currentModel,
        signal: controller.signal,
        onStart: (data) => {
          if (!activeConversationId && data.conversation_id) {
            setActiveConversationId(data.conversation_id);
            setConversations((prev) => [
              {
                id: data.conversation_id,
                title: data.title,
                created_at: now,
                updated_at: now,
                message_count: 2,
              },
              ...prev,
            ]);
          }
        },
        onToken: (token) => {
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        },
        onDone: (data) => {
          setIsGenerating(false);
          abortControllerRef.current = null;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMsgId) {
                return {
                  ...msg,
                  id: data.message_id || msg.id,
                  content:
                    msg.content ||
                    "I was unable to generate a response. Please check your model status and try again.",
                };
              }
              return msg;
            })
          );
        },
        onError: (err) => {
          setIsGenerating(false);
          abortControllerRef.current = null;
          setError(err);
          // If assistant message was empty, show error inside assistant message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId && !msg.content
                ? {
                    ...msg,
                    content: `⚠️ **Error:** ${err}\n\nPlease ensure the Solix backend service is online and accessible.`,
                  }
                : msg
            )
          );
        },
      });
    },
    [activeConversationId, currentModel, isGenerating]
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
    stopGenerating,
    sendMessage,
    setCurrentModel,
    refreshData,
  };
}
