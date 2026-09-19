"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Message } from "@/types/chat";
import { MessageItem } from "./MessageItem";
import { WelcomeScreen } from "./WelcomeScreen";

interface MessageListProps {
  messages: Message[];
  isGenerating: boolean;
  isLoadingHistory: boolean;
  modelName: string;
  onSelectPrompt: (prompt: string) => void;
  onEditPrompt?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  isLoadingHistory,
  modelName,
  onSelectPrompt,
  onEditPrompt,
  onRegenerate,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isUserScrolledUpRef = useRef<boolean>(false);

  // Auto-scroll on new content strictly inside container if user hasn't scrolled up
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user is already near bottom (within 100px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom && !isUserScrolledUpRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isGenerating ? "auto" : "smooth",
      });
    }
  }, [messages, isGenerating]);

  // Track scroll position to prevent interrupting user reading previous messages
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isScrolledUp = distanceFromBottom > 100;

    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  };

  if (isLoadingHistory) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-[#8f9299] gap-3 select-none">
        <div className="w-6 h-6 rounded-full border-2 border-[#3a3d43] border-t-[#eeeeec] animate-spin" />
        <span className="text-xs tracking-wider uppercase font-mono text-[#666970]">
          Loading conversation…
        </span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full flex flex-col justify-center">
        <WelcomeScreen onSelectPrompt={onSelectPrompt} modelName={modelName} />
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full relative"
    >
      <div className="solix-message-stream">
        {messages.map((msg, index) => {
          const isLast = index === messages.length - 1;
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              isStreaming={isLast && isGenerating && msg.role === "assistant"}
              onEditPrompt={onEditPrompt}
              onRegenerate={onRegenerate}
            />
          );
        })}

        <div className="h-4 flex-shrink-0" />
      </div>

      {/* Floating Scroll to Bottom Button / New Messages indicator */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#15171a] text-[#eeeeec] hover:bg-[#1c1e23] border border-[#2a2d33] shadow-2xl transition-all cursor-pointer text-xs font-medium animate-fade-in ${
            isGenerating ? "ring-1 ring-cyan-500/40" : ""
          }`}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDown className={`w-3.5 h-3.5 ${isGenerating ? "text-cyan-400 animate-bounce" : ""}`} />
          <span>{isGenerating ? "New messages ↓" : "Scroll to bottom"}</span>
        </button>
      )}
    </div>
  );
};

