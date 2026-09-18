"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceApi } from "@/lib/api";
import {
  CodingChatMessage,
  CodePatch,
  ExecutionResult,
  FileNode,
  GitStatus,
  LanguageRuntime,
  Problem,
  Workspace,
} from "@/types/workspace";

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & File Editor State
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, string>>({});
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [selectedLineRange, setSelectedLineRange] = useState<{ start: number; end: number } | null>(null);

  // Execution & Terminal State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "git">("terminal");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [targetProblem, setTargetProblem] = useState<Problem | null>(null);
  const [availableRuntimes, setAvailableRuntimes] = useState<LanguageRuntime[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  // Git State
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  // AI Coding Chat & Patch State
  const [messages, setMessages] = useState<CodingChatMessage[]>([]);
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false);
  const [activePatch, setActivePatch] = useState<CodePatch | null>(null);
  const [isReviewingDiff, setIsReviewingDiff] = useState<boolean>(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Available Runtimes / Compilers
  const loadRuntimes = useCallback(async () => {
    try {
      const runtimes = await workspaceApi.getRuntimes();
      setAvailableRuntimes(runtimes);
    } catch (err) {
      console.error("Failed to load runtimes:", err);
    }
  }, []);

  useEffect(() => {
    loadRuntimes();
  }, [loadRuntimes]);

  // Load Workspaces List
  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let list = await workspaceApi.listWorkspaces();
      if (!list || list.length === 0) {
        // Automatically create a default starter workspace if none exists
        const defaultWs = await workspaceApi.createWorkspace("My Project", "starter-python");
        list = [defaultWs];
      }
      setWorkspaces(list);
      if (!activeWorkspace && list.length > 0) {
        setActiveWorkspace(list[0]);
      }
    } catch (err: any) {
      console.error("Failed to load workspaces:", err);
      setError(err.message || "Failed to load workspaces");
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // Load File Tree and Git status when active workspace changes
  const refreshWorkspace = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const [tree, git] = await Promise.all([
        workspaceApi.getFileTree(activeWorkspace.id).catch(() => []),
        workspaceApi.getGitStatus(activeWorkspace.id).catch(() => ({ is_repo: false, modified: [], untracked: [] })),
      ]);
      setFileTree(tree);
      setGitStatus(git);

      // If no file is open, open main.py, main.cpp, index.js or the first file found
      if (openFiles.length === 0 && tree.length > 0) {
        const firstFile = tree.find((n) => !n.is_directory);
        if (firstFile) {
          openFile(firstFile.path);
        }
      }
    } catch (err: any) {
      console.error("Failed to refresh workspace:", err);
    }
  }, [activeWorkspace, openFiles.length]);

  useEffect(() => {
    if (activeWorkspace) {
      refreshWorkspace();
    }
  }, [activeWorkspace, refreshWorkspace]);

  // Switch Active Workspace
  const selectWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    setOpenFiles([]);
    setActiveFile(null);
    setFileContents({});
    setDirtyFiles({});
    setTerminalOutput("");
    setLastResult(null);
    setProblems([]);
    setTargetProblem(null);
    setActiveExecutionId(null);
    setMessages([]);
    setActivePatch(null);
  };

  // Create Workspace
  const createNewWorkspace = async (name?: string, template: string = "starter-python") => {
    try {
      const ws = await workspaceApi.createWorkspace(name, template);
      setWorkspaces((prev) => [ws, ...prev]);
      selectWorkspace(ws);
      return ws;
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
      throw err;
    }
  };

  // Open a file into editor tabs
  const openFile = async (path: string) => {
    if (!activeWorkspace) return;

    if (!openFiles.includes(path)) {
      setOpenFiles((prev) => [...prev, path]);
    }
    setActiveFile(path);

    // Fetch content if not already cached
    if (fileContents[path] === undefined) {
      try {
        const fileData = await workspaceApi.readFile(activeWorkspace.id, path);
        setFileContents((prev) => ({ ...prev, [path]: fileData.content }));
      } catch (err: any) {
        console.error(`Failed to read file ${path}:`, err);
      }
    }
  };

  // Close an open tab
  const closeFile = (path: string) => {
    const nextOpen = openFiles.filter((p) => p !== path);
    setOpenFiles(nextOpen);

    // If closing active file, switch to adjacent tab
    if (activeFile === path) {
      setActiveFile(nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null);
    }
  };

  // Update file content in dirty state
  const updateContent = (path: string, newContent: string) => {
    const orig = fileContents[path] ?? "";
    if (newContent === orig) {
      // Clean
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    } else {
      // Dirty
      setDirtyFiles((prev) => ({ ...prev, [path]: newContent }));
    }
  };

  // Save active file or specified file
  const saveFile = async (targetPath?: string) => {
    const path = targetPath || activeFile;
    if (!activeWorkspace || !path) return;

    const contentToSave = dirtyFiles[path] !== undefined ? dirtyFiles[path] : fileContents[path];
    if (contentToSave === undefined) return;

    try {
      await workspaceApi.writeFile(activeWorkspace.id, path, contentToSave);
      setFileContents((prev) => ({ ...prev, [path]: contentToSave }));
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      // Refresh tree to update file sizes
      const tree = await workspaceApi.getFileTree(activeWorkspace.id);
      setFileTree(tree);
    } catch (err: any) {
      console.error(`Failed to save ${path}:`, err);
      setError(err.message || `Failed to save ${path}`);
    }
  };

  // Create new file or folder
  const createFileOrDir = async (path: string, isDirectory: boolean, initialContent: string = "") => {
    if (!activeWorkspace) return;
    try {
      await workspaceApi.createFileOrDir(activeWorkspace.id, path, isDirectory, initialContent);
      const tree = await workspaceApi.getFileTree(activeWorkspace.id);
      setFileTree(tree);
      if (!isDirectory) {
        await openFile(path);
      }
    } catch (err: any) {
      console.error("Failed to create file/folder:", err);
      throw err;
    }
  };

  // Delete file or folder
  const deleteFileOrDir = async (path: string) => {
    if (!activeWorkspace) return;
    try {
      await workspaceApi.deletePath(activeWorkspace.id, path);
      closeFile(path);
      const tree = await workspaceApi.getFileTree(activeWorkspace.id);
      setFileTree(tree);
    } catch (err: any) {
      console.error("Failed to delete path:", err);
      throw err;
    }
  };

  // Rename file or folder
  const renameFileOrDir = async (oldPath: string, newPath: string) => {
    if (!activeWorkspace) return;
    try {
      await workspaceApi.renamePath(activeWorkspace.id, oldPath, newPath);
      // Update open files if renamed
      setOpenFiles((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
      if (activeFile === oldPath) {
        setActiveFile(newPath);
      }
      // Migrate contents cache
      if (fileContents[oldPath] !== undefined) {
        setFileContents((prev) => {
          const next = { ...prev, [newPath]: prev[oldPath] };
          delete next[oldPath];
          return next;
        });
      }
      const tree = await workspaceApi.getFileTree(activeWorkspace.id);
      setFileTree(tree);
    } catch (err: any) {
      console.error("Failed to rename path:", err);
      throw err;
    }
  };

  // Build / Compile Project Sources
  const buildProject = async () => {
    if (!activeWorkspace || isRunning) return;
    try {
      setIsRunning(true);
      setTerminalTab("terminal");
      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "🔨 Building project...\n");

      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const result = await workspaceApi.build(activeWorkspace.id);
      setActiveExecutionId(result.execution_id || null);
      setProblems(result.problems || []);

      const combined = result.stdout + (result.stderr ? "\n" + result.stderr : "");
      const statusText = result.success
        ? `\n[Build succeeded in ${result.build_time}s${result.binary_path ? ` -> ${result.binary_path}` : ""}]`
        : `\n[Build failed with code ${result.exit_code} in ${result.build_time}s]`;

      setTerminalOutput((prev) => prev + combined + statusText);

      // Automatically focus problems tab if there are errors or diagnostics
      if (!result.success || (result.problems && result.problems.length > 0)) {
        setTerminalTab("problems");
      }
      return result;
    } catch (err: any) {
      setTerminalOutput((prev) => prev + `\n[Build Error]: ${err.message || "Failed to build project"}`);
    } finally {
      setIsRunning(false);
      setActiveExecutionId(null);
    }
  };

  // Execute Code (Run)
  const runProject = async (customCommand?: string) => {
    if (!activeWorkspace || isRunning) return;
    try {
      setIsRunning(true);
      setTerminalTab("terminal");
      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "▶ Running project...\n");

      // Save active dirty files before running
      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const result = await workspaceApi.run(activeWorkspace.id, customCommand);
      setActiveExecutionId(result.execution_id || null);
      setLastResult(result);
      if (result.problems) {
        setProblems(result.problems);
      }
      const combined = result.stdout + (result.stderr ? "\n" + result.stderr : "");
      setTerminalOutput((prev) => prev + combined + `\n[Process exited with code ${result.exit_code} in ${result.execution_time}s]`);
      // Update problems tab if error or diagnostics found
      if (result.exit_code !== 0 || (result.problems && result.problems.length > 0)) {
        setTerminalTab("problems");
      }
      return result;
    } catch (err: any) {
      setTerminalOutput((prev) => prev + `\n[Error]: ${err.message || "Failed to execute code"}`);
    } finally {
      setIsRunning(false);
      setActiveExecutionId(null);
    }
  };

  // Run Tests (Test)
  const testProject = async (customCommand?: string) => {
    if (!activeWorkspace || isRunning) return;
    try {
      setIsRunning(true);
      setTerminalTab("terminal");
      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "🧪 Running tests...\n");

      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const result = await workspaceApi.test(activeWorkspace.id, customCommand);
      setActiveExecutionId(result.execution_id || null);
      setLastResult(result);
      if (result.problems) {
        setProblems(result.problems);
      }
      const combined = result.stdout + (result.stderr ? "\n" + result.stderr : "");
      setTerminalOutput((prev) => prev + combined + `\n[Tests completed with code ${result.exit_code} in ${result.execution_time}s]`);
      if (result.exit_code !== 0 || (result.problems && result.problems.length > 0)) {
        setTerminalTab("problems");
      }
      return result;
    } catch (err: any) {
      setTerminalOutput((prev) => prev + `\n[Test Error]: ${err.message || "Failed to run tests"}`);
    } finally {
      setIsRunning(false);
      setActiveExecutionId(null);
    }
  };

  // Stop Running Process
  const stopProject = async () => {
    if (!activeWorkspace) return;
    try {
      await workspaceApi.stop(activeWorkspace.id, activeExecutionId || undefined);
      setIsRunning(false);
      setActiveExecutionId(null);
      setTerminalOutput((prev) => prev + "\n[Execution stopped by user]");
    } catch (err: any) {
      console.error("Failed to stop process:", err);
    }
  };

  // Jump to specific problem in editor
  const jumpToProblem = (problem: Problem) => {
    if (problem.file) {
      openFile(problem.file);
    }
    setTargetProblem(problem);
  };

  // Clear Terminal Output
  const clearTerminal = () => {
    setTerminalOutput("");
    setLastResult(null);
  };

  // Send Coding AI Message with Grounded Context
  const sendCodingMessage = async (
    prompt: string,
    options: {
      webSearch?: boolean;
      customAction?: "explain" | "debug" | "fix" | "refactor" | "tests" | "doc";
    } = {}
  ) => {
    if (!activeWorkspace || isAIGenerating || !prompt.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Include terminal context if debugging
    let termCtx = "";
    if (options.customAction === "debug" || prompt.toLowerCase().includes("debug") || (lastResult && lastResult.exit_code !== 0)) {
      if (lastResult?.stderr) {
        termCtx = lastResult.stderr;
      } else if (terminalOutput) {
        termCtx = terminalOutput.slice(-2000);
      }
    }

    const newMessages: CodingChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        content: prompt,
        timestamp: new Date(),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ];

    setMessages(newMessages);
    setIsAIGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(workspaceApi.getChatUrl(activeWorkspace.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          current_file: activeFile,
          selected_code: selectedCode,
          open_files: openFiles,
          terminal_context: termCtx,
          web_search: options.webSearch ?? webSearchEnabled,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";
      let foundPatch: CodePatch | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "token" && event.text) {
              accumulatedText += event.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: accumulatedText } : m
                )
              );
            } else if (event.type === "patch_ready") {
              foundPatch = {
                file: event.file,
                explanation: event.explanation,
                replacement_content: event.replacement_content,
                diff: event.diff,
              };
              setActivePatch(foundPatch);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, patch: foundPatch! } : m
                )
              );
            } else if (event.type === "search_results") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, sources: event.sources } : m
                )
              );
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, isStreaming: false, content: accumulatedText, patch: foundPatch || m.patch }
            : m
        )
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, isStreaming: false, content: m.content + `\n\n[Error: ${err.message || "Failed to generate response"}]` }
              : m
          )
        );
      }
    } finally {
      setIsAIGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Apply proposed patch
  const applyPatch = async (patch: CodePatch) => {
    if (!activeWorkspace) return;
    try {
      await workspaceApi.applyPatch(activeWorkspace.id, patch.file, patch.replacement_content);
      // Update cached content and clear dirty state
      setFileContents((prev) => ({ ...prev, [patch.file]: patch.replacement_content }));
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[patch.file];
        return next;
      });
      // Make sure the file is opened
      await openFile(patch.file);
      setIsReviewingDiff(false);
      setActivePatch(null);
    } catch (err: any) {
      console.error("Failed to apply patch:", err);
      setError(err.message || "Failed to apply patch");
    }
  };

  // Reject proposed patch
  const rejectPatch = () => {
    setActivePatch(null);
    setIsReviewingDiff(false);
  };

  return {
    workspaces,
    activeWorkspace,
    selectWorkspace,
    createNewWorkspace,
    fileTree,
    refreshWorkspace,
    isLoading,
    error,

    // Editor & Tabs
    openFiles,
    activeFile,
    openFile,
    closeFile,
    fileContents,
    dirtyFiles,
    updateContent,
    saveFile,
    createFileOrDir,
    deleteFileOrDir,
    renameFileOrDir,
    selectedCode,
    setSelectedCode,
    selectedLineRange,
    setSelectedLineRange,

    // Execution & Terminal
    isRunning,
    terminalOutput,
    lastResult,
    terminalTab,
    setTerminalTab,
    buildProject,
    runProject,
    testProject,
    stopProject,
    clearTerminal,
    problems,
    setProblems,
    targetProblem,
    setTargetProblem,
    jumpToProblem,
    availableRuntimes,
    loadRuntimes,

    // Git
    gitStatus,

    // AI Coding Assistant
    messages,
    isAIGenerating,
    sendCodingMessage,
    activePatch,
    isReviewingDiff,
    setIsReviewingDiff,
    applyPatch,
    rejectPatch,
    webSearchEnabled,
    setWebSearchEnabled,
  };
}

