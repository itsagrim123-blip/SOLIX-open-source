"use client";

import React from "react";
import {
  Menu,
  Plus,
  Settings,
  Sparkles,
  User,
} from "lucide-react";

interface ChatHeaderProps {
  currentModel: string;
  isProviderConnected: boolean;
  onOpenMobileMenu: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentModel,
  isProviderConnected,
  onOpenMobileMenu,
  onNewChat,
  onOpenSettings,
}) => {
  return (
    <header className="h-14 border-b border-white/[0.06] glass-panel-subtle flex items-center justify-between px-4 z-20 select-none">
      {/* Left side: Mobile menu toggle + Solix brand badge + Active Model badge */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Solix Brand Badge */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center shadow-glow-cyan">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          <span className="font-semibold text-sm tracking-wider text-white">
            SOLIX
          </span>
        </div>

        {/* Model Indicator Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isProviderConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span className="text-slate-300 font-mono text-[11px]">
            {currentModel}
          </span>
          {!isProviderConnected && (
            <span className="text-[10px] text-amber-400/90 font-sans ml-1">
              (Preview)
            </span>
          )}
        </div>
      </div>

      {/* Right side: New Chat + Settings + Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick New Chat button */}
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-400/30 text-xs font-medium text-slate-200 transition-all"
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Profile Avatar placeholder */}
        <div
          className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10 flex items-center justify-center text-slate-300 shadow-sm cursor-pointer hover:border-cyan-400/30 transition-colors"
          title="User profile"
        >
          <User className="w-4 h-4" />
        </div>
      </div>
    </header>
  );
};

