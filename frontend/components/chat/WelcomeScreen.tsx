"use client";

import React from "react";
import { BookOpen, Brain, Code2, LineChart } from "lucide-react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  modelName?: string;
}

interface SuggestionCard {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  prompt: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPrompt,
}) => {
  const suggestions: SuggestionCard[] = [
    {
      icon: <BookOpen className="w-4 h-4 text-[#858b94]" />,
      title: "Explain something",
      subtitle: "Break down a complex concept simply.",
      prompt: "Explain how operating system kernels manage memory using virtual memory and page tables in simple terms.",
    },
    {
      icon: <Code2 className="w-4 h-4 text-cyan-400/80" />,
      title: "Help me code",
      subtitle: "Debug, write, or refactor code.",
      prompt: "Write a high-performance, asynchronous worker pool in Python using asyncio and queues.",
    },
    {
      icon: <LineChart className="w-4 h-4 text-[#858b94]" />,
      title: "Analyze something",
      subtitle: "Compare trade-offs or review data.",
      prompt: "Analyze the trade-offs between monolithic, microservice, and event-driven architectures for a high-throughput payment platform.",
    },
    {
      icon: <Brain className="w-4 h-4 text-[#858b94]" />,
      title: "Brainstorm",
      subtitle: "Generate ideas and explore directions.",
      prompt: "Brainstorm 5 innovative product features for an AI-native code editor workspace.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full select-none animate-fade-in">
      <div className="text-center mb-6 space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white font-sans">
          What can I help with?
        </h1>
        <p className="text-xs sm:text-sm text-[#858b94]">
          Ask a question, explore an idea, or build something.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {suggestions.map((card, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(card.prompt)}
            className="flex flex-col text-left p-3 rounded-xs bg-[#131518] hover:bg-[#181a1f] border border-[#22242a] hover:border-[#32363f] transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="shrink-0 group-hover:text-white transition-colors">
                {card.icon}
              </span>
              <span className="text-xs font-semibold text-[#eeeeec] group-hover:text-white transition-colors">
                {card.title}
              </span>
            </div>
            <span className="text-[11px] text-[#787e88] leading-normal group-hover:text-[#a5abb5] transition-colors">
              {card.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

