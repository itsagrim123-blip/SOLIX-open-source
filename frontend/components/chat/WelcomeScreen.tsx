"use client";

import React from "react";
import { Sparkles, Code, FileText, Lightbulb, BookOpen } from "lucide-react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  modelName?: string;
}

interface SuggestionCard {
  icon: React.ReactNode;
  title: string;
  prompt: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPrompt,
}) => {
  const suggestions: SuggestionCard[] = [
    {
      icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
      title: "Explain something",
      prompt: "Explain quantum superposition in simple, intuitive terms.",
    },
    {
      icon: <Code className="w-4 h-4 text-blue-400" />,
      title: "Help me code",
      prompt: "Write a high-performance async rate limiter in Python using asyncio.",
    },
    {
      icon: <FileText className="w-4 h-4 text-violet-400" />,
      title: "Analyze an architecture",
      prompt: "Analyze the trade-offs between monolithic and microservice architectures.",
    },
    {
      icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
      title: "Brainstorm an idea",
      prompt: "Brainstorm 5 innovative features for an AI-native developer workspace.",
    },
  ];

  return (
    <div className="solix-hero my-auto select-none animate-fade-in px-4">
      {/* Icon Badge */}
      <div className="w-12 h-12 rounded-2xl mx-auto mb-4 bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-glow-cyan">
        <Sparkles className="w-6 h-6 text-cyan-300" />
      </div>

      {/* Main Heading */}
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-1.5">
        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Solix</span>
      </h1>

      {/* Subtitle */}
      <p className="text-xs sm:text-sm text-slate-400 mb-6 sm:mb-8 max-w-sm mx-auto leading-relaxed">
        Your AI workspace. Ask anything, build anything.
      </p>

      {/* 4 Compact Suggestion Cards (2x2 grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-xl mx-auto text-left">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-cyan-400/30 transition-all duration-200 cursor-pointer text-left group active:scale-[0.99]"
          >
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] group-hover:border-cyan-400/20 transition-colors flex-shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-[13px] font-medium text-slate-200 group-hover:text-white transition-colors">
                {item.title}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 font-normal">
                {item.prompt}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
