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
      title: "Explain a concept",
      description: "Understand complex topics with clarity",
      prompt: "Explain a complex concept like quantum superposition in simple, intuitive terms.",
    },
    {
      icon: "‹/›",
      title: "Write some code",
      description: "Generate clean, production-ready code",
      prompt: "Write a high-performance async rate limiter in Python using asyncio.",
    },
    {
      icon: "♙",
      title: "Help me study",
      description: "Create summaries, quizzes and more",
      prompt: "Create a 5-question conceptual practice quiz on distributed systems and consensus protocols.",
    },
    {
      icon: "⌁",
      title: "Analyze something",
      description: "Get insights from data, images or text",
      prompt: "Analyze the architectural trade-offs between monolithic architectures and microservices.",
    },
    {
      icon: "♧",
      title: "Brainstorm ideas",
      description: "Explore creative ideas and new possibilities",
      prompt: "Brainstorm 5 innovative features for an AI-native developer workspace that maximize productivity.",
    },
  ];

  return (
    <div className="solix-hero my-auto select-none animate-fade-in">
      {/* Glowing Pulsing Hero Logo */}
      <div className="hero-logo-badge">✣</div>

      {/* Main Heading */}
      <h1>
        How can <span>Solix</span> help you today?
      </h1>

      {/* Subtitle */}
      <p className="hero-sub">
        Your intelligent conversational workspace powered by local and cloud AI models.
      </p>

      {/* Suggestion Cards Grid with Light Sweep Reflection */}
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
