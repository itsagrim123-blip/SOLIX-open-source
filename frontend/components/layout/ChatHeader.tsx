"use client";

import React, { useEffect, useRef, useState } from "react";
import { Menu, Settings } from "lucide-react";
import { ModelInfo } from "@/types/chat";

export type BackendStatus = "checking" | "online" | "offline";

interface ChatHeaderProps {
  currentModel: string;
  models: ModelInfo[];
  onSelectModel: (modelId: string) => void;
  isBackendConnected?: boolean;
  backendStatus?: BackendStatus;
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

  const statusPillClass =
    currentStatus === "online"
      ? ""
      : currentStatus === "checking"
      ? "checking"
      : "offline";

  const statusDotClass =
    currentStatus === "online"
      ? ""
      : currentStatus === "checking"
      ? "checking"
      : "offline";

  return (
    <header className="h-[54px] sm:h-[60px] flex-none flex items-center justify-between px-3 sm:px-4 border-b border-[#96b4e6]/10 glass z-20 select-none relative pt-[env(safe-area-inset-top,0px)]">
      {/* LEFT: Solix Icon + SOLIX + Small Model Indicator + Server Status Indicator */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="solix-logo-badge !w-7 !h-7 sm:!w-[35px] sm:!h-[35px] !text-sm sm:!text-[18px]">
            ✣
          </div>
          <strong className="font-extrabold tracking-[0.3px] text-white text-xs sm:text-base">
            SOLIX
          </strong>
        </div>

        {/* Subtle Separator on larger screens */}
        <span className="opacity-20 hidden sm:inline text-slate-400">|</span>

        {/* Small Model Indicator & Dropdown */}
        <div className="relative" ref={modelPickerRef}>
          <button
            type="button"
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="glass px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-[#eaf1ff] hover:text-white hover:border-[#5ac8ff]/40 transition-all cursor-pointer font-mono flex items-center gap-1 max-w-[85px] sm:max-w-none"
            title="Switch AI model"
            aria-label="Switch AI model"
          >
            <span className="truncate">{currentModel}</span>
            <span className="text-[10px] opacity-70">⌄</span>
          </button>

          {showModelPicker && (
            <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl glass p-2 z-50 animate-fade-in border border-white/10 shadow-2xl">
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

        {/* Server Status Indicator (Handling Checking, Online, Offline states) */}
        <div
          className={`status-pill !py-0.5 !px-2 sm:!py-1 sm:!px-2.5 !text-[11px] sm:!text-xs flex items-center gap-1.5 ${statusPillClass}`}
          title={
            currentStatus === "online"
              ? "Server Online"
              : currentStatus === "checking"
              ? "Checking backend health..."
              : "Server Offline (Simulation mode active)"
          }
        >
          <span className={`status-dot !w-1.5 !h-1.5 ${statusDotClass}`} />
          <span className="hidden sm:inline">
            {currentStatus === "online"
              ? "Server Online"
              : currentStatus === "checking"
              ? "Checking..."
              : "Server Offline"}
          </span>
          <span className="sm:hidden">
            {currentStatus === "online"
              ? "Online"
              : currentStatus === "checking"
              ? "Checking"
              : "Offline"}
          </span>
        </div>
      </div>

      {/* RIGHT: Hamburger/Menu Button on Mobile, New Chat + Settings on Desktop */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Desktop Controls (md+) */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="new-btn !h-9 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
            title="Start a new chat"
          >
            <span>＋ New Chat</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="iconbtn"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Hamburger Menu Button with 40x40 touch target */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-slate-300 hover:text-white active:scale-95 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
