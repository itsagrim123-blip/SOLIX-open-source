export interface FileNode {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  updated_at?: number;
  language?: string;
  children?: FileNode[];
}

export interface Workspace {
  id: string;
  name: string;
  template?: string;
  created_at: number;
  updated_at: number;
}

export interface ExecutionResult {
  workspace_id: string;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time: number;
  timed_out: boolean;
  success: boolean;
}

export interface CodePatch {
  file: string;
  explanation: string;
  replacement_content: string;
  diff: string;
}

export interface GitStatus {
  is_repo: boolean;
  branch?: string;
  modified: string[];
  untracked: string[];
  error?: string;
}

export interface CodingChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  patch?: CodePatch;
  isStreaming?: boolean;
  sources?: any[];
}

