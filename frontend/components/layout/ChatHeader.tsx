"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Menu } from "lucide-react";
import { ModelInfo } from "@/types/chat";
import { getModelBadge, getModelDescription, getModelLabel } from "@/lib/models";

export type BackendStatus = "checking" | "online" | "offline";

interface ChatHeaderProps {
  currentModel: string;
  models: ModelInfo[];
  onSelectModel: (modelId: string) => void;
  isBackendConnected?: boolean;
  backendStatus?: BackendStatus;
  isSwitchingModel?: boolean;
  switchingModelTarget?: string | null;
  modelSwitchSuccess?: string | null;
  onOpenMobileMenu: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentModel,
  models,
  onSelectModel,
  isBackendConnected = true,
  backendStatus,
  isSwitchingModel = false,
  switchingModelTarget = null,
  modelSwitchSuccess = null,
  onOpenMobileMenu,
  onNewChat,
  onOpenSettings,
}) => {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  const currentStatus: BackendStatus =
    backendStatus || (isBackendConnected ? "online" : "offline");

  const statusDotClass =
    currentStatus === "online"
      ? "online"
      : currentStatus === "checking"
      ? "checking"
      : "offline";

  return (
    <header className="solix-topbar select-none relative">
      {/* LEFT: Solix · Model Selector · Server Status */}
      <div className="flex items-center min-w-0">
        <div className="solix-model">
          {/* Mobile hamburger menu trigger */}
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-1 mr-1 rounded text-slate-400 hover:text-white"
            title="Open Menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <span className="text-white font-semibold">Solix</span>
          <span className="muted">·</span>

          {/* Model Switcher Dropdown Anchor */}
          <div className="relative inline-flex items-center" ref={modelPickerRef}>
            <button
              type="button"
              onClick={() => !isSwitchingModel && setShowModelPicker(!showModelPicker)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#dedfe2] hover:text-white transition-colors cursor-pointer py-1"
              title="Select AI Model"
              aria-label="Select AI Model"
              disabled={isSwitchingModel}
            >
              {isSwitchingModel ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400 flex-shrink-0" />
                  <span className="truncate max-w-[140px]">
                    {getModelLabel(switchingModelTarget || currentModel)}
                  </span>
                </>
              ) : modelSwitchSuccess ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="truncate max-w-[140px] text-emerald-400">
                    {getModelLabel(modelSwitchSuccess)}
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate max-w-[160px]">
                    {getModelLabel(currentModel)}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 flex-shrink-0" />
                </>
              )}
            </button>

            {/* Model Selection Menu */}
            {showModelPicker && (
              <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 rounded-xl bg-[#141518] border border-[#292b30] p-2 z-50 animate-fade-in shadow-2xl">
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

          {/* Server Status Indicator */}
          <span
            className="solix-status solix-status-desktop"
            title={
              currentStatus === "online"
                ? "Solix backend online"
                : currentStatus === "checking"
                ? "Connecting to backend..."
                : "Solix backend offline"
            }
          >
            <i className={`solix-dot ${statusDotClass}`} />
            <span>
              {currentStatus === "online"
                ? "Server online"
                : currentStatus === "checking"
                ? "Checking..."
                : "Server offline"}
            </span>
          </span>
        </div>
      </div>

      {/* RIGHT: New Chat & Settings */}
      <div className="solix-top-actions">
        <button
          onClick={onNewChat}
          className="solix-top-btn cursor-pointer"
          title="Start a new chat"
        >
          <span>＋</span>
          <span>New Chat</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="solix-top-btn icon cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <span>⚙</span>
        </button>
      </div>
    </header>
  );
};
