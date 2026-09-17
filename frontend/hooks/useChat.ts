"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { streamChat } from "@/lib/stream";
import {
  ConversationSummary,
  Message,
  ModelInfo,
} from "@/types/chat";

export function useChat() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("llama3.2");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [isProviderConnected, setIsProviderConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations and models on initial mount
  const refreshData = useCallback(async () => {
    try {
      setError(null);
      const [healthData, modelsData, convsData] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getModels().catch(() => null),
        api.getConversations().catch(() => []),
      ]);

      if (healthData) {
        setIsBackendConnected(true);
        setIsProviderConnected(healthData.provider_connected);
      } else {
        setIsBackendConnected(false);
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
      setIsBackendConnected(false);
      setError(err.message || "Unable to connect to Solix backend.");
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
      setMessages(detail.messages || []);
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

  // Rename conversation
  const renameConversation = useCallback(async (id: string, newTitle: string) => {
    try {
      const updated = await api.updateConversationTitle(id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
    } catch (err: any) {
      console.error("Failed to rename conversation:", err);
      setError(err.message || "Failed to rename conversation.");
    }
  }, []);

  // Stop currently generating response
  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isGenerating) return;

      setError(null);
      const userMsgId = "user-" + Date.now();
      const assistantMsgId = "assistant-" + Date.now();

      // Optimistically add user message and blank assistant message
      const userMsg: Message = {
        id: userMsgId,
        conversation_id: activeConversationId || "temp",
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: Message = {
        id: assistantMsgId,
        conversation_id: activeConversationId || "temp",
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulatedContent = "";

      await streamChat({
        message: trimmed,
        conversationId: activeConversationId || undefined,
        model: currentModel,
        signal: controller.signal,
        onStart: (data) => {
          if (!activeConversationId) {
            setActiveConversationId(data.conversation_id);
          }
          // Update conversations list with new or updated title
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === data.conversation_id);
            if (!exists) {
              return [
                {
                  id: data.conversation_id,
                  title: data.title,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  message_count: 2,
                },
                ...prev,
              ];
            }
            return prev.map((c) =>
              c.id === data.conversation_id
                ? { ...c, title: data.title, updated_at: new Date().toISOString() }
                : c
            );
          });
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
          // Refresh conversation list to maintain correct update ordering
          api.getConversations().then(setConversations).catch(() => {});
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
                    content: `⚠️ **Error:** ${err}\n\n*Please ensure your Ollama instance is active at \`http://localhost:11434\` or check your connection.*`,
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
    isGenerating,
    isLoadingHistory,
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

