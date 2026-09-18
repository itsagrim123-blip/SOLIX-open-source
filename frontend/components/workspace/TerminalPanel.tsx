"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  GitBranch,
  RotateCcw,
  Sparkles,
  Square,
  Terminal,
  Trash2,
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
  const problemCount = problems.length > 0 ? problems.length : (hasError ? 1 : 0);

  return (
    <div
      className={`border-t border-[#24262b] bg-[#0c0d10] flex flex-col transition-all duration-200 ${
        isCollapsed ? "h-9" : isExpanded ? "h-[380px]" : "h-[200px]"
      }`}
    >
      {/* Terminal Header Bar */}
      <div className="flex items-center justify-between px-3 h-9 bg-[#131417] border-b border-[#24262b] select-none flex-shrink-0">
        {/* Left Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("terminal");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "terminal"
                ? "bg-[#1d1f25] text-white font-semibold"
                : "text-[#8f9299] hover:text-[#eeeeec]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("problems");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "problems"
                ? "bg-[#1d1f25] text-white font-semibold"
                : "text-[#8f9299] hover:text-[#eeeeec]"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${problemCount > 0 ? "text-rose-400" : "text-[#73767d]"}`} />
            <span>Problems</span>
            {problemCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-950 text-rose-300 border border-rose-800 font-mono font-bold">
                {problemCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              onTabChange("git");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeTab === "git"
                ? "bg-[#1d1f25] text-white font-semibold"
                : "text-[#8f9299] hover:text-[#eeeeec]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Git</span>
            {gitStatus?.is_repo && gitStatus.branch && (
              <span className="text-[10px] text-[#73767d] font-mono">({gitStatus.branch})</span>
            )}
          </button>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Running...</span>
              <button
                type="button"
                onClick={onStop}
                className="ml-1 p-1 rounded bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 transition-colors"
                title="Stop execution"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </button>
            </div>
          )}

          {lastResult && !isRunning && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  lastResult.exit_code === 0
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                    : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
                }`}
              >
                Exit {lastResult.exit_code}
              </span>
              <span className="text-[10px] text-[#73767d] flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {lastResult.execution_time}s
              </span>
            </div>
          )}

          {/* Quick Debug with Solix Action */}
          {hasError && !isRunning && (
            <button
              type="button"
              onClick={() => onDebugError(lastResult.stderr || output)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-medium cursor-pointer transition-colors"
              title="Send error to Solix AI to analyze and generate a fix"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Debug with Solix</span>
            </button>
          )}

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded text-[#8f9299] hover:text-white transition-colors cursor-pointer"
            title="Clear output"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-[#8f9299] hover:text-white transition-colors cursor-pointer"
            title="Copy terminal output"
          >
            <Copy className="w-3 h-3" />
          </button>

          {/* Expand / Collapse Height Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                setIsCollapsed(false);
              } else if (!isExpanded) {
                setIsExpanded(true);
              } else {
                setIsExpanded(false);
              }
            }}
            className="p-1 rounded text-[#8f9299] hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Restore height" : "Expand terminal"}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[12.5px] leading-relaxed select-text">
          {activeTab === "terminal" && (
            output ? (
              <pre className="whitespace-pre-wrap font-mono text-[#dedfe2] m-0">
                {output}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#555860] italic">
                Terminal ready. Click 'Run' or press Ctrl+Enter to execute project.
              </div>
            )
          )}

          {activeTab === "problems" && (
            problems.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#8f9299] px-1 pb-1 border-b border-[#1f2127]">
                  <span>
                    {problems.length} {problems.length === 1 ? "problem" : "problems"} detected in workspace
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const allText = problems
                        .map((p) => `${p.file}:${p.line}:${p.column}: ${p.severity}: ${p.message}`)
                        .join("\n");
                      onDebugError(allText);
                    }}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    title="Ask Solix AI to analyze all detected problems and propose fixes"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-semibold">Debug all with Solix</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {problems.map((prob, idx) => (
                    <div
                      key={idx}
                      onClick={() => onSelectProblem?.(prob)}
                      className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-[#14161b] hover:bg-[#1a1d24] border border-[#262830] hover:border-cyan-500/40 cursor-pointer transition-all group"
                      title="Click to jump to line in editor"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {prob.severity === "error" ? (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-[#eeeeec] group-hover:text-cyan-300 transition-colors">
                              {prob.file || "workspace"}
                              {prob.line ? `:${prob.line}` : ""}
                              {prob.column ? `:${prob.column}` : ""}
                            </span>
                            {prob.source && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#202229] text-[#8f9299] uppercase font-mono">
                                {prob.source}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-rose-200/90 font-mono mt-1 break-words whitespace-pre-wrap m-0">
                            {prob.message}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDebugError(`${prob.file}:${prob.line}:${prob.column}: ${prob.message}`);
                        }}
                        className="shrink-0 p-1.5 rounded-md hover:bg-cyan-950/60 text-cyan-400 hover:text-cyan-300 border border-transparent hover:border-cyan-700/50 transition-colors"
                        title="Debug this specific error with Solix AI"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/40 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold mb-1">Process exited with non-zero code {lastResult.exit_code}</div>
                    <pre className="whitespace-pre-wrap text-[11.5px] font-mono text-rose-200/90 m-0">
                      {lastResult.stderr || "No stderr captured."}
                    </pre>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDebugError(lastResult.stderr || output)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Solix to Fix This Error</span>
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-emerald-400/80 italic py-6">
                ✓ No problems detected in workspace.
              </div>
            )
          )}

          {activeTab === "git" && (
            <div className="space-y-3 text-xs">
              {gitStatus?.is_repo ? (
                <>
                  <div className="flex items-center gap-2 text-[#c4c6cb]">
                    <GitBranch className="w-4 h-4 text-cyan-400" />
                    <span>Current Branch:</span>
                    <span className="font-semibold text-white font-mono">{gitStatus.branch}</span>
                  </div>

                  {gitStatus.modified.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                        Modified Files ({gitStatus.modified.length})
                      </span>
                      <ul className="space-y-0.5 font-mono text-[11px] text-[#dedfe2] pl-3">
                        {gitStatus.modified.map((f) => (
                          <li key={f}>M {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gitStatus.untracked.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                        Untracked Files ({gitStatus.untracked.length})
                      </span>
                      <ul className="space-y-0.5 font-mono text-[11px] text-[#dedfe2] pl-3">
                        {gitStatus.untracked.map((f) => (
                          <li key={f}>? {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {gitStatus.modified.length === 0 && gitStatus.untracked.length === 0 && (
                    <div className="text-[#73767d] italic">Working tree clean.</div>
                  )}
                </>
              ) : (
                <div className="text-[#73767d] italic">
                  Not a Git repository. To enable Git tracking, run 'git init' in the workspace.
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

