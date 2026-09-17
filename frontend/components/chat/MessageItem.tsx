"use client";

import React, { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Message } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  const formattedTime = (() => {
    try {
      const date = new Date(message.timestamp);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  })();

  if (isUser) {
    return (
      <div className="w-full flex justify-end animate-fade-in py-1">
        <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end group">
          {/* User Message Header */}
          <div className="flex items-center gap-1.5 mb-1 px-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-slate-200 active:scale-95 transition-all text-[10px] flex items-center gap-1 cursor-pointer"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
              )}
            </button>
            <span className="text-[11px] font-medium text-slate-400">You</span>
            {formattedTime && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formattedTime}
              </span>
            )}
          </div>

          {/* User Glass Bubble */}
          <div className="relative px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.08] border border-white/[0.08] shadow-glass-sm text-slate-100 text-sm sm:text-[15px] leading-relaxed break-words transition-all">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant Response Turn
  return (
    <div className="w-full flex items-start gap-3 sm:gap-3.5 group animate-fade-in py-1.5">
      {/* Solix Avatar Badge */}
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
        </div>
      </div>

      {/* Assistant Content Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 sm:mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white tracking-wide">
              Solix AI
            </span>
            {formattedTime && (
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                {formattedTime}
              </span>
            )}
          </div>

          {/* Copy Action */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-slate-400 hover:text-slate-200 active:scale-95 bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-all text-xs cursor-pointer"
              title="Copy response"
              aria-label="Copy response"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-sans text-[10px] sm:text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="font-sans text-[10px] sm:text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rendered Content / Thinking Indicator */}
        <div className="text-slate-100 leading-relaxed text-sm sm:text-[15px] selection:bg-cyan-500/30 selection:text-cyan-200 overflow-hidden break-words">
          {message.content ? (
            <>
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-cyan-400/80 animate-pulse ml-1 align-middle rounded-sm" />
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 py-1.5 text-slate-400 text-xs sm:text-sm animate-pulse">
              <span className="inline-block w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              <span className="text-cyan-300 font-medium">Thinking...</span>
            </div>
          ) : (
            <div className="text-slate-500 italic text-xs sm:text-sm py-1">
              No response generated.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
