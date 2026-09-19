"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  Code2,
  Cpu,
  Download,
  FolderTree,
  HardDrive,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
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
import { CodePatch } from "@/types/workspace";
import { workspaceMigration } from "@/lib/storage/workspaceMigration";

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  // Mobile navigation tab
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
    workspaceMigration.checkPendingMigration().then((hasPending) => {
      setPendingMigration(hasPending);
    }).catch(() => {});
  }, []);

  const handleMigrateLegacy = async () => {
    setIsMigrating(true);
    try {
      const count = await workspaceMigration.migrateServerWorkspaces();
      await refreshWorkspace();
      setPendingMigration(false);
      setMigrationSuccessMsg(`Successfully imported ${count} legacy project(s) to local browser storage.`);
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
    // On mobile, automatically switch to the AI tab to see the diagnostic & fix
    setMobileTab("ai");
  };

  if (isLoading && !activeWorkspace) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d0e10] text-[#8f9299] gap-3">
        <div className="w-8 h-8 border-2 border-[#292b30] border-t-cyan-400 rounded-full animate-spin" />
        <div className="text-sm font-medium">Initializing Coding Workspace...</div>
        <div className="text-xs text-[#666970]">Mounting local sandbox & indexer</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0d0e10] text-[#dedfe2] overflow-hidden select-none">
      {/* Workspace Top Header (Unified Full-Screen Header) */}
      <div className="h-[52px] px-3.5 border-b border-[#26282e] bg-[#121316] flex items-center justify-between shrink-0 gap-2 z-20 select-none">
        {/* LEFT: Brand Logo + 'Solix · Workspace' + Divider + Project Selector & Badges */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Solix Dragon Logo & Title */}
          <div className="flex items-center gap-2 shrink-0">
            <SolixLogo size="sm" px={26} />
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="text-white tracking-wide">Solix</span>
              <span className="text-[#555860]">·</span>
              <span className="text-cyan-400 font-medium">Workspace</span>
            </div>
          </div>

          <span className="h-4 w-px bg-[#2a2c33] mx-1 shrink-0 hidden sm:inline-block" />

          {/* Project Selector Dropdown */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#18191e] border border-[#2e3138] hover:border-[#3d414a] transition-colors">
            <Code2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              aria-label="Select active workspace"
              value={activeWorkspace?.id || ""}
              onChange={(e) => {
                const ws = workspaces.find((w) => w.id === e.target.value);
                if (ws) selectWorkspace(ws);
              }}
              className="bg-transparent text-xs font-semibold text-[#dedfe2] outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} className="bg-[#141518] text-[#dedfe2]">
                  {ws.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCreatingWorkspace(true)}
            className="p-1.5 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Create New Project"
            aria-label="Create New Project"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => refreshWorkspace()}
            className="p-1.5 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Refresh Files"
            aria-label="Refresh Files"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Local Storage Indicator Pill */}
          <button
            type="button"
            onClick={() => setShowStorageModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#18191e] hover:bg-[#202228] text-[#a0a3ab] hover:text-[#eeeeec] border border-[#2c2f36] transition-colors cursor-pointer"
            title="Inspect local browser storage & export backup"
          >
            <HardDrive className="w-3 h-3 text-cyan-400" />
            <span>
              {storageStats.isSaving ? "Saving..." : "Local"}
              {storageStats.bytes > 0 ? ` · ${formatBytes(storageStats.bytes)}` : ""}
            </span>
          </button>

          {/* Sandboxed Badge (Truthful & Interactive) */}
          <button
            type="button"
            onClick={() => setShowSandboxModal(true)}
            className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 transition-colors cursor-pointer"
            title="Inspect sandbox isolation & execution runtime"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Browser Sandbox</span>
          </button>

          {/* Runtimes & Compilers Pill */}
          <button
            type="button"
            onClick={() => setShowRuntimesModal(true)}
            className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#18191e] hover:bg-[#202228] text-[#a0a3ab] hover:text-[#eeeeec] border border-[#2c2f36] transition-colors cursor-pointer"
            title="Inspect system compilers and installed runtimes"
          >
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Compilers ({availableRuntimes.filter((r) => r.available).length})</span>
          </button>

          <span className="hidden lg:inline-flex items-center gap-1 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-2.5 h-2.5" />
            qwen2.5-coder:7b
          </span>
        </div>

        {/* RIGHT: Mode Switcher Pill */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher Pill (matches ChatHeader & ChatSidebar) */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#15171a] border border-[#2a2c33] text-xs">
            <button
              onClick={onBackToChat}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[#8f9299] hover:text-white transition-all font-medium cursor-pointer"
              title="Return to Normal Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-xs font-semibold cursor-default"
              title="Currently in Workspace Mode"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Legacy Migration Notification Banner */}
      {pendingMigration && !migrationBannerDismissed && (
        <div className="bg-gradient-to-r from-cyan-950/90 via-blue-950/80 to-[#14161c] border-b border-cyan-500/30 px-3.5 py-2 flex items-center justify-between text-xs text-cyan-200 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">📦</span>
            <span className="font-medium text-white">Legacy Server Projects Detected:</span>
            <span className="text-cyan-200/80 hidden sm:inline">
              Import server workspaces to your local browser storage for client-side persistence and execution.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleMigrateLegacy}
              disabled={isMigrating}
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              {isMigrating ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Migrating...</span>
                </>
              ) : (
                <span>Migrate to Local</span>
              )}
            </button>
            <button
              onClick={() => setMigrationBannerDismissed(true)}
              className="p-1 text-cyan-400/60 hover:text-white transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Migration Success Toast */}
      {migrationSuccessMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-3.5 py-1.5 flex items-center justify-between text-xs text-emerald-300 z-10">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{migrationSuccessMsg}</span>
          </div>
          <button
            onClick={() => setMigrationSuccessMsg(null)}
            className="p-1 text-emerald-400/60 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher Bar (visible only on screens < 1024px) */}
      <div className="lg:hidden flex items-center justify-around bg-[#121316] border-b border-[#25272c] py-1 px-2 shrink-0">
        <button
          onClick={() => setMobileTab("files")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            mobileTab === "files"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold"
              : "text-[#8f9299] hover:text-[#dedfe2]"
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Files</span>
        </button>

        <button
          onClick={() => setMobileTab("editor")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            mobileTab === "editor"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold"
              : "text-[#8f9299] hover:text-[#dedfe2]"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => setMobileTab("terminal")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            mobileTab === "terminal"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold"
              : "text-[#8f9299] hover:text-[#dedfe2]"
          }`}
        >
          <TerminalIcon className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => setMobileTab("ai")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            mobileTab === "ai"
              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold"
              : "text-[#8f9299] hover:text-[#dedfe2]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Solix AI</span>
        </button>
      </div>

      {/* Main Workspace Body */}
      {/* 1. Desktop Layout (lg:flex, 3 columns + bottom terminal) */}
      <div className="hidden lg:flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Left Column: File Explorer (240px) */}
        <div className="w-60 shrink-0 h-full border-r border-[#26282e] flex flex-col bg-[#111215]">
          <FileExplorer
            tree={fileTree}
            activeFile={activeFile}
            onSelectFile={openFile}
            onCreateFileOrDir={createFileOrDir}
            onDeletePath={deleteFileOrDir}
            onRenamePath={renameFileOrDir}
            onExportZip={exportProject}
            onImportFiles={importProject}
          />
        </div>

        {/* Center Column: Code Editor + Collapsible Bottom Terminal */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden border-r border-[#26282e]">
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
            />
          </div>

          {/* Bottom: Terminal Panel */}
          <div className="shrink-0 bg-[#0f1013] border-t border-[#26282e]">
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

        {/* Right Column: AI Coding Panel (380px) */}
        <div className="w-[380px] shrink-0 h-full flex flex-col bg-[#121316]">
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

      {/* 2. Mobile Layout (< lg:flex, single active panel full width) */}
      <div className="flex-1 lg:hidden min-h-0 min-w-0 overflow-hidden flex flex-col">
        {mobileTab === "files" && (
          <div className="flex-1 min-h-0 bg-[#111215]">
            <FileExplorer
              tree={fileTree}
              activeFile={activeFile}
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
            />
          </div>
        )}

        {mobileTab === "terminal" && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#0f1013]">
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
          <div className="flex-1 min-h-0 flex flex-col bg-[#121316]">
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

      {/* New Project Modal */}
      {isCreatingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-[#141518] border border-[#2e3137] rounded-xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Create New Coding Project</h3>
              <button
                onClick={() => setIsCreatingWorkspace(false)}
                className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#8f9299] mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="e.g. My Algorithm Project"
                  autoFocus
                  className="w-full px-3 py-1.5 text-xs bg-[#191a1e] border border-[#2e3137] rounded-lg text-white placeholder-[#666970] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8f9299] mb-1">
                  Language & Starter Template
                </label>
                <select
                  value={newWorkspaceTemplate}
                  onChange={(e) => setNewWorkspaceTemplate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#191a1e] border border-[#2e3137] rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="starter-python">Python 3 (main.py, test_main.py) — In-Browser WASM</option>
                  <option value="starter-web">JavaScript / Node (index.js) — In-Browser Worker</option>
                  <option value="starter-cpp">C++ (main.cpp, math_utils.cpp) — Native Compiler</option>
                  <option value="empty">Empty Project (blank canvas)</option>
                </select>
              </div>

              <div className="text-[11px] text-[#666970]">
                All files will be saved directly into your device's local IndexedDB and executed in the local sandbox.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingWorkspace(false)}
                  className="px-3 py-1.5 text-xs font-medium text-[#8f9299] hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspaceName.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sandbox Isolation & Runtime Details Modal */}
      {showSandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[#141518] border border-[#2e3137] rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">Browser Sandbox Architecture</h3>
              </div>
              <button
                onClick={() => setShowSandboxModal(false)}
                className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8f9299] leading-relaxed">
              Solix Workspace operates with a <strong className="text-[#dedfe2]">Local-First Architecture</strong>. Your code is stored on your device and executed directly in your browser using WebAssembly and Web Workers.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <div className="text-[10.5px] text-[#8f9299] uppercase font-bold tracking-wider mb-0.5">
                  Execution Mode
                </div>
                <div className="font-semibold text-emerald-400">100% In-Browser</div>
                <div className="text-[11px] text-[#666970] mt-0.5">Isolated Web Worker & Pyodide WASM</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <div className="text-[10.5px] text-[#8f9299] uppercase font-bold tracking-wider mb-0.5">
                  Timeout Protection
                </div>
                <div className="font-semibold text-cyan-400">15 Seconds Watchdog</div>
                <div className="text-[11px] text-[#666970] mt-0.5">Auto-terminates infinite loops</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <div className="text-[10.5px] text-[#8f9299] uppercase font-bold tracking-wider mb-0.5">
                  Output Buffer Cap
                </div>
                <div className="font-semibold text-white">500 KB Limit</div>
                <div className="text-[11px] text-[#666970] mt-0.5">Prevents browser memory freezes</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <div className="text-[10.5px] text-[#8f9299] uppercase font-bold tracking-wider mb-0.5">
                  Source Privacy
                </div>
                <div className="font-semibold text-emerald-400">Zero Server Storage</div>
                <div className="text-[11px] text-[#666970] mt-0.5">Source files never permanently stored</div>
              </div>
            </div>

            <div className="border-t border-[#252830] pt-3">
              <div className="text-[11px] font-semibold text-white mb-2">Browser Compilers & Interpreters</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded bg-[#18191e]">
                  <span className="text-white">Python 3.12 (Pyodide WASM)</span>
                  <span className="text-emerald-400 font-medium">✓ Local WebAssembly</span>
                </div>
                <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded bg-[#18191e]">
                  <span className="text-white">JavaScript / TypeScript (Worker)</span>
                  <span className="text-emerald-400 font-medium">✓ Local Web Worker</span>
                </div>
                <div className="flex items-center justify-between text-xs px-2.5 py-2 rounded bg-[#18191e]">
                  <span className="text-[#8f9299]">C / C++ (GCC / Clang)</span>
                  <span className="text-zinc-500 font-medium">Requires Native Runtime</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#252830]">
              <button
                type="button"
                onClick={() => setShowSandboxModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Storage & Export Modal */}
      {showStorageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#141518] border border-[#2e3137] rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Local Storage & Persistence</h3>
              </div>
              <button
                onClick={() => setShowStorageModal(false)}
                className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <span className="text-[#8f9299]">Active Project:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {activeWorkspace?.name || "None"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <span className="text-[#8f9299]">Project Storage Used:</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {formatBytes(storageStats.bytes)} ({storageStats.fileCount} files)
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <span className="text-[#8f9299]">Storage Engine:</span>
                <span className="text-emerald-400 font-mono">IndexedDB + OPFS</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#18191e] border border-[#26282e]">
                <span className="text-[#8f9299]">Auto-Save:</span>
                <span className="text-white">Active (500ms debounce)</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await exportProject();
                  setShowStorageModal(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Project as ZIP (100% Client-Side)</span>
              </button>

              {activeWorkspace && workspaces.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm(`Are you sure you want to permanently delete "${activeWorkspace.name}" from your local browser storage?`)) {
                      await deleteWorkspace(activeWorkspace.id);
                      setShowStorageModal(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete This Project</span>
                </button>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#252830]">
              <button
                type="button"
                onClick={() => setShowStorageModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#1e2025] hover:bg-[#282a30] text-[#dedfe2] rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runtimes & Compilers Inspector Modal */}
      {showRuntimesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#141518] border border-[#2e3137] rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">System Compilers & Runtimes</h3>
              </div>
              <button
                onClick={() => setShowRuntimesModal(false)}
                className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8f9299] leading-relaxed">
              Solix detects installed compilers and execution runtimes directly on your host environment.
            </p>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {availableRuntimes.map((rt) => (
                <div
                  key={rt.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#191b20] border border-[#262930]"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{rt.display_name}</span>
                      {rt.version && (
                        <span className="text-[10.5px] font-mono text-cyan-400">
                          {rt.version}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#666970] truncate mt-0.5">
                      {rt.available ? (
                        <span className="font-mono text-[10px] text-[#8f9299]">
                          {rt.compiler || rt.runner || "Available in system environment"}
                        </span>
                      ) : (
                        <span>{rt.install_hint || "Not detected in system PATH"}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    {rt.available ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        <span>Available</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                        <XCircle className="w-3 h-3 text-zinc-500" />
                        <span>Not installed</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#252830]">
              <button
                type="button"
                onClick={() => setShowRuntimesModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors cursor-pointer"
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
