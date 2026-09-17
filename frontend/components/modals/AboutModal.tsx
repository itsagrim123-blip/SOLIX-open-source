"use client";

import React, { useEffect } from "react";
import {
  Cpu,
  Database,
  Lock,
  Sparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { getModelLabel } from "@/lib/models";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  currentModel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg glass rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="solix-logo-badge">✣</div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                SOLIX <span className="text-[10px] font-mono font-normal text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">v1.2.0</span>
              </h2>
              <p className="text-xs text-[#8798b2]">
                Intelligent Local AI Workspace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="iconbtn !w-8 !h-8"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 text-xs sm:text-sm max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-[#aebbd0] leading-relaxed text-xs sm:text-sm">
            Solix is a modern, privacy-first conversational workspace powered by local and cloud AI models. It combines low-latency SSE token streaming with client-side IndexedDB isolation and an immersive dark glassmorphic design.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                <Cpu className="w-3.5 h-3.5" />
                <span>Active Model</span>
              </div>
              <p className="text-[#8798b2] text-[11px] font-mono truncate">
                {getModelLabel(currentModel)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-blue-300 font-semibold text-xs">
                <Workflow className="w-3.5 h-3.5" />
                <span>Architecture</span>
              </div>
              <p className="text-[#8798b2] text-[11px]">
                FastAPI + Next.js App Router
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold text-xs">
                <Zap className="w-3.5 h-3.5" />
                <span>Streaming</span>
              </div>
              <p className="text-[#8798b2] text-[11px]">
                SSE Token-by-Token
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-xs">
                <Database className="w-3.5 h-3.5" />
                <span>Storage</span>
              </div>
              <p className="text-[#8798b2] text-[11px]">
                IndexedDB (Device Local)
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-500/[0.05] border border-cyan-400/20 text-[#aebbd0] text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Complete Local Isolation</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Run your conversations with zero cloud leaks. Chats are rendered from your browser's private storage, and AI inference runs locally via Ollama (Qwen 3, Qwen 2.5 Coder, Gemma 3, Phi-4 Mini).
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end">
          <button
            onClick={onClose}
            className="new-btn !h-9 px-4 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
