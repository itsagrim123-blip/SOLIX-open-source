import { API_BASE_URL, getApiUrl } from "@/lib/config";
import {
  ConversationDetail,
  ConversationSummary,
  HealthResponse,
  ModelsResponse,
} from "@/types/chat";
import {
  BuildResult,
  CodePatch,
  ExecutionResult,
  FileNode,
  GitStatus,
  LanguageRuntime,
  Workspace,
} from "@/types/workspace";

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

  /** Upload a file to Solix with real progress tracking */
  uploadFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{
    file_id: string;
    filename: string;
    content_type: string;
    detected_type: string;
    size_bytes: number;
    status: string;
    chunk_count: number;
    url?: string;
    preview_url?: string;
    download_url?: string;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      const url = getApiUrl("/api/files/upload");
      const formData = new FormData();
      formData.append("files", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(Array.isArray(res) ? res[0] : res);
          } catch (e) {
            reject(new Error("Invalid response format from server"));
          }
        } else {
          let errMessage = `Upload failed with status ${xhr.status}`;
          try {
            const errData = JSON.parse(xhr.responseText);
            if (errData?.detail) {
              errMessage = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
            }
          } catch {
            // fallback
          }
          reject(new Error(errMessage));
        }
      };

      xhr.onerror = () => {
        reject(new Error(`Unable to upload file to Solix backend at ${API_BASE_URL}.`));
      };

      xhr.send(formData);
    });
  },

  /** Delete an uploaded file from server */
  async deleteFile(fileId: string): Promise<{ success: boolean; file_id: string }> {
    return request<{ success: boolean; file_id: string }>(
      `/api/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" }
    );
  },

  /** Check processing status of an uploaded file */
  async getFileStatus(
    fileId: string
  ): Promise<{ file_id: string; status: string; filename: string; chunk_count: number; error?: string; url?: string; preview_url?: string }> {
    return request<{ file_id: string; status: string; filename: string; chunk_count: number; error?: string; url?: string; preview_url?: string }>(
      `/api/files/${encodeURIComponent(fileId)}/status`
    );
  },

  /** Get stable, fully-qualified URL to view/stream an uploaded file */
  getFileContentUrl(fileId: string): string {
    return getApiUrl(`/api/files/${encodeURIComponent(fileId)}/content`);
  },

  /** Get stable, fully-qualified URL to download an uploaded file */
  getFileDownloadUrl(fileId: string): string {
    return getApiUrl(`/api/files/${encodeURIComponent(fileId)}/download`);
  },
};

export const workspaceApi = {
  /** List all active workspaces */
  async listWorkspaces(): Promise<Workspace[]> {
    return request<Workspace[]>("/api/workspaces");
  },

  /** Create a new workspace */
  async createWorkspace(name?: string, template: string = "starter-python"): Promise<Workspace> {
    return request<Workspace>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, template }),
    });
  },

  /** Get workspace metadata */
  async getWorkspace(id: string): Promise<Workspace> {
    return request<Workspace>(`/api/workspaces/${encodeURIComponent(id)}`);
  },

  /** Delete a workspace */
  async deleteWorkspace(id: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(`/api/workspaces/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** Get hierarchical file tree */
  async getFileTree(id: string): Promise<FileNode[]> {
    return request<FileNode[]>(`/api/workspaces/${encodeURIComponent(id)}/files`);
  },

  /** Read a specific file content */
  async readFile(
    id: string,
    path: string
  ): Promise<{ path: string; content: string; size: number; updated_at: number; language: string }> {
    return request<{ path: string; content: string; size: number; updated_at: number; language: string }>(
      `/api/workspaces/${encodeURIComponent(id)}/files/${path}`
    );
  },

  /** Write/save file content */
  async writeFile(
    id: string,
    path: string,
    content: string
  ): Promise<{ path: string; size: number; updated_at: number; language: string }> {
    return request<{ path: string; size: number; updated_at: number; language: string }>(
      `/api/workspaces/${encodeURIComponent(id)}/files/${path}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      }
    );
  },

  /** Create new file or directory */
  async createFileOrDir(
    id: string,
    path: string,
    isDirectory: boolean = false,
    content: string = ""
  ): Promise<FileNode> {
    return request<FileNode>(`/api/workspaces/${encodeURIComponent(id)}/files`, {
      method: "POST",
      body: JSON.stringify({ path, is_directory: isDirectory, content }),
    });
  },

  /** Delete a file or directory */
  async deletePath(id: string, path: string): Promise<{ success: boolean; path: string }> {
    return request<{ success: boolean; path: string }>(
      `/api/workspaces/${encodeURIComponent(id)}/files/${path}`,
      { method: "DELETE" }
    );
  },

  /** Rename or move a file/directory */
  async renamePath(
    id: string,
    oldPath: string,
    newPath: string
  ): Promise<{ old_path: string; new_path: string; is_directory: boolean }> {
    return request<{ old_path: string; new_path: string; is_directory: boolean }>(
      `/api/workspaces/${encodeURIComponent(id)}/rename`,
      {
        method: "POST",
        body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
      }
    );
  },

  /** Detect available language runtimes and compilers */
  async getRuntimes(): Promise<LanguageRuntime[]> {
    return request<LanguageRuntime[]>("/api/workspaces/runtimes");
  },

  /** Build/compile project sources without executing */
  async build(id: string): Promise<BuildResult> {
    return request<BuildResult>(`/api/workspaces/${encodeURIComponent(id)}/build`, {
      method: "POST",
    });
  },

  /** Run project code */
  async run(id: string, command?: string): Promise<ExecutionResult> {
    return request<ExecutionResult>(`/api/workspaces/${encodeURIComponent(id)}/run`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  },

  /** Run project tests */
  async test(id: string, command?: string): Promise<ExecutionResult> {
    return request<ExecutionResult>(`/api/workspaces/${encodeURIComponent(id)}/test`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  },

  /** Stop running process */
  async stop(id: string, executionId?: string): Promise<{ success: boolean; workspace_id: string; execution_id?: string }> {
    const url = executionId
      ? `/api/workspaces/${encodeURIComponent(id)}/executions/${encodeURIComponent(executionId)}/stop`
      : `/api/workspaces/${encodeURIComponent(id)}/stop`;
    return request<{ success: boolean; workspace_id: string; execution_id?: string }>(url, {
      method: "POST",
    });
  },

  /** Apply structured patch proposed by Solix */
  async applyPatch(
    id: string,
    file: string,
    replacementContent: string
  ): Promise<{ success: boolean; file: string; diff: string }> {
    return request<{ success: boolean; file: string; diff: string }>(
      `/api/workspaces/${encodeURIComponent(id)}/apply-patch`,
      {
        method: "POST",
        body: JSON.stringify({ file, replacement_content: replacementContent }),
      }
    );
  },

  /** Query read-only Git status */
  async getGitStatus(id: string): Promise<GitStatus> {
    return request<GitStatus>(`/api/workspaces/${encodeURIComponent(id)}/git/status`);
  },

  /** Get fully-qualified SSE chat URL */
  getChatUrl(id: string): string {
    return getApiUrl(`/api/workspaces/${encodeURIComponent(id)}/chat`);
  },

  /** Get fully-qualified SSE Autonomous Agent URL */
  getAgentRunUrl(id: string): string {
    return getApiUrl(`/api/workspaces/${encodeURIComponent(id)}/agent/run`);
  },

  /** Approve or reject an agent staged file change */
  async approveAgentChange(
    id: string,
    taskId: string,
    approvalId: string,
    approved: boolean
  ): Promise<{ success: boolean; approval_id: string; approved: boolean }> {
    return request<{ success: boolean; approval_id: string; approved: boolean }>(
      `/api/workspaces/${encodeURIComponent(id)}/agent/${encodeURIComponent(taskId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ approval_id: approvalId, approved }),
      }
    );
  },

  /** Stop and cancel an active autonomous agent task */
  async stopAgentTask(
    id: string,
    taskId: string
  ): Promise<{ success: boolean; task_id: string }> {
    return request<{ success: boolean; task_id: string }>(
      `/api/workspaces/${encodeURIComponent(id)}/agent/${encodeURIComponent(taskId)}/stop`,
      {
        method: "POST",
      }
    );
  },
};


