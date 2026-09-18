"use client";

import React from "react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  modelName?: string;
}

interface SuggestionCard {
  title: string;
  subtitle: string;
  prompt: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPrompt,
}) => {
  const suggestions: SuggestionCard[] = [
    {
      title: "Explain something",
      subtitle: "Break down a difficult topic in simple terms.",
      prompt: "Explain how operating system kernels manage memory using virtual memory and page tables in simple terms.",
    },
    {
      title: "Help me code",
      subtitle: "Work through a bug, function, or new project.",
      prompt: "Write a high-performance, asynchronous worker pool in Python using asyncio and queues.",
    },
    {
      title: "Analyze an architecture",
      subtitle: "Look at trade-offs and suggest improvements.",
      prompt: "Analyze the trade-offs between monolithic, microservice, and event-driven architectures for a high-throughput payment platform.",
    },
    {
      title: "Brainstorm an idea",
      subtitle: "Explore possibilities and turn an idea into a plan.",
      prompt: "Brainstorm 5 innovative product features for an AI-native code editor workspace.",
    },
  ];

  return (
    <div className="solix-welcome select-none animate-fade-in">
      <div className="solix-welcome-inner">
        <h1 className="solix-greeting">What can I help with?</h1>
        <p className="solix-sub">Ask a question, work through an idea, or build something.</p>

        <div className="solix-suggestions">
          {suggestions.map((card, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(card.prompt)}
              className="solix-suggestion active:scale-[0.99]"
            >
              <div className="solix-suggestion-title">{card.title}</div>
              <div className="solix-suggestion-text">{card.subtitle}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
