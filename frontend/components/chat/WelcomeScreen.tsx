"use client";

import React from "react";

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  modelName?: string;
}

interface SuggestionCard {
  icon: string;
  title: string;
  description: string;
  prompt: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSelectPrompt,
}) => {
  const suggestions: SuggestionCard[] = [
    {
      icon: "♧",
      title: "Explain concept",
      description: "Understand complex topics with clarity",
      prompt: "Explain a complex concept like quantum superposition in simple, intuitive terms.",
    },
    {
      icon: "‹/›",
      title: "Write code",
      description: "Generate clean, production-ready code",
      prompt: "Write a high-performance async rate limiter in Python using asyncio.",
    },
    {
      icon: "♙",
      title: "Help study",
      description: "Create summaries, quizzes and study notes",
      prompt: "Create a 5-question conceptual practice quiz on distributed systems and consensus protocols.",
    },
    {
      icon: "⌁",
      title: "Analyze data",
      description: "Get insights from data, logic or text",
      prompt: "Analyze the architectural trade-offs between monolithic architectures and microservices.",
    },
    {
      icon: "♧",
      title: "Brainstorm",
      description: "Explore creative ideas and possibilities",
      prompt: "Brainstorm 5 innovative features for an AI-native developer workspace that maximize productivity.",
    },
    {
      icon: "✦",
      title: "Plan task",
      description: "Structured roadmaps and project plans",
      prompt: "Help me create a structured, step-by-step project plan for building and launching a web app.",
    },
  ];

  return (
    <div className="solix-hero my-auto select-none animate-fade-in px-2 sm:px-4">
      {/* Glowing Pulsing Hero Logo Badge */}
      <div className="hero-logo-badge !w-12 !h-12 sm:!w-16 sm:!h-16 !text-2xl sm:!text-[31px] !mb-3 sm:!mb-5">
        ✣
      </div>

      {/* Main Heading */}
      <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#eef4ff] mb-1.5 sm:mb-2">
        How can <span>Solix</span> help you today?
      </h1>

      {/* Responsive Subtitle */}
      <p className="hero-sub text-[11px] sm:text-xs md:text-sm text-[#8798b2] mb-4 sm:mb-7 max-w-sm sm:max-w-md mx-auto leading-relaxed">
        Your intelligent conversational workspace powered by local and cloud AI models.
      </p>

      {/* 2-Column Grid on Mobile, 3-Column on Desktop */}
      <div className="solix-hero-cards">
        {suggestions.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectPrompt(item.prompt)}
            className="reference-card glass"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectPrompt(item.prompt);
              }
            }}
          >
            <div className="solix-card-icon">{item.icon}</div>
            <b>{item.title}</b>
            <p>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
