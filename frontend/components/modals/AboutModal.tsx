"use client";

import React, { useEffect } from "react";
import { Cpu, Database, Lock, Workflow, X, Zap } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#141518] rounded-xl p-6 border border-[#292b30] shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#292b30]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#eeeeec] text-[#0d0e10] flex items-center justify-center font-bold text-xs">
              ✦
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#eeeeec] flex items-center gap-2">
                SOLIX <span className="text-[10px] font-mono font-normal text-[#8f9299] bg-[#191a1e] border border-[#292b30] px-1.5 py-0.2 rounded">v1.2.0</span>
              </h2>
              <p className="text-[11px] text-[#8f9299]">
                Your AI workspace. Ask anything, build anything.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8f9299] hover:text-white hover:bg-[#1a1c20] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-[#aeb0b6] leading-relaxed text-xs">
            Solix is a minimal, privacy-first conversational workspace powered by local and cloud AI models. It combines low-latency SSE token streaming with client-side IndexedDB isolation and a distraction-free dark interface.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#dedfe2] font-semibold text-xs">
                <Cpu className="w-3.5 h-3.5 text-[#8f9299]" />
                <span>Active Model</span>
              </div>
              <p className="text-[#8f9299] text-[11px] font-mono truncate">
                {getModelLabel(currentModel)}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#dedfe2] font-semibold text-xs">
                <Workflow className="w-3.5 h-3.5 text-[#8f9299]" />
                <span>Architecture</span>
              </div>
              <p className="text-[#8f9299] text-[11px]">
                FastAPI + Next.js App Router
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#dedfe2] font-semibold text-xs">
                <Zap className="w-3.5 h-3.5 text-[#8f9299]" />
                <span>Streaming</span>
              </div>
              <p className="text-[#8f9299] text-[11px]">
                SSE Token-by-Token
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#dedfe2] font-semibold text-xs">
                <Database className="w-3.5 h-3.5 text-[#8f9299]" />
                <span>Storage</span>
              </div>
              <p className="text-[#8f9299] text-[11px]">
                IndexedDB (Device Local)
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#15171a] border border-[#292b30] space-y-1">
            <div className="flex items-center gap-1.5 text-[#eeeeec] font-semibold text-xs">
              <Lock className="w-3.5 h-3.5 text-[#8f9299]" />
              <span>Complete Local Isolation</span>
            </div>
            <p className="text-[11px] text-[#8f9299] leading-relaxed">
              Conversations are stored exclusively in your browser's private database. Inferences run locally via Ollama with full hardware acceleration.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#292b30] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#0d0e10] bg-[#eeeeec] hover:bg-[#d8d9dc] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
