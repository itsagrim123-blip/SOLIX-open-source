"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  RotateCcw,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  Wrench,
} from "lucide-react";
import { ExecutionResult, GitStatus, Problem } from "@/types/workspace";

interface TerminalPanelProps {
  output: string;
  lastResult: ExecutionResult | null;
  isRunning: boolean;
  onClear: () => void;
  onStop: () => void;
  onDebugError: (errorDetails: string) => void;
  gitStatus: GitStatus | null;
  activeTab: "terminal" | "problems" | "git";
  onTabChange: (tab: "terminal" | "problems" | "git") => void;
  problems?: Problem[];
  onSelectProblem?: (problem: Problem) => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  output,
  lastResult,
  isRunning,
  onClear,
  onStop,
  onDebugError,
  gitStatus,
  activeTab,
  onTabChange,
  problems = [],
  onSelectProblem,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (terminalEndRef.current && !isCollapsed) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output, isCollapsed]);

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy terminal output:", err);
    }
  };

  const hasError = lastResult && lastResult.exit_code !== 0;
  const problemCount = problems.length > 0 ? problems.length : hasError ? 1 : 0;

  return (
    <div
      className={`border-t border-[#22242a] bg-[#0d0f12] flex flex-col transition-all duration-150 select-none ${
        isCollapsed ? "h-[30px]" : isExpanded ? "h-[420px]" : "h-full"
      }`}
    >
      {/* Docked IDE Bottom Panel Header (30px) */}
      <div className="flex items-center justify-between px-2 h-[30px] bg-[#111214] border-b border-[#22242a] select-none shrink-0">
        {/* Left Tabs */}
        <div className="flex items-center h-full">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("terminal");
            }}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-mono tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === "terminal"
                ? "text-[#e2e8f0] border-cyan-500 bg-[#16171b] font-semibold"
                : "text-[#858b94] border-transparent hover:text-[#d4d7dc] hover:bg-[#141518]"
            }`}
          >
            <TerminalIcon className="w-3 h-3" />
            <span>TERMINAL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("problems");
            }}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-mono tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === "problems"
                ? "text-[#e2e8f0] border-cyan-500 bg-[#16171b] font-semibold"
                : "text-[#858b94] border-transparent hover:text-[#d4d7dc] hover:bg-[#141518]"
            }`}
          >
            <AlertCircle
              className={`w-3 h-3 ${problemCount > 0 ? "text-rose-400" : "text-[#666c75]"}`}
            />
            <span>PROBLEMS</span>
            <span
              className={`text-[10px] font-mono ${
                problemCount > 0 ? "text-rose-400 font-bold" : "text-[#666c75]"
              }`}
            >
              ({problemCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("git");
            }}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] font-mono tracking-wider transition-colors cursor-pointer border-b-2 ${
              activeTab === "git"
                ? "text-[#e2e8f0] border-cyan-500 bg-[#16171b] font-semibold"
                : "text-[#858b94] border-transparent hover:text-[#d4d7dc] hover:bg-[#141518]"
            }`}
          >
            <GitBranch className="w-3 h-3" />
            <span>GIT</span>
            {gitStatus?.is_repo && gitStatus.branch && (
              <span className="text-[10px] text-[#666c75] font-mono">({gitStatus.branch})</span>
            )}
          </button>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-1.5 pr-1">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-mono mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Running...</span>
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1 px-1.5 h-5 rounded-xs bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-mono transition-colors cursor-pointer"
                title="Stop execution (Ctrl+C)"
              >
                <Square className="w-2 h-2 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          {lastResult && !isRunning && (
            <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#858b94] mr-2">
              <span
                className={lastResult.exit_code === 0 ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}
              >
                [code {lastResult.exit_code}]
              </span>
              <span className="text-[#666c75]">{lastResult.execution_time}s</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-xs text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1a1c21] transition-colors"
            title={copied ? "Copied" : "Copy Output"}
          >
            <Copy className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded-xs text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1a1c21] transition-colors"
            title="Clear Output"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-xs text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1a1c21] transition-colors hidden sm:inline-flex"
            title={isExpanded ? "Restore Size" : "Maximize Panel"}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-xs text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1a1c21] transition-colors"
            title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Terminal Content Body */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs select-text bg-[#0d0f12]">
          {activeTab === "terminal" && (
            <div className="space-y-2">
              {output ? (
                <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-[#d4d7dc] m-0 select-text">
                  {output}
                </pre>
              ) : (
                <div className="text-[#666c75] text-[11px] font-mono">
                  Terminal ready · Ctrl+Enter to run
                </div>
              )}

              {/* Real-time sandbox running banner */}
              {isRunning && (
                <div className="py-1 px-2.5 rounded-xs bg-[#14161a] border border-cyan-800/40 text-[11px] font-mono text-cyan-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Executing in sandbox...</span>
                  </div>
                  <button
                    type="button"
                    onClick={onStop}
                    className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                  >
                    Stop
                  </button>
                </div>
              )}

              {/* Clean process exit status banner */}
              {lastResult && !isRunning && (
                <div
                  className={`py-1 px-2.5 rounded-xs border text-[11px] font-mono flex items-center justify-between ${
                    lastResult.exit_code === 0
                      ? "bg-emerald-950/25 border-emerald-800/40 text-emerald-300"
                      : "bg-rose-950/25 border-rose-800/40 text-rose-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {lastResult.exit_code === 0 ? (
                      <span>✓ Process exited with code 0</span>
                    ) : (
                      <span>✕ Process exited with code {lastResult.exit_code}</span>
                    )}
                  </div>
                  <span className="text-[#666c75] text-[10px]">
                    Finished in {lastResult.execution_time}s
                  </span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          )}

          {activeTab === "problems" && (
            problems.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[10.5px] text-[#858b94] font-mono mb-2 uppercase tracking-wide">
                  Diagnostics & Compiler Errors ({problems.length})
                </div>
                {problems.map((prob, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectProblem && onSelectProblem(prob)}
                    className="group flex items-start justify-between p-1.5 rounded-xs bg-[#131417] hover:bg-[#1a1c21] border border-[#202227] cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0 pr-2">
                      {prob.severity === "error" ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-[11.5px] text-[#d4d7dc] group-hover:text-white leading-snug">
                          {prob.message}
                        </div>
                        <div className="text-[10.5px] text-[#666c75] font-mono mt-0.5">
                          {prob.file || "workspace"}:{prob.line || 1}:{prob.column || 1}
                          {prob.source && <span className="ml-2 text-[#555a62]">[{prob.source}]</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDebugError(`${prob.file}:${prob.line}:${prob.column}: ${prob.message}`);
                      }}
                      className="shrink-0 px-2 py-0.5 rounded-xs text-[10.5px] font-medium text-cyan-400 hover:text-cyan-300 hover:bg-[#1f232b] border border-transparent hover:border-cyan-800/40 transition-colors"
                      title="Investigate with Solix AI"
                    >
                      Fix with AI
                    </button>
                  </div>
                ))}
              </div>
            ) : hasError ? (
              <div className="space-y-2">
                <div className="p-2 rounded-xs bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
                  <div className="font-semibold text-rose-400 mb-1">
                    Process exited with non-zero code {lastResult.exit_code}
                  </div>
                  <pre className="whitespace-pre-wrap text-[11px] font-mono text-rose-200/80 m-0">
                    {lastResult.stderr || "No stderr output captured."}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => onDebugError(lastResult.stderr || output)}
                  className="px-2.5 py-1 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  Investigate Error with Solix AI
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[#666c75] font-mono py-2">
                No problems detected.
              </div>
            )
          )}

          {activeTab === "git" && (
            <div className="space-y-2 text-xs">
              {gitStatus?.is_repo ? (
                <>
                  <div className="flex items-center gap-2 text-[#858b94]">
                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Branch:</span>
                    <span className="font-semibold text-[#d4d7dc] font-mono">{gitStatus.branch}</span>
                  </div>

                  {gitStatus.modified.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                        Modified ({gitStatus.modified.length})
                      </span>
                      <ul className="space-y-0.5 font-mono text-[11px] text-[#d4d7dc] pl-2">
                        {gitStatus.modified.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <span className="text-amber-400">M</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gitStatus.untracked.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono font-semibold text-cyan-400 uppercase tracking-wider block mb-1">
                        Untracked ({gitStatus.untracked.length})
                      </span>
                      <ul className="space-y-0.5 font-mono text-[11px] text-[#d4d7dc] pl-2">
                        {gitStatus.untracked.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <span className="text-cyan-400">?</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gitStatus.modified.length === 0 && gitStatus.untracked.length === 0 && (
                    <div className="text-[#555a62] italic pt-1">Working tree clean.</div>
                  )}
                </>
              ) : (
                <div className="text-[#555a62] italic">
                  Not a Git repository.
                </div>
              )}
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
};
