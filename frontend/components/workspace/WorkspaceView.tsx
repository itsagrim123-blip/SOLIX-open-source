"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  Code2,
  Cpu,
  Download,
  FolderTree,
  HardDrive,
  Hammer,
  MessageSquare,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
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
import { DiffReviewModal } from "./DiffReviewModal";
import { SolixLogo } from "@/components/brand/SolixLogo";
import type { CodePatch } from "@/types/workspace";
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
  } = workspace;

  // Editor cursor tracking for IDE status bar
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Navigation tab for mobile viewports
  const [mobileTab, setMobileTab] = useState<"files" | "editor" | "ai" | "terminal">("editor");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceTemplate, setNewWorkspaceTemplate] = useState("starter-python");
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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0d0e10] text-[#d4d7dc] overflow-hidden select-none">
      {/* Top Bar: Classic Professional Desktop IDE Header (38px) */}
      <div className="h-[38px] px-3 border-b border-[#292c31] bg-[#111214] flex items-center justify-between shrink-0 gap-3 z-20 select-none">
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
          <div className="flex items-center gap-1.5 px-2 h-6 rounded-xs bg-[#16171a] border border-[#292c31] hover:border-[#383b42] transition-colors">
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

          <button
            onClick={() => refreshWorkspace()}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="Refresh Files"
            aria-label="Refresh Files"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* CENTER / RIGHT: Compact Execution Actions */}
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={() => buildProject()}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-medium text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1c1f24] transition-colors cursor-pointer"
            title="Build Project"
          >
            <Hammer className="w-3 h-3" />
            <span>Build</span>
          </button>

          <button
            type="button"
            onClick={() => testProject()}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-medium text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1c1f24] transition-colors cursor-pointer"
            title="Run Unit Tests"
          >
            <PlayCircle className="w-3 h-3" />
            <span>Test</span>
          </button>

          <button
            type="button"
            onClick={() => runProject()}
            disabled={isRunning}
            className={`flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-semibold transition-colors cursor-pointer ${
              isRunning
                ? "bg-amber-950/60 text-amber-300 border border-amber-800/60"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
            title="Run active file in browser sandbox"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
        </div>

        {/* RIGHT: Chat / Workspace Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-xs bg-[#151619] border border-[#292c31] text-xs">
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
        {/* Left Column: File Explorer (220px) */}
        <div className="w-[220px] shrink-0 h-full flex flex-col bg-[#111214]">
          <FileExplorer
            tree={fileTree}
            activeFile={activeFile}
            projectName={activeWorkspace?.name || "PROJECT"}
            onSelectFile={openFile}
            onCreateFileOrDir={createFileOrDir}
            onDeletePath={deleteFileOrDir}
            onRenamePath={renameFileOrDir}
            onExportZip={exportProject}
            onImportFiles={importProject}
          />
        </div>

        {/* Center Column: Code Editor + Docked Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden border-r border-[#292c31]">
          {/* Top: Code Editor */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
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
            />
          </div>

          {/* Bottom: Docked Terminal / Problems Panel */}
          <div className="shrink-0">
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
            />
          </div>
        </div>

        {/* Right Column: AI Developer Tool Panel (340px) */}
        <div className="w-[340px] shrink-0 h-full flex flex-col bg-[#111214]">
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
      </div>

      {/* Mobile Layout (< lg) */}
      <div className="flex-1 lg:hidden min-h-0 min-w-0 overflow-hidden flex flex-col">
        {mobileTab === "files" && (
          <div className="flex-1 min-h-0 bg-[#111214]">
            <FileExplorer
              tree={fileTree}
              activeFile={activeFile}
              projectName={activeWorkspace?.name || "PROJECT"}
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
                setMobileTab("terminal");
              }}
              onTest={() => {
                testProject();
                setMobileTab("terminal");
              }}
              isRunning={isRunning}
              problems={problems}
              targetProblem={targetProblem}
              onSelectionChange={(code, range) => {
                setSelectedCode(code);
                setSelectedLineRange(range);
              }}
              onCursorChange={(line, col) => setCursorPos({ line, col })}
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
      <div className="h-[22px] px-3 bg-[#0d0e10] border-t border-[#292c31] flex items-center justify-between text-[11px] font-mono text-[#666c75] shrink-0 select-none">
        {/* Left Side: File & Editor metadata */}
        <div className="flex items-center gap-3">
          <span className="text-[#858b94]">{activeLanguage}</span>
          <span>UTF-8</span>
          <span>LF</span>
          <span>Spaces: 4</span>
          <span className="text-[#858b94]">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        </div>

        {/* Right Side: Runtime & Persistence status (clickable) */}
        <div className="flex items-center gap-3">
          {/* Browser Sandbox status */}
          <button
            type="button"
            onClick={() => setShowSandboxModal(true)}
            className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect sandbox isolation & execution runtime"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Python (Pyodide WASM)</span>
          </button>

          <span>|</span>

          {/* Local Storage status */}
          <button
            type="button"
            onClick={() => setShowStorageModal(true)}
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect local browser storage & export backup"
          >
            <HardDrive className="w-3 h-3 text-[#666c75]" />
            <span>
              {storageStats.isSaving ? "Saving..." : "✓ Saved locally"}
              {storageStats.bytes > 0 ? ` (${formatBytes(storageStats.bytes)})` : ""}
            </span>
          </button>

          <span>|</span>

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
                  <option value="starter-python">Python 3 (In-Browser WASM)</option>
                  <option value="starter-web">JavaScript / Node (In-Browser Worker)</option>
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
                  <span className="text-white">Python 3.12 (Pyodide WASM)</span>
                  <span className="text-emerald-400 text-[11px]">✓ Available</span>
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

              {activeWorkspace && workspaces.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      confirm(
                        `Are you sure you want to permanently delete "${activeWorkspace.name}" from your local browser storage?`
                      )
                    ) {
                      await deleteWorkspace(activeWorkspace.id);
                      setShowStorageModal(false);
                    }
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
    </div>
  );
};
