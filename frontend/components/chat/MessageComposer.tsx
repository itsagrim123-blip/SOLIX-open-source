"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Cpu,
  Paperclip,
  Square,
  Wrench,
} from "lucide-react";
import { ModelInfo } from "@/types/chat";

interface MessageComposerProps {
  onSendMessage: (message: string) => void;
  onStopGenerating: () => void;
  isGenerating: boolean;
  models: ModelInfo[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  initialValue?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGenerating,
  isGenerating,
  models,
  currentModel,
  onSelectModel,
  initialValue = "",
}) => {
  const [input, setInput] = useState(initialValue);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Sync initialValue if provided externally (e.g. from suggestion card)
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${Math.max(nextHeight, 44)}px`;
  }, [input]);

  // Close model picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelPickerRef.current &&
        !modelPickerRef.current.contains(e.target as Node)
      ) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-3 sm:pb-5 pt-2 flex-shrink-0 relative z-20">
      <div className="relative rounded-2xl glass-composer p-2.5 sm:p-3">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Solix anything... (Shift+Enter for newline)"
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-slate-100 placeholder-slate-400 text-sm sm:text-[15px] leading-relaxed max-h-[180px] px-2 pt-1 pb-2 block font-normal"
          style={{ minHeight: "44px" }}
          aria-label="Chat input message"
        />

        {/* Action Controls Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05] mt-1">
          {/* Left Controls: Model selector, attachments, tools */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Model Selector Pill */}
            <div className="relative" ref={modelPickerRef}>
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-slate-300 hover:text-cyan-300 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-cyan-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                aria-label="Select AI Model"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="max-w-[130px] truncate">{currentModel}</span>
              </button>

              {/* Model Dropdown Menu */}
              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-60 rounded-2xl glass-panel shadow-glass-lg p-2 z-50 animate-fade-in border border-white/10">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Available Models
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5 mt-1">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m.id);
                          setShowModelPicker(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          currentModel === m.id
                            ? "bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-400/30"
                            : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        {m.is_default && (
                          <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20">
                            def
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attachment Button */}
            <button
              type="button"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-all"
              title="Attach context (Coming soon)"
              aria-label="Attachment"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Tools Button */}
            <button
              type="button"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] transition-all"
              title="AI Tools & Functions (Coming soon)"
              aria-label="Tools"
            >
              <Wrench className="w-4 h-4" />
            </button>
          </div>

          {/* Right Controls: Send / Stop */}
          <div>
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] animate-pulse"
                aria-label="Stop generating response"
              >
                <Square className="w-3.5 h-3.5 fill-rose-400" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim()}
                className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
                  input.trim()
                    ? "bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-glow-cyan hover:scale-[1.05] active:scale-[0.95] hover:brightness-110 cursor-pointer"
                    : "bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/[0.05]"
                }`}
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className="text-[11px] text-slate-400 tracking-wide font-normal">
          Solix may produce inaccurate responses. Verify critical information.
        </span>
      </div>
    </div>
  );
};
