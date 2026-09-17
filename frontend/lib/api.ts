import { API_BASE_URL, getApiUrl } from "@/lib/config";
import {
  ConversationDetail,
  ConversationSummary,
  HealthResponse,
  ModelsResponse,
} from "@/types/chat";

/**
 * Perform a typed HTTP fetch to the Solix backend with error handling.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = getApiUrl(path);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let message = `API request error: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // use default message
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(
        `Unable to reach Solix backend at ${API_BASE_URL}. Ensure the FastAPI server is running.`
      );
    }
    throw err;
  }
}

export const api = {
  /** Check backend health status */
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health");
  },

  /** Get available AI models and provider status */
  async getModels(): Promise<ModelsResponse> {
    return request<ModelsResponse>("/api/models");
  },

  /** List all conversations */
  async getConversations(): Promise<ConversationSummary[]> {
    return request<ConversationSummary[]>("/api/conversations");
  },

  /** Create a new blank conversation */
  async createConversation(title?: string): Promise<ConversationDetail> {
    return request<ConversationDetail>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Chat" }),
    });
  },

  /** Fetch a specific conversation with all messages */
  async getConversation(id: string): Promise<ConversationDetail> {
    return request<ConversationDetail>(`/api/conversations/${encodeURIComponent(id)}`);
  },

  /** Update conversation title */
  async updateConversationTitle(
    id: string,
    title: string
  ): Promise<ConversationDetail> {
    return request<ConversationDetail>(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  /** Delete a conversation */
  async deleteConversation(id: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(
      `/api/conversations/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  },

  /** Switch active AI model on backend with real VRAM management and readiness verification */
  async switchModel(
    model: string
  ): Promise<{ status: string; model: string; message: string; vram_usage?: number }> {
    return request<{ status: string; model: string; message: string; vram_usage?: number }>(
      "/api/models/switch",
      {
        method: "POST",
        body: JSON.stringify({ model }),
      }
    );
  },
};

