"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  Code2,
  Cpu,
  Download,
  FolderTree,
  Globe,
  HardDrive,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Terminal as TerminalIcon,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FileExplorer } from "./FileExplorer";
import { CodeEditorPanel } from "./CodeEditorPanel";
import { AIPanel } from "./AIPanel";
import { TerminalPanel } from "./TerminalPanel";
import { PreviewPanel } from "./PreviewPanel";
import { DiffReviewModal } from "./DiffReviewModal";
import { CommandPaletteModal } from "./CommandPaletteModal";
import { SolixLogo } from "@/components/brand/SolixLogo";
import type { CodePatch, Workspace } from "@/types/workspace";
import { workspaceMigration } from "@/lib/storage/workspaceMigration";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getLanguageLabel(file: string | null): string {
  if (!file) return "Plain Text";
  const ext = file.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
      return "Python";
    case "js":
      return "JavaScript";
    case "jsx":
      return "JavaScript React";
    case "ts":
      return "TypeScript";
    case "tsx":
      return "TypeScript React";
    case "json":
      return "JSON";
    case "md":
      return "Markdown";
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "cpp":
    case "cc":
    case "cxx":
      return "C++";
    case "c":
    case "h":
      return "C";
    case "rs":
      return "Rust";
    case "go":
      return "Go";
    case "toml":
      return "TOML";
    case "yaml":
    case "yml":
      return "YAML";
    default:
      return ext ? ext.toUpperCase() : "Plain Text";
  }
}

interface WorkspaceViewProps {
  onBackToChat?: () => void;
  workspace: ReturnType<typeof useWorkspace>;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ onBackToChat, workspace }) => {
  const {
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
    targetProblem,
    jumpToProblem,
    availableRuntimes,

    // Local Storage & Export/Import
    exportProject,
    importProject,
    storageStats,

    // Git
    gitStatus,

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
    currentPlan,
    pendingApproval,
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
  } = workspace;

  // Editor cursor tracking for IDE status bar
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Navigation tab for mobile viewports
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "preview" | "ai" | "terminal">("editor");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceTemplate, setNewWorkspaceTemplate] = useState("starter-web");
  const [projectToDelete, setProjectToDelete] = useState<Workspace | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [showRuntimesModal, setShowRuntimesModal] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Legacy workspace migration states
  const [pendingMigration, setPendingMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationBannerDismissed, setMigrationBannerDismissed] = useState(false);
  const [migrationSuccessMsg, setMigrationSuccessMsg] = useState<string | null>(null);

  // Reviewing diff modal state
  const [reviewingModalPatch, setReviewingModalPatch] = useState<CodePatch | null>(null);
  const [reviewingOperation, setReviewingOperation] = useState<"create" | "modify" | "delete" | undefined>();
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);

  // Panel widths and heights with local persistence
  const [explorerWidth, setExplorerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solix_ide_explorer_width");
      if (saved) return Math.max(160, Math.min(450, parseInt(saved, 10)));
    }
    return 220;
  });

  const [aiWidth, setAiWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solix_ide_ai_width");
      if (saved) return Math.max(260, Math.min(650, parseInt(saved, 10)));
    }
    return 340;
  });

  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solix_ide_terminal_height");
      if (saved) return Math.max(100, Math.min(500, parseInt(saved, 10)));
    }
    return 220;
  });

  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isAiOpen, setIsAiOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  // Command palette state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"commands" | "files">("commands");

  // Drag resizer handlers
  const startResizingExplorer = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = explorerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(450, startWidth + (moveEvent.clientX - startX)));
      setExplorerWidth(newWidth);
      localStorage.setItem("solix_ide_explorer_width", String(newWidth));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startResizingAi = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = aiWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(650, startWidth - (moveEvent.clientX - startX)));
      setAiWidth(newWidth);
      localStorage.setItem("solix_ide_ai_width", String(newWidth));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startResizingTerminal = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(100, Math.min(500, startHeight - (moveEvent.clientY - startY)));
      setTerminalHeight(newHeight);
      localStorage.setItem("solix_ide_terminal_height", String(newHeight));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const [previewWidth, setPreviewWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solix_ide_preview_width");
      if (saved) return Math.max(260, Math.min(900, parseInt(saved, 10)));
    }
    return 480;
  });

  const startResizingPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = previewWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(950, startWidth - (moveEvent.clientX - startX)));
      setPreviewWidth(newWidth);
      localStorage.setItem("solix_ide_preview_width", String(newWidth));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+V -> Toggle Live Preview
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        togglePreview();
        return;
      }

      // Ctrl+Shift+P -> Command Palette (Commands mode)
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteMode("commands");
        setIsCommandPaletteOpen(true);
        return;
      }

      // Ctrl+P -> Quick Open (Files mode)
      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteMode("files");
        setIsCommandPaletteOpen(true);
        return;
      }

      // Ctrl+S -> Save Active File
      if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile();
        return;
      }

      // Ctrl+Enter -> Run Project
      if (isCtrlOrCmd && e.key === "Enter") {
        e.preventDefault();
        runProject();
        return;
      }

      // Ctrl+` -> Toggle Terminal Panel
      if (isCtrlOrCmd && e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
        return;
      }

      // Ctrl+B -> Toggle AI Panel
      if (isCtrlOrCmd && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsAiOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [saveFile, runProject]);

  // Check for legacy migration on mount
  useEffect(() => {
    workspaceMigration
      .checkPendingMigration()
      .then((hasPending) => {
        setPendingMigration(hasPending);
      })
      .catch(() => {});
  }, []);

  const handleMigrateLegacy = async () => {
    setIsMigrating(true);
    try {
      const count = await workspaceMigration.migrateServerWorkspaces();
      await refreshWorkspace();
      setPendingMigration(false);
      setMigrationSuccessMsg(`Successfully imported ${count} legacy project(s) to local storage.`);
      setTimeout(() => setMigrationSuccessMsg(null), 6000);
    } catch (err: any) {
      alert("Failed to migrate workspaces: " + (err.message || "Unknown error"));
    } finally {
      setIsMigrating(false);
    }
  };

  const handleReviewPatch = (
    patch: CodePatch,
    approvalId?: string,
    operation?: "create" | "modify" | "delete"
  ) => {
    setReviewingModalPatch(patch);
    setReviewingApprovalId(approvalId || null);
    setReviewingOperation(operation || "modify");
    setIsReviewingDiff(true);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await createNewWorkspace(newWorkspaceName.trim(), newWorkspaceTemplate);
      setNewWorkspaceName("");
      setIsCreatingWorkspace(false);
    } catch (err: any) {
      alert(err.message || "Failed to create workspace");
    }
  };

  const handleDebugError = (errorDetails: string) => {
    sendCodingMessage(
      `Please investigate and fix the following runtime error:\n\n\`\`\`\n${errorDetails}\n\`\`\``,
      { customAction: "debug" }
    );
    setMobileTab("ai");
  };

  if (isLoading && !activeWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d0e10] text-[#858b94] gap-2 select-none">
        <div className="w-5 h-5 border-2 border-[#292c31] border-t-cyan-400 rounded-full animate-spin" />
        <div className="text-xs font-mono font-medium text-[#d4d7dc]">Loading Workspace...</div>
      </div>
    );
  }

  const activeLanguage = getLanguageLabel(activeFile);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0d0f12] text-[#d4d7dc] overflow-hidden select-none">
      {/* Top Bar: Classic Professional Desktop IDE Header (38px) */}
      <div className="h-[38px] px-3 border-b border-[#22242a] bg-[#111214] flex items-center justify-between shrink-0 gap-3 z-20 select-none">
        {/* LEFT: Solix Logo + Project Selector Dropdown + Actions */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Solix Brand Icon & Title */}
          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <SolixLogo size="sm" px={20} />
            <span className="text-xs font-semibold text-white tracking-wide font-sans">
              Solix
            </span>
          </div>

          <span className="text-[#444850] font-mono text-xs">/</span>

          {/* Project Selector Dropdown */}
          <div className="flex items-center gap-1.5 px-2 h-6 rounded-xs bg-[#16171a] border border-[#22242a] hover:border-[#2e323b] transition-colors">
            <Code2 className="w-3 h-3 text-cyan-400 shrink-0" />
            <select
              aria-label="Select active workspace"
              value={activeWorkspace?.id || ""}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === e.target.value);
                if (ws) selectWorkspace(ws);
              }}
              className="bg-transparent text-xs text-[#d4d7dc] outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate font-medium"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} className="bg-[#141518] text-[#d4d7dc]">
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCreatingWorkspace(true)}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="Create New Project"
            aria-label="Create New Project"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {activeWorkspace && (
            <button
              onClick={() => setProjectToDelete(activeWorkspace)}
              className="p-1 rounded-xs text-[#858b94] hover:text-rose-400 hover:bg-[#1a1c21] transition-colors cursor-pointer"
              title={`Delete Project "${activeWorkspace.name}"`}
              aria-label="Delete Active Project"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => refreshWorkspace()}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="Refresh Files"
            aria-label="Refresh Files"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* CENTER: Quick Open / Command Palette Trigger */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-2">
          <button
            type="button"
            onClick={() => {
              setPaletteMode("files");
              setIsCommandPaletteOpen(true);
            }}
            className="w-full flex items-center justify-between px-2.5 h-6 rounded-xs bg-[#16171a] hover:bg-[#1a1c20] border border-[#22242a] hover:border-[#2e323b] text-[11px] text-[#787f8c] hover:text-[#9ca3af] transition-colors cursor-pointer"
            title="Search files or commands (Ctrl+P / Ctrl+Shift+P)"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Search className="w-3 h-3 text-[#787f8c]" />
              <span className="truncate">Search files or commands...</span>
            </div>
            <span className="text-[10px] font-mono text-[#555a62] shrink-0 ml-1">Ctrl+P</span>
          </button>
        </div>

        {/* RIGHT: Chat / Workspace Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-xs bg-[#151619] border border-[#22242a] text-xs">
            <button
              onClick={onBackToChat}
              className="flex items-center gap-1 px-2.5 h-6 rounded-xs text-[#858b94] hover:text-white transition-colors font-medium cursor-pointer"
              title="Return to Normal Chat"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Chat</span>
            </button>
            <button
              className="flex items-center gap-1 px-2.5 h-6 rounded-xs bg-[#1f232b] text-cyan-300 border border-cyan-800/50 font-semibold cursor-default"
              title="Workspace Mode Active"
            >
              <Code2 className="w-3 h-3" />
              <span>Workspace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Legacy Migration Notification Banner (Quiet) */}
      {pendingMigration && !migrationBannerDismissed && (
        <div className="bg-[#141822] border-b border-cyan-800/40 px-3 py-1.5 flex items-center justify-between text-xs text-[#a5abb5] z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-cyan-400 font-mono">Notice:</span>
            <span className="truncate">Legacy server projects detected. Import to your local browser storage?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleMigrateLegacy}
              disabled={isMigrating}
              className="px-2 h-5 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isMigrating ? "Migrating..." : "Import Locally"}
            </button>
            <button
              onClick={() => setMigrationBannerDismissed(true)}
              className="p-0.5 text-[#666c75] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Migration Success Toast */}
      {migrationSuccessMsg && (
        <div className="bg-[#121c17] border-b border-emerald-800/40 px-3 py-1 flex items-center justify-between text-xs text-emerald-300 z-10">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{migrationSuccessMsg}</span>
          </div>
          <button
            onClick={() => setMigrationSuccessMsg(null)}
            className="p-0.5 text-emerald-400/60 hover:text-white cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher Bar (< 1024px) */}
      <div className="lg:hidden flex items-center justify-around bg-[#111214] border-b border-[#292c31] py-1 px-2 shrink-0">
        <button
          onClick={() => setMobileTab("files")}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
            mobileTab === "files"
              ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold"
              : "text-[#858b94] hover:text-[#d4d7dc]"
          }`}
        >
          <FolderTree className="w-3 h-3" />
          <span>Files</span>
        </button>

        <button
          onClick={() => setMobileTab("editor")}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
            mobileTab === "editor"
              ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold"
              : "text-[#858b94] hover:text-[#d4d7dc]"
          }`}
        >
          <Code2 className="w-3 h-3" />
          <span>Editor</span>
        </button>

        {isWebProject && (
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
              mobileTab === "preview"
                ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold"
                : "text-[#858b94] hover:text-[#d4d7dc]"
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Preview</span>
          </button>
        )}

        <button
          onClick={() => setMobileTab("terminal")}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
            mobileTab === "terminal"
              ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold"
              : "text-[#858b94] hover:text-[#d4d7dc]"
          }`}
        >
          <TerminalIcon className="w-3 h-3" />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => setMobileTab("ai")}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
            mobileTab === "ai"
              ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold"
              : "text-[#858b94] hover:text-[#d4d7dc]"
          }`}
        >
          <span>AI</span>
        </button>
      </div>

      {/* Main Workspace Body: Classic 3-Column Desktop Layout */}
      <div className="hidden lg:flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Left Column: File Explorer (Resizable) */}
        {isExplorerOpen && (
          <>
            <div
              style={{ width: `${explorerWidth}px` }}
              className="shrink-0 h-full flex flex-col bg-[#111214] overflow-hidden"
            >
              <FileExplorer
                tree={fileTree}
                activeFile={activeFile}
                projectName={activeWorkspace?.name || "PROJECT"}
                dirtyFiles={dirtyFiles}
                problems={problems}
                gitStatus={gitStatus}
                onSelectFile={openFile}
                onCreateFileOrDir={createFileOrDir}
                onDeletePath={deleteFileOrDir}
                onRenamePath={renameFileOrDir}
                onExportZip={exportProject}
                onImportFiles={importProject}
              />
            </div>

            {/* Splitter Resizer Handle between Explorer and Center */}
            <div
              onMouseDown={startResizingExplorer}
              className="w-1 bg-[#16171a] hover:bg-cyan-500 active:bg-cyan-500 cursor-col-resize shrink-0 transition-colors z-10 border-r border-[#22242a]"
              title="Drag to resize File Explorer"
            />
          </>
        )}

        {/* Center Column: Code Editor + Docked Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top: Code Editor + Live Preview (Side-by-Side Split View) */}
          <div className="flex-1 min-h-0 overflow-hidden relative flex">
            {/* Editor Panel */}
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <CodeEditorPanel
                openFiles={openFiles}
                activeFile={activeFile}
                fileContents={fileContents}
                dirtyFiles={dirtyFiles}
                onSelectFile={openFile}
                onCloseFile={closeFile}
                onUpdateContent={updateContent}
                onSaveFile={saveFile}
                onBuild={() => buildProject()}
                onRun={() => runProject()}
                onTest={() => testProject()}
                isRunning={isRunning}
                problems={problems}
                targetProblem={targetProblem}
                onSelectionChange={(code, range) => {
                  setSelectedCode(code);
                  setSelectedLineRange(range);
                }}
                onCursorChange={(line, col) => setCursorPos({ line, col })}
                isWebProject={isWebProject}
                isPreviewOpen={isPreviewOpen}
                onTogglePreview={togglePreview}
              />
            </div>

            {/* Split Resizer Handle between Editor and Live Preview */}
            {isPreviewOpen && (
              <>
                <div
                  onMouseDown={startResizingPreview}
                  className="w-1 bg-[#16171a] hover:bg-cyan-500 active:bg-cyan-500 cursor-col-resize shrink-0 transition-colors z-10 border-l border-r border-[#22242a]"
                  title="Drag to resize Website Live Preview"
                />
                <div
                  style={{ width: `${previewWidth}px` }}
                  className="h-full shrink-0 min-w-[280px] max-w-[80vw]"
                >
                  <PreviewPanel
                    html={previewHtml}
                    onRefresh={refreshPreview}
                    onClose={togglePreview}
                    isLive={isLivePreview}
                    onToggleLive={toggleLivePreview}
                    viewport={previewViewport}
                    onViewportChange={setPreviewViewport}
                    problems={problems}
                    onSelectProblem={jumpToProblem}
                    entryFile={activeFile && activeFile.endsWith(".html") ? activeFile : "index.html"}
                  />
                </div>
              </>
            )}
          </div>

          {/* Bottom: Docked Terminal / Problems / Console Panel (Resizable) */}
          {isTerminalOpen && (
            <div className="shrink-0 flex flex-col">
              {/* Terminal Horizontal Resizer Splitter */}
              <div
                onMouseDown={startResizingTerminal}
                className="h-1 bg-[#16171a] hover:bg-cyan-500 active:bg-cyan-500 cursor-row-resize shrink-0 transition-colors z-10 border-t border-[#22242a]"
                title="Drag to resize Terminal panel"
              />
              <div style={{ height: `${terminalHeight}px` }} className="overflow-hidden">
                <TerminalPanel
                  output={terminalOutput}
                  lastResult={lastResult}
                  isRunning={isRunning}
                  onClear={clearTerminal}
                  onStop={stopProject}
                  onDebugError={handleDebugError}
                  gitStatus={gitStatus}
                  activeTab={terminalTab}
                  onTabChange={setTerminalTab}
                  problems={problems}
                  onSelectProblem={jumpToProblem}
                  consoleLogs={consoleLogs}
                  onClearConsole={clearConsole}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Developer Tool Panel (Resizable) */}
        {isAiOpen && (
          <>
            {/* AI Panel Splitter Resizer Handle */}
            <div
              onMouseDown={startResizingAi}
              className="w-1 bg-[#16171a] hover:bg-cyan-500 active:bg-cyan-500 cursor-col-resize shrink-0 transition-colors z-10 border-l border-[#22242a]"
              title="Drag to resize Solix Code AI panel"
            />
            <div
              style={{ width: `${aiWidth}px` }}
              className="shrink-0 h-full flex flex-col bg-[#111214] overflow-hidden"
            >
              <AIPanel
                messages={messages}
                isGenerating={isAIGenerating}
                onSendMessage={sendCodingMessage}
                activeFile={activeFile}
                selectedCode={selectedCode}
                selectedLineRange={selectedLineRange}
                onReviewPatch={(patch) => {
                  const matchingApproval =
                    pendingApproval?.file === patch.file ? pendingApproval : null;
                  handleReviewPatch(
                    patch,
                    matchingApproval?.approval_id,
                    matchingApproval?.operation
                  );
                }}
                onApplyPatch={applyPatch}
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
                agentMode={agentMode}
                onToggleAgentMode={setAgentMode}
                autoApply={autoApply}
                onToggleAutoApply={() => setAutoApply(!autoApply)}
                agentState={agentState}
                currentPlan={currentPlan}
                pendingApproval={pendingApproval}
                onRespondApproval={respondApproval}
                onStopAgent={stopAgent}
              />
            </div>
          </>
        )}
      </div>

      {/* Mobile Layout (< lg) */}
      <div className="flex-1 lg:hidden min-h-0 min-w-0 overflow-hidden flex flex-col">
        {mobileTab === "files" && (
          <div className="flex-1 min-h-0 bg-[#111214]">
            <FileExplorer
              tree={fileTree}
              activeFile={activeFile}
              projectName={activeWorkspace?.name || "PROJECT"}
              dirtyFiles={dirtyFiles}
              problems={problems}
              gitStatus={gitStatus}
              onSelectFile={(path) => {
                openFile(path);
                setMobileTab("editor");
              }}
              onCreateFileOrDir={createFileOrDir}
              onDeletePath={deleteFileOrDir}
              onRenamePath={renameFileOrDir}
              onExportZip={exportProject}
              onImportFiles={importProject}
            />
          </div>
        )}

        {mobileTab === "editor" && (
          <div className="flex-1 min-h-0 flex flex-col">
            <CodeEditorPanel
              openFiles={openFiles}
              activeFile={activeFile}
              fileContents={fileContents}
              dirtyFiles={dirtyFiles}
              onSelectFile={openFile}
              onCloseFile={closeFile}
              onUpdateContent={updateContent}
              onSaveFile={saveFile}
              onBuild={() => {
                buildProject();
                setMobileTab("terminal");
              }}
              onRun={() => {
                runProject();
                if (isWebProject) {
                  setMobileTab("preview");
                } else {
                  setMobileTab("terminal");
                }
              }}
              onTest={() => {
                testProject();
                setMobileTab("terminal");
              }}
              isRunning={isRunning}
              problems={problems}
              targetProblem={targetProblem}
              isWebProject={isWebProject}
              isPreviewOpen={isPreviewOpen}
              onTogglePreview={() => {
                togglePreview();
                if (!isPreviewOpen) setMobileTab("preview");
              }}
              onSelectionChange={(code, range) => {
                setSelectedCode(code);
                setSelectedLineRange(range);
              }}
              onCursorChange={(line, col) => setCursorPos({ line, col })}
            />
          </div>
        )}

        {mobileTab === "preview" && isWebProject && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#0b0c0e]">
            <PreviewPanel
              html={previewHtml}
              isLive={isLivePreview}
              onToggleLive={toggleLivePreview}
              onRefresh={refreshPreview}
              viewport={previewViewport}
              onViewportChange={setPreviewViewport}
              onClose={() => setMobileTab("editor")}
              problems={problems}
              onSelectProblem={(prob) => {
                jumpToProblem(prob);
                setMobileTab("editor");
              }}
              entryFile={activeFile && activeFile.endsWith(".html") ? activeFile : "index.html"}
            />
          </div>
        )}

        {mobileTab === "terminal" && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#0d0e10]">
            <TerminalPanel
              output={terminalOutput}
              lastResult={lastResult}
              isRunning={isRunning}
              onClear={clearTerminal}
              onStop={stopProject}
              onDebugError={handleDebugError}
              gitStatus={gitStatus}
              activeTab={terminalTab}
              onTabChange={setTerminalTab}
              problems={problems}
              onSelectProblem={(prob) => {
                jumpToProblem(prob);
                setMobileTab("editor");
              }}
              consoleLogs={consoleLogs}
              onClearConsole={clearConsole}
            />
          </div>
        )}

        {mobileTab === "ai" && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#111214]">
            <AIPanel
              messages={messages}
              isGenerating={isAIGenerating}
              onSendMessage={sendCodingMessage}
              activeFile={activeFile}
              selectedCode={selectedCode}
              selectedLineRange={selectedLineRange}
              onReviewPatch={(patch) => {
                const matchingApproval =
                  pendingApproval?.file === patch.file ? pendingApproval : null;
                handleReviewPatch(
                  patch,
                  matchingApproval?.approval_id,
                  matchingApproval?.operation
                );
              }}
              onApplyPatch={applyPatch}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
              agentMode={agentMode}
              onToggleAgentMode={setAgentMode}
              autoApply={autoApply}
              onToggleAutoApply={() => setAutoApply(!autoApply)}
              agentState={agentState}
              currentPlan={currentPlan}
              pendingApproval={pendingApproval}
              onRespondApproval={respondApproval}
              onStopAgent={stopAgent}
            />
          </div>
        )}
      </div>

      {/* Classic IDE Status Bar (22px) */}
      <div className="h-[22px] px-3 bg-[#111214] border-t border-[#22242a] flex items-center justify-between text-[11px] font-mono text-[#787f8c] shrink-0 select-none">
        {/* Left Side: File & Editor metadata */}
        <div className="flex items-center gap-2.5">
          <span className="text-[#a5abb5]">{activeLanguage}</span>
          <span className="text-[#2a2d35]">·</span>
          <span>UTF-8</span>
          <span className="text-[#2a2d35]">·</span>
          <span>LF</span>
          <span className="text-[#2a2d35]">·</span>
          <span>Spaces: 4</span>
          <span className="text-[#2a2d35]">·</span>
          <span className="text-[#a5abb5]">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>

        {/* Right Side: Runtime & Persistence status (clickable) */}
        <div className="flex items-center gap-2.5">
          {/* Browser Sandbox status */}
          <button
            type="button"
            onClick={() => setShowSandboxModal(true)}
            className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect sandbox isolation & execution runtime"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{isWebProject ? "Web Sandbox (Isolated)" : "Python (Pyodide WASM)"}</span>
          </button>

          <span className="text-[#2a2d35]">·</span>

          {/* Local Storage status */}
          <button
            type="button"
            onClick={() => setShowStorageModal(true)}
            className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect local browser storage & export backup"
          >
            <HardDrive className="w-3 h-3 text-[#787f8c]" />
            <span>
              {storageStats.isSaving ? "Saving..." : "Saved locally"}
              {storageStats.bytes > 0 ? ` (${formatBytes(storageStats.bytes)})` : ""}
            </span>
          </button>

          <span className="text-[#2a2d35]">·</span>

          {/* Compilers Inspector */}
          <button
            type="button"
            onClick={() => setShowRuntimesModal(true)}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect system compilers"
          >
            Compilers ({availableRuntimes.filter((r) => r.available).length})
          </button>
        </div>
      </div>

      {/* Diff Review Modal */}
      <DiffReviewModal
        patch={reviewingModalPatch || activePatch}
        operation={reviewingOperation}
        originalContent={
          reviewingModalPatch || activePatch
            ? fileContents[(reviewingModalPatch || activePatch)!.file] || ""
            : ""
        }
        isOpen={isReviewingDiff}
        onApply={async (patch) => {
          if (reviewingApprovalId) {
            await respondApproval(reviewingApprovalId, true);
            setIsReviewingDiff(false);
            setReviewingApprovalId(null);
            setReviewingModalPatch(null);
          } else {
            await applyPatch(patch);
          }
        }}
        onReject={async () => {
          if (reviewingApprovalId) {
            await respondApproval(reviewingApprovalId, false);
            setIsReviewingDiff(false);
            setReviewingApprovalId(null);
            setReviewingModalPatch(null);
          } else {
            rejectPatch();
          }
        }}
      />

      {/* New Project Modal (Classic IDE Dialog) */}
      {isCreatingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm bg-[#141518] border border-[#292c31] rounded-xs p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#22252a] pb-2">
              <span className="text-xs font-mono font-semibold uppercase text-white tracking-wider">
                New Coding Project
              </span>
              <button
                onClick={() => setIsCreatingWorkspace(false)}
                className="p-1 rounded-xs text-[#858b94] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-[#858b94] mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. My Algorithm Project"
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0d0e10] border border-[#292c31] rounded-xs text-white placeholder-[#555a62] focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#858b94] mb-1">
                  Template
                </label>
                <select
                  value={newWorkspaceTemplate}
                  onChange={(e) => setNewWorkspaceTemplate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#0d0e10] border border-[#292c31] rounded-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
                >
                  <option value="starter-web">Web Project (HTML / CSS / JavaScript)</option>
                  <option value="starter-web-landing">Landing Page (HTML / CSS / JavaScript)</option>
                  <option value="starter-web-app">JavaScript Web App (SPA)</option>
                  <option value="starter-web-blank">Blank Website (HTML / CSS / JS)</option>
                  <option value="starter-python">Python 3 (In-Browser WASM)</option>
                  <option value="starter-cpp">C++ (Native Compiler)</option>
                  <option value="empty">Empty Project</option>
                </select>
              </div>

              <div className="text-[10.5px] text-[#666c75] font-mono">
                Project files are stored directly in your browser's local IndexedDB.
              </div>

              <div className="flex justify-end gap-1.5 pt-1 border-t border-[#22252a]">
                <button
                  type="button"
                  onClick={() => setIsCreatingWorkspace(false)}
                  className="px-3 h-7 text-xs font-medium text-[#858b94] hover:text-white rounded-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspaceName.trim()}
                  className="px-3 h-7 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xs transition-colors cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sandbox Isolation & Runtime Details Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-[#141518] border border-[#292c31] rounded-xs p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#22252a] pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-mono font-semibold uppercase text-white tracking-wider">
                  Browser Sandbox Details
                </span>
              </div>
              <button
                onClick={() => setShowSandboxModal(false)}
                className="p-1 rounded-xs text-[#858b94] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#858b94] leading-relaxed">
              Solix Workspace executes code directly in your browser using isolated WebAssembly (Pyodide) and Web Workers.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <div className="text-[10px] text-[#666c75] uppercase mb-0.5">Execution Engine</div>
                <div className="text-emerald-400 font-semibold">100% In-Browser</div>
                <div className="text-[10px] text-[#555a62]">Pyodide WASM & Web Worker</div>
              </div>

              <div className="p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <div className="text-[10px] text-[#666c75] uppercase mb-0.5">Watchdog Timer</div>
                <div className="text-cyan-400 font-semibold">15 Seconds</div>
                <div className="text-[10px] text-[#555a62]">Auto-terminates infinite loops</div>
              </div>

              <div className="p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <div className="text-[10px] text-[#666c75] uppercase mb-0.5">Output Limit</div>
                <div className="text-white font-semibold">500 KB Cap</div>
                <div className="text-[10px] text-[#555a62]">Prevents memory freezes</div>
              </div>

              <div className="p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <div className="text-[10px] text-[#666c75] uppercase mb-0.5">Server Storage</div>
                <div className="text-emerald-400 font-semibold">Zero Uploads</div>
                <div className="text-[10px] text-[#555a62]">Source files stay on device</div>
              </div>
            </div>

            <div className="border-t border-[#22252a] pt-2.5">
              <div className="text-[10.5px] font-mono text-[#858b94] uppercase tracking-wide mb-1.5">
                Runtime Availability
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between p-1.5 rounded-xs bg-[#0d0e10]">
                  <span className="text-white">Web Sandbox (HTML / CSS / JS Preview)</span>
                  <span className="text-emerald-400 text-[11px]">
                    {isWebProject ? "✓ Active" : "✓ Available"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-xs bg-[#0d0e10]">
                  <span className="text-white">Python 3.12 (Pyodide WASM)</span>
                  <span className="text-emerald-400 text-[11px]">
                    {!isWebProject ? "✓ Active" : "✓ Available"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-xs bg-[#0d0e10]">
                  <span className="text-white">JavaScript / TypeScript (Worker)</span>
                  <span className="text-emerald-400 text-[11px]">✓ Available</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-xs bg-[#0d0e10]">
                  <span className="text-[#858b94]">C / C++ (GCC / Clang)</span>
                  <span className="text-[#555a62] text-[11px]">Requires Native Runtime</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#22252a]">
              <button
                type="button"
                onClick={() => setShowSandboxModal(false)}
                className="px-3 h-7 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Storage & Export Modal */}
      {showStorageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#141518] border border-[#292c31] rounded-xs p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#22252a] pb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-semibold uppercase text-white tracking-wider">
                  Storage & Persistence
                </span>
              </div>
              <button
                onClick={() => setShowStorageModal(false)}
                className="p-1 rounded-xs text-[#858b94] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <span className="text-[#858b94]">Project:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {activeWorkspace?.name || "None"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <span className="text-[#858b94]">Size on Device:</span>
                <span className="text-cyan-400 font-semibold">
                  {formatBytes(storageStats.bytes)} ({storageStats.fileCount} files)
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <span className="text-[#858b94]">Storage Engine:</span>
                <span className="text-emerald-400">IndexedDB + OPFS</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]">
                <span className="text-[#858b94]">Auto-Save:</span>
                <span className="text-white">Active (500ms debounce)</span>
              </div>
            </div>

            <div className="pt-1 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await exportProject();
                  setShowStorageModal(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 h-7 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xs text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Project as ZIP</span>
              </button>

              {activeWorkspace && (
                <button
                  type="button"
                  onClick={() => {
                    setShowStorageModal(false);
                    setProjectToDelete(activeWorkspace);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-7 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xs text-xs font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete This Project</span>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#22252a]">
              <button
                type="button"
                onClick={() => setShowStorageModal(false)}
                className="px-3 h-7 text-xs font-semibold bg-[#1c1f24] hover:bg-[#252830] text-[#d4d7dc] rounded-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runtimes & Compilers Inspector Modal */}
      {showRuntimesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#141518] border border-[#292c31] rounded-xs p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#22252a] pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-semibold uppercase text-white tracking-wider">
                  Compilers & Runtimes
                </span>
              </div>
              <button
                onClick={() => setShowRuntimesModal(false)}
                className="p-1 rounded-xs text-[#858b94] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#858b94] leading-relaxed">
              Available compilers and local execution engines detected for this workspace.
            </p>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto font-mono text-xs">
              {availableRuntimes.map((rt) => (
                <div
                  key={rt.id}
                  className="flex items-center justify-between p-2 rounded-xs bg-[#0d0e10] border border-[#22252a]"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{rt.display_name}</span>
                      {rt.version && (
                        <span className="text-[10px] text-cyan-400">
                          {rt.version}
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] text-[#666c75] truncate mt-0.5">
                      {rt.available ? (
                        <span>{rt.compiler || rt.runner || "Available"}</span>
                      ) : (
                        <span>{rt.install_hint || "Not installed"}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    {rt.available ? (
                      <span className="text-[11px] text-emerald-400">Available</span>
                    ) : (
                      <span className="text-[11px] text-[#555a62]">Unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#22252a]">
              <button
                type="button"
                onClick={() => setShowRuntimesModal(false)}
                className="px-3 h-7 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm bg-[#141518] border border-[#292c31] rounded-xs p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#22252a] pb-2">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-mono font-semibold uppercase text-white tracking-wider">
                  Delete Project
                </span>
              </div>
              <button
                type="button"
                onClick={() => !isDeletingWorkspace && setProjectToDelete(null)}
                className="p-1 rounded-xs text-[#858b94] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                disabled={isDeletingWorkspace}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#c0c5cc] leading-relaxed">
              Delete <span className="font-semibold text-white font-mono">&ldquo;{projectToDelete.name}&rdquo;</span>? This will permanently remove the project and its local files from this browser.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#22252a]">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeletingWorkspace}
                className="px-3 h-7 text-xs font-medium text-[#858b94] hover:text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingWorkspace}
                onClick={async () => {
                  if (!projectToDelete) return;
                  try {
                    setIsDeletingWorkspace(true);
                    const targetId = projectToDelete.id;
                    await deleteWorkspace(targetId);
                    setProjectToDelete(null);
                  } catch (err: any) {
                    alert("Failed to delete project: " + (err.message || "Unknown error"));
                  } finally {
                    setIsDeletingWorkspace(false);
                  }
                }}
                className="px-3 h-7 text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xs transition-colors cursor-pointer"
              >
                {isDeletingWorkspace ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Command Palette / Quick Open Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        initialMode={paletteMode}
        fileTree={fileTree}
        onSelectFile={openFile}
        onSaveFile={() => saveFile()}
        onRunProject={() => runProject()}
        onBuildProject={() => buildProject()}
        onTestProject={() => testProject()}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        onToggleAi={() => setIsAiOpen((prev) => !prev)}
        onTogglePreview={togglePreview}
        onNewFile={() => createFileOrDir("new_file.py", false)}
        onNewFolder={() => createFileOrDir("new_folder", true)}
        onNewProject={() => setIsCreatingWorkspace(true)}
        onDeleteProject={() => activeWorkspace && setProjectToDelete(activeWorkspace)}
        onExportZip={exportProject}
        onImportFiles={() => {
          if (typeof document === "undefined") return;
          const input = document.createElement("input");
          input.type = "file";
          input.multiple = true;
          input.onchange = async (e: any) => {
            const files: FileList = e.target.files;
            if (!files || files.length === 0) return;
            const items: Array<{ path: string; content: string }> = [];
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const text = await file.text();
              items.push({ path: file.name, content: text });
            }
            await importProject(items);
          };
          input.click();
        }}
        onClearTerminal={clearTerminal}
        onOpenStorageModal={() => setShowStorageModal(true)}
        onOpenRuntimesModal={() => setShowRuntimesModal(true)}
        onBackToChat={onBackToChat}
        onAiAction={(action) => {
          if (action === "explain") {
            sendCodingMessage("Explain the current code architecture and data structures in this project.", { customAction: "explain" });
          } else if (action === "fix") {
            sendCodingMessage("Diagnose any potential bugs or edge cases in this project and propose a fix.", { customAction: "fix" });
          } else if (action === "tests") {
            sendCodingMessage("Write unit tests for this project.", { customAction: "tests" });
          }
          if (!isAiOpen) setIsAiOpen(true);
        }}
      />
    </div>
  );
};
