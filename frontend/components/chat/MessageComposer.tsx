"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowUp,
  Check,
  ChevronDown,
  FileCode,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RotateCw,
  Sliders,
  Square,
  Table,
  X,
} from "lucide-react";
import { AttachedFile, ModelInfo } from "@/types/chat";
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
  attachedFiles?: AttachedFile[];
  onUploadFiles?: (files: FileList | File[]) => void;
  onRemoveFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;
  fileStatusLabel?: string | null;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (type === "pdf" || ext === "pdf") {
    return <FileText className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
  }
  if (
    ["code", "py", "js", "ts", "tsx", "jsx", "html", "css", "java", "c", "cpp", "cs", "go", "rs", "sql", "sh"].includes(type) ||
    ["py", "js", "ts", "tsx", "jsx", "html", "css", "json", "yaml", "yml", "xml", "sql", "sh", "bat", "ps1"].includes(ext)
  ) {
    return <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
  }
  if (
    ["spreadsheet", "xlsx", "xls", "ods", "csv", "tsv"].includes(type) ||
    ["xlsx", "xls", "ods", "csv", "tsv"].includes(ext)
  ) {
    return <Table className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
  }
  if (
    ["image", "png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "tiff", "tif"].includes(type) ||
    ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "tiff", "tif"].includes(ext)
  ) {
    return <ImageIcon className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />;
  }
  if (["archive", "zip"].includes(type) || ext === "zip") {
    return <Archive className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
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
  attachedFiles = [],
  onUploadFiles,
  onRemoveFile,
  onRetryFile,
  fileStatusLabel = null,
}) => {
  const [content, setContent] = useState(initialValue);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 72), 200);
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

  const isAnyFileUploading = attachedFiles.some(
    (f) => f.status === "uploading" || f.status === "processing"
  );
  const hasReadyFiles = attachedFiles.some((f) => f.status === "ready");

  const handleSubmit = () => {
    const trimmed = content.trim();
    if ((!trimmed && !hasReadyFiles) || isGenerating || isSwitchingModel || isAnyFileUploading) return;
    
    // Default prompt if file is attached without text
    const finalMessage = trimmed || "Please summarize and analyze the attached file(s).";
    onSendMessage(finalMessage);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles?.(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles?.(e.target.files);
      e.target.value = "";
    }
  };

  // Dynamic status label
  const activeStatusLabel = (() => {
    if (!isGenerating) return null;
    if (fileStatusLabel) return fileStatusLabel;
    if (webSearchEnabled) {
      switch (webSearchStatus) {
        case "searching": return "Searching the web…";
        case "reading": return "Reading sources…";
        case "generating": return "Generating answer…";
        default: return null;
      }
    }
    return null;
  })();

  const placeholderText = attachedFiles.length > 0
    ? "Ask anything about attached files, or Message Solix…"
    : webSearchEnabled
    ? "Search the web with Solix…"
    : "Message Solix…";

  return (
    <div
      className="solix-composer-wrap"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input for Paperclip click */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        aria-label="Upload files"
      />

      {/* Live status indicator */}
      {activeStatusLabel && (
        <div className="solix-search-status">
          <span className="solix-search-spinner" aria-hidden="true" />
          <span>{activeStatusLabel}</span>
        </div>
      )}

      <div
        className={`solix-composer transition-all duration-200 ${
          isDragging ? "ring-2 ring-cyan-500/60 bg-cyan-950/15 border-cyan-500/40" : ""
        }`}
      >
        {/* Drag Overlay Notice */}
        {isDragging && (
          <div className="px-4 py-3 text-center text-xs font-semibold text-cyan-300 animate-pulse bg-cyan-950/30 border-b border-cyan-800/40 rounded-t-xl flex items-center justify-center gap-2">
            <Paperclip className="w-4 h-4" />
            <span>Drop files here to attach to Solix File Intelligence</span>
          </div>
        )}

        {/* Attached Files Tray */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3 pb-2 border-b border-[#292b30]/60 max-h-36 overflow-y-auto">
            {attachedFiles.map((file) => {
              const isError = file.status === "error";
              const isReady = file.status === "ready";
              const isProcessing = file.status === "processing";
              const isUploading = file.status === "uploading";

              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                    isError
                      ? "bg-rose-950/30 border-rose-800/50 text-rose-200"
                      : isReady
                      ? "bg-[#17191d] border-[#303238] text-[#eeeeec] shadow-xs"
                      : "bg-[#141518] border-[#292b30] text-[#a5a7ad]"
                  }`}
                >
                  {file.previewUrl && (file.type === "image" || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) ? (
                    <div className="relative w-7 h-7 rounded overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    getFileIcon(file.type, file.name)
                  )}

                  <div className="flex flex-col min-w-0 max-w-[130px] sm:max-w-[190px]">
                    <span className="font-medium text-[11px] truncate text-[#eeeeec]" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[9px] text-[#8f9299]">
                      {isUploading ? (
                        <span className="text-cyan-400 font-mono">Uploading {file.progress}%</span>
                      ) : isProcessing ? (
                        <span className="text-amber-400">Processing…</span>
                      ) : isReady ? (
                        <span className="text-emerald-400">✓ Ready · {formatFileSize(file.size)}</span>
                      ) : (
                        <span className="text-rose-400 truncate" title={file.error || "Failed"}>
                          ⚠ {file.error === "Not Found" ? "Backend not found (restart server)" : (file.error || "Failed")}
                        </span>
                      )}
                    </span>
                  </div>

                  {isError && onRetryFile && (
                    <button
                      type="button"
                      onClick={() => onRetryFile(file.id)}
                      className="p-1 hover:text-[#eeeeec] text-[#8f9299] transition-colors cursor-pointer"
                      title="Retry upload"
                      aria-label="Retry upload"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveFile?.(file.id)}
                    className="p-1 hover:text-rose-400 text-[#8f9299] transition-colors cursor-pointer"
                    title="Remove file"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          rows={1}
          className="solix-textarea"
          aria-label="Chat input message"
        />

        {/* Bottom Toolbar */}
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 flex-shrink-0" />
                    <span className="truncate max-w-[120px]">
                      {getModelLabel(switchingModelTarget || currentModel)}
                    </span>
                  </>
                ) : modelSwitchSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate max-w-[120px] text-emerald-400">
                      {getModelLabel(modelSwitchSuccess)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="truncate max-w-[140px]">
                      {getModelLabel(currentModel)}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5 flex-shrink-0" />
                  </>
                )}
              </button>

              {/* Model Dropdown Menu */}
              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 max-w-[calc(100vw-32px)] rounded-xl bg-[#141518] border border-[#292b30] p-2 z-50 animate-fade-in shadow-[0_12px_40px_rgba(0,0,0,0.7)]">
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
              <Globe className="w-4 h-4 flex-shrink-0" />
              <span className="solix-web-search-label font-medium">
                {webSearchEnabled ? "Web Search ✓" : "Web Search"}
              </span>
            </button>

            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="solix-small-btn icon active:scale-95 cursor-pointer"
              title="Attach documents, code, images, spreadsheets"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Tools Button */}
            <button
              type="button"
              className="solix-small-btn icon active:scale-95 cursor-default"
              title="Assistant capabilities"
              aria-label="Tools"
            >
              <Sliders className="w-4 h-4" />
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
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!content.trim() && !hasReadyFiles) || isSwitchingModel || isAnyFileUploading}
                className="solix-send-btn active:scale-95"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-4.5 h-4.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle Disclaimer */}
      <div className="solix-disclaimer">
        {webSearchEnabled && attachedFiles.length > 0
          ? "File Intelligence + Web Search · Qwen 3 8B · Grounded Citations"
          : webSearchEnabled
          ? "Web Search · Qwen 3 8B · Sources verified by backend"
          : attachedFiles.length > 0
          ? "File Intelligence · Local RAG · Citations grounded in documents"
          : "Solix can make mistakes. Verify important information."}
      </div>
    </div>
  );
};
