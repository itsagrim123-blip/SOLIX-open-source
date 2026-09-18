"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Code2,
  Cpu,
  FileCheck,
  GitPullRequest,
  Globe,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { SourceCards } from "@/components/chat/SourceCards";
import { CodingChatMessage, CodePatch } from "@/types/workspace";

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

  const handleActionClick = (action: "explain" | "debug" | "fix" | "refactor" | "tests" | "doc") => {
    const fileTarget = activeFile ? `in ${activeFile}` : "in this project";
    const selectionTarget = selectedCode ? `the selected code (${selectedLineRange ? `lines ${selectedLineRange.start}-${selectedLineRange.end}` : ""})` : `the current file (${fileTarget})`;

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

  return (
    <div className="h-full flex flex-col bg-[#111215] border-l border-[#24262b] select-none">
      {/* AI Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#24262b] bg-[#141518]">
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
            <p className="text-xs font-medium text-[#dedfe2] mb-1">Solix Code Intelligence</p>
            <p className="text-[11px] max-w-[220px] text-[#73767d]">
              Ask questions about your codebase, request refactors, or debug runtime errors.
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
                  <div className="max-w-[88%] bg-[#1a1c22] border border-[#2e3138] rounded-xl px-3 py-2 text-xs text-[#eeeeec] leading-relaxed break-words">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8f9299]">
                      <span className="text-white">Solix</span>
                      {msg.isStreaming && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      )}
                    </div>

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

                    {/* Proposed Patch Card */}
                    {msg.patch && (
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
              selectedCode
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
      </form>
    </div>
  );
};

