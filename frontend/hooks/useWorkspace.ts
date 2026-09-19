"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceStorage, StoredFile } from "@/lib/storage/workspaceStorage";
import { workspaceMigration } from "@/lib/storage/workspaceMigration";
import { executionEngine, SandboxStatus } from "@/lib/execution/ExecutionEngine";
import { webPreviewBuilder } from "@/lib/execution/WebPreviewBuilder";
import { workspaceApi } from "@/lib/api";
import {
  CodingChatMessage,
  CodePatch,
  ConsoleLogMessage,
  ExecutionResult,
  FileNode,
  GitStatus,
  LanguageRuntime,
  Problem,
  Workspace,
  AgentState,
  AgentPlanStep,
  AgentToolActivity,
  AgentApprovalRequest,
} from "@/types/workspace";

export interface StorageStats {
  bytes: number;
  fileCount: number;
  isSaving: boolean;
  lastSavedAt: number | null;
}

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
  const [terminalTab, setTerminalTab] = useState<"terminal" | "problems" | "git" | "console">("terminal");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [targetProblem, setTargetProblem] = useState<Problem | null>(null);
  const [availableRuntimes, setAvailableRuntimes] = useState<LanguageRuntime[]>([]);

  // Web Live Preview & Console State
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("solix_ide_preview_open") === "true";
    }
    return false;
  });
  const [isLivePreview, setIsLivePreview] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("solix_ide_preview_live") !== "false";
    }
    return true;
  });
  const [previewViewport, setPreviewViewportState] = useState<"desktop" | "tablet" | "mobile" | "responsive">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("solix_ide_preview_viewport") as any) || "desktop";
    }
    return "desktop";
  });
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogMessage[]>([]);

  // Local Storage Stats & Auto-save
  const [storageStats, setStorageStats] = useState<StorageStats>({
    bytes: 0,
    fileCount: 0,
    isSaving: false,
    lastSavedAt: null,
  });

  // Git State
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);

  // AI Coding Chat & Patch State
  const [messages, setMessages] = useState<CodingChatMessage[]>([]);
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false);
  const [activePatch, setActivePatch] = useState<CodePatch | null>(null);
  const [isReviewingDiff, setIsReviewingDiff] = useState<boolean>(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);

  // Autonomous Coding Agent State
  const [agentMode, setAgentMode] = useState<"ask" | "agent">("agent");
  const [autoApply, setAutoApply] = useState<boolean>(false);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [currentPlan, setCurrentPlan] = useState<AgentPlanStep[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<AgentApprovalRequest | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoSaveTimerRef = useRef<Record<string, any>>({});

  // 1. Load Available Runtimes (Truthful Browser Engine)
  const loadRuntimes = useCallback(() => {
    const runtimes = executionEngine.getAvailableRuntimes();
    setAvailableRuntimes(runtimes);
  }, []);

  useEffect(() => {
    loadRuntimes();
  }, [loadRuntimes]);

  // 2. Load Local Workspaces from IndexedDB (with auto-migration check)
  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let list = await workspaceStorage.listWorkspaces();

      if (list.length === 0) {
        // Check if legacy workspaces exist on server
        const hasLegacy = await workspaceMigration.checkPendingMigration();
        if (hasLegacy) {
          const migratedCount = await workspaceMigration.migrateServerWorkspaces();
          if (migratedCount > 0) {
            list = await workspaceStorage.listWorkspaces();
          }
        }

        // If still empty, create default starter workspace locally
        if (list.length === 0) {
          const defaultWs = await workspaceStorage.createWorkspace("My Project", "starter-python");
          list = [defaultWs];
        }
      }

      setWorkspaces(list);
      if (!activeWorkspace && list.length > 0) {
        setActiveWorkspace(list[0]);
      }
    } catch (err: any) {
      console.error("Failed to load local workspaces:", err);
      setError(err.message || "Failed to load local workspaces");
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // 3. Refresh Workspace File Tree and Storage Stats
  const refreshWorkspace = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const [tree, usage] = await Promise.all([
        workspaceStorage.getFileTree(activeWorkspace.id),
        workspaceStorage.getStorageUsage(activeWorkspace.id),
      ]);

      setFileTree(tree);
      setStorageStats((prev) => ({
        ...prev,
        bytes: usage.bytes,
        fileCount: usage.fileCount,
        lastSavedAt: Date.now(),
      }));

      // Open first file if no file is open
      if (openFiles.length === 0 && tree.length > 0) {
        const firstFile = tree.find((n) => !n.is_directory);
        if (firstFile) {
          openFile(firstFile.path);
        }
      }
    } catch (err: any) {
      console.error("Failed to refresh local workspace:", err);
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
    setMessages([]);
    setActivePatch(null);
    setPendingApproval(null);
    setConsoleLogs([]);
  };

  // Web Project Detection
  const isWebProject = Boolean(
    activeWorkspace?.template?.startsWith("starter-web") ||
    fileTree.some((f) => f.path === "index.html" || f.name === "index.html") ||
    openFiles.some((f) => f.endsWith(".html"))
  );

  const togglePreview = useCallback(() => {
    setIsPreviewOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("solix_ide_preview_open", String(next));
      }
      return next;
    });
  }, []);

  const toggleLivePreview = useCallback(() => {
    setIsLivePreview((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("solix_ide_preview_live", String(next));
      }
      return next;
    });
  }, []);

  const setPreviewViewport = useCallback((vp: "desktop" | "tablet" | "mobile" | "responsive") => {
    setPreviewViewportState(vp);
    if (typeof window !== "undefined") {
      localStorage.setItem("solix_ide_preview_viewport", vp);
    }
  }, []);

  const clearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!activeWorkspace) return null;
    try {
      const allFiles = await workspaceStorage.getAllFiles(activeWorkspace.id);
      const res = await webPreviewBuilder.buildAndValidate(allFiles, activeFile);
      setPreviewHtml(res.html);
      return res;
    } catch (err) {
      console.error("Failed to refresh preview:", err);
      return null;
    }
  }, [activeWorkspace, activeFile]);

  // Handle postMessage from preview iframe sandbox
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "solix-preview-console") {
        const newLog: ConsoleLogMessage = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: data.level || "log",
          text: data.text || "",
          timestamp: data.timestamp || Date.now(),
        };
        setConsoleLogs((prev) => [...prev.slice(-200), newLog]);
      } else if (data.type === "solix-preview-error") {
        const errorLog: ConsoleLogMessage = {
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: "error",
          text: data.message || "Runtime error in preview",
          timestamp: data.timestamp || Date.now(),
          file: data.file,
          line: data.line,
          column: data.column,
        };
        setConsoleLogs((prev) => [...prev.slice(-200), errorLog]);

        const prob: Problem = {
          severity: "error",
          file: data.file || "script.js",
          line: data.line || 1,
          column: data.column || 1,
          message: data.message || "Runtime error in preview",
          source: "Preview Runtime",
        };
        setProblems((prev) => {
          const exists = prev.some(
            (p) => p.file === prob.file && p.line === prob.line && p.message === prob.message
          );
          return exists ? prev : [...prev, prob];
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Debounced live preview snapshot update
  useEffect(() => {
    if (!isLivePreview || !isPreviewOpen || !activeWorkspace) return;
    const timer = setTimeout(() => {
      refreshPreview();
    }, 350);
    return () => clearTimeout(timer);
  }, [fileContents, dirtyFiles, isLivePreview, isPreviewOpen, activeWorkspace, refreshPreview]);

  // Create Workspace
  const createNewWorkspace = async (name?: string, template: string = "starter-python") => {
    try {
      const wsName = name && name.trim() ? name.trim() : "New Project";
      const ws = await workspaceStorage.createWorkspace(wsName, template);
      setWorkspaces((prev) => [ws, ...prev]);
      selectWorkspace(ws);
      return ws;
    } catch (err: any) {
      setError(err.message || "Failed to create workspace");
      throw err;
    }
  };

  // Delete Workspace
  const deleteWorkspace = async (id: string) => {
    try {
      await workspaceStorage.deleteWorkspace(id);
      const remaining = workspaces.filter((w) => w.id !== id);
      setWorkspaces(remaining);
      if (activeWorkspace?.id === id) {
        if (remaining.length > 0) {
          selectWorkspace(remaining[0]);
        } else {
          const defaultWs = await workspaceStorage.createWorkspace("My Project", "starter-python");
          setWorkspaces([defaultWs]);
          selectWorkspace(defaultWs);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete workspace");
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

    // Read from local IndexedDB if not cached
    if (fileContents[path] === undefined) {
      try {
        const content = await workspaceStorage.readFile(activeWorkspace.id, path);
        setFileContents((prev) => ({ ...prev, [path]: content }));
      } catch (err: any) {
        console.error(`Failed to read file ${path}:`, err);
      }
    }
  };

  // Close an open tab
  const closeFile = (path: string) => {
    const nextOpen = openFiles.filter((p) => p !== path);
    setOpenFiles(nextOpen);

    if (activeFile === path) {
      setActiveFile(nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null);
    }
  };

  // Save active file or specified file
  const saveFile = async (targetPath?: string) => {
    const path = targetPath || activeFile;
    if (!activeWorkspace || !path) return;

    const contentToSave = dirtyFiles[path] !== undefined ? dirtyFiles[path] : fileContents[path];
    if (contentToSave === undefined) return;

    try {
      setStorageStats((prev) => ({ ...prev, isSaving: true }));
      await workspaceStorage.writeFile(activeWorkspace.id, path, contentToSave);
      setFileContents((prev) => ({ ...prev, [path]: contentToSave }));
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      const tree = await workspaceStorage.getFileTree(activeWorkspace.id);
      const usage = await workspaceStorage.getStorageUsage(activeWorkspace.id);
      setFileTree(tree);
      setStorageStats({
        bytes: usage.bytes,
        fileCount: usage.fileCount,
        isSaving: false,
        lastSavedAt: Date.now(),
      });
    } catch (err: any) {
      console.error(`Failed to save ${path}:`, err);
      setStorageStats((prev) => ({ ...prev, isSaving: false }));
      setError(err.message || `Failed to save ${path}`);
    }
  };

  // Update file content with debounced local auto-save (500ms)
  const updateContent = (path: string, newContent: string) => {
    const orig = fileContents[path] ?? "";
    if (newContent === orig) {
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    } else {
      setDirtyFiles((prev) => ({ ...prev, [path]: newContent }));
      setStorageStats((prev) => ({ ...prev, isSaving: true }));

      // Debounce auto-save
      if (autoSaveTimerRef.current[path]) {
        clearTimeout(autoSaveTimerRef.current[path]);
      }
      autoSaveTimerRef.current[path] = setTimeout(async () => {
        if (activeWorkspace) {
          try {
            await workspaceStorage.writeFile(activeWorkspace.id, path, newContent);
            setFileContents((prev) => ({ ...prev, [path]: newContent }));
            setDirtyFiles((prev) => {
              const next = { ...prev };
              delete next[path];
              return next;
            });
            const usage = await workspaceStorage.getStorageUsage(activeWorkspace.id);
            setStorageStats({
              bytes: usage.bytes,
              fileCount: usage.fileCount,
              isSaving: false,
              lastSavedAt: Date.now(),
            });
          } catch (e) {
            setStorageStats((prev) => ({ ...prev, isSaving: false }));
          }
        }
      }, 500);
    }
  };

  // Create new file or folder
  const createFileOrDir = async (path: string, isDirectory: boolean, initialContent: string = "") => {
    if (!activeWorkspace) return;
    try {
      if (isDirectory) {
        await workspaceStorage.createFolder(activeWorkspace.id, path);
      } else {
        await workspaceStorage.writeFile(activeWorkspace.id, path, initialContent);
      }
      const tree = await workspaceStorage.getFileTree(activeWorkspace.id);
      setFileTree(tree);
      if (!isDirectory) {
        await openFile(path);
      }
      const usage = await workspaceStorage.getStorageUsage(activeWorkspace.id);
      setStorageStats((prev) => ({ ...prev, bytes: usage.bytes, fileCount: usage.fileCount }));
    } catch (err: any) {
      console.error("Failed to create file/folder:", err);
      throw err;
    }
  };

  // Delete file or folder
  const deleteFileOrDir = async (path: string) => {
    if (!activeWorkspace) return;
    try {
      await workspaceStorage.deleteFile(activeWorkspace.id, path);
      await workspaceStorage.deleteFolder(activeWorkspace.id, path);
      closeFile(path);
      const tree = await workspaceStorage.getFileTree(activeWorkspace.id);
      setFileTree(tree);
      const usage = await workspaceStorage.getStorageUsage(activeWorkspace.id);
      setStorageStats((prev) => ({ ...prev, bytes: usage.bytes, fileCount: usage.fileCount }));
    } catch (err: any) {
      console.error("Failed to delete path:", err);
      throw err;
    }
  };

  // Rename file or folder
  const renameFileOrDir = async (oldPath: string, newPath: string) => {
    if (!activeWorkspace) return;
    try {
      await workspaceStorage.renamePath(activeWorkspace.id, oldPath, newPath);
      setOpenFiles((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
      if (activeFile === oldPath) {
        setActiveFile(newPath);
      }
      if (fileContents[oldPath] !== undefined) {
        setFileContents((prev) => {
          const next = { ...prev, [newPath]: prev[oldPath] };
          delete next[oldPath];
          return next;
        });
      }
      const tree = await workspaceStorage.getFileTree(activeWorkspace.id);
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

      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const allFiles = await workspaceStorage.getAllFiles(activeWorkspace.id);

      // Web Project Validation Pipeline
      if (webPreviewBuilder.isWebProject(allFiles)) {
        setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "🔨 Building & Validating Web Project...\n");
        const res = await webPreviewBuilder.buildAndValidate(allFiles, activeFile);
        setPreviewHtml(res.html);

        let report = `Entry point: ${res.entryFile || "none"}\n` +
          `Linked styles: ${res.linkedStyles.join(", ") || "none"}\n` +
          `Linked scripts: ${res.linkedScripts.join(", ") || "none"}\n` +
          `Assets: ${res.assets.length} referenced\n`;

        if (res.problems.length > 0) {
          report += `Diagnostics: ${res.problems.length} issue(s) detected.\n`;
          setProblems((prev) => {
            const nonWeb = prev.filter((p) => !p.source.includes("Validator"));
            return [...nonWeb, ...res.problems];
          });
          setTerminalTab("problems");
        } else {
          report += `✓ Validation passed. Preview snapshot ready.\n`;
        }

        setTerminalOutput((prev) => prev + report);
        return;
      }

      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "🔨 Building project...\n");
      const runtime = executionEngine.detectRuntime(allFiles, activeFile);

      if (!runtime.build_required) {
        const msg = `[Build]: ${runtime.display_name} is an interpreted/transpiled language. Direct build step not required.\nUse 'Run' to execute in the browser sandbox.\n`;
        setTerminalOutput((prev) => prev + msg);
        return;
      }

      const status = executionEngine.getSandboxStatus(allFiles, activeFile);
      if (status.mode === "unavailable") {
        const errText = `\n[Build Unavailable]: ${runtime.display_name} local compiler is unavailable in the browser sandbox.\n` +
                        `To build ${runtime.display_name}, connect the optional Solix Native Runtime.\n`;
        setTerminalOutput((prev) => prev + errText);
        setTerminalTab("problems");
        setProblems([
          {
            severity: "error",
            file: activeFile || "",
            line: 1,
            column: 1,
            message: `${runtime.display_name} local compiler unavailable in browser`,
            source: "Solix",
          },
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Execute Code in Browser-Local Web Worker or Launch Web Preview
  const runProject = async () => {
    if (!activeWorkspace || isRunning) return;
    try {
      setIsRunning(true);
      setTerminalTab("terminal");

      // Save any pending dirty edits
      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const allFiles = await workspaceStorage.getAllFiles(activeWorkspace.id);

      // Web Project Launch
      if (webPreviewBuilder.isWebProject(allFiles)) {
        setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + `▶ Web Project Preview\n`);
        const res = await webPreviewBuilder.buildAndValidate(allFiles, activeFile);
        setPreviewHtml(res.html);
        setIsPreviewOpen(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("solix_ide_preview_open", "true");
        }

        let report = `Local virtual file system mounted.\n` +
          `Preview launched for ${res.entryFile || "index.html"}.\n`;

        if (res.problems.length > 0) {
          setProblems((prev) => {
            const nonWeb = prev.filter((p) => !p.source.includes("Validator"));
            return [...nonWeb, ...res.problems];
          });
          report += `[Warning]: ${res.problems.length} issue(s) detected during build. Check Problems tab.\n`;
        }

        setTerminalOutput((prev) => prev + report);
        return;
      }

      const target = activeFile || "main.py";
      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + `▶ ${target}\n`);

      const result = await executionEngine.run(activeWorkspace.id, allFiles, activeFile, {
        onStdout: (chunk) => setTerminalOutput((prev) => prev + chunk),
        onStderr: (chunk) => setTerminalOutput((prev) => prev + chunk),
      });

      setLastResult(result);
      if (result.problems) {
        setProblems(result.problems);
      }

      setTerminalOutput(
        (prev) => prev + `\n[Process exited with code ${result.exit_code} in ${result.execution_time}s]\n`
      );

      if (result.exit_code !== 0 || (result.problems && result.problems.length > 0)) {
        setTerminalTab("problems");
      }
      return result;
    } catch (err: any) {
      setTerminalOutput((prev) => prev + `\n[Error]: ${err.message || "Failed to execute code"}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run Tests in Browser-Local Web Worker or Run Web Validation Suite
  const testProject = async () => {
    if (!activeWorkspace || isRunning) return;
    try {
      setIsRunning(true);
      setTerminalTab("terminal");
      setTerminalOutput((prev) => prev + (prev ? "\n\n" : "") + "🧪 Running test suite in browser sandbox...\n");

      if (activeFile && dirtyFiles[activeFile] !== undefined) {
        await saveFile(activeFile);
      }

      const allFiles = await workspaceStorage.getAllFiles(activeWorkspace.id);

      // Web Project Validation Test Suite
      if (webPreviewBuilder.isWebProject(allFiles)) {
        const res = await webPreviewBuilder.buildAndValidate(allFiles, activeFile);
        let report = `[Web Project Validation Test Suite]:\n` +
          `HTML & Asset Links: ${res.problems.filter(p => p.source.includes("HTML") || p.source.includes("Link")).length === 0 ? "✓ Passed" : "✕ Errors detected"}\n` +
          `CSS Syntax: ${res.problems.filter(p => p.source.includes("CSS")).length === 0 ? "✓ Passed" : "✕ Errors detected"}\n` +
          `JavaScript Syntax: ${res.problems.filter(p => p.source.includes("JavaScript")).length === 0 ? "✓ Passed" : "✕ Errors detected"}\n`;

        if (res.problems.length > 0) {
          setProblems((prev) => {
            const nonWeb = prev.filter((p) => !p.source.includes("Validator"));
            return [...nonWeb, ...res.problems];
          });
          setTerminalTab("problems");
          report += `\nTest suite finished with ${res.problems.length} failure(s).\n`;
        } else {
          report += `\nAll web validation tests passed successfully (0 errors).\n`;
        }

        setTerminalOutput((prev) => prev + report);
        return;
      }

      const result = await executionEngine.test(activeWorkspace.id, allFiles, {
        onStdout: (chunk) => setTerminalOutput((prev) => prev + chunk),
        onStderr: (chunk) => setTerminalOutput((prev) => prev + chunk),
      });

      setLastResult(result);
      if (result.problems) {
        setProblems(result.problems);
      }

      setTerminalOutput(
        (prev) => prev + `\n[Tests completed with code ${result.exit_code} in ${result.execution_time}s]\n`
      );

      if (result.exit_code !== 0 || (result.problems && result.problems.length > 0)) {
        setTerminalTab("problems");
      }
      return result;
    } catch (err: any) {
      setTerminalOutput((prev) => prev + `\n[Test Error]: ${err.message || "Failed to run tests"}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  // Stop Running Execution
  const stopProject = () => {
    executionEngine.stop();
    setIsRunning(false);
    setTerminalOutput((prev) => prev + "\n[Execution stopped by user]\n");
  };

  // Export Project to ZIP (100% Local, zero server uploads)
  const exportProject = async () => {
    if (!activeWorkspace) return;
    try {
      const blob = await workspaceStorage.exportWorkspace(activeWorkspace.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeWorkspace.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export failed:", err);
      alert("Failed to export project ZIP: " + err.message);
    }
  };

  // Import Project Files (from folder or drag-and-drop)
  const importProject = async (files: Array<{ path: string; content: string }>) => {
    if (!activeWorkspace) return;
    try {
      const count = await workspaceStorage.importFiles(activeWorkspace.id, files);
      await refreshWorkspace();
      return count;
    } catch (err: any) {
      console.error("Import failed:", err);
      throw err;
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

  // Respond to Pending Agent Approval
  const respondApproval = async (approvalId: string, approved: boolean) => {
    if (!activeWorkspace || !activeTaskId) return;
    try {
      await workspaceApi.approveAgentChange(activeWorkspace.id, activeTaskId, approvalId, approved);
      setPendingApproval(null);
    } catch (err: any) {
      console.error("Failed to respond to approval:", err);
      setError(err.message || "Failed to respond to approval");
    }
  };

  // Stop Running Autonomous Agent
  const stopAgent = async () => {
    if (!activeWorkspace) return;
    if (activeTaskId) {
      try {
        await workspaceApi.stopAgentTask(activeWorkspace.id, activeTaskId);
      } catch (err: any) {
        console.error("Failed to stop agent task:", err);
      }
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAIGenerating(false);
    setAgentState("cancelled");
    setActiveTaskId(null);
    setPendingApproval(null);
  };

  // Autonomous Agent Execution Loop
  const sendAutonomousAgentMessage = async (prompt: string) => {
    if (!activeWorkspace || isAIGenerating || !prompt.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

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
        plan: [],
        tools: [],
        agentState: "planning",
      },
    ];

    setMessages(newMessages);
    setIsAIGenerating(true);
    setAgentState("planning");
    setCurrentPlan([]);
    setPendingApproval(null);
    abortControllerRef.current = new AbortController();

    try {
      // Collect local files to send snapshot to ephemeral backend agent
      const localFiles = await workspaceStorage.getAllFiles(activeWorkspace.id);
      const filesPayload = localFiles.map((f) => ({ path: f.path, content: f.content }));

      const response = await fetch(workspaceApi.getAgentRunUrl(activeWorkspace.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          request: prompt,
          current_file: activeFile || null,
          active_file: activeFile || null,
          auto_apply: autoApply,
          files: filesPayload,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Agent run failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";
      let currentTools: AgentToolActivity[] = [];
      let latestPlan: AgentPlanStep[] = [];

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

            if (event.type === "agent_started") {
              setActiveTaskId(event.task_id);
            } else if (event.type === "state_change") {
              setAgentState(event.state);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, agentState: event.state } : m))
              );
            } else if (event.type === "plan_created") {
              latestPlan = event.plan || [];
              setCurrentPlan(latestPlan);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, plan: latestPlan } : m))
              );
            } else if (event.type === "token" && event.text) {
              accumulatedText += event.text;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulatedText } : m))
              );
            } else if (event.type === "tool_started") {
              const newTool: AgentToolActivity = {
                id: event.call_id || `tool-${Date.now()}`,
                name: event.tool,
                args: event.args || {},
                status: "running",
              };
              currentTools = [...currentTools, newTool];
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, tools: currentTools } : m))
              );
            } else if (event.type === "tool_completed") {
              currentTools = currentTools.map((t) =>
                t.name === event.tool && (t.status === "running" || t.id === event.call_id)
                  ? {
                      ...t,
                      status: event.result?.error ? "error" : "completed",
                      result: event.result,
                    }
                  : t
              );
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, tools: currentTools } : m))
              );

              if (["workspace_run", "workspace_test", "workspace_build"].includes(event.tool) && event.result) {
                const res = event.result;
                setLastResult(res);
                if (res.stdout || res.stderr) {
                  setTerminalOutput(
                    (prev) =>
                      prev +
                      `\n[Agent ${event.tool}]\n` +
                      (res.stdout ? res.stdout + "\n" : "") +
                      (res.stderr ? res.stderr + "\n" : "")
                  );
                }
                if (res.problems && res.problems.length > 0) {
                  setProblems(res.problems);
                }
              }
            } else if (event.type === "approval_required") {
              setPendingApproval(event.request);
              setAgentState("awaiting_approval");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, approval: event.request, agentState: "awaiting_approval" }
                    : m
                )
              );
            } else if (event.type === "changes_applied") {
              setPendingApproval(null);
              // Save change directly into local IndexedDB
              if (event.file && activeWorkspace) {
                const afterContent = event.result?.content ?? "";
                if (event.operation === "delete") {
                  workspaceStorage.deleteFile(activeWorkspace.id, event.file).catch(() => {});
                } else if (afterContent) {
                  workspaceStorage.writeFile(activeWorkspace.id, event.file, afterContent).then(() => {
                    setFileContents((prev) => ({ ...prev, [event.file]: afterContent }));
                  }).catch(() => {});
                }
              }
              refreshWorkspace();
            } else if (event.type === "changes_rejected") {
              setPendingApproval(null);
            } else if (event.type === "run_completed" || event.type === "test_completed") {
              if (event.result) {
                setLastResult(event.result);
                setTerminalOutput(
                  (prev) =>
                    prev +
                    `\n[Agent Execution Result: exit code ${event.result.exit_code}]\n` +
                    (event.result.stdout ? event.result.stdout + "\n" : "") +
                    (event.result.stderr ? event.result.stderr + "\n" : "")
                );
                if (event.result.problems && event.result.problems.length > 0) {
                  setProblems(event.result.problems);
                  setTerminalTab("problems");
                }
              }
            } else if (event.type === "agent_completed") {
              setAgentState("completed");
              refreshWorkspace();
            } else if (event.type === "agent_failed") {
              setAgentState("failed");
            } else if (event.type === "agent_cancelled") {
              setAgentState("cancelled");
            }
          } catch {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                isStreaming: false,
                content: accumulatedText || m.content,
                plan: latestPlan.length > 0 ? latestPlan : m.plan,
                tools: currentTools,
              }
            : m
        )
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setAgentState("failed");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  isStreaming: false,
                  agentState: "failed",
                  content:
                    m.content +
                    `\n\n[Agent Error: ${err.message || "Failed to complete agent task"}]`,
                }
              : m
          )
        );
      }
    } finally {
      setIsAIGenerating(false);
      setActiveTaskId(null);
      abortControllerRef.current = null;
    }
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

    if (agentMode === "agent" && !options.customAction) {
      return sendAutonomousAgentMessage(prompt);
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

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
          } catch {}
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

  // Apply proposed patch to local IndexedDB storage
  const applyPatch = async (patch: CodePatch) => {
    if (!activeWorkspace) return;
    try {
      await workspaceStorage.writeFile(activeWorkspace.id, patch.file, patch.replacement_content);
      setFileContents((prev) => ({ ...prev, [patch.file]: patch.replacement_content }));
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[patch.file];
        return next;
      });
      await openFile(patch.file);
      await refreshWorkspace();
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
    deleteWorkspace,
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

    // Local Storage & Export/Import
    exportProject,
    importProject,
    storageStats,

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

    // Autonomous Agent
    agentMode,
    setAgentMode,
    autoApply,
    setAutoApply,
    agentState,
    setAgentState,
    currentPlan,
    pendingApproval,
    setPendingApproval,
    respondApproval,
    stopAgent,

    // Web Project & Live Preview
    isWebProject,
    isPreviewOpen,
    setIsPreviewOpen,
    togglePreview,
    isLivePreview,
    setIsLivePreview,
    toggleLivePreview,
    previewViewport,
    setPreviewViewport,
    previewHtml,
    refreshPreview,
    consoleLogs,
    clearConsole,
  };
}
