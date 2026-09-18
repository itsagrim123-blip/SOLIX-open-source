"use client";

import React, { useState } from "react";
import { Check, Copy, Globe } from "lucide-react";
import { Message } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { SourceCards } from "./SourceCards";
import { formatFileSize, getFileIcon } from "./MessageComposer";
import { api } from "@/lib/api";

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
              <div className="flex flex-col gap-2 mb-2 pb-2 border-b border-white/10">
                {/* Images preview grid */}
                {message.files!.some((f) => f.type === "image" || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name)) && (
                  <div className="flex flex-wrap gap-2">
                    {message.files!.filter((f) => f.type === "image" || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name)).map((f) => {
                      const imgUrl = f.previewUrl || f.url || api.getFileContentUrl(f.id);
                      return (
                        <a
                          key={`img-${f.id}`}
                          href={imgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block rounded-lg overflow-hidden border border-white/15 hover:border-cyan-500/50 transition-all max-w-[140px] max-h-[140px] bg-black/40"
                          title={`View full size: ${f.name}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      );
                    })}
                  </div>
                )}
                {/* File attachment pills */}
                <div className="flex flex-wrap gap-1.5">
                  {message.files!.map((f) => {
                    const fileUrl = f.url || api.getFileContentUrl(f.id);
                    return (
                      <a
                        key={f.id}
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#191b1f] border border-[#2e3138] text-[11px] text-[#eeeeec] hover:border-[#42464f] hover:bg-[#202227] transition-all"
                        title={`Download or view: ${f.name}`}
                      >
                        {getFileIcon(f.type, f.name)}
                        <span className="truncate max-w-[150px] font-medium" title={f.name}>
                          {f.name}
                        </span>
                        <span className="text-[9px] text-[#8f9299]">({formatFileSize(f.size)})</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="whitespace-pre-wrap m-0">{message.content}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {formattedTime && (
              <span className="text-[11px] text-[#7e828a] font-mono">
                {formattedTime}
              </span>
            )}
            <button
              onClick={handleCopy}
              className="p-0.5 rounded text-[#7e828a] hover:text-[#eeeeec] transition-colors"
              title="Copy message"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
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
        <SolixLogo size="sm" px={28} />
      </div>

      {/* Body */}
      <div className="solix-assistant-body">
        <div className="solix-assistant-header">
          <div className="flex items-center gap-2">
            <span className="solix-assistant-name">Solix</span>
            {message.webSearch && (
              <span className="solix-web-search-badge" title="Generated with web search">
                <Globe className="w-3 h-3" />
                Web
              </span>
            )}
            {formattedTime && (
              <span className="text-[11px] text-[#7e828a] font-mono">
                {formattedTime}
              </span>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[#8f9299] hover:text-[#eeeeec] transition-all text-xs flex items-center gap-1 cursor-pointer"
            title="Copy response"
            aria-label="Copy response"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="text-[#eeeeec] break-words">
          {message.content ? (
            <>
              <MarkdownRenderer content={message.content} />
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-[#eeeeec] animate-pulse ml-1 align-middle rounded-xs" />
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 py-1.5 text-[#8f9299] text-sm animate-pulse">
              <span className="inline-block w-3.5 h-3.5 border-2 border-[#3a3d43] border-t-[#eeeeec] rounded-full animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <div className="text-[#787c84] italic text-sm py-1.5">
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
