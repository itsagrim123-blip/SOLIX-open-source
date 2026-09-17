"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Loader2, Paperclip, Sliders, Square } from "lucide-react";
import { ModelInfo } from "@/types/chat";

interface MessageComposerProps {
  onSendMessage: (message: string) => void;
  onStopGenerating: () => void;
  isGenerating: boolean;
  models: ModelInfo[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  isSwitchingModel?: boolean;
  switchingModelTarget?: string | null;
  modelSwitchSuccess?: string | null;
  initialValue?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onStopGenerating,
  isGenerating,
  models,
  currentModel,
  onSelectModel,
  isSwitchingModel = false,
  switchingModelTarget = null,
  modelSwitchSuccess = null,
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

  // Auto-resize textarea height (min 1 line, max ~6-8 lines)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${Math.max(nextHeight, 28)}px`;
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
    if (!trimmed || isGenerating || isSwitchingModel) return;
    onSendMessage(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "28px";
    }
  };

  const isSendDisabled = !input.trim() || isGenerating || isSwitchingModel;

  return (
    <div className="composer-wrap">
      <div className="composer-box">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Solix anything... (Shift+Enter for newline)"
          rows={1}
          className="composer-textarea text-sm sm:text-[15px] leading-relaxed"
          style={{ minHeight: "28px", fontSize: "15px" }}
          aria-label="Chat input message"
        />

        {/* Action Controls Toolbar */}
        <div className="composer-bottom">
          {/* Model Selector Pill */}
          <div className="relative" ref={modelPickerRef}>
            <button
              type="button"
              onClick={() => !isSwitchingModel && setShowModelPicker(!showModelPicker)}
              className={`composer-pill !py-1 !px-2.5 !text-[11px] sm:!text-xs active:scale-95 transition-all ${
                isSwitchingModel
                  ? "border-cyan-400/40 text-cyan-300 cursor-wait bg-cyan-500/10"
                  : modelSwitchSuccess
                  ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10"
                  : ""
              }`}
              aria-label="Select AI Model"
              title="Change active model"
              disabled={isSwitchingModel}
            >
              {isSwitchingModel ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                  <span className="truncate max-w-[120px]">
                    Loading {switchingModelTarget || currentModel}...
                  </span>
                </>
              ) : modelSwitchSuccess ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="truncate max-w-[120px]">
                    {modelSwitchSuccess}
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate max-w-[120px] sm:max-w-[160px]">
                    {currentModel}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                </>
              )}
            </button>

            {/* Model Dropdown Menu */}
            {showModelPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-56 sm:w-60 rounded-xl glass p-2 z-50 animate-fade-in border border-white/10 shadow-2xl">
                <div className="px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer active:scale-98 ${
                        currentModel === m.id
                          ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                          : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.is_default && (
                        <span className="text-[10px] text-cyan-400 font-mono px-1 py-0.2 rounded bg-cyan-400/10">
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
            className="iconbtn !w-8 !h-8 sm:!w-[34px] sm:!h-[34px] active:scale-95"
            title="Attach file (Optional)"
            aria-label="Attachment"
            onClick={() => alert("File attachment will be available in a future update.")}
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {/* Tools / Commands Button */}
          <button
            type="button"
            className="iconbtn !w-8 !h-8 sm:!w-[34px] sm:!h-[34px] active:scale-95"
            title="Shortcuts and Commands"
            aria-label="Commands"
            onClick={() => alert("Shortcut: Press Shift+Enter for newline, Enter to send.")}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send / Stop Controls */}
          {isGenerating ? (
            <button
              type="button"
              onClick={onStopGenerating}
              className="composer-stop-btn !w-8 !h-8 sm:!w-8 sm:!h-8 active:scale-95"
              title="Stop generating response"
              aria-label="Stop generating response"
            >
              <Square className="w-3 h-3 fill-rose-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSendDisabled}
              className={`composer-send-btn !w-8 !h-8 sm:!w-8 sm:!h-8 active:scale-95 transition-all ${
                isSendDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:scale-105"
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 text-white stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="composer-disclaimer text-[10px] sm:text-[11px] text-slate-500 mt-2 text-center">
        Solix may produce inaccurate responses. Verify critical information.
      </div>
    </div>
  );
};
