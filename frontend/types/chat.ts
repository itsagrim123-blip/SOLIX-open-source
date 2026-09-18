export type Role = "user" | "assistant" | "system";

export interface SearchSource {
  id: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "processing" | "ready" | "error";
  progress: number;
  error?: string;
  chunkCount?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  timestamp: string;
  /** Whether this message was generated with Web Search enabled */
  webSearch?: boolean;
  /** Source citations for web-search assistant messages */
  sources?: SearchSource[];
  /** Attached files associated with this message */
  files?: { id: string; name: string; size: number; type: string }[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface ModelInfo {
  id: string;
  name: string;
  details?: string;
  size?: number;
  modified_at?: string;
  is_default: boolean;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default_model: string;
  provider: string;
  provider_connected: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  provider: string;
  provider_connected: boolean;
  database: string;
  ollama?: boolean;
  model?: string;
  model_available?: boolean;
}

// ── SSE Payload types ─────────────────────────────────────────────────────────

export interface StreamStartPayload {
  type: "start";
  conversation_id: string;
  title: string;
  provider?: string;
  provider_connected?: boolean;
  web_search?: boolean;
}

export interface StreamTokenPayload {
  type: "token";
  content: string;
}

export interface StreamDonePayload {
  type: "done";
  conversation_id: string;
  message_id?: string;
  full_content?: string;
  sources?: SearchSource[];
}

export interface StreamErrorPayload {
  type: "error";
  error: string;
  conversation_id?: string;
}

export interface StreamSearchStartedPayload {
  type: "search_started";
  query: string;
  conversation_id: string;
}

export interface StreamSearchResultsPayload {
  type: "search_results";
  count: number;
  conversation_id: string;
}

export interface StreamSourcesPayload {
  type: "sources";
  sources: SearchSource[];
  conversation_id: string;
}

export interface StreamFileStatusPayload {
  type: "file_status";
  status: string;
  chunk_count?: number;
  conversation_id: string;
}

export type StreamPayload =
  | StreamStartPayload
  | StreamTokenPayload
  | StreamDonePayload
  | StreamErrorPayload
  | StreamSearchStartedPayload
  | StreamSearchResultsPayload
  | StreamSourcesPayload
  | StreamFileStatusPayload;
