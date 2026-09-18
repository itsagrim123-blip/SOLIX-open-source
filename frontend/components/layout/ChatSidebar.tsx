"use client";

import React, { useMemo, useState } from "react";
import { Check, Code2, Edit2, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { ConversationSummary } from "@/types/chat";
import { SolixLogo } from "@/components/brand/SolixLogo";

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeView?: "chat" | "coding";
  onSelectView?: (view: "chat" | "coding") => void;
  transitionState?: "idle" | "entering" | "active" | "exiting";
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onOpenAbout,
  isMobileOpen,
  onCloseMobile,
  activeView = "chat",
  onSelectView,
  transitionState = "idle",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const handleStartRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const renderSidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div className="solix-brand">
          <div className="solix-logo">
            <SolixLogo size="md" px={36} />
          </div>
          <span className="tracking-[0.2em]">SOLIX</span>
        </div>
        {isMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* View Mode Navigation: Chat vs Coding Workspace */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#101114] border border-[#25272c] rounded-xl my-2 shrink-0">
        <button
          onClick={() => {
            onSelectView?.("chat");
            if (isMobile) onCloseMobile();
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeView === "chat"
              ? "bg-[#1f2127] text-white shadow-xs border border-[#32353c]"
              : "text-[#8f9299] hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => {
            onSelectView?.("coding");
            if (isMobile) onCloseMobile();
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeView === "coding"
              ? "bg-cyan-500/15 text-cyan-400 shadow-xs border border-cyan-500/30"
              : "text-[#8f9299] hover:text-cyan-300"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>
      </div>

      {/* New Chat Button */}
      <button
        onClick={() => {
          onSelectView?.("chat");
          onNewChat();
          if (isMobile) onCloseMobile();
        }}
        className="solix-new-chat cursor-pointer active:scale-98"
        title="Start a new chat"
      >
        <span>＋</span>
        <span>New Chat</span>
      </button>

      {/* Search Bar */}
      <div className="solix-search">
        <span className="text-xs">⌕</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          aria-label="Search conversations"
        />
      </div>

      {/* Recent Section Label */}
      <div className="solix-section-label">RECENT</div>

      {/* Conversation List */}
      <div className="solix-conversations-list">
        {filteredConversations.map((conv) => {
          const isActive = activeConversationId === conv.id;
          const isEditing = editingId === conv.id;

          if (isEditing) {
            return (
              <form
                key={conv.id}
                onSubmit={(e) => handleSaveRename(conv.id, e)}
                className="px-1 py-0.5"
              >
                <div className="flex items-center gap-1 bg-[#191a1e] rounded-lg p-1 border border-[#3a3d43]">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onBlur={() => setEditingId(null)}
                    className="flex-1 bg-transparent px-1.5 py-0.5 text-xs text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
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
                onSelectView?.("chat");
                onSelectConversation(conv.id);
                if (isMobile) onCloseMobile();
              }}
              className={`group solix-conversation ${isActive ? "active" : ""}`}
              title={conv.title}
            >
              <span className="truncate flex-1 text-left text-[13px]">
                {conv.title}
              </span>

              {/* Rename & Delete Controls */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity flex-shrink-0 pl-1">
                <button
                  onClick={(e) => handleStartRename(conv, e)}
                  className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                  title="Rename"
                  aria-label="Rename conversation"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete chat"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="p-4 text-center text-xs text-[#666970] space-y-1 my-auto">
            <div>No conversations yet.</div>
            <div className="text-[11px] text-[#555860]">Start a new chat above.</div>
          </div>
        )}
      </div>

      {/* Sidebar Bottom Footer */}
      <div className="solix-sidebar-bottom">
        <button
          onClick={() => {
            onOpenSettings();
            if (isMobile) onCloseMobile();
          }}
          className="solix-side-btn cursor-pointer"
          title="Settings"
        >
          <span>⚙</span>
          <span>Settings</span>
        </button>

        <button
          onClick={() => {
            onOpenAbout();
            if (isMobile) onCloseMobile();
          }}
          className="solix-side-btn cursor-pointer"
          title="About Solix"
        >
          <span>ⓘ</span>
          <span>About Solix</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`solix-sidebar solix-sidebar-desktop ${
          transitionState === "entering"
            ? "animate-chat-sidebar-collapse"
            : transitionState === "exiting"
            ? "animate-chat-sidebar-reveal"
            : ""
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[265px] max-w-[85vw] h-full bg-[#15171a] border-r border-[#292b30] z-50 md:hidden transition-transform duration-250 ease-out shadow-2xl p-4 flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </div>
    </>
  );
};
