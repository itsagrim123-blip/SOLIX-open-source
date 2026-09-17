"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Menu, Plus, Settings, Sparkles } from "lucide-react";
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
    <header className="h-[56px] sm:h-[60px] flex-none flex items-center justify-between px-3 sm:px-5 border-b border-white/[0.08] glass z-30 select-none relative pt-[env(safe-area-inset-top,0px)]">
      {/* LEFT: Solix Logo + Brand + Model + Server Status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-violet-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <strong className="font-bold tracking-tight text-white text-sm sm:text-base">
            SOLIX
          </strong>
        </div>

        {/* Subtle Separator */}
        <span className="opacity-20 hidden sm:inline text-slate-500 font-light">|</span>

        {/* Model Selector Dropdown */}
        <div className="relative" ref={modelPickerRef}>
          <button
            type="button"
            onClick={() => !isSwitchingModel && setShowModelPicker(!showModelPicker)}
            className={`glass px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs text-slate-200 hover:text-white hover:border-cyan-400/30 transition-all cursor-pointer font-medium flex items-center gap-1.5 max-w-[140px] sm:max-w-[210px] ${
              isSwitchingModel
                ? "border-cyan-400/40 text-cyan-300 bg-cyan-500/10 cursor-wait"
                : modelSwitchSuccess
                ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10"
                : ""
            }`}
            title="Switch AI model"
            aria-label="Switch AI model"
            disabled={isSwitchingModel}
          >
            {isSwitchingModel ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400 flex-shrink-0" />
                <span className="truncate">
                  {getModelLabel(switchingModelTarget || currentModel)}
                </span>
              </>
            ) : modelSwitchSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{getModelLabel(modelSwitchSuccess)}</span>
              </>
            ) : (
              <>
                <span className="truncate">{getModelLabel(currentModel)}</span>
                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 flex-shrink-0" />
              </>
            )}
          </button>

          {showModelPicker && (
            <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 rounded-2xl glass p-2.5 z-50 animate-fade-in border border-white/10 shadow-2xl">
              <div className="px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Select AI Model</span>
                <span className="text-[10px] font-mono text-cyan-400/80">{models.length} available</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 mt-1.5 pr-0.5">
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
                      className={`w-full text-left p-2.5 rounded-xl text-xs flex flex-col gap-1 transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-400/35 text-white shadow-sm"
                          : "border-transparent text-slate-300 hover:bg-white/[0.06] hover:border-white/[0.08] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                          <span>{label}</span>
                          {m.is_default && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/25">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                          {badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal leading-tight line-clamp-1">
                        {desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Server Status Pill */}
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

      {/* RIGHT: New Chat + Settings on Desktop, Hamburger on Mobile */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="new-btn !h-8 px-3 text-xs font-semibold cursor-pointer active:scale-95"
            title="Start a new chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="iconbtn !w-8 !h-8"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile New Chat Button */}
        <button
          onClick={onNewChat}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white active:scale-95 bg-white/[0.04] border border-white/[0.08]"
          title="New Chat"
          aria-label="New Chat"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white active:scale-95 bg-white/[0.04] border border-white/[0.08]"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
