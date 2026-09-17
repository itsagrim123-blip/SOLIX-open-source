"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
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
  onOpenAbout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isProviderConnected?: boolean;
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
  isCollapsed,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
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

  const renderSidebarInner = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full min-h-0 select-none overflow-hidden p-3 gap-2.5">
      {/* Brand Header */}
      <div className="flex items-center justify-between flex-shrink-0 h-9 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 via-blue-500 to-violet-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          {(!isCollapsed || isMobile) && (
            <span className="font-bold text-sm tracking-tight text-white">
              SOLIX
            </span>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Mobile Close Button */}
        {isMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0">
        <button
          onClick={() => {
            onNewChat();
            if (isMobile) onCloseMobile();
          }}
          className={`new-btn w-full !h-9 text-xs font-semibold cursor-pointer active:scale-98 ${
            isCollapsed && !isMobile ? "!px-0 !justify-center" : ""
          }`}
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-300" />
          {(!isCollapsed || isMobile) && <span>New Chat</span>}
        </button>
      </div>

      {/* Search Input */}
      {(!isCollapsed || isMobile) && (
        <div className="relative flex-shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-400/40 transition-colors"
          />
        </div>
      )}

      {/* Section Header */}
      {(!isCollapsed || isMobile) && (
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 pt-1">
          Recent
        </div>
      )}

      {/* Conversations Scroll Container (Strict internal scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
        {filteredConversations.map((conv) => {
          const isActive = activeConversationId === conv.id;
          const isEditing = editingId === conv.id;

          if (isEditing && (!isCollapsed || isMobile)) {
            return (
              <form
                key={conv.id}
                onSubmit={(e) => handleSaveRename(conv.id, e)}
                className="px-1 py-0.5"
              >
                <div className="flex items-center gap-1 bg-[#080e1b] rounded-lg p-1 border border-cyan-400/40">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onBlur={() => setEditingId(null)}
                    className="flex-1 bg-transparent px-1.5 py-0.5 text-xs text-white outline-none font-sans"
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
                if (isMobile) onCloseMobile();
              }}
              className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors border ${
                isActive
                  ? "bg-white/[0.08] text-white border-cyan-400/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-transparent"
              } ${isCollapsed && !isMobile ? "!justify-center !px-0" : ""}`}
              title={conv.title}
            >
              {isCollapsed && !isMobile ? (
                <MessageSquare
                  className={`w-4 h-4 ${
                    isActive ? "text-cyan-400" : "text-slate-400"
                  }`}
                />
              ) : (
                <>
                  <span className="truncate flex-1 text-left text-xs">
                    {conv.title}
                  </span>

                  {/* Rename & Delete controls */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0 pl-1">
                    <button
                      onClick={(e) => handleStartRename(conv, e)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {filteredConversations.length === 0 && (!isCollapsed || isMobile) && (
          <div className="p-3 text-center text-xs text-slate-500 italic">
            No chats found
          </div>
        )}
      </div>

      {/* Bottom Footer: Settings & About Solix */}
      <div className="border-t border-white/[0.06] pt-2 space-y-1 flex-shrink-0">
        <button
          onClick={() => {
            onOpenSettings();
            if (isMobile) onCloseMobile();
          }}
          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer ${
            isCollapsed && !isMobile ? "!justify-center !px-0" : ""
          }`}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          {(!isCollapsed || isMobile) && <span>Settings</span>}
        </button>

        <button
          onClick={() => {
            onOpenAbout();
            if (isMobile) onCloseMobile();
          }}
          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer ${
            isCollapsed && !isMobile ? "!justify-center !px-0" : ""
          }`}
          title="About Solix"
        >
          <span className="w-3.5 h-3.5 text-center font-mono text-xs leading-none">ⓘ</span>
          {(!isCollapsed || isMobile) && <span>About Solix</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full min-h-0 glass border-r border-white/[0.07] transition-all duration-300 z-20 flex-none ${
          isCollapsed ? "w-[60px]" : "w-[268px]"
        }`}
      >
        {renderSidebarInner(false)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[270px] max-w-[85vw] h-full glass border-r border-white/10 z-50 md:hidden transition-transform duration-300 ease-out shadow-2xl flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "max(8px, env(safe-area-inset-top, 8px))",
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        }}
      >
        {renderSidebarInner(true)}
      </div>
    </>
  );
};
