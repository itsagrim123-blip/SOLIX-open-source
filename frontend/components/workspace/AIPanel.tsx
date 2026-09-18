"use client";

import React, { useEffect, useRef, useState } from "react";
import {
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
  Sparkles,
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
        prompt = `Explain ${selectionTarget} and how it fits into the project architecture.`;
        break;
      case "debug":
        prompt = `Find potential bugs or edge-case vulnerabilities in ${selectionTarget} and propose a fix.`;
        break;
      case "fix":
        prompt = `Fix any syntax, type, or runtime errors in ${selectionTarget} and provide a patch.`;
        break;
      case "refactor":
        prompt = `Refactor ${selectionTarget} for improved readability, modern idioms, and performance.`;
        break;
      case "tests":
        prompt = `Write comprehensive unit tests for ${selectionTarget}.`;
        break;
      case "doc":
        prompt = `Generate docstrings, type annotations, and documentation for ${selectionTarget}.`;
        break;
    }

    onSendMessage(prompt, { customAction: action });
  };

  const renderAgentStateBadge = (state: AgentState) => {
    switch (state) {
      case "planning":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Planning
          </span>
        );
      case "reading":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Reading
          </span>
        );
      case "editing":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Editing
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse">
            <AlertTriangle className="w-2.5 h-2.5" />
            Awaiting Approval
          </span>
        );
      case "applying":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Applying
          </span>
        );
      case "building":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Building
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Running
          </span>
        );
      case "testing":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Testing
          </span>
        );
      case "debugging":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Debugging
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Done
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <X className="w-2.5 h-2.5" />
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#2a2c33] text-[#a0a4ae] border border-[#3e414c]">
            <Square className="w-2.5 h-2.5" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#111215] border-l border-[#24262b] select-none">
      {/* AI Panel Header */}
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-[#24262b] bg-[#141518]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#191b20] border border-[#2e3138] grid place-items-center">
              <SolixLogo size="sm" px={20} />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">Solix Code AI</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Model Badge */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1c1f26] text-cyan-400 border border-cyan-800/40">
              <Cpu className="w-2.5 h-2.5" />
              qwen2.5-coder:7b
            </span>

            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={onToggleWebSearch}
              className={`p-1 rounded transition-colors cursor-pointer ${
                webSearchEnabled
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700"
                  : "text-[#73767d] hover:text-[#eeeeec]"
              }`}
              title={webSearchEnabled ? "Web Search ON" : "Toggle Web Search for documentation"}
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Selector & Agent Controls */}
        <div className="flex items-center justify-between pt-0.5">
          {/* Segmented [Ask] vs [Agent] Toggle */}
          <div className="flex items-center rounded-lg bg-[#0d0e12] p-0.5 border border-[#262830]">
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("ask")}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                agentMode === "ask"
                  ? "bg-[#1f222a] text-white shadow-xs"
                  : "text-[#73767d] hover:text-[#dedfe2]"
              }`}
            >
              Ask
            </button>
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("agent")}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                agentMode === "agent"
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-[#73767d] hover:text-[#dedfe2]"
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              Agent
            </button>
          </div>

          {/* Mode Controls */}
          {agentMode === "agent" && (
            <div className="flex items-center gap-1.5">
              {/* Auto Apply Toggle */}
              <button
                type="button"
                onClick={onToggleAutoApply}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  autoApply
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700"
                    : "bg-[#16181d] text-[#73767d] hover:text-[#dedfe2] border border-[#282b33]"
                }`}
                title={
                  autoApply
                    ? "Auto-apply ON: Changes apply automatically (Deletions always require approval)"
                    : "Auto-apply OFF: File changes require explicit review & approval"
                }
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>Auto Apply</span>
              </button>

              {/* State Badge */}
              {renderAgentStateBadge(agentState)}

              {/* Stop Button if generating */}
              {isGenerating && onStopAgent && (
                <button
                  type="button"
                  onClick={onStopAgent}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition-colors cursor-pointer shadow-xs animate-pulse"
                  title="Stop Agent Execution"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Pill Indicator */}
      <div className="px-3 py-1.5 bg-[#14161a] border-b border-[#24262b] text-[11px] text-[#8f9299] flex items-center justify-between">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          {selectedCode ? (
            <span className="truncate">
              Selected: {selectedLineRange ? `lines ${selectedLineRange.start}–${selectedLineRange.end}` : "snippet"} in {activeFile || "file"}
            </span>
          ) : activeFile ? (
            <span className="truncate">Context: {activeFile}</span>
          ) : (
            <span>Context: Entire Project</span>
          )}
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-[#24262b] bg-[#121316] overflow-x-auto">
        <button
          type="button"
          onClick={() => handleActionClick("explain")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#191b20] hover:bg-[#20232a] text-[#dedfe2] border border-[#2e3138] transition-colors flex-shrink-0 cursor-pointer"
        >
          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
          <span>Explain</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionClick("debug")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#191b20] hover:bg-[#20232a] text-[#dedfe2] border border-[#2e3138] transition-colors flex-shrink-0 cursor-pointer"
        >
          <Wand2 className="w-2.5 h-2.5 text-amber-400" />
          <span>Debug</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionClick("fix")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#191b20] hover:bg-[#20232a] text-[#dedfe2] border border-[#2e3138] transition-colors flex-shrink-0 cursor-pointer"
        >
          <Code2 className="w-2.5 h-2.5 text-rose-400" />
          <span>Fix Bug</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionClick("refactor")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#191b20] hover:bg-[#20232a] text-[#dedfe2] border border-[#2e3138] transition-colors flex-shrink-0 cursor-pointer"
        >
          <FileCheck className="w-2.5 h-2.5 text-emerald-400" />
          <span>Refactor</span>
        </button>

        <button
          type="button"
          onClick={() => handleActionClick("tests")}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-[#191b20] hover:bg-[#20232a] text-[#dedfe2] border border-[#2e3138] transition-colors flex-shrink-0 cursor-pointer"
        >
          <span>Tests</span>
        </button>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#73767d]">
            <div className="w-10 h-10 rounded-xl bg-[#15171a] border border-[#24262b] flex items-center justify-center text-lg mb-2">
              ⚡
            </div>
            <p className="text-xs font-medium text-[#dedfe2] mb-1">
              {agentMode === "agent" ? "Solix Autonomous Coding Agent" : "Solix Code Intelligence"}
            </p>
            <p className="text-[11px] max-w-[240px] text-[#73767d]">
              {agentMode === "agent"
                ? "Give high-level tasks like 'Add tests', 'Refactor calculator', or 'Create a FastAPI microservice'."
                : "Ask questions about your codebase, request snippets, or analyze runtime errors."}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {isUser ? (
                  <div className="w-fit max-w-[88%] bg-[#1a1c22] border border-[#2e3138] rounded-xl px-3 py-2 text-xs text-[#eeeeec] leading-relaxed whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-2.5">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8f9299]">
                      <span className="text-white">Solix</span>
                      {msg.agentState && renderAgentStateBadge(msg.agentState)}
                      {msg.isStreaming && !msg.agentState && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      )}
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
                    <div className="text-xs text-[#eeeeec] leading-relaxed break-words">
                      {msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : msg.isStreaming ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#8f9299] py-1 animate-pulse">
                          <span className="w-3 h-3 border-2 border-[#3a3d43] border-t-cyan-400 rounded-full animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Web Search Sources if present */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourceCards sources={msg.sources} />
                    )}

                    {/* Legacy Single Proposed Patch Card */}
                    {msg.patch && !msg.approval && (
                      <div className="p-2.5 rounded-lg border border-cyan-700/50 bg-[#121820] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                            <GitPullRequest className="w-3.5 h-3.5" />
                            <span>Proposed Patch: {msg.patch.file}</span>
                          </div>
                        </div>

                        {msg.patch.explanation && (
                          <p className="text-[11px] text-[#c4c6cb] m-0">
                            {msg.patch.explanation}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onReviewPatch(msg.patch!)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#191e28] hover:bg-[#202735] text-cyan-300 text-xs font-medium border border-cyan-800/60 transition-colors cursor-pointer"
                          >
                            <span>Review Diff</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onApplyPatch(msg.patch!)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Apply Changes</span>
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

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-[#24262b] bg-[#141518]">
        <div className="relative rounded-lg border border-[#2e3138] bg-[#0e0f12] focus-within:border-[#454952] transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              agentMode === "agent"
                ? "Describe task for Autonomous Agent (Enter to execute)..."
                : selectedCode
                ? "Ask about selected code (Enter to send)..."
                : activeFile
                ? `Ask about ${activeFile} (Enter to send)...`
                : "Ask Solix about this project..."
            }
            rows={2}
            className="w-full bg-transparent px-2.5 py-2 text-xs text-[#eeeeec] placeholder:text-[#666970] outline-none resize-none"
          />

          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[10px] text-[#666970]">
              Shift+Enter for newline
            </span>

            <div className="flex items-center gap-1.5">
              {isGenerating && onStopAgent && (
                <button
                  type="button"
                  onClick={onStopAgent}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Stop Agent"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  input.trim() && !isGenerating
                    ? "bg-cyan-600 text-white hover:bg-cyan-500"
                    : "text-[#555860] cursor-not-allowed"
                }`}
                title="Send (Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Subcomponents ──

const PlanWidget: React.FC<{ plan: AgentPlanStep[] }> = ({ plan }) => {
  const [isOpen, setIsOpen] = useState(true);
  const completedCount = plan.filter((p) => p.status === "completed").length;

  return (
    <div className="rounded-lg border border-cyan-800/40 bg-[#12161f] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#161c28] hover:bg-[#1a2232] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-cyan-200">Autonomous Plan</span>
          <span className="text-[10px] font-mono text-[#8f9299]">
            ({completedCount}/{plan.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#8f9299]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#8f9299]" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 space-y-1.5 bg-[#0f1218]">
          {plan.map((step) => {
            let icon = <Clock className="w-3 h-3 text-[#666970]" />;
            let textColor = "text-[#8f9299]";
            if (step.status === "completed") {
              icon = <Check className="w-3 h-3 text-emerald-400" />;
              textColor = "text-[#c4c6cb] line-through decoration-[#4a4d55]";
            } else if (step.status === "in_progress") {
              icon = <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />;
              textColor = "text-cyan-300 font-medium";
            } else if (step.status === "failed") {
              icon = <X className="w-3 h-3 text-rose-400" />;
              textColor = "text-rose-300";
            }

            return (
              <div key={step.id} className="flex items-start gap-2 text-[11px] leading-snug">
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[#252830] bg-[#101216] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[#14171d] hover:bg-[#181c24] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-3 h-3 text-[#8f9299]" />
          <span className="text-[11px] font-medium text-[#c4c6cb]">
            Tools Activity ({tools.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#8f9299]" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#8f9299]" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 space-y-1.5 bg-[#0b0c0e] max-h-48 overflow-y-auto">
          {tools.map((t, i) => {
            const isRun = t.status === "running";
            const isErr = t.status === "error";

            return (
              <div
                key={t.id || i}
                className="flex items-start gap-2 p-1.5 rounded bg-[#13151b] border border-[#1e2027] text-[10px] font-mono"
              >
                <span className="shrink-0 mt-0.5">
                  {isRun ? (
                    <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                  ) : isErr ? (
                    <X className="w-2.5 h-2.5 text-rose-400" />
                  ) : (
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  )}
                </span>
                <div className="flex-1 truncate">
                  <span className="text-cyan-300 font-semibold">{t.name}</span>
                  {t.args?.path && <span className="text-[#8f9299]"> ({t.args.path})</span>}
                  {t.args?.query && <span className="text-[#8f9299]"> ("{t.args.query}")</span>}
                </div>
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
  const opColor =
    approval.operation === "create"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : approval.operation === "delete"
      ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
      : "text-amber-400 bg-amber-500/10 border-amber-500/30";

  return (
    <div className="p-3 rounded-lg border border-amber-600/50 bg-[#16140f] space-y-2.5 animate-fade-in shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-300">Approval Required</span>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${opColor}`}
        >
          {approval.operation}
        </span>
      </div>

      <div className="text-xs text-[#dcded8]">
        <span className="text-[#8f9299]">File: </span>
        <span className="font-mono text-white font-medium">{approval.file}</span>
      </div>

      {approval.explanation && (
        <p className="text-[11px] text-[#b4b7be] m-0 leading-relaxed">
          {approval.explanation}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onReview}
          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-[#222328] hover:bg-[#2b2d34] text-cyan-300 text-xs font-medium border border-[#3e424e] transition-colors cursor-pointer"
        >
          <Code2 className="w-3 h-3" />
          <span>Review Diff</span>
        </button>

        <button
          type="button"
          onClick={onReject}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
          <span>Reject</span>
        </button>

        <button
          type="button"
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Check className="w-3 h-3" />
          <span>Apply</span>
        </button>
      </div>
    </div>
  );
};
