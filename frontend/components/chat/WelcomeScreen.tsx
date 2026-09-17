"use client";

import React from "react";
import {
  Brain,
  Code2,
  GraduationCap,
  Lightbulb,
  LineChart,
  Sparkles,
} from "lucide-react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  modelName: string;
}

interface SuggestionCard {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  prompt: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPrompt,
  modelName,
}) => {
  const suggestions: SuggestionCard[] = [
    {
      icon: <Brain className="w-5 h-5 text-cyan-400" />,
      title: "Explain a concept",
      subtitle: "Understand quantum superposition or zero-knowledge proofs",
      prompt: "Explain the fundamentals of quantum computing and superposition in simple, intuitive terms.",
    },
    {
      icon: <Code2 className="w-5 h-5 text-sky-400" />,
      title: "Write some code",
      subtitle: "Generate clean, production-ready code with tests",
      prompt: "Write a high-performance async rate limiter in Python using token bucket algorithm and asyncio.",
    },
    {
      icon: <GraduationCap className="w-5 h-5 text-violet-400" />,
      title: "Help me study",
      subtitle: "Create a quiz or summarize key academic concepts",
      prompt: "Create a 5-question conceptual practice quiz on distributed consensus protocols like Raft and Paxos.",
    },
    {
      icon: <LineChart className="w-5 h-5 text-emerald-400" />,
      title: "Analyze something",
      subtitle: "Compare architectures or inspect technical trade-offs",
      prompt: "Analyze the architectural trade-offs between monolithic databases and microservice event-driven data meshes.",
    },
    {
      icon: <Lightbulb className="w-5 h-5 text-amber-400" />,
      title: "Brainstorm ideas",
      subtitle: "Generate creative product features and workflows",
      prompt: "Brainstorm 5 innovative features for an AI-native developer workspace that maximize flow state.",
    },
  ];

  return (
    <div className="flex-1 my-auto flex flex-col items-center justify-center max-w-4xl mx-auto px-4 py-8 text-center animate-fade-in select-none">
      {/* Solix Emblem */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/25 via-blue-500/20 to-violet-500/25 border border-cyan-400/35 flex items-center justify-center shadow-glow-cyan backdrop-blur-xl group hover:border-cyan-400/50 hover:scale-105 transition-all">
          <Sparkles className="w-8 h-8 text-cyan-300 group-hover:rotate-12 transition-transform duration-300" />
        </div>
        <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/15 to-violet-500/15 rounded-2xl blur-xl -z-10" />
      </div>

      {/* Main Title */}
      <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-2">
        How can <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400">Solix</span> help you today?
      </h1>
      <p className="text-xs sm:text-sm text-slate-400 mb-8 max-w-md font-normal">
        Your intelligent conversational workspace powered by local and cloud AI models.
      </p>

      {/* Suggestion Cards Grid with Glass Reflection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl text-left">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="glass-reflection group relative p-4 rounded-2xl glass-panel-interactive text-left focus:outline-none focus:ring-1 focus:ring-cyan-400/40 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] group-hover:border-cyan-400/30 group-hover:bg-cyan-500/10 transition-colors shadow-inner flex-shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {item.subtitle}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
