"use client";

import React, { useState } from "react";
import {
  Check,
  Code2,
  Cpu,
  FolderTree,
  Hammer,
  MessageSquare,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Terminal as TerminalIcon,
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

  // Reviewing diff modal state
  const [reviewingModalPatch, setReviewingModalPatch] = useState<CodePatch | null>(null);
  const [reviewingOperation, setReviewingOperation] = useState<"create" | "modify" | "delete" | undefined>();
  const [reviewingApprovalId, setReviewingApprovalId] = useState<string | null>(null);

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

          {/* Sandboxed Badge */}
          <span className="hidden md:inline-flex items-center gap-1.5 text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Local Sandbox
          </span>

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
                  <option value="starter-python">Python 3 (main.py, test_main.py)</option>
                  <option value="starter-cpp">C++ (GCC) (main.cpp, math_utils.cpp, include/)</option>
                  <option value="starter-node">Node.js (index.js, package.json)</option>
                  <option value="empty">Empty Project (blank canvas)</option>
                </select>
              </div>

              <div className="text-[11px] text-[#666970]">
                A sandboxed environment will be created with starter templates, build tasks, and test suites.
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
