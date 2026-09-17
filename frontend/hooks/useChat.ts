"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { conversationStore } from "@/lib/storage/conversationStore";
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

  // Send a message & stream response, persisting to IndexedDB locally
  const sendMessage = useCallback(
    async (
      content: string,
      options?: { systemPrompt?: string; temperature?: number }
    ) => {
      if (!content.trim() || isGenerating || isSwitchingModel) return;

      const userMessageId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;
      const now = new Date().toISOString();

      let targetConvId = activeConversationId;

      const userMessage: Message = {
        id: userMessageId,
        conversation_id: targetConvId || "",
        role: "user",
        content: content.trim(),
        timestamp: now,
      };

      const placeholderAssistantMsg: Message = {
        id: assistantMsgId,
        conversation_id: targetConvId || "",
        role: "assistant",
        content: "",
        timestamp: now,
      };

      // Optimistically append messages to UI
      setMessages((prev) => [...prev, userMessage, placeholderAssistantMsg]);
      setIsGenerating(true);
      setError(null);

      // If activeConversationId is already present, save user message to IndexedDB immediately
      if (targetConvId) {
        await conversationStore.addMessage(userMessage);
      }

      // Create new abort controller for this stream
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = "";

      await streamChat({
        message: content.trim(),
        conversationId: targetConvId || undefined,
        model: currentModel,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature,
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
            const newConv = await conversationStore.createConversation(
              data.conversation_id,
              chatTitle
            );

            // Update user message with assigned conversation_id and save to IndexedDB
            userMessage.conversation_id = data.conversation_id;
            await conversationStore.addMessage(userMessage);

            // Refresh conversation list in sidebar
            setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== data.conversation_id)]);
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
        onDone: async (data) => {
          setIsGenerating(false);
          abortControllerRef.current = null;

          const finalAssistantContent =
            accumulatedContent ||
            "I was unable to generate a response. Please check your model status and try again.";

          const finalAssistantMsg: Message = {
            id: data.message_id || assistantMsgId,
            conversation_id: targetConvId || activeConversationId || "",
            role: "assistant",
            content: finalAssistantContent,
            timestamp: new Date().toISOString(),
          };

          // Save final assistant message to local IndexedDB
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
    [activeConversationId, currentModel, isGenerating, isSwitchingModel]
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
  };
}
