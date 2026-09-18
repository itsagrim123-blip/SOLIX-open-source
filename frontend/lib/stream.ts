import { API_BASE_URL, getApiUrl } from "@/lib/config";
import { SearchSource, StreamPayload } from "@/types/chat";

export interface StreamChatParams {
  message: string;
  conversationId?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  webSearch?: boolean;
  fileIds?: string[];
  signal?: AbortSignal;
  onStart?: (data: { conversation_id: string; title: string; provider?: string }) => void;
  onToken?: (token: string) => void;
  onDone?: (data: {
    conversation_id: string;
    message_id?: string;
    full_content?: string;
    sources?: SearchSource[];
  }) => void;
  onError?: (error: string) => void;
  onSearchStarted?: (data: { query: string }) => void;
  onSearchResults?: (data: { count: number }) => void;
  onSources?: (sources: SearchSource[]) => void;
  onFileStatus?: (data: { status: string; chunk_count?: number }) => void;
}

/**
 * Stream conversational responses from POST /api/chat via Server-Sent Events (SSE).
 * Supports both normal chat and web search mode.
 */
export async function streamChat({
  message,
  conversationId,
  model,
  systemPrompt,
  temperature,
  webSearch = false,
  fileIds,
  signal,
  onStart,
  onToken,
  onDone,
  onError,
  onSearchStarted,
  onSearchResults,
  onSources,
  onFileStatus,
}: StreamChatParams): Promise<void> {
  const url = getApiUrl("/api/chat");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
        model: model || null,
        system_prompt: systemPrompt || null,
        temperature: temperature ?? 0.7,
        web_search: webSearch,
        file_ids: fileIds && fileIds.length > 0 ? fileIds : null,
      }),
      signal,
    });

    if (!response.ok) {
      let errDetail = `Server responded with ${response.status}: ${response.statusText}`;
      try {
        const body = await response.json();
        if (body?.detail) errDetail = body.detail;
      } catch {
        // fallback
      }
      throw new Error(errDetail);
    }

    if (!response.body) {
      throw new Error("No response stream body available from server.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // keep incomplete last line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6).trim();
        if (!dataStr) continue;

        try {
          const payload: StreamPayload = JSON.parse(dataStr);

          switch (payload.type) {
            case "start":
              onStart?.({
                conversation_id: payload.conversation_id,
                title: payload.title,
                provider: payload.provider,
              });
              break;
            case "token":
              onToken?.(payload.content);
              break;
            case "done":
              onDone?.({
                conversation_id: payload.conversation_id,
                message_id: payload.message_id,
                full_content: payload.full_content,
                sources: payload.sources,
              });
              break;
            case "error":
              onError?.(payload.error);
              break;
            case "search_started":
              onSearchStarted?.({ query: payload.query });
              break;
            case "search_results":
              onSearchResults?.({ count: payload.count });
              break;
            case "sources":
              onSources?.(payload.sources);
              break;
            case "file_status":
              onFileStatus?.({ status: payload.status, chunk_count: payload.chunk_count });
              break;
          }
        } catch (jsonErr) {
          console.warn("Could not parse SSE JSON line:", dataStr, jsonErr);
        }
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      // User pressed stop generation
      return;
    }
    const message =
      err.name === "TypeError" && err.message.includes("fetch")
        ? `Could not reach Solix backend at ${API_BASE_URL}. Ensure it is running.`
        : err.message || "Failed to process chat response.";
    onError?.(message);
  }
}
