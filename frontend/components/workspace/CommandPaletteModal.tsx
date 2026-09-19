"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AlertCircle,
  Code2,
  Cpu,
  Download,
  FileCode,
  FilePlus,
  FolderPlus,
  FolderTree,
  HardDrive,
  Hammer,
  MessageSquare,
  Play,
  PlayCircle,
  RotateCcw,
  Save,
  Search,
  Terminal as TerminalIcon,
  Upload,
  X,
  Sparkles,
  Globe,
  Trash2,
} from "lucide-react";
import { FileNode } from "@/types/workspace";

export interface CommandItem {
  id: string;
  label: string;
  category: "Execution" | "File" | "View" | "AI" | "Project";
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "commands" | "files";
  fileTree: FileNode[];
  onSelectFile: (path: string) => void;
  onSaveFile: () => void;
  onRunProject: () => void;
  onBuildProject: () => void;
  onTestProject: () => void;
  onToggleTerminal: () => void;
  onToggleExplorer: () => void;
  onToggleAi: () => void;
  onTogglePreview?: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onNewProject: () => void;
  onDeleteProject?: () => void;
  onExportZip: () => void;
  onImportFiles: () => void;
  onClearTerminal: () => void;
  onOpenStorageModal: () => void;
  onOpenRuntimesModal: () => void;
  onBackToChat?: () => void;
  onAiAction?: (action: "explain" | "fix" | "tests") => void;
}

function flattenFiles(nodes: FileNode[]): string[] {
  const result: string[] = [];
  function walk(items: FileNode[]) {
    for (const item of items) {
      if (item.is_directory) {
        if (item.children) walk(item.children);
      } else {
        result.push(item.path);
      }
    }
  }
  walk(nodes);
  return result;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  initialMode = "commands",
  fileTree,
  onSelectFile,
  onSaveFile,
  onRunProject,
  onBuildProject,
  onTestProject,
  onToggleTerminal,
  onToggleExplorer,
  onToggleAi,
  onTogglePreview,
  onNewFile,
  onNewFolder,
  onNewProject,
  onDeleteProject,
  onExportZip,
  onImportFiles,
  onClearTerminal,
  onOpenStorageModal,
  onOpenRuntimesModal,
  onBackToChat,
  onAiAction,
}) => {
  const [mode, setMode] = useState<"commands" | "files">(initialMode);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen, initialMode]);

  // All flattened files
  const allFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  // Defined commands
  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "run-project",
        label: "Run Project / File",
        category: "Execution",
        shortcut: "Ctrl+Enter",
        icon: <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />,
        action: () => {
          onClose();
          onRunProject();
        },
      },
      {
        id: "save-file",
        label: "Save Active File",
        category: "File",
        shortcut: "Ctrl+S",
        icon: <Save className="w-3.5 h-3.5 text-emerald-400" />,
        action: () => {
          onClose();
          onSaveFile();
        },
      },
      {
        id: "build-project",
        label: "Build Project",
        category: "Execution",
        icon: <Hammer className="w-3.5 h-3.5 text-amber-400" />,
        action: () => {
          onClose();
          onBuildProject();
        },
      },
      {
        id: "test-project",
        label: "Run Unit Tests",
        category: "Execution",
        icon: <PlayCircle className="w-3.5 h-3.5 text-teal-400" />,
        action: () => {
          onClose();
          onTestProject();
        },
      },
      {
        id: "toggle-terminal",
        label: "Toggle Docked Terminal",
        category: "View",
        shortcut: "Ctrl+`",
        icon: <TerminalIcon className="w-3.5 h-3.5 text-[#a5abb5]" />,
        action: () => {
          onClose();
          onToggleTerminal();
        },
      },
      {
        id: "toggle-ai",
        label: "Toggle Solix Code AI Panel",
        category: "View",
        shortcut: "Ctrl+B",
        icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
        action: () => {
          onClose();
          onToggleAi();
        },
      },
      {
        id: "toggle-explorer",
        label: "Toggle File Explorer",
        category: "View",
        icon: <FolderTree className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onToggleExplorer();
        },
      },
      ...(onTogglePreview
        ? [
            {
              id: "toggle-preview",
              label: "Toggle Live Web Preview",
              category: "View" as const,
              shortcut: "Ctrl+Shift+V",
              icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />,
              action: () => {
                onClose();
                onTogglePreview();
              },
            },
          ]
        : []),
      {
        id: "ai-explain",
        label: "Solix AI: Explain Active Code",
        category: "AI",
        icon: <Code2 className="w-3.5 h-3.5 text-cyan-400" />,
        action: () => {
          onClose();
          onAiAction?.("explain");
        },
      },
      {
        id: "ai-fix",
        label: "Solix AI: Diagnose & Fix Bugs",
        category: "AI",
        icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
        action: () => {
          onClose();
          onAiAction?.("fix");
        },
      },
      {
        id: "ai-tests",
        label: "Solix AI: Generate Unit Tests",
        category: "AI",
        icon: <PlayCircle className="w-3.5 h-3.5 text-teal-400" />,
        action: () => {
          onClose();
          onAiAction?.("tests");
        },
      },
      {
        id: "new-file",
        label: "New File...",
        category: "File",
        icon: <FilePlus className="w-3.5 h-3.5 text-[#a5abb5]" />,
        action: () => {
          onClose();
          onNewFile();
        },
      },
      {
        id: "new-folder",
        label: "New Folder...",
        category: "File",
        icon: <FolderPlus className="w-3.5 h-3.5 text-[#a5abb5]" />,
        action: () => {
          onClose();
          onNewFolder();
        },
      },
      {
        id: "new-project",
        label: "New Project...",
        category: "Project",
        icon: <Code2 className="w-3.5 h-3.5 text-cyan-400" />,
        action: () => {
          onClose();
          onNewProject();
        },
      },
      ...(onDeleteProject
        ? [
            {
              id: "delete-project",
              label: "Delete Active Project...",
              category: "Project" as const,
              icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
              action: () => {
                onClose();
                onDeleteProject();
              },
            },
          ]
        : []),
      {
        id: "export-zip",
        label: "Export Project (ZIP)",
        category: "Project",
        icon: <Download className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onExportZip();
        },
      },
      {
        id: "import-files",
        label: "Import Files / Folder",
        category: "Project",
        icon: <Upload className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onImportFiles();
        },
      },
      {
        id: "clear-terminal",
        label: "Clear Terminal Output",
        category: "Execution",
        icon: <RotateCcw className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onClearTerminal();
        },
      },
      {
        id: "storage-inspector",
        label: "Local Storage & Persistence Inspector",
        category: "Project",
        icon: <HardDrive className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onOpenStorageModal();
        },
      },
      {
        id: "runtimes-inspector",
        label: "System Compilers & Sandbox Runtimes",
        category: "Execution",
        icon: <Cpu className="w-3.5 h-3.5 text-[#858b94]" />,
        action: () => {
          onClose();
          onOpenRuntimesModal();
        },
      },
      ...(onBackToChat
        ? [
            {
              id: "back-to-chat",
              label: "Return to Chat Mode",
              category: "View" as const,
              icon: <MessageSquare className="w-3.5 h-3.5 text-[#858b94]" />,
              action: () => {
                onClose();
                onBackToChat();
              },
            },
          ]
        : []),
    ],
    [
      onClose,
      onRunProject,
      onSaveFile,
      onBuildProject,
      onTestProject,
      onToggleTerminal,
      onToggleAi,
      onToggleExplorer,
      onAiAction,
      onNewFile,
      onNewFolder,
      onNewProject,
      onExportZip,
      onImportFiles,
      onClearTerminal,
      onOpenStorageModal,
      onOpenRuntimesModal,
      onBackToChat,
    ]
  );

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!query.trim()) return allFiles;
    const q = query.toLowerCase();
    return allFiles.filter((f) => f.toLowerCase().includes(q));
  }, [allFiles, query]);

  // Filtered commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(q))
    );
  }, [commands, query]);

  const currentCount = mode === "commands" ? filteredCommands.length : filteredFiles.length;

  // Keyboard navigation within palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (currentCount > 0 ? (prev + 1) % currentCount : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (currentCount > 0 ? (prev - 1 + currentCount) % currentCount : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "commands" && filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      } else if (mode === "files" && filteredFiles[selectedIndex]) {
        onSelectFile(filteredFiles[selectedIndex]);
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/65 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#141518] border border-[#292c31] rounded-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mode Selector & Input Bar */}
        <div className="flex items-center px-3 h-10 border-b border-[#22252a] bg-[#111214] gap-2">
          {/* Segmented Mode Button */}
          <div className="flex items-center p-0.5 rounded-xs bg-[#0d0e10] border border-[#292c31] text-[10.5px] font-mono shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode("commands");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className={`px-2 h-5 rounded-xs font-medium cursor-pointer transition-colors ${
                mode === "commands"
                  ? "bg-[#22252a] text-cyan-300 font-semibold"
                  : "text-[#858b94] hover:text-[#d4d7dc]"
              }`}
            >
              &gt; Commands
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("files");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className={`px-2 h-5 rounded-xs font-medium cursor-pointer transition-colors ${
                mode === "files"
                  ? "bg-[#22252a] text-cyan-300 font-semibold"
                  : "text-[#858b94] hover:text-[#d4d7dc]"
              }`}
            >
              Files
            </button>
          </div>

          <div className="flex items-center flex-1 min-w-0 gap-1.5">
            {mode === "commands" ? (
              <span className="text-[#666c75] font-mono text-xs font-bold">&gt;</span>
            ) : (
              <Search className="w-3.5 h-3.5 text-[#666c75] shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "commands"
                  ? "Type a command or filter by category..."
                  : "Type name of file to open..."
              }
              className="flex-1 bg-transparent text-xs text-[#d4d7dc] placeholder-[#555a62] outline-none font-sans"
            />
          </div>

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-[#666c75] hover:text-[#d4d7dc] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[340px] overflow-y-auto py-1 font-mono text-xs bg-[#141518]"
        >
          {mode === "commands" ? (
            filteredCommands.length === 0 ? (
              <div className="px-4 py-6 text-center text-[#666c75] text-xs">
                No matching commands found.
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#1d2027] text-white border-l-2 border-cyan-400 pl-2.5"
                        : "text-[#a5abb5] hover:bg-[#181a1f] border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{cmd.icon}</span>
                      <span className="truncate font-medium">{cmd.label}</span>
                      <span className="text-[10px] text-[#555a62] uppercase tracking-wide">
                        [{cmd.category}]
                      </span>
                    </div>

                    {cmd.shortcut && (
                      <span className="text-[10.5px] font-mono px-1.5 py-0.5 rounded-xs bg-[#101114] text-[#858b94] border border-[#292c31] shrink-0 ml-2">
                        {cmd.shortcut}
                      </span>
                    )}
                  </div>
                );
              })
            )
          ) : filteredFiles.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#666c75] text-xs">
              No matching files found.
            </div>
          ) : (
            filteredFiles.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              const fileName = file.split("/").pop() || file;
              const dirPath = file.substring(0, file.lastIndexOf("/"));

              return (
                <div
                  key={file}
                  onClick={() => {
                    onSelectFile(file);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#1d2027] text-white border-l-2 border-cyan-400 pl-2.5"
                      : "text-[#a5abb5] hover:bg-[#181a1f] border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-medium text-[#d4d7dc] truncate">{fileName}</span>
                    {dirPath && (
                      <span className="text-[10.5px] text-[#555a62] truncate">
                        {dirPath}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info (22px) */}
        <div className="h-[22px] px-3 bg-[#0d0e10] border-t border-[#22252a] flex items-center justify-between text-[10px] font-mono text-[#555a62] select-none">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to dismiss</span>
          </div>
          <div>
            <span>Ctrl+P (Files) · Ctrl+Shift+P (Commands)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
