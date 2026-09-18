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
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  isLoadingHistory,
  modelName,
  onSelectPrompt,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll on new content strictly inside container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 240;

    if (isNearBottom || isGenerating) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isGenerating ? "auto" : "smooth",
      });
    }
  }, [messages, isGenerating]);

  // Show/hide scroll bottom button
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isScrolledUp =
      container.scrollHeight - container.scrollTop - container.clientHeight > 200;
    setShowScrollBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
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
          Loading conversation...
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
            />
          );
        })}

        <div className="h-4 flex-shrink-0" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 sm:right-10 z-30 p-2 rounded-full bg-[#15171a] text-[#eeeeec] hover:bg-[#1b1d21] border border-[#292b30] shadow-xl transition-all cursor-pointer"
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
