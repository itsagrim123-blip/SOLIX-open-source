"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Check, X } from "lucide-react";
import { CodePatch } from "@/types/workspace";

// Dynamically load Monaco DiffEditor with ssr: false
const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-xs text-[#8f9299]">Loading Diff Viewer...</div> }
);

interface DiffReviewModalProps {
  patch: CodePatch | null;
  originalContent: string;
  isOpen: boolean;
  onApply: (patch: CodePatch) => Promise<void>;
  onReject: () => void;
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  patch,
  originalContent,
  isOpen,
  onApply,
  onReject,
}) => {
  if (!isOpen || !patch) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] bg-[#111215] border border-[#303238] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#292b30] bg-[#15171a]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Review Proposed Diff
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#1f2126] text-[#dedfe2] border border-[#2e3137]">
              {patch.file}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#3a3d43] bg-[#191b1f] hover:bg-[#202227] text-xs font-medium text-[#c4c6cb] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <button
              type="button"
              onClick={() => onApply(patch)}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Changes</span>
            </button>
          </div>
        </div>

        {/* Explanation Banner */}
        {patch.explanation && (
          <div className="px-4 py-2 bg-[#16181d] border-b border-[#292b30] text-xs text-[#c4c6cb] flex items-center gap-2">
            <span className="text-cyan-400 font-semibold">AI Rationale:</span>
            <span>{patch.explanation}</span>
          </div>
        )}

        {/* Monaco Diff Viewer */}
        <div className="flex-1 min-h-0">
          <MonacoDiffEditor
            original={originalContent}
            modified={patch.replacement_content}
            language={patch.file.split(".").pop() === "py" ? "python" : "typescript"}
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

