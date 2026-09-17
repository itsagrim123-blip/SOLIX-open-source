"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Message } from "@/types/chat";
import { MessageItem } from "./MessageItem";
import { TypingIndicator } from "./TypingIndicator";
import { WelcomeScreen } from "./WelcomeScreen";

interface MessageListProps {
  messages: Message[];
  isGenerating: boolean;
  isLoadingHistory: boolean;
  modelName: string;
  onSelectPrompt: (prompt: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  isLoadingHistory,
  modelName,
  onSelectPrompt,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll on new message content
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only auto-scroll if user is near bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 180;

    if (isNearBottom || isGenerating) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating]);

  // Track scroll position to show/hide "Scroll to bottom" button
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isScrolledUp =
      container.scrollHeight - container.scrollTop - container.clientHeight > 200;
    setShowScrollBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoadingHistory) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
        <span className="text-xs tracking-wider uppercase font-mono">Loading conversation...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
        <WelcomeScreen onSelectPrompt={onSelectPrompt} modelName={modelName} />
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full relative divide-y divide-white/[0.02]"
    >
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            isStreaming={isLast && isGenerating && msg.role === "assistant"}
          />
        );
      })}

      {/* Typing indicator if generating and last assistant message hasn't emitted tokens yet */}
      {isGenerating &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" &&
        !messages[messages.length - 1].content && (
          <div className="max-w-3xl mx-auto px-4 py-4">
            <TypingIndicator />
          </div>
        )}

      <div ref={messagesEndRef} className="h-6" />

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-20 p-2 sm:p-2.5 rounded-full glass text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
