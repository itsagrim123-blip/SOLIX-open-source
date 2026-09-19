"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code2,
  Edit2,
  Info,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { ConversationSummary } from "@/types/chat";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { conversationStore } from "@/lib/storage/conversationStore";

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
  searchFocusSignal?: number;
}

function getGroupKey(dateStr: string): "TODAY" | "YESTERDAY" | "PREVIOUS 7 DAYS" | "EARLIER" {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgoStart = todayStart - 6 * 86400000;
    const time = d.getTime();

    if (time >= todayStart) return "TODAY";
    if (time >= yesterdayStart) return "YESTERDAY";
    if (time >= sevenDaysAgoStart) return "PREVIOUS 7 DAYS";
    return "EARLIER";
  } catch {
    return "EARLIER";
  }
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
  searchFocusSignal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [matchedSnippets, setMatchedSnippets] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load saved sidebar collapsed state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("solix_chat_sidebar_collapsed");
        if (saved === "true") {
          setIsCollapsed(true);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("solix_chat_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B to toggle sidebar, Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCollapsed) {
          setIsCollapsed(false);
          try {
            localStorage.setItem("solix_chat_sidebar_collapsed", "false");
          } catch {
            // ignore
          }
        }
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  // Focus search if signal changes
  useEffect(() => {
    if (searchFocusSignal && searchInputRef.current) {
      if (isCollapsed) {
        setIsCollapsed(false);
      }
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchFocusSignal, isCollapsed]);

  // Perform multi-message search asynchronously across IndexedDB
  useEffect(() => {
    let cancelled = false;
    const q = searchQuery.trim();
    if (!q) {
      setMatchedSnippets({});
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const snippets = await conversationStore.searchAcrossConversations(q);
        if (!cancelled) {
          setMatchedSnippets(snippets);
        }
      } catch {
        if (!cancelled) setMatchedSnippets({});
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Filter conversations by title OR matching snippet
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;

    return conversations.filter((c) => {
      const titleMatch = c.title.toLowerCase().includes(q);
      const snippetMatch = Boolean(matchedSnippets[c.id]);
      return titleMatch || snippetMatch;
    });
  }, [conversations, searchQuery, matchedSnippets]);

  // Group conversations into chronological buckets
  const groupedConversations = useMemo(() => {
    const groups: { [key in "TODAY" | "YESTERDAY" | "PREVIOUS 7 DAYS" | "EARLIER"]: ConversationSummary[] } = {
      TODAY: [],
      YESTERDAY: [],
      "PREVIOUS 7 DAYS": [],
      EARLIER: [],
    };

    for (const c of filteredConversations) {
      const dateVal = c.updated_at || c.created_at || new Date().toISOString();
      const groupKey = getGroupKey(dateVal);
      groups[groupKey].push(c);
    }

    return groups;
  }, [filteredConversations]);

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

  // Render an individual conversation item
  const renderConversationItem = (conv: ConversationSummary, isMobile: boolean) => {
    const isActive = activeConversationId === conv.id;
    const isEditing = editingId === conv.id;
    const snippet = searchQuery.trim() ? matchedSnippets[conv.id] : null;

    if (isEditing) {
      return (
        <form
          key={conv.id}
          onSubmit={(e) => handleSaveRename(conv.id, e)}
          className="px-1 py-0.5"
        >
          <div className="flex items-center gap-1 bg-[#191a1e] rounded-md p-1 border border-[#3a3d43]">
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
        className={`group relative flex flex-col py-1.5 px-2.5 rounded-md text-xs transition-colors cursor-pointer border ${
          isActive
            ? "bg-[#1d2027] text-white border-[#383d47] font-medium"
            : "text-[#a5abb5] hover:bg-[#181a1f] hover:text-[#eeeeec] border-transparent"
        }`}
        title={conv.title}
      >
        <div className="flex items-center justify-between w-full min-w-0">
          <span className="truncate flex-1 text-left text-[12.5px] leading-tight">
            {conv.title}
          </span>

          {/* Action buttons on hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity flex-shrink-0 pl-1">
            <button
              onClick={(e) => handleStartRename(conv, e)}
              className="p-1 rounded text-[#787e88] hover:text-white transition-colors"
              title="Rename conversation"
              aria-label="Rename conversation"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
              className="p-1 rounded text-[#787e88] hover:text-rose-400 transition-colors"
              title="Delete conversation"
              aria-label="Delete conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Highlighted message match snippet */}
        {snippet && (
          <div className="text-[10.5px] text-[#7d828a] truncate pt-0.5 italic pl-0.5">
            &quot;{snippet}&quot;
          </div>
        )}
      </div>
    );
  };

  const renderSidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* Brand Header: 48px height matching ChatHeader baseline */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-[#202227] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8.5 h-8.5 flex items-center justify-center shrink-0">
            <SolixLogo size="md" px={36} className="scale-115 object-contain" />
          </div>
          <span className="text-[16px] font-bold text-white tracking-[0.22em] uppercase font-sans select-none">
            SOLIX
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isMobile && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-xs text-[#787e88] hover:text-white hover:bg-[#1c1e23] transition-colors cursor-pointer"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-xs text-[#787e88] hover:text-white hover:bg-[#1c1e23] transition-colors"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Body Content */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 overflow-hidden">
        {/* View Mode Navigation: Chat vs Coding Workspace */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#101114] border border-[#22242a] rounded-xs mb-2 shrink-0">
        <button
          onClick={() => {
            onSelectView?.("chat");
            if (isMobile) onCloseMobile();
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
            activeView === "chat"
              ? "bg-[#1f2127] text-white shadow-xs border border-[#32353c]"
              : "text-[#858b94] hover:text-white"
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
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xs text-xs font-semibold transition-all cursor-pointer ${
            activeView === "coding"
              ? "bg-cyan-500/15 text-cyan-400 shadow-xs border border-cyan-500/30"
              : "text-[#858b94] hover:text-cyan-300"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>
      </div>

      {/* New Chat Action Button */}
      <button
        onClick={() => {
          onSelectView?.("chat");
          onNewChat();
          if (isMobile) onCloseMobile();
        }}
        className="w-full flex items-center justify-center gap-2 h-8.5 rounded-xs border border-[#272a31] bg-[#16171b] hover:bg-[#1c1e24] hover:border-[#383d47] text-xs font-semibold text-white transition-all cursor-pointer active:scale-98 shrink-0 my-1"
        title="Start a new chat (Ctrl+N)"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New Chat</span>
        <span className="text-[10px] font-mono text-[#666c75] ml-auto pr-2 hidden sm:inline">
          Ctrl+N
        </span>
      </button>

      {/* Search Input Bar */}
      <div className="relative my-2 shrink-0">
        <div className="flex items-center h-8 px-2.5 rounded-xs bg-[#121316] border border-[#22242a] focus-within:border-[#3a3e47] transition-colors text-[#858b94]">
          <Search className="w-3.5 h-3.5 mr-2 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-transparent text-xs text-[#eeeeec] placeholder:text-[#666c75] outline-none"
            aria-label="Search conversations"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="p-0.5 text-[#858b94] hover:text-white cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="text-[9px] font-mono text-[#555a63] shrink-0 hidden sm:inline">
              Ctrl+K
            </span>
          )}
        </div>
      </div>

      {/* Grouped Conversation List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 pr-1">
        {searchQuery.trim() ? (
          <div>
            <div className="text-[10px] font-mono font-semibold text-[#666c75] uppercase tracking-wider px-2 py-1">
              Search Results ({filteredConversations.length})
            </div>
            <div className="space-y-0.5 mt-1">
              {filteredConversations.map((conv) => renderConversationItem(conv, isMobile))}
            </div>
            {filteredConversations.length === 0 && (
              <div className="p-4 text-center text-xs text-[#666c75] space-y-1">
                <div>No matching chats found</div>
                <div className="text-[11px] text-[#555860]">
                  Try searching a different word or phrase
                </div>
              </div>
            )}
          </div>
        ) : (
          (
            [
              { key: "TODAY", label: "Today" },
              { key: "YESTERDAY", label: "Yesterday" },
              { key: "PREVIOUS 7 DAYS", label: "Previous 7 Days" },
              { key: "EARLIER", label: "Earlier" },
            ] as const
          ).map(({ key, label }) => {
            const list = groupedConversations[key];
            if (!list || list.length === 0) return null;

            return (
              <div key={key} className="space-y-1">
                <div className="text-[10px] font-mono font-semibold text-[#666c75] uppercase tracking-wider px-2 pt-1 pb-0.5">
                  {label}
                </div>
                <div className="space-y-0.5">
                  {list.map((conv) => renderConversationItem(conv, isMobile))}
                </div>
              </div>
            );
          })
        )}

        {!searchQuery.trim() && conversations.length === 0 && (
          <div className="p-6 text-center text-xs text-[#666c75] space-y-1 my-auto">
            <div>No conversations yet</div>
            <div className="text-[11px] text-[#555860]">Click New Chat to begin</div>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="border-t border-[#202227] pt-2 mt-auto shrink-0 flex flex-col gap-0.5">
        <button
          onClick={() => {
            onOpenSettings();
            if (isMobile) onCloseMobile();
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-xs text-[#858b94] hover:text-white hover:bg-[#181a1f] transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => {
            onOpenAbout();
            if (isMobile) onCloseMobile();
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-xs text-[#858b94] hover:text-white hover:bg-[#181a1f] transition-colors cursor-pointer"
          title="About Solix"
        >
          <Info className="w-3.5 h-3.5" />
          <span>About Solix</span>
        </button>
      </div>
    </div>
  </div>
);

  // Compact Collapsed Sidebar (Desktop)
  const renderCollapsedSidebar = () => (
    <div className="flex flex-col items-center justify-between h-full select-none w-13 shrink-0">
      {/* Top Header: 48px height matching ChatHeader */}
      <div className="h-12 w-full border-b border-[#202227] flex items-center justify-center shrink-0">
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded-xs hover:bg-[#1c1e23] transition-colors cursor-pointer"
          title="Expand sidebar (Ctrl+B)"
          aria-label="Expand sidebar"
        >
          <SolixLogo size="sm" px={28} />
        </button>
      </div>

      {/* Body: Action icons */}
      <div className="flex-1 flex flex-col items-center justify-between py-2.5 w-full">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-xs text-[#787e88] hover:text-white hover:bg-[#1c1e23] transition-colors cursor-pointer"
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>

          <div className="w-6 h-[1px] bg-[#22242a]" />

          {/* View Switch Icons */}
          <button
            onClick={() => onSelectView?.("chat")}
            className={`p-2 rounded-xs transition-colors cursor-pointer ${
              activeView === "chat"
                ? "bg-[#1f2127] text-white border border-[#32353c]"
                : "text-[#858b94] hover:text-white"
            }`}
            title="Chat mode"
            aria-label="Chat mode"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSelectView?.("coding")}
            className={`p-2 rounded-xs transition-colors cursor-pointer ${
              activeView === "coding"
                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                : "text-[#858b94] hover:text-cyan-300"
            }`}
            title="Workspace mode"
            aria-label="Workspace mode"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <div className="w-6 h-[1px] bg-[#22242a]" />

          {/* New Chat Icon */}
          <button
            onClick={() => {
              onSelectView?.("chat");
              onNewChat();
            }}
            className="p-2 rounded-xs bg-[#16171b] border border-[#272a31] text-white hover:bg-[#1c1e24] hover:border-[#383d47] transition-colors cursor-pointer"
            title="New Chat (Ctrl+N)"
            aria-label="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Search Icon */}
          <button
            onClick={() => {
              toggleCollapsed();
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="p-2 rounded-xs text-[#858b94] hover:text-white hover:bg-[#181a1f] transition-colors cursor-pointer"
            title="Search conversations (Ctrl+K)"
            aria-label="Search conversations"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom: Settings */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xs text-[#858b94] hover:text-white hover:bg-[#181a1f] transition-colors cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenAbout}
            className="p-2 rounded-xs text-[#858b94] hover:text-white hover:bg-[#181a1f] transition-colors cursor-pointer"
            title="About Solix"
            aria-label="About Solix"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed/Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full bg-[#121316] border-r border-[#202227] transition-all duration-200 ease-in-out shrink-0 ${
          isCollapsed ? "w-13 min-w-13" : "w-[260px] min-w-[260px]"
        } ${
          transitionState === "entering"
            ? "animate-chat-sidebar-collapse"
            : transitionState === "exiting"
            ? "animate-chat-sidebar-reveal"
            : ""
        }`}
      >
        {isCollapsed ? renderCollapsedSidebar() : renderSidebarContent(false)}
      </aside>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[275px] max-w-[85vw] h-full bg-[#121316] border-r border-[#22242a] z-50 md:hidden transition-transform duration-250 ease-out shadow-2xl flex flex-col ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </div>
    </>
  );
};

