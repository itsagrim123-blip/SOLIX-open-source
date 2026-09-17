"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Menu,
  Settings,
} from "lucide-react";
import { ModelInfo } from "@/types/chat";

interface ChatHeaderProps {
  currentModel: string;
  models: ModelInfo[];
  onSelectModel: (modelId: string) => void;
  isBackendConnected: boolean;
  onOpenMobileMenu: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentModel,
  models,
  onSelectModel,
  isBackendConnected,
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

  return (
    <header className="h-[60px] flex-none flex items-center justify-between px-4 border-b border-[#96b4e6]/10 glass z-20 select-none relative">
      {/* Top Left: Logo + SOLIX + | + Model Selector + Compact Status Pill */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile drawer toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="solix-logo-badge">✣</div>
          <strong className="font-extrabold tracking-[0.3px] text-white text-sm sm:text-base">
            SOLIX
          </strong>
        </div>

        {/* Subtle Separator */}
        <span className="opacity-20 hidden sm:inline text-slate-400">|</span>

        {/* Model Selector Pill with Dropdown */}
        <div className="relative hidden sm:block" ref={modelPickerRef}>
          <button
            type="button"
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="glass px-3 py-1.5 rounded-xl text-xs text-[#eaf1ff] hover:text-white hover:border-[#5ac8ff]/40 transition-all cursor-pointer font-mono flex items-center gap-1.5"
            title="Switch AI model"
          >
            <span>{currentModel}</span>
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

        {/* Compact Glass Status Pill: Green dot + Server Online OR Red dot + Server Offline */}
        <div
          className={`status-pill hidden sm:inline-flex ${
            isBackendConnected ? "" : "offline"
          }`}
          title={isBackendConnected ? "FastAPI backend is responsive" : "FastAPI backend is offline (Simulation mode active)"}
        >
          <span
            className={`status-dot ${isBackendConnected ? "" : "offline"}`}
          />
          <span>{isBackendConnected ? "Server Online" : "Server Offline"}</span>
        </div>
      </div>

      {/* Top Right: New Chat + Settings (Matching Reference) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mobile Server Status dot */}
        <div
          className={`status-pill sm:hidden py-1 px-2.5 text-[11px] ${
            isBackendConnected ? "" : "offline"
          }`}
        >
          <span
            className={`status-dot ${isBackendConnected ? "" : "offline"}`}
          />
          <span>{isBackendConnected ? "Online" : "Offline"}</span>
        </div>

        {/* ＋ New Chat Button */}
        <button
          onClick={onNewChat}
          className="new-btn !h-9 px-3.5 text-xs sm:text-sm font-semibold cursor-pointer"
          title="Start a new chat"
        >
          <span>＋ New Chat</span>
        </button>

        {/* Settings Icon Button */}
        <button
          onClick={onOpenSettings}
          className="iconbtn"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
