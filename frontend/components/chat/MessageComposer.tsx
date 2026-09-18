"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronDown, Globe, Loader2, Paperclip, Sliders, Square } from "lucide-react";
import { ModelInfo } from "@/types/chat";
import { getModelBadge, getModelDescription, getModelLabel } from "@/lib/models";

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
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  webSearchStatus?: "idle" | "searching" | "reading" | "generating";
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
  webSearchEnabled = false,
  onToggleWebSearch,
  webSearchStatus = "idle",
}) => {
  const [content, setContent] = useState(initialValue);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Sync initialValue changes
  useEffect(() => {
    if (initialValue) {
      setContent(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight();
      }
    }
  }, [initialValue]);

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

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 56), 180);
    textarea.style.height = `${newHeight}px`;
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!content.trim() || isGenerating || isSwitchingModel) return;
    onSendMessage(content.trim());
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Dynamic search status label
  const searchStatusLabel = (() => {
    if (!isGenerating || !webSearchEnabled) return null;
    switch (webSearchStatus) {
      case "searching": return "Searching the web…";
      case "reading": return "Reading sources…";
      case "generating": return "Generating answer…";
      default: return null;
    }
  })();

  return (
    <div className="solix-composer-wrap">
      {/* Web search status indicator — lives in the message area, never shifts layout */}
      {searchStatusLabel && (
        <div className="solix-search-status">
          <span className="solix-search-spinner" aria-hidden="true" />
          <span>{searchStatusLabel}</span>
        </div>
      )}

      <div className="solix-composer">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={webSearchEnabled ? "Search the web with Solix…" : "Message Solix…"}
          rows={1}
          className="solix-textarea"
          aria-label="Chat input message"
        />

        <div className="solix-composer-bar">
          <div className="solix-composer-left">
            {/* Model Selector Pill */}
            <div className="relative" ref={modelPickerRef}>
              <button
                type="button"
                onClick={() => !isSwitchingModel && setShowModelPicker(!showModelPicker)}
                className="solix-small-btn cursor-pointer active:scale-98"
                aria-label="Select AI Model"
                title="Change active model"
                disabled={isSwitchingModel}
              >
                {isSwitchingModel ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400 flex-shrink-0" />
                    <span className="truncate max-w-[120px]">
                      {getModelLabel(switchingModelTarget || currentModel)}
                    </span>
                  </>
                ) : modelSwitchSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate max-w-[120px] text-emerald-400">
                      {getModelLabel(modelSwitchSuccess)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="truncate max-w-[140px]">
                      {getModelLabel(currentModel)}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 flex-shrink-0" />
                  </>
                )}
              </button>

              {/* Model Dropdown Menu */}
              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 rounded-xl bg-[#141518] border border-[#292b30] p-2 z-50 animate-fade-in shadow-2xl">
                  <div className="px-2 py-1 text-[10px] font-bold text-[#666970] uppercase tracking-wider flex items-center justify-between">
                    <span>Available Models</span>
                    <span className="text-[10px] font-mono text-[#8f9299]">
                      {models.length} ready
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 mt-1 pr-0.5">
                    {models.map((m) => {
                      const isSelected = currentModel === m.id;
                      const label = getModelLabel(m.id);
                      const desc = getModelDescription(m.id);
                      const badge = getModelBadge(m.id);

                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectModel(m.id);
                            setShowModelPicker(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg text-xs flex flex-col gap-0.5 transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-[#191a1e] border-[#3a3d43] text-white"
                              : "border-transparent text-[#a5a7ad] hover:bg-[#1a1c20] hover:text-[#eeeeec]"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-xs text-[#eeeeec]">
                              {label}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#1f2126] text-[#8f9299] border border-[#292b30]">
                              {badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8f9299] font-normal leading-tight line-clamp-1">
                            {desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={onToggleWebSearch}
              className={`solix-web-search-btn ${webSearchEnabled ? "active" : ""}`}
              title={webSearchEnabled ? "Web Search ON — click to disable" : "Enable Web Search (uses Qwen 3 8B)"}
              aria-label="Toggle Web Search"
              aria-pressed={webSearchEnabled}
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="solix-web-search-label">
                {webSearchEnabled ? "Web Search ✓" : "Web Search"}
              </span>
            </button>

            {/* Attachment Button */}
            <button
              type="button"
              className="solix-small-btn icon active:scale-95"
              title="Attach context (Optional)"
              aria-label="Attachment"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            {/* Tools Button */}
            <button
              type="button"
              className="solix-small-btn icon active:scale-95"
              title="Assistant capabilities"
              aria-label="Tools"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Action: Send or Stop */}
          <div>
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="solix-stop-btn cursor-pointer active:scale-95"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!content.trim() || isSwitchingModel}
                className="solix-send-btn active:scale-95"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Disclaimer */}
      <div className="solix-disclaimer">
        {webSearchEnabled
          ? "Web Search · Qwen 3 8B · Sources verified by backend"
          : "Solix can make mistakes. Verify important information."}
      </div>
    </div>
  );
};
