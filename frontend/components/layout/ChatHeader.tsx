"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, HardDrive, Loader2, Menu, Server, Settings, Sparkles } from "lucide-react";
import { ModelInfo } from "@/types/chat";
import { getModelBadge, getModelDescription, getModelLabel } from "@/lib/models";
import { SolixLogo } from "@/components/brand/SolixLogo";

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
  onNewChat?: () => void;
  onOpenSettings: () => void;
  activeView?: "chat" | "coding";
  onSelectView?: (view: "chat" | "coding") => void;
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
  onOpenSettings,
}) => {
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const statusPopoverRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelPickerRef.current &&
        !modelPickerRef.current.contains(e.target as Node)
      ) {
        setShowModelPicker(false);
      }
      if (
        statusPopoverRef.current &&
        !statusPopoverRef.current.contains(e.target as Node)
      ) {
        setShowStatusPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentStatus: BackendStatus =
    backendStatus || (isBackendConnected ? "online" : "offline");

  return (
    <header className="h-12 px-4 border-b border-[#22242a] bg-[#111214] flex items-center justify-between select-none relative z-20 shrink-0">
      {/* LEFT: Mobile Menu Button · Solix Brand · Model Selector · Server Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile menu hamburger button */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1c1e23] transition-colors"
          title="Open Menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Brand identity */}
        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          <SolixLogo size="sm" px={20} />
          <span className="text-xs font-semibold text-white tracking-wide font-sans">
            Solix
          </span>
        </div>

        <span className="text-[#3c4048] font-mono text-xs">·</span>

        {/* Model Switcher Dropdown Anchor */}
        <div className="relative inline-flex items-center" ref={modelPickerRef}>
          <button
            type="button"
            onClick={() => !isSwitchingModel && setShowModelPicker(!showModelPicker)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#d4d7dc] hover:text-white transition-colors cursor-pointer py-1 px-1.5 rounded-xs hover:bg-[#181a1f]"
            title="Select AI Model"
            aria-label="Select AI Model"
            disabled={isSwitchingModel}
          >
            {isSwitchingModel ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
                <span className="truncate max-w-[130px]">
                  {getModelLabel(switchingModelTarget || currentModel)}
                </span>
              </>
            ) : modelSwitchSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[130px] text-emerald-400">
                  {getModelLabel(modelSwitchSuccess)}
                </span>
              </>
            ) : (
              <>
                <span className="truncate max-w-[150px]">
                  {getModelLabel(currentModel)}
                </span>
                <ChevronDown className="w-3 h-3 text-[#666c75] shrink-0" />
              </>
            )}
          </button>

          {/* Model Selection Menu */}
          {showModelPicker && (
            <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 rounded-xs bg-[#141518] border border-[#292c31] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-2xl">
              <div className="px-2 py-1 text-[10px] font-mono font-semibold text-[#858b94] uppercase tracking-wider flex items-center justify-between border-b border-[#202227] pb-1.5 mb-1">
                <span>Available Models</span>
                <span className="text-[10px] font-mono text-[#666c75]">
                  {models.length} ready
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
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
                      className={`w-full text-left p-2 rounded-xs text-xs flex flex-col gap-0.5 transition-colors cursor-pointer border ${
                        isSelected
                          ? "bg-[#1d2027] border-[#383d47] text-white"
                          : "border-transparent text-[#a5abb5] hover:bg-[#181a1f] hover:text-[#eeeeec]"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-xs text-[#eeeeec]">
                          {label}
                        </span>
                        {badge && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-[#101114] text-[#858b94] border border-[#25282f]">
                            {badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#787e88] font-normal leading-tight line-clamp-1">
                        {desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span className="text-[#3c4048] font-mono text-xs hidden sm:inline">·</span>

        {/* Server Status Indicator (Click opens status popover) */}
        <div className="relative inline-flex items-center" ref={statusPopoverRef}>
          <button
            type="button"
            onClick={() => setShowStatusPopover(!showStatusPopover)}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs hover:bg-[#181a1f] text-[11px] font-mono transition-colors cursor-pointer"
            title="Click to view server connection status"
            aria-label="Server status"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStatus === "online"
                  ? "bg-emerald-400"
                  : currentStatus === "checking"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span
              className={
                currentStatus === "online"
                  ? "text-emerald-400 font-medium"
                  : currentStatus === "checking"
                  ? "text-amber-400"
                  : "text-rose-400"
              }
            >
              {currentStatus === "online"
                ? "Online"
                : currentStatus === "checking"
                ? "Connecting…"
                : "Offline"}
            </span>
          </button>

          {/* Compact Status Diagnostics Popover */}
          {showStatusPopover && (
            <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xs bg-[#141518] border border-[#292c31] p-3 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-2xl space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-[#202227] pb-1.5">
                <span className="text-[10.5px] font-semibold text-[#858b94] uppercase tracking-wide">
                  System Diagnostics
                </span>
                <span
                  className={`text-[10.5px] font-semibold ${
                    currentStatus === "online" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  ● {currentStatus === "online" ? "Connected" : "Disconnected"}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#666c75] flex items-center gap-1.5">
                    <Server className="w-3 h-3 text-[#858b94]" />
                    Backend:
                  </span>
                  <span className="text-[#d4d7dc]">127.0.0.1:8000</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#666c75] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#858b94]" />
                    Active Model:
                  </span>
                  <span className="text-[#d4d7dc] truncate max-w-[120px]" title={currentModel}>
                    {getModelLabel(currentModel)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#666c75]">Web Search:</span>
                  <span className="text-emerald-400">Available</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#666c75] flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-[#858b94]" />
                    Storage:
                  </span>
                  <span className="text-emerald-400">Local IndexedDB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Settings Action (No duplicate Chat/Workspace switcher or duplicate New Chat) */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
