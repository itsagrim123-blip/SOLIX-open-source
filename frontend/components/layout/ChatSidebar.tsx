"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ConversationSummary } from "@/types/chat";

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isProviderConnected: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  isProviderConnected,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Group conversations by date (Today, Yesterday, Last 7 Days, Older)
  const groupedConversations = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: { [key: string]: ConversationSummary[] } = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: [],
    };

    filtered.forEach((conv) => {
      const updatedAt = new Date(conv.updated_at).getTime();
      if (updatedAt >= today) {
        groups["Today"].push(conv);
      } else if (updatedAt >= yesterday) {
        groups["Yesterday"].push(conv);
      } else if (updatedAt >= sevenDaysAgo) {
        groups["Previous 7 Days"].push(conv);
      } else {
        groups["Older"].push(conv);
      }
    });

    return groups;
  }, [conversations, searchQuery]);

  const handleStartRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Top Header: Logo + Collapse Button */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/25 to-violet-500/25 border border-cyan-400/30 flex items-center justify-center shadow-glow-cyan">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-wide text-white flex items-center gap-1.5">
                SOLIX
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                v1.0.0
              </span>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-violet-500/15 hover:from-cyan-500/25 hover:to-violet-500/25 text-white font-medium text-xs sm:text-sm shadow-sm transition-all group ${
            isCollapsed ? "px-2" : ""
          }`}
          title="Start a new chat"
        >
          <Plus className="w-4 h-4 text-cyan-300 group-hover:rotate-90 transition-transform duration-200" />
          {!isCollapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Search Bar */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/[0.06] focus:border-cyan-400/30 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {Object.entries(groupedConversations).map(([groupTitle, convs]) => {
          if (convs.length === 0) return null;

          return (
            <div key={groupTitle} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2 py-1 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {groupTitle}
                </div>
              )}

              {convs.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const isEditing = editingId === conv.id;

                if (isEditing) {
                  return (
                    <form
                      key={conv.id}
                      onSubmit={(e) => handleSaveRename(conv.id, e)}
                      className="px-2 py-1"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                          onBlur={() => setEditingId(null)}
                          className="flex-1 bg-white/10 border border-cyan-400/40 rounded px-2 py-1 text-xs text-white outline-none"
                        />
                        <button
                          type="submit"
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onCloseMobile();
                    }}
                    className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isActive
                        ? "bg-white/[0.08] text-white border border-cyan-400/30 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                    }`}
                    title={conv.title}
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isActive ? "text-cyan-400" : "text-slate-500"
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="flex-1 truncate font-normal">
                        {conv.title}
                      </span>
                    )}

                    {/* Actions Menu */}
                    {!isCollapsed && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button
                          onClick={(e) => handleStartRename(conv, e)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200"
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {conversations.length === 0 && !isCollapsed && (
          <div className="p-4 text-center text-xs text-slate-500">
            No conversations yet. Start a new chat above!
          </div>
        )}
      </div>

      {/* Bottom Footer: Provider Status & Settings */}
      <div className="p-3 border-t border-white/[0.06] space-y-2">
        {/* Provider Status Pill */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px]">
            <span className="text-slate-400">Ollama Engine</span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  isProviderConnected
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                }`}
              />
              <span
                className={`font-medium ${
                  isProviderConnected ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {isProviderConnected ? "Online" : "Simulation"}
              </span>
            </div>
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors ${
            isCollapsed ? "justify-center" : ""
          }`}
          title="Open Settings"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          {!isCollapsed && <span>Settings & Providers</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Glass Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen glass-panel border-r border-white/[0.08] transition-all duration-300 z-30 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-72 glass-panel border-r border-white/[0.08] z-50 md:hidden transition-transform duration-300 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

