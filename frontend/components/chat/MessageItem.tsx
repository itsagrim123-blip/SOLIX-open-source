"use client";

import React, { useState } from "react";
import { Check, Copy, Globe } from "lucide-react";
import { Message } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { SourceCards } from "./SourceCards";
import { formatFileSize, getFileIcon } from "./MessageComposer";

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
    const hasFiles = message.files && message.files.length > 0;

    return (
      <div className="solix-user-msg animate-fade-in">
        <div className="flex flex-col items-end group">
          <div className="solix-user-bubble">
            {hasFiles && (
              <div className="flex flex-wrap gap-1.5 mb-2 pb-1.5 border-b border-white/10">
                {message.files!.map((f) => (
                  <div
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#191b1f] border border-[#2e3138] text-[11px] text-[#eeeeec]"
                  >
                    {getFileIcon(f.type, f.name)}
                    <span className="truncate max-w-[150px] font-medium" title={f.name}>
                      {f.name}
                    </span>
                    <span className="text-[9px] text-[#8f9299]">({formatFileSize(f.size)})</span>
                  </div>
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap m-0">{message.content}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formattedTime && (
              <span className="text-[10px] text-[#666970] font-mono">
                {formattedTime}
              </span>
            )}
            <button
              onClick={handleCopy}
              className="p-0.5 rounded text-[#666970] hover:text-[#eeeeec] transition-colors"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Assistant Message
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div className="solix-assistant-msg animate-fade-in group">
      {/* Subtle Avatar */}
      <div className="solix-assistant-avatar">
        <SolixLogo size="sm" px={26} />
      </div>

      {/* Body */}
      <div className="solix-assistant-body">
        <div className="solix-assistant-header">
          <div className="flex items-center gap-2">
            <span className="solix-assistant-name">Solix</span>
            {message.webSearch && (
              <span className="solix-web-search-badge" title="Generated with web search">
                <Globe className="w-2.5 h-2.5" />
                Web
              </span>
            )}
            {formattedTime && (
              <span className="text-[10px] text-[#666970] font-mono">
                {formattedTime}
              </span>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8f9299] hover:text-[#eeeeec] transition-all text-xs flex items-center gap-1 cursor-pointer"
            title="Copy response"
            aria-label="Copy response"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px]">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="text-[#eeeeec] leading-relaxed text-[13px] break-words">
          {message.content ? (
            <>
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-[#eeeeec] animate-pulse ml-1 align-middle rounded-xs" />
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 py-1 text-[#8f9299] text-xs animate-pulse">
              <span className="inline-block w-3 h-3 border-2 border-[#3a3d43] border-t-[#eeeeec] rounded-full animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <div className="text-[#666970] italic text-xs py-1">
              No response generated.
            </div>
          )}
        </div>

        {/* Source Cards — shown after content, only for web search messages */}
        {hasSources && <SourceCards sources={message.sources!} />}
      </div>
    </div>
  );
};
