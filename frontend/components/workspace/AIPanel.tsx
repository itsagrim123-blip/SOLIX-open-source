"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  FileCheck,
  GitPullRequest,
  Globe,
  Loader2,
  ShieldCheck,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { SourceCards } from "@/components/chat/SourceCards";
import {
  AgentApprovalRequest,
  AgentPlanStep,
  AgentState,
  AgentToolActivity,
  CodingChatMessage,
  CodePatch,
} from "@/types/workspace";

interface AIPanelProps {
  messages: CodingChatMessage[];
  isGenerating: boolean;
  onSendMessage: (
    prompt: string,
    options?: {
      webSearch?: boolean;
      customAction?: "explain" | "debug" | "fix" | "refactor" | "tests" | "doc";
    }
  ) => void;
  activeFile: string | null;
  selectedCode: string;
  selectedLineRange: { start: number; end: number } | null;
  onReviewPatch: (patch: CodePatch) => void;
  onApplyPatch: (patch: CodePatch) => Promise<void>;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;

  // Autonomous Agent Props
  agentMode?: "ask" | "agent";
  onToggleAgentMode?: (mode: "ask" | "agent") => void;
  autoApply?: boolean;
  onToggleAutoApply?: () => void;
  agentState?: AgentState;
  currentPlan?: AgentPlanStep[];
  pendingApproval?: AgentApprovalRequest | null;
  onRespondApproval?: (approvalId: string, approved: boolean) => Promise<void>;
  onStopAgent?: () => void;
}

const sanitizeContent = (text: string): string => {
  if (!text) return "";
  let cleaned = text.replace(/```(?:tool_call|json)?\s*\{\s*"name"\s*:\s*"workspace_.*?\}\s*```/gs, "");
  cleaned = cleaned.replace(/<tool_call>.*?<\/tool_call>/gs, "");
  cleaned = cleaned.replace(/\{\s*"name"\s*:\s*"workspace_[a-z_]+"\s*,\s*"arguments"\s*:\s*\{.*?\}\s*\}/gs, "");
  cleaned = cleaned.replace(/<\/?tool_call>/g, "");
  cleaned = cleaned.replace(/^(?:Hello!|Hi!|Hey!|Greetings!|Hello there!|How can I (?:help|assist) you today\??)[^\n]*\n*/i, "");
  return cleaned.trim();
};

export const AIPanel: React.FC<AIPanelProps> = ({
  messages,
  isGenerating,
  onSendMessage,
  activeFile,
  selectedCode,
  selectedLineRange,
  onReviewPatch,
  onApplyPatch,
  webSearchEnabled,
  onToggleWebSearch,
  agentMode = "agent",
  onToggleAgentMode,
  autoApply = false,
  onToggleAutoApply,
  agentState = "idle",
  currentPlan = [],
  pendingApproval,
  onRespondApproval,
  onStopAgent,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleActionClick = (
    action: "explain" | "debug" | "fix" | "refactor" | "tests" | "doc"
  ) => {
    const fileTarget = activeFile ? `in ${activeFile}` : "in this project";
    const selectionTarget = selectedCode
      ? `the selected code (${selectedLineRange ? `lines ${selectedLineRange.start}-${selectedLineRange.end}` : ""})`
      : `the current file (${fileTarget})`;

    let prompt = "";
    switch (action) {
      case "explain":
        prompt = `Explain ${selectionTarget} and its architecture.`;
        break;
      case "debug":
        prompt = `Inspect ${selectionTarget} for edge cases or bugs and propose a fix.`;
        break;
      case "fix":
        prompt = `Fix errors in ${selectionTarget} and generate a patch.`;
        break;
      case "refactor":
        prompt = `Refactor ${selectionTarget} for clean structure and performance.`;
        break;
      case "tests":
        prompt = `Write unit tests for ${selectionTarget}.`;
        break;
      case "doc":
        prompt = `Generate docstrings and type annotations for ${selectionTarget}.`;
        break;
    }

    onSendMessage(prompt, { customAction: action });
  };

  // Quiet agent status indicator
  const renderAgentStatus = (state: AgentState) => {
    switch (state) {
      case "planning":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Planning</span>
          </span>
        );
      case "reading":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Reading files</span>
          </span>
        );
      case "editing":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>Editing code</span>
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-orange-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span>Awaiting approval</span>
          </span>
        );
      case "applying":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Applying changes</span>
          </span>
        );
      case "building":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span>Building project</span>
          </span>
        );
      case "running":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Executing</span>
          </span>
        );
      case "testing":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-teal-400">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span>Running tests</span>
          </span>
        );
      case "debugging":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>Diagnosing error</span>
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Completed</span>
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400">
            <X className="w-3 h-3 text-rose-400" />
            <span>Failed</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#858b94]">
            <Square className="w-2.5 h-2.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#111214] border-l border-[#22242a] select-none text-[#d4d7dc]">
      {/* Top Header: AI Developer Tool Panel (34px) */}
      <div className="flex items-center justify-between px-3 h-[34px] border-b border-[#22242a] bg-[#111214] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <SolixLogo size="sm" px={16} />
          <span className="text-[10.5px] font-mono font-semibold tracking-wider text-white uppercase">
            SOLIX CODE AI
          </span>
          <span className="text-[#3c4048] font-mono text-[10px]">·</span>
          <span className="text-[10px] font-mono text-[#787f8c] hidden sm:inline truncate">
            {agentMode === "agent" ? "Agent" : "Ask"} · qwen2.5-coder:7b
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5">
          {/* Segmented [Ask] vs [Agent] Toggle */}
          <div className="flex items-center rounded-xs bg-[#0d0e10] p-0.5 border border-[#292c31]">
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("ask")}
              className={`px-2 h-5 rounded-xs text-[10.5px] font-medium transition-colors cursor-pointer ${
                agentMode === "ask"
                  ? "bg-[#22252a] text-white font-semibold"
                  : "text-[#858b94] hover:text-[#d4d7dc]"
              }`}
            >
              Ask
            </button>
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("agent")}
              className={`px-2 h-5 rounded-xs text-[10.5px] font-semibold transition-colors cursor-pointer ${
                agentMode === "agent"
                  ? "bg-cyan-600 text-white"
                  : "text-[#858b94] hover:text-[#d4d7dc]"
              }`}
            >
              Agent
            </button>
          </div>

          {/* Auto Apply Toggle (in Agent mode) */}
          {agentMode === "agent" && (
            <button
              type="button"
              onClick={onToggleAutoApply}
              className={`px-1.5 h-5 rounded-xs text-[10px] font-mono border transition-colors cursor-pointer ${
                autoApply
                  ? "bg-emerald-950/70 text-emerald-300 border-emerald-700"
                  : "bg-[#16171a] text-[#666c75] border-[#292c31] hover:text-[#d4d7dc]"
              }`}
              title={
                autoApply
                  ? "Auto-apply ON: safe changes apply immediately"
                  : "Auto-apply OFF: all file changes require review"
              }
            >
              Auto-Apply
            </button>
          )}

          {/* Web Search Toggle */}
          <button
            type="button"
            onClick={onToggleWebSearch}
            className={`p-1 rounded-xs transition-colors cursor-pointer ${
              webSearchEnabled
                ? "text-cyan-400 bg-[#17202d] border border-cyan-800/50"
                : "text-[#666c75] hover:text-[#d4d7dc]"
            }`}
            title={webSearchEnabled ? "Web Search Active" : "Toggle Web Search for Documentation"}
          >
            <Globe className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Context & Quick Actions Bar (26px) */}
      <div className="px-3 h-[26px] bg-[#0d0e10] border-b border-[#202227] text-[10.5px] font-mono text-[#666c75] flex items-center justify-between shrink-0">
        <div className="truncate pr-2">
          {selectedCode ? (
            <span className="text-[#a5abb5]">
              Selected lines {selectedLineRange ? `${selectedLineRange.start}–${selectedLineRange.end}` : ""} in {activeFile || "file"}
            </span>
          ) : activeFile ? (
            <span className="text-[#a5abb5]">Context: {activeFile}</span>
          ) : (
            <span>Context: Entire Project</span>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleActionClick("explain")}
            className="hover:text-cyan-400 transition-colors"
            title="Explain code"
          >
            Explain
          </button>
          <span className="text-[#3a3d45]">·</span>
          <button
            type="button"
            onClick={() => handleActionClick("fix")}
            className="hover:text-cyan-400 transition-colors"
            title="Fix bug"
          >
            Fix
          </button>
          <span className="text-[#3a3d45]">·</span>
          <button
            type="button"
            onClick={() => handleActionClick("tests")}
            className="hover:text-cyan-400 transition-colors"
            title="Generate tests"
          >
            Tests
          </button>
        </div>
      </div>

      {/* Real-time Agent Status line when active */}
      {agentState !== "idle" && (
        <div className="px-3 py-1.5 bg-[#141619] border-b border-[#292c31] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renderAgentStatus(agentState)}
          </div>
          {isGenerating && onStopAgent && (
            <button
              type="button"
              onClick={onStopAgent}
              className="flex items-center gap-1 px-1.5 h-5 rounded-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-mono transition-colors"
            >
              <Square className="w-2 h-2 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 font-sans text-xs select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center px-4 py-6 text-[#858b94] select-none max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <SolixLogo size="sm" px={20} />
              <span className="text-xs font-mono font-semibold text-[#e2e8f0] uppercase tracking-wider">
                SOLIX CODE AI
              </span>
            </div>
            <p className="text-xs text-[#858b94] mb-4 font-sans leading-relaxed">
              Ready to work on your project.
            </p>

            <div className="text-[10.5px] font-mono text-[#666c75] uppercase tracking-wider mb-2 font-semibold">
              Try:
            </div>

            <div className="space-y-1.5 text-xs font-sans">
              <button
                type="button"
                onClick={() =>
                  onSendMessage(
                    agentMode === "agent"
                      ? `Add comprehensive unit tests for ${activeFile || "this project"}`
                      : `How should I test ${activeFile || "this code"}?`
                  )
                }
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#15171c] hover:bg-[#1c1f26] text-[#a5abb5] hover:text-white border border-[#22242a] hover:border-[#32353e] transition-colors cursor-pointer"
              >
                <span className="text-cyan-400 font-mono font-bold">›</span>
                <span>Add unit tests</span>
              </button>

              <button
                type="button"
                onClick={() => handleActionClick("fix")}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#15171c] hover:bg-[#1c1f26] text-[#a5abb5] hover:text-white border border-[#22242a] hover:border-[#32353e] transition-colors cursor-pointer"
              >
                <span className="text-cyan-400 font-mono font-bold">›</span>
                <span>Fix the current error</span>
              </button>

              <button
                type="button"
                onClick={() => handleActionClick("refactor")}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#15171c] hover:bg-[#1c1f26] text-[#a5abb5] hover:text-white border border-[#22242a] hover:border-[#32353e] transition-colors cursor-pointer"
              >
                <span className="text-cyan-400 font-mono font-bold">›</span>
                <span>
                  Refactor {activeFile ? activeFile.split("/").pop() : "codebase"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleActionClick("explain")}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#15171c] hover:bg-[#1c1f26] text-[#a5abb5] hover:text-white border border-[#22242a] hover:border-[#32353e] transition-colors cursor-pointer"
              >
                <span className="text-cyan-400 font-mono font-bold">›</span>
                <span>Explain this project</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const cleanContent = sanitizeContent(msg.content);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {isUser ? (
                  <div className="w-fit max-w-[92%] bg-[#181a1f] border border-[#292c31] rounded-xs px-2.5 py-1.5 text-xs text-[#d4d7dc] leading-relaxed whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#858b94]">
                      <span className="font-semibold text-[#d4d7dc]">SOLIX</span>
                      {msg.agentState && renderAgentStatus(msg.agentState)}
                    </div>

                    {/* Step-by-Step Agent Plan Widget */}
                    {msg.plan && msg.plan.length > 0 && (
                      <PlanWidget plan={msg.plan} />
                    )}

                    {/* Tool Activity Chips/List */}
                    {msg.tools && msg.tools.length > 0 && (
                      <ToolActivityCard tools={msg.tools} />
                    )}

                    {/* Pending Staged Change Approval Card */}
                    {msg.approval && (
                      <ApprovalCard
                        approval={msg.approval}
                        onReview={() =>
                          onReviewPatch({
                            file: msg.approval!.file,
                            explanation: msg.approval!.explanation,
                            replacement_content: msg.approval!.after,
                            diff: msg.approval!.diff,
                          })
                        }
                        onApprove={() =>
                          onRespondApproval?.(msg.approval!.approval_id, true)
                        }
                        onReject={() =>
                          onRespondApproval?.(msg.approval!.approval_id, false)
                        }
                      />
                    )}

                    {/* Response Text / Markdown */}
                    <div className="text-xs text-[#d4d7dc] leading-relaxed break-words">
                      {cleanContent ? (
                        <MarkdownRenderer content={cleanContent} />
                      ) : msg.isStreaming ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#858b94] py-1">
                          <span className="w-2.5 h-2.5 border border-[#3a3d43] border-t-cyan-400 rounded-full animate-spin" />
                          <span>Thinking &amp; executing...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Web Search Sources if present */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourceCards sources={msg.sources} />
                    )}

                    {/* Legacy Single Proposed Patch Card */}
                    {msg.patch && !msg.approval && (
                      <div className="p-2 rounded-xs border border-[#292c31] bg-[#141519] space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[11px]">
                            <GitPullRequest className="w-3 h-3" />
                            <span>Patch: {msg.patch.file}</span>
                          </div>
                        </div>

                        {msg.patch.explanation && (
                          <p className="text-[11px] text-[#858b94] m-0">
                            {msg.patch.explanation}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onReviewPatch(msg.patch!)}
                            className="px-2 h-6 rounded-xs bg-[#1c1f24] hover:bg-[#24272e] text-cyan-300 text-[11px] font-medium border border-[#2e3138] transition-colors cursor-pointer"
                          >
                            Review Diff
                          </button>

                          <button
                            type="button"
                            onClick={() => onApplyPatch(msg.patch!)}
                            className="px-2.5 h-6 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Apply Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Command Box */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-[#292c31] bg-[#111214]">
        <div className="rounded-xs border border-[#22242a] bg-[#0d0f12] focus-within:border-[#3a3f4b] transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              agentMode === "agent"
                ? "Describe a task for the Agent..."
                : selectedCode
                ? "Ask about selected code..."
                : activeFile
                ? `Ask about ${activeFile}...`
                : "Ask about this project..."
            }
            rows={2}
            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-[#d4d7dc] placeholder:text-[#555a62] outline-none resize-none font-sans"
          />

          <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">
            <span className="text-[10px] font-mono text-[#555a62]">
              Shift+Enter for newline
            </span>

            <div className="flex items-center gap-1.5">
              {isGenerating && onStopAgent && (
                <button
                  type="button"
                  onClick={onStopAgent}
                  className="flex items-center gap-1 px-2 h-6 rounded-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10.5px] font-mono transition-colors"
                  title="Stop execution"
                >
                  <Square className="w-2 h-2 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className={`flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-semibold transition-colors cursor-pointer ${
                  input.trim() && !isGenerating
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                    : "bg-[#18191d] text-[#555a62] cursor-not-allowed border border-[#222429]"
                }`}
                title="Send"
              >
                <span>Send</span>
                <ArrowUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Subcomponents ──

// Human-readable tool label mapper (removes raw JSON/function names from UI)
function getToolDisplayLabel(name: string, args: Record<string, any> = {}): string {
  switch (name) {
    case "workspace_list_files":
      return "Inspected workspace files";
    case "workspace_read_file":
      return args.path ? `Read ${args.path}` : "Read file";
    case "workspace_create_file":
      return args.path ? `Created ${args.path}` : "Created file";
    case "workspace_update_file":
      return args.path ? `Staged changes to ${args.path}` : "Updated file";
    case "workspace_delete_file":
      return args.path ? `Deleted ${args.path}` : "Deleted file";
    case "workspace_run":
      return args.file ? `Ran ${args.file}` : "Executed project in sandbox";
    case "workspace_build":
      return "Built project";
    case "workspace_test":
      return "Ran test suite";
    case "workspace_search":
      return args.query ? `Searched for "${args.query}"` : "Searched codebase";
    case "workspace_diagnose_errors":
      return "Analyzed errors & diagnostics";
    default:
      return name.replace(/^workspace_/, "").replace(/_/g, " ");
  }
}

// Classic Task Checklist Plan
const PlanWidget: React.FC<{ plan: AgentPlanStep[] }> = ({ plan }) => {
  const [isOpen, setIsOpen] = useState(true);
  const completedCount = plan.filter((p) => p.status === "completed").length;

  return (
    <div className="rounded-xs border border-[#22242a] bg-[#141519] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#16171c] hover:bg-[#1a1c22] transition-colors text-left cursor-pointer border-b border-[#202227]"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-semibold text-[#858b94] uppercase tracking-wider">
            PLAN
          </span>
          <span className="text-[10px] font-mono text-[#666c75]">
            ({completedCount}/{plan.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666c75]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666c75]" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 space-y-1.5 bg-[#0d0f12] font-mono text-[11px]">
          {plan.map((step) => {
            let icon = (
              <span className="w-2.5 h-2.5 rounded-full border border-[#4a505b] inline-block shrink-0 mt-0.5" />
            );
            let textColor = "text-[#a5abb5]";

            if (step.status === "completed") {
              icon = <Check className="w-3 h-3 text-emerald-400 shrink-0" />;
              textColor = "text-[#666c75] line-through decoration-[#3a3e46]";
            } else if (step.status === "in_progress") {
              icon = <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />;
              textColor = "text-cyan-300 font-medium";
            } else if (step.status === "failed") {
              icon = <X className="w-3 h-3 text-rose-400 shrink-0" />;
              textColor = "text-rose-300";
            }

            return (
              <div key={step.id} className="flex items-start gap-2 leading-tight">
                <span className="shrink-0 mt-0.5">{icon}</span>
                <span className={`flex-1 ${textColor}`}>{step.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ToolActivityCard: React.FC<{ tools: AgentToolActivity[] }> = ({ tools }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  const toggleDetail = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDetails((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="rounded-xs border border-[#22242a] bg-[#141519] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#16171c] hover:bg-[#1a1c22] transition-colors text-left cursor-pointer border-b border-[#202227]"
      >
        <div className="flex items-center gap-1.5">
          <Code2 className="w-3 h-3 text-[#666c75]" />
          <span className="text-[10px] font-mono text-[#858b94] uppercase tracking-wider font-semibold">
            ACTIVITY ({tools.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#666c75]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#666c75]" />
        )}
      </button>

      {isOpen && (
        <div className="p-1.5 space-y-1 bg-[#0d0f12] max-h-56 overflow-y-auto">
          {tools.map((t, i) => {
            const isRun = t.status === "running";
            const isErr = t.status === "error";
            const label = getToolDisplayLabel(t.name, t.args);
            const hasArgs = t.args && Object.keys(t.args).length > 0;
            const hasResult = Boolean(t.result);
            const isDetailOpen = Boolean(expandedDetails[i]);

            return (
              <div
                key={t.id || i}
                className="p-1.5 rounded-xs bg-[#131417] border border-[#202227] text-[10.5px] font-mono space-y-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate flex-1">
                    <span className="shrink-0">
                      {isRun ? (
                        <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                      ) : isErr ? (
                        <X className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Check className="w-3 h-3 text-emerald-400" />
                      )}
                    </span>
                    <span className={isRun ? "text-cyan-300" : isErr ? "text-rose-300" : "text-[#d4d7dc]"}>
                      {label}
                    </span>
                  </div>

                  {(hasArgs || hasResult) && (
                    <button
                      type="button"
                      onClick={(e) => toggleDetail(i, e)}
                      className="text-[9.5px] text-[#666c75] hover:text-[#a5abb5] shrink-0 cursor-pointer ml-1 font-mono"
                    >
                      {isDetailOpen ? "▾ details" : "▸ details"}
                    </button>
                  )}
                </div>

                {isDetailOpen && (
                  <div className="mt-1 p-1.5 bg-[#090a0c] rounded-xs border border-[#1e2025] text-[9.5px] text-[#858b94] overflow-x-auto max-h-24">
                    {hasArgs && (
                      <div>
                        <span className="text-[#555a62]">args: </span>
                        <span>{JSON.stringify(t.args)}</span>
                      </div>
                    )}
                    {hasResult && (
                      <div className="mt-0.5 truncate">
                        <span className="text-[#555a62]">result: </span>
                        <span>
                          {typeof t.result === "string"
                            ? t.result.slice(0, 150)
                            : JSON.stringify(t.result).slice(0, 150)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ApprovalCard: React.FC<{
  approval: AgentApprovalRequest;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ approval, onReview, onApprove, onReject }) => {
  return (
    <div className="p-2.5 rounded-xs border border-amber-800/60 bg-[#16140f] space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] font-mono font-semibold text-amber-300">
            Approval Required
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase font-semibold text-amber-400">
          [{approval.operation}]
        </span>
      </div>

      <div className="text-[11px] font-mono text-[#d4d7dc]">
        <span className="text-[#858b94]">File: </span>
        <span className="font-semibold text-white">{approval.file}</span>
      </div>

      {approval.explanation && (
        <p className="text-[11px] text-[#a5abb5] m-0 leading-relaxed font-sans">
          {approval.explanation}
        </p>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={onReview}
          className="flex-1 px-2 h-6 rounded-xs bg-[#1f2229] hover:bg-[#282c35] text-cyan-300 text-[11px] font-medium border border-[#303440] transition-colors cursor-pointer"
        >
          Review Diff
        </button>

        <button
          type="button"
          onClick={onReject}
          className="px-2.5 h-6 rounded-xs bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[11px] font-medium transition-colors cursor-pointer"
        >
          Reject
        </button>

        <button
          type="button"
          onClick={onApprove}
          className="flex-1 px-2 h-6 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
        >
          Apply
        </button>
      </div>
    </div>
  );
};
