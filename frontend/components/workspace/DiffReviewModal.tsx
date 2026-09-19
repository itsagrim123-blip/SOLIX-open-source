"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Check, X, FilePlus, FileEdit, Trash2 } from "lucide-react";
import { CodePatch } from "@/types/workspace";

// Dynamically load Monaco DiffEditor with ssr: false
const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-xs text-[#858b94]">
        Loading Diff Viewer...
      </div>
    ),
  }
);

interface DiffReviewModalProps {
  patch: CodePatch | null;
  originalContent: string;
  isOpen: boolean;
  onApply: (patch: CodePatch) => Promise<void> | void;
  onReject: () => void;
  operation?: "create" | "modify" | "delete";
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  patch,
  originalContent,
  isOpen,
  onApply,
  onReject,
  operation,
}) => {
  if (!isOpen || !patch) return null;

  const ext = patch.file.split(".").pop() || "";
  const getLanguage = (extension: string) => {
    switch (extension) {
      case "py":
        return "python";
      case "js":
      case "jsx":
        return "javascript";
      case "ts":
      case "tsx":
        return "typescript";
      case "cpp":
      case "cc":
      case "h":
        return "cpp";
      case "c":
        return "c";
      case "rs":
        return "rust";
      case "go":
        return "go";
      case "java":
        return "java";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "html":
        return "html";
      case "css":
        return "css";
      default:
        return "plaintext";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
      <div className="w-full max-w-5xl h-[85vh] bg-[#111214] border border-[#292c31] rounded-xs shadow-2xl flex flex-col overflow-hidden">
        {/* Header: Classic IDE Dialog Header */}
        <div className="flex items-center justify-between px-3.5 h-10 border-b border-[#292c31] bg-[#151619] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-[#858b94] uppercase">
              Review Changes
            </span>

            {operation === "create" && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-emerald-950 text-emerald-400 border border-emerald-800">
                <FilePlus className="w-2.5 h-2.5" />
                CREATE
              </span>
            )}
            {operation === "modify" && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-amber-950 text-amber-300 border border-amber-800">
                <FileEdit className="w-2.5 h-2.5" />
                MODIFY
              </span>
            )}
            {operation === "delete" && (
              <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-rose-950 text-rose-300 border border-rose-800">
                <Trash2 className="w-2.5 h-2.5" />
                DELETE
              </span>
            )}

            <span className="text-xs font-mono text-[#d4d7dc] font-semibold truncate">
              {patch.file}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onReject}
              className="flex items-center gap-1 px-3 h-7 rounded-xs border border-[#292c31] bg-[#1a1c21] hover:bg-[#22252b] text-xs font-medium text-[#858b94] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              onClick={() => onApply(patch)}
              className="flex items-center gap-1 px-3.5 h-7 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Apply Changes</span>
            </button>
          </div>
        </div>

        {/* AI Rationale / Explanation line */}
        {patch.explanation && (
          <div className="px-3.5 py-1.5 bg-[#0d0e10] border-b border-[#202227] text-[11px] text-[#858b94] flex items-center gap-2 shrink-0">
            <span className="text-cyan-400 font-mono font-medium">Rationale:</span>
            <span className="truncate">{patch.explanation}</span>
          </div>
        )}

        {/* Monaco Diff Viewer */}
        <div className="flex-1 min-h-0 bg-[#0d0e10]">
          <MonacoDiffEditor
            original={operation === "create" ? "" : originalContent}
            modified={operation === "delete" ? "" : patch.replacement_content}
            language={getLanguage(ext)}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
};
