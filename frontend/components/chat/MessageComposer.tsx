"use client";

import React, { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
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
    textarea.style.height = `${Math.max(nextHeight, 45)}px`;
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
      textareaRef.current.style.height = "45px";
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-box glass">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Solix anything... (Shift+Enter for newline)"
          rows={1}
          className="composer-textarea"
          aria-label="Chat input message"
        />

        {/* Action Controls Toolbar matching Reference */}
        <div className="composer-bottom">
          {/* Model Selector Pill with Dropup */}
          <div className="relative" ref={modelPickerRef}>
            <button
              type="button"
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="composer-pill"
              aria-label="Select AI Model"
              title="Change active model"
            >
              <span>⚙</span>
              <span>{currentModel}</span>
            </button>

            {/* Model Dropdown Menu */}
            {showModelPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl glass p-2 z-50 animate-fade-in border border-white/10 shadow-2xl">
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        currentModel === m.id
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                          : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.is_default && (
                        <span className="text-[10px] text-cyan-400 font-mono px-1 py-0.5 rounded bg-cyan-400/10">
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
            className="iconbtn"
            title="Attach file (Optional)"
            aria-label="Attachment"
            onClick={() => alert("File attachment will be available in future update.")}
          >
            📎
          </button>

          {/* Tools / Commands Button */}
          <button
            type="button"
            className="iconbtn"
            title="Shortcuts and Commands"
            aria-label="Commands"
            onClick={() => alert("Shortcut: Press Shift+Enter for newline, Enter to send.")}
          >
            ⌘
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send / Stop Controls */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGenerating}
              className="composer-stop-btn"
              title="Stop generating response"
              aria-label="Stop generating response"
            >
              <Square className="w-3.5 h-3.5 fill-rose-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={`composer-send-btn ${
                !input.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <span className="text-base font-bold leading-none select-none">↑</span>
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="composer-disclaimer">
        Solix may produce inaccurate responses. Verify critical information.
      </div>
    </div>
  );
};
