"use client";

import React, { useState } from "react";
import { Check, Copy, Sparkles, User } from "lucide-react";
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
      <div className="w-full px-4 py-3 sm:py-4 transition-colors">
        <div className="max-w-3xl w-full mx-auto flex justify-end">
          <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end group">
            <div className="flex items-center gap-2 mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px] font-medium text-slate-400">You</span>
              {formattedTime && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {formattedTime}
                </span>
              )}
            </div>

            {/* Compact User Glass Pill */}
            <div className="relative px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.08] border border-white/[0.1] shadow-glass-sm text-slate-100 text-[15px] leading-relaxed break-words transition-all">
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Copy Action */}
              <button
                onClick={handleCopy}
                className="absolute -left-8 top-3 p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy message"
                aria-label="Copy message"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assistant Response Turn
  return (
    <div className="w-full px-4 py-4 sm:py-6 border-y border-white/[0.03] bg-white/[0.015] transition-colors">
      <div className="max-w-3xl w-full mx-auto flex gap-3 sm:gap-4 items-start group">
        {/* Solix Glowing Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/25 via-blue-500/20 to-violet-500/25 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shadow-glow-cyan">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Assistant Content Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white tracking-wide">
                Solix AI
              </span>
              {formattedTime && (
                <span className="text-[11px] text-slate-500 font-mono">
                  {formattedTime}
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-xs"
                title="Copy response"
                aria-label="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-sans text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-sans text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Rendered Content */}
          <div className="text-slate-100 leading-relaxed text-[15px] selection:bg-cyan-500/30 selection:text-cyan-200">
            {message.content ? (
              <MarkdownRenderer content={message.content} />
            ) : isStreaming ? (
              <span className="inline-block w-2 h-4 bg-cyan-400/80 animate-pulse ml-0.5 rounded-sm" />
            ) : (
              <span className="text-slate-500 italic text-sm">No content</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
