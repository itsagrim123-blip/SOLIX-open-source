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

  // Auto-scroll on new message content or while streaming strictly inside message container
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

  // Track scroll position to show/hide "Scroll to bottom" button
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
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 gap-3 select-none">
        <div className="w-7 h-7 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
        <span className="text-xs tracking-wider uppercase font-mono text-slate-500">
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
      {/* Centered Conversation Column */}
      <div className="max-w-[880px] w-[calc(100%-32px)] mx-auto py-5 sm:py-7 flex flex-col gap-4 sm:gap-5 min-h-0">
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
          className="absolute bottom-4 right-4 sm:right-8 z-30 p-2 sm:p-2.5 rounded-full glass text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer border border-white/10"
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
