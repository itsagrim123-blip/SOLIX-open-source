export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  timestamp: string;
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
}

export interface StreamStartPayload {
  type: "start";
  conversation_id: string;
  title: string;
  provider?: string;
  provider_connected?: boolean;
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
}

export interface StreamErrorPayload {
  type: "error";
  error: string;
  conversation_id?: string;
}

export type StreamPayload =
  | StreamStartPayload
  | StreamTokenPayload
  | StreamDonePayload
  | StreamErrorPayload;

