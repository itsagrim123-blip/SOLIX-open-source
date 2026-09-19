"use client";

import React, { useEffect, useRef, useState } from "react";
import { HardDrive, Menu, Server, Settings, Sparkles } from "lucide-react";
import { ModelInfo } from "@/types/chat";
import { getModelLabel } from "@/lib/models";

export type BackendStatus = "checking" | "online" | "offline";

interface ChatHeaderProps {
  currentModel: string;
  models?: ModelInfo[];
  onSelectModel?: (modelId: string) => void;
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
  models = [],
  onSelectModel,
  isBackendConnected = true,
  backendStatus,
  isSwitchingModel = false,
  switchingModelTarget = null,
  modelSwitchSuccess = null,
  onOpenMobileMenu,
  onOpenSettings,
}) => {
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const statusPopoverRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
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
      {/* LEFT: Mobile Menu Button · Server Status */}
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
