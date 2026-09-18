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

export interface Problem {
  severity: "error" | "warning" | "info";
  file: string;
  line: number;
  column: number;
  message: string;
  source: string;
}

export interface LanguageRuntime {
  id: string;
  display_name: string;
  extensions: string[];
  compiler?: string | null;
  runner?: string | null;
  test_command?: string | null;
  available: boolean;
  version?: string | null;
  build_required: boolean;
  install_hint?: string | null;
}

export interface ExecutionResult {
  execution_id?: string;
  workspace_id: string;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time: number;
  timed_out: boolean;
  success: boolean;
  problems?: Problem[];
}

export interface BuildResult {
  workspace_id: string;
  success: boolean;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  build_time: number;
  binary_path?: string | null;
  problems?: Problem[];
  execution_id?: string | null;
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
