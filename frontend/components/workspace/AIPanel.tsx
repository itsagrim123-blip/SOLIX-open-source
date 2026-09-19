"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  MoreHorizontal,
  Square,
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
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, currentPlan, pendingApproval]);

  // Close settings popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const renderAgentStatusText = (state: AgentState): string => {
    switch (state) {
      case "planning":
        return "Planning...";
      case "reading":
        return "Reading files...";
      case "editing":
        return "Editing code...";
      case "awaiting_approval":
        return "Awaiting approval...";
      case "applying":
        return "Applying changes...";
      case "building":
        return "Building project...";
      case "running":
        return "Executing...";
      case "testing":
        return "Running tests...";
      case "debugging":
        return "Diagnosing error...";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return "Working...";
    }
  };

  const isWorking = isGenerating || (agentState && agentState !== "idle" && agentState !== "completed" && agentState !== "failed" && agentState !== "cancelled");

  const fileName = activeFile ? activeFile.split("/").pop() || activeFile : null;

  return (
    <div className="h-full flex flex-col bg-[#111214] border-l border-[#22242a] select-none text-[#d4d7dc]">
      {/* ── Top Header (34px) ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-[34px] border-b border-[#22242a] bg-[#111214] shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-1.5 min-w-0">
          <SolixLogo size="sm" px={16} />
          <span className="text-[11px] font-semibold tracking-wider text-white uppercase select-none">
            SOLIX CODE AI
          </span>
        </div>

        {/* Controls: Segmented Toggle + Settings Menu */}
        <div className="flex items-center gap-2">
          {/* Ask | Agent Segmented Switcher */}
          <div className="flex items-center rounded-xs bg-[#0d0e10] p-0.5 border border-[#23262d]">
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("ask")}
              className={`px-2 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
                agentMode === "ask"
                  ? "bg-[#20232a] text-white font-medium"
                  : "text-[#717680] hover:text-[#d4d7dc]"
              }`}
            >
              Ask
            </button>
            <button
              type="button"
              onClick={() => onToggleAgentMode?.("agent")}
              className={`px-2 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
                agentMode === "agent"
                  ? "bg-cyan-600/90 text-white font-medium"
                  : "text-[#717680] hover:text-[#d4d7dc]"
              }`}
            >
              Agent
            </button>
          </div>

          {/* Settings Menu Button & Popover */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded-xs transition-colors cursor-pointer ${
                showSettings
                  ? "bg-[#1d2026] text-white"
                  : "text-[#717680] hover:text-white hover:bg-[#1a1c21]"
              }`}
              title="Agent settings"
              aria-label="Agent settings"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Settings Popover */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xs bg-[#14161a] border border-[#282b33] p-2.5 z-50 shadow-2xl space-y-2.5 text-xs animate-fade-in font-sans">
                <div className="flex items-center justify-between border-b border-[#20232a] pb-1.5">
                  <span className="text-[10px] font-mono font-semibold text-[#858b94] uppercase tracking-wider">
                    Agent Settings
                  </span>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-0.5 text-[#666c75] hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Auto-Apply Toggle */}
                {agentMode === "agent" && (
                  <div className="flex items-center justify-between text-[11px]">
                    <div>
                      <div className="text-[#e2e4e8] font-medium">Auto Apply</div>
                      <div className="text-[10px] text-[#717680] leading-tight">
                        Safe changes apply without review
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleAutoApply}
                      className={`px-2 py-0.5 rounded-xs text-[10.5px] font-medium border transition-colors cursor-pointer ${
                        autoApply
                          ? "bg-emerald-950/70 text-emerald-300 border-emerald-700"
                          : "bg-[#181a1f] text-[#717680] border-[#292c33] hover:text-white"
                      }`}
                    >
                      {autoApply ? "On" : "Off"}
                    </button>
                  </div>
                )}

                {/* Web Search Toggle */}
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    <div className="text-[#e2e4e8] font-medium">Web Search</div>
                    <div className="text-[10px] text-[#717680] leading-tight">
                      Search online documentation
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleWebSearch}
                    className={`px-2 py-0.5 rounded-xs text-[10.5px] font-medium border transition-colors cursor-pointer ${
                      webSearchEnabled
                        ? "bg-cyan-950/70 text-cyan-300 border-cyan-800"
                        : "bg-[#181a1f] text-[#717680] border-[#292c33] hover:text-white"
                    }`}
                  >
                    {webSearchEnabled ? "On" : "Off"}
                  </button>
                </div>

                {/* Model Info */}
                <div className="pt-1 border-t border-[#20232a] text-[10px] text-[#6b7280] flex items-center justify-between">
                  <span>Model</span>
                  <span className="font-mono text-[#a1a1aa]">qwen2.5-coder:7b</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Context Bar (Subtle, 24px) ─────────────────────────────────────── */}
      <div className="px-3 h-6 bg-[#0e1013] border-b border-[#1f2228] text-[10.5px] text-[#6b7280] flex items-center justify-between shrink-0 font-sans">
        <div className="truncate flex items-center gap-1.5">
          <span className="text-[#858b94]">Context:</span>
          <span className="text-[#d1d5db] truncate font-mono text-[10px]">
            {selectedCode
              ? `${fileName || "file"} (${selectedLineRange ? `L${selectedLineRange.start}–${selectedLineRange.end}` : "selection"})`
              : fileName || "Project"}
          </span>
        </div>

        {/* Inline Context Actions */}
        <div className="flex items-center gap-2 shrink-0 text-[10.5px]">
          {selectedCode ? (
            <button
              type="button"
              onClick={() => handleActionClick("explain")}
              className="text-[#9ca3af] hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Explain selection
            </button>
          ) : activeFile ? (
            <>
              <button
                type="button"
                onClick={() => handleActionClick("explain")}
                className="text-[#9ca3af] hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Explain
              </button>
              <span className="text-[#374151]">·</span>
              <button
                type="button"
                onClick={() => handleActionClick("fix")}
                className="text-[#9ca3af] hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Fix
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Working Status Bar (Shown only when working) ───────────────────── */}
      {isWorking && (
        <div className="px-3 py-1 bg-[#121418] border-b border-[#1f2228] flex items-center justify-between shrink-0 text-[11px] font-sans">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span>{renderAgentStatusText(agentState)}</span>
          </div>
          {onStopAgent && (
            <button
              type="button"
              onClick={onStopAgent}
              className="text-[10px] font-mono text-rose-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Square className="w-2 h-2 fill-current" />
              <span>Stop</span>
            </button>
          )}
        </div>
      )}

      {/* ── Conversation & Activity Area ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 font-sans text-xs select-text">
        {messages.length === 0 ? (
          /* Empty State — Calm, Simple, Obvious */
          <div className="h-full flex flex-col justify-center px-3 py-6 text-[#858b94] select-none max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <SolixLogo size="sm" px={18} />
              <span className="text-[11px] font-semibold text-[#e2e8f0] tracking-wider uppercase">
                SOLIX CODE AI
              </span>
            </div>

            {agentMode === "ask" ? (
              <>
                <p className="text-xs text-[#9ca3af] mb-4 font-sans leading-relaxed">
                  Ask anything about your code.
                </p>
                <div className="text-[10px] font-mono text-[#6b7280] uppercase tracking-wider mb-2 font-medium">
                  Try:
                </div>
                <div className="space-y-1.5 text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => handleActionClick("explain")}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>Explain this file</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSendMessage(
                        `Why is this code failing? Inspect errors in ${fileName || "this project"} and suggest a solution.`
                      )
                    }
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>Why is this failing?</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSendMessage(
                        `How does this function or module work in ${fileName || "this project"}? Explain the logic in detail.`
                      )
                    }
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>How does this function work?</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-[#9ca3af] mb-4 font-sans leading-relaxed">
                  Ready to work on your project.
                </p>
                <div className="text-[10px] font-mono text-[#6b7280] uppercase tracking-wider mb-2 font-medium">
                  Try:
                </div>
                <div className="space-y-1.5 text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => handleActionClick("fix")}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>Fix the current error</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSendMessage(
                        `Add comprehensive unit tests for ${fileName || "this project"}`
                      )
                    }
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>Add unit tests</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActionClick("refactor")}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xs bg-[#14161a] hover:bg-[#1a1d24] text-[#a5abb5] hover:text-white border border-[#202227] hover:border-[#2f333c] transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>Refactor this file</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Messages List */
          messages.map((msg) => {
            const isUser = msg.role === "user";
            const cleanContent = sanitizeContent(msg.content);

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {isUser ? (
                  <div className="w-fit max-w-[92%] bg-[#1a1c22] border border-[#272a31] rounded-xs px-2.5 py-1.5 text-xs text-[#d4d7dc] leading-relaxed whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-1.5">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#717680]">
                      <span className="font-semibold text-[#d4d7dc]">SOLIX</span>
                      {msg.agentState && msg.agentState !== "idle" && (
                        <span>
                          · {(!msg.isStreaming && msg.agentState === "planning") ? "Completed" : renderAgentStatusText(msg.agentState)}
                        </span>
                      )}
                    </div>

                    {/* Compact Plan */}
                    {msg.plan && msg.plan.length > 0 && (
                      <PlanWidget plan={msg.plan} />
                    )}

                    {/* Human-readable Tool Activity (No raw JSON) */}
                    {msg.tools && msg.tools.length > 0 && (
                      <ToolActivityCard tools={msg.tools} />
                    )}

                    {/* Staged Change Approval Card */}
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
                        <div className="flex items-center gap-1.5 text-[11px] text-[#858b94] py-1">
                          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                          <span>Thinking &amp; executing...</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Web Search Sources if present */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourceCards sources={msg.sources} />
                    )}

                    {/* Legacy Proposed Patch Card */}
                    {msg.patch && !msg.approval && (
                      <div className="p-2 rounded-xs border border-[#282b33] bg-[#141519] space-y-1.5 my-1">
                        <div className="text-[11px] font-mono text-cyan-300">
                          Patch: {msg.patch.file}
                        </div>
                        {msg.patch.explanation && (
                          <p className="text-[11px] text-[#858b94] m-0">
                            {msg.patch.explanation}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => onReviewPatch(msg.patch!)}
                            className="px-2 h-5.5 rounded-xs bg-[#1c1f24] hover:bg-[#24272e] text-cyan-300 text-[10.5px] font-medium border border-[#2e3138] transition-colors cursor-pointer"
                          >
                            Review diff
                          </button>
                          <button
                            type="button"
                            onClick={() => onApplyPatch(msg.patch!)}
                            className="px-2 h-5.5 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white text-[10.5px] font-medium transition-colors cursor-pointer"
                          >
                            Apply changes
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

        {/* Live Pending Approval if not already inside a message */}
        {pendingApproval && !messages.some((m) => m.approval?.approval_id === pendingApproval.approval_id) && (
          <ApprovalCard
            approval={pendingApproval}
            onReview={() =>
              onReviewPatch({
                file: pendingApproval.file,
                explanation: pendingApproval.explanation,
                replacement_content: pendingApproval.after,
                diff: pendingApproval.diff,
              })
            }
            onApprove={() =>
              onRespondApproval?.(pendingApproval.approval_id, true)
            }
            onReject={() =>
              onRespondApproval?.(pendingApproval.approval_id, false)
            }
          />
        )}

        {/* Live Active Plan if agent is actively running with plan */}
        {isWorking && currentPlan && currentPlan.length > 0 && !messages.some((m) => m.plan && m.plan.length > 0) && (
          <PlanWidget plan={currentPlan} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box (Visual Focus of the Panel) ─────────────────────────── */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-[#1f2228] bg-[#111214] shrink-0">
        <div className="rounded-xs border border-[#22242a] bg-[#0d0f12] focus-within:border-[#383d47] transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              agentMode === "agent"
                ? fileName
                  ? `Describe a task for ${fileName}...`
                  : "Describe a task for Solix..."
                : selectedCode
                ? "Ask about selected code..."
                : fileName
                ? `Ask about ${fileName}...`
                : "Ask about this code..."
            }
            rows={2}
            className="w-full bg-transparent px-2.5 py-2 text-xs text-[#e5e7eb] placeholder:text-[#555a62] outline-none resize-none font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">
            {/* Left status / web search chip */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleWebSearch}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
                  webSearchEnabled
                    ? "text-cyan-300 bg-cyan-950/40 border border-cyan-800/50"
                    : "text-[#555a62] hover:text-[#9ca3af]"
                }`}
                title={webSearchEnabled ? "Web Search enabled (click to toggle)" : "Enable Web Search"}
              >
                <Globe className="w-3 h-3" />
                <span className="text-[10px]">Web</span>
              </button>
              {autoApply && agentMode === "agent" && (
                <span className="text-[10px] font-mono text-emerald-400/80 px-1 py-0.5 bg-emerald-950/30 rounded-xs border border-emerald-900/40">
                  auto-apply
                </span>
              )}
            </div>

            {/* Right Action: Stop or Send */}
            <div className="flex items-center gap-1.5">
              {isWorking && onStopAgent && (
                <button
                  type="button"
                  onClick={onStopAgent}
                  className="flex items-center gap-1 px-2 h-6 rounded-xs bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 text-[10.5px] font-mono transition-colors cursor-pointer"
                  title="Stop agent"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className={`flex items-center justify-center w-6 h-6 rounded-xs transition-colors cursor-pointer ${
                  input.trim() && !isGenerating
                    ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                    : "bg-[#18191d] text-[#555a62] cursor-not-allowed border border-[#222429]"
                }`}
                title="Send (Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

// ── Subcomponents ──

// Human-readable tool label mapper (clean, professional, zero raw JSON)
function getToolDisplayLabel(name: string, args: Record<string, any> = {}): string {
  const path = args.path ? args.path.split("/").pop() || args.path : "";
  const file = args.file ? args.file.split("/").pop() || args.file : "";

  switch (name) {
    case "workspace_list_files":
      return "Inspected workspace files";
    case "workspace_read_file":
      return path ? `Read ${path}` : "Read file";
    case "workspace_create_file":
      return path ? `Created ${path}` : "Created file";
    case "workspace_update_file":
      return path ? `Modified ${path}` : "Updated file";
    case "workspace_delete_file":
      return path ? `Deleted ${path}` : "Deleted file";
    case "workspace_rename_file":
      return "Renamed file";
    case "workspace_create_directory":
      return path ? `Created folder ${path}` : "Created folder";
    case "workspace_run":
      return file ? `Executed ${file}` : "Ran project";
    case "workspace_build":
      return "Built project";
    case "workspace_test":
      return "Ran test suite";
    case "workspace_search":
      return args.query ? `Searched for "${args.query}"` : "Searched codebase";
    case "workspace_diagnose_errors":
      return "Analyzed compiler diagnostics";
    case "workspace_git_status":
      return "Checked git status";
    case "workspace_git_diff":
      return "Checked git diff";
    default:
      return name.replace(/^workspace_/, "").replace(/_/g, " ");
  }
}

// Compact, calm checklist plan
const PlanWidget: React.FC<{ plan: AgentPlanStep[] }> = ({ plan }) => {
  const [isOpen, setIsOpen] = useState(true);
  if (!plan || plan.length === 0) return null;

  const completedCount = plan.filter((p) => p.status === "completed").length;

  return (
    <div className="rounded-xs border border-[#22242a] bg-[#0d0f12] overflow-hidden text-xs my-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1 bg-[#141519] hover:bg-[#181a20] transition-colors text-left cursor-pointer border-b border-[#1f2228]"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-[#717680]">
          <span className="uppercase tracking-wider">Plan</span>
          <span>
            ({completedCount}/{plan.length})
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-[#555a62]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#555a62]" />
        )}
      </button>

      {isOpen && (
        <div className="p-2 space-y-1 text-[11px] font-sans">
          {plan.map((step) => {
            const isDone = step.status === "completed";
            const isCurrent = step.status === "in_progress";
            const isFailed = step.status === "failed";

            return (
              <div key={step.id} className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs">
                  {isDone ? (
                    <span className="text-emerald-400 font-medium">✓</span>
                  ) : isCurrent ? (
                    <Loader2 className="w-3 h-3 text-cyan-400 animate-spin inline-block" />
                  ) : isFailed ? (
                    <span className="text-rose-400 font-bold">✕</span>
                  ) : (
                    <span className="text-[#555a62]">○</span>
                  )}
                </span>
                <span
                  className={
                    isDone
                      ? "text-[#6b7280] line-through"
                      : isCurrent
                      ? "text-cyan-300 font-medium"
                      : isFailed
                      ? "text-rose-300"
                      : "text-[#a1a1aa]"
                  }
                >
                  {step.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Human-readable tool activity list with subtle details toggle (No raw JSON)
const ToolActivityCard: React.FC<{ tools: AgentToolActivity[] }> = ({ tools }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="space-y-1 my-1">
      {/* Human-readable list */}
      <div className="space-y-0.5">
        {tools.map((t, idx) => {
          const isRun = t.status === "running";
          const isErr = t.status === "error";
          const label = getToolDisplayLabel(t.name, t.args);

          return (
            <div
              key={t.id || idx}
              className="flex items-center gap-1.5 text-[11px] text-[#cbd5e1] font-sans"
            >
              <span className="shrink-0 text-xs">
                {isRun ? (
                  <Loader2 className="w-3 h-3 text-cyan-400 animate-spin inline-block" />
                ) : isErr ? (
                  <span className="text-rose-400 font-bold">✕</span>
                ) : (
                  <span className="text-emerald-400 font-medium">✓</span>
                )}
              </span>
              <span
                className={
                  isRun
                    ? "text-cyan-300"
                    : isErr
                    ? "text-rose-300"
                    : "text-[#cbd5e1]"
                }
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Subtle details toggle */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="text-[10px] text-[#555a62] hover:text-[#9ca3af] transition-colors cursor-pointer font-mono"
      >
        {showDetails ? "▾ Hide activity details" : "▸ Activity details"}
      </button>

      {showDetails && (
        <div className="p-1.5 rounded-xs bg-[#090a0c] border border-[#1f2228] text-[10px] font-mono text-[#9ca3af] space-y-1 max-h-32 overflow-y-auto">
          {tools.map((t, idx) => (
            <div
              key={t.id || idx}
              className="border-b border-[#181a1f] pb-1 last:border-0 last:pb-0"
            >
              <div className="text-cyan-400 font-medium">{t.name}</div>
              {t.args && Object.keys(t.args).length > 0 && (
                <div className="text-[#6b7280] truncate">
                  args: {JSON.stringify(t.args)}
                </div>
              )}
              {t.result && (
                <div className="text-[#6b7280] truncate">
                  result:{" "}
                  {typeof t.result === "string"
                    ? t.result.slice(0, 100)
                    : JSON.stringify(t.result).slice(0, 100)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Compact Approval Card
const ApprovalCard: React.FC<{
  approval: AgentApprovalRequest;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ approval, onReview, onApprove, onReject }) => {
  return (
    <div className="p-2 rounded-xs border border-amber-800/50 bg-[#16140f] space-y-1.5 my-1">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="font-medium">Approval requested</span>
        </div>
        <span className="text-[10px] font-mono uppercase text-amber-400/90 font-medium">
          {approval.operation}
        </span>
      </div>

      <div className="text-[11px] font-mono text-[#e5e7eb] truncate">
        <span className="text-[#858b94]">File: </span>
        <span className="text-white font-medium">{approval.file}</span>
      </div>

      {approval.explanation && (
        <p className="text-[11px] text-[#a5abb5] m-0 leading-relaxed font-sans line-clamp-2">
          {approval.explanation}
        </p>
      )}

      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={onReview}
          className="flex-1 px-2 h-5.5 rounded-xs bg-[#1f2229] hover:bg-[#282c35] text-cyan-300 text-[10.5px] font-medium border border-[#303440] transition-colors cursor-pointer"
        >
          Review changes
        </button>
        <button
          type="button"
          onClick={onReject}
          className="px-2 h-5.5 rounded-xs bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10.5px] font-medium transition-colors cursor-pointer"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="px-2.5 h-5.5 rounded-xs bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-medium transition-colors cursor-pointer"
        >
          Apply
        </button>
      </div>
    </div>
  );
};
