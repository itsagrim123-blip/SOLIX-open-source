"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-3 py-2 px-1 animate-fade-in">
      <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 shadow-glow-cyan">
        <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: "6s" }} />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
        <span className="text-xs text-slate-400 font-medium mr-1.5">Solix is thinking</span>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
};

