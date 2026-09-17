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
    <div className="flex flex-col h-full min-h-0 select-none overflow-hidden">
      {/* Brand Header */}
      <div className="sidebar-brand justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="solix-logo-badge !w-8 !h-8 sm:!w-[35px] sm:!h-[35px]">
            ✣
          </div>
          {(!isCollapsed || isMobile) && (
            <span className="font-extrabold text-sm sm:text-base tracking-[0.3px] text-white">
              SOLIX
            </span>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 rounded-lg text-[#7888a2] hover:text-[#eef5ff] hover:bg-white/[0.06] transition-colors"
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

        {/* Mobile Close Button (Touch optimized) */}
        {isMobile && (
          <button
            onClick={onCloseMobile}
            className="iconbtn !w-9 !h-9 flex items-center justify-center rounded-xl"
            aria-label="Close sidebar"
            title="Close sidebar"
          >
            <X className="w-4 h-4 text-[#aebbd0]" />
          </button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="pt-2 flex-shrink-0">
        <button
          onClick={() => {
            onNewChat();
            if (isMobile) onCloseMobile();
          }}
          className={`new-btn w-full min-h-[42px] active:scale-[0.98] ${
            isCollapsed && !isMobile ? "!px-0 !justify-center" : ""
          }`}
          title="Start a new chat"
        >
          {isCollapsed && !isMobile ? (
            <Plus className="w-4 h-4 text-cyan-300" />
          ) : (
            <span>＋ New Chat</span>
          )}
        </button>
      </div>

      {/* Search Input */}
      {(!isCollapsed || isMobile) && (
        <div className="pt-2 flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="sidebar-search min-h-[38px]"
          />
        </div>
      )}

      {/* Section Header */}
      {(!isCollapsed || isMobile) && (
        <div className="sidebar-section">Recent Chats</div>
      )}

      {/* Conversations Scroll Container (Strict internal scroll) */}
      <div className="sidebar-chats mt-1.5">
        {filteredConversations.map((conv) => {
          const isActive = activeConversationId === conv.id;
          const isEditing = editingId === conv.id;

          if (isEditing && (!isCollapsed || isMobile)) {
            return (
              <form
                key={conv.id}
                onSubmit={(e) => handleSaveRename(conv.id, e)}
                className="px-1 py-1 flex-shrink-0"
              >
                <div className="flex items-center gap-1 bg-[#080e1b] rounded-xl p-1.5 border border-cyan-400/50 shadow-inner">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onBlur={() => setEditingId(null)}
                    className="flex-1 bg-transparent px-2 py-0.5 text-xs text-white outline-none font-sans"
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
              className={`sidebar-chat-item group active:scale-[0.98] ${
                isActive ? "active" : ""
              } ${isCollapsed && !isMobile ? "!justify-center !px-0" : "min-h-[40px]"}`}
              title={conv.title}
            >
              {isCollapsed && !isMobile ? (
                <MessageSquare
                  className={`w-4 h-4 ${
                    isActive ? "text-cyan-400" : "text-[#7888a2]"
                  }`}
                />
              ) : (
                <>
                  <span className="truncate flex-1 text-left text-xs sm:text-[13px]">
                    {conv.title}
                  </span>

                  {/* Rename & Delete controls */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0 pl-1">
                    <button
                      onClick={(e) => handleStartRename(conv, e)}
                      className="p-1 rounded hover:bg-white/10 text-[#7888a2] hover:text-white transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-[#7888a2] hover:text-rose-400 transition-colors"
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
          <div className="p-3 text-center text-xs text-[#7888a2] italic">
            No chats found
          </div>
        )}
      </div>

      {/* Bottom Footer: Settings & About Solix matching Reference */}
      <div className="sidebar-bottom">
        <button
          onClick={() => {
            onOpenSettings();
            if (isMobile) onCloseMobile();
          }}
          className={`sidebar-bottom-btn min-h-[40px] active:scale-[0.98] ${
            isCollapsed && !isMobile ? "!justify-center !px-0" : ""
          }`}
          title="Settings"
        >
          <span className="text-sm">⚙</span>
          {(!isCollapsed || isMobile) && <span>Settings</span>}
        </button>

        <button
          onClick={() => {
            onOpenAbout();
            if (isMobile) onCloseMobile();
          }}
          className={`sidebar-bottom-btn min-h-[40px] active:scale-[0.98] ${
            isCollapsed && !isMobile ? "!justify-center !px-0" : ""
          }`}
          title="About Solix"
        >
          <span className="text-sm">ⓘ</span>
          {(!isCollapsed || isMobile) && <span>About Solix</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (md+) */}
      <aside
        className={`hidden md:flex flex-col h-[100dvh] h-screen glass border-r border-[#96b4e6]/10 transition-all duration-300 z-30 flex-none ${
          isCollapsed ? "w-[68px] p-2" : "solix-sidebar"
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

      {/* Mobile Slide-Out Drawer with Safe Area Insets */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[280px] max-w-[85vw] h-[100dvh] h-[100svh] glass border-r border-[#96b4e6]/15 z-50 md:hidden transition-transform duration-300 ease-out shadow-2xl flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          paddingLeft: "12px",
          paddingRight: "12px",
        }}
      >
        {renderSidebarInner(true)}
      </div>
    </>
  );
};
