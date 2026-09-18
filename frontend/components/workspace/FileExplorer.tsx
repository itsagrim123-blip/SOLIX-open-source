"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { FileNode } from "@/types/workspace";

interface FileExplorerProps {
  tree: FileNode[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFileOrDir: (path: string, isDirectory: boolean) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  onRenamePath: (oldPath: string, newPath: string) => Promise<void>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activeFile,
  onSelectFile,
  onCreateFileOrDir,
  onDeletePath,
  onRenamePath,
}) => {
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newPathInput, setNewPathInput] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const toggleDir = (path: string) => {
    setCollapsedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathInput.trim()) return;
    try {
      await onCreateFileOrDir(newPathInput.trim(), isCreatingFolder);
      setNewPathInput("");
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
    } catch (err: any) {
      alert(err.message || "Failed to create");
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent, oldPath: string) => {
    e.preventDefault();
    if (!renameInput.trim() || renameInput.trim() === oldPath) {
      setEditingPath(null);
      return;
    }
    try {
      await onRenamePath(oldPath, renameInput.trim());
      setEditingPath(null);
      setRenameInput("");
    } catch (err: any) {
      alert(err.message || "Failed to rename");
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "py" || ext === "js" || ext === "ts" || ext === "tsx" || ext === "jsx") {
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />;
    }
    if (ext === "md" || ext === "txt") {
      return <FileText className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />;
    }
    if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml") {
      return <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-[#8f9299] flex-shrink-0" />;
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isDir = node.is_directory;
    const isCollapsed = isDir && collapsedDirs[node.path];
    const isActive = !isDir && activeFile === node.path;
    const isEditing = editingPath === node.path;

    if (isEditing) {
      return (
        <form
          key={node.path}
          onSubmit={(e) => handleRenameSubmit(e, node.path)}
          className="px-2 py-0.5"
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
        >
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            autoFocus
            onBlur={() => setEditingPath(null)}
            className="w-full bg-[#1b1d22] text-xs text-white px-2 py-0.5 rounded border border-[#3a3d43] outline-none"
          />
        </form>
      );
    }

    return (
      <div key={node.path}>
        <div
          onClick={() => (isDir ? toggleDir(node.path) : onSelectFile(node.path))}
          className={`group flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer select-none transition-colors ${
            isActive
              ? "bg-[#191b20] text-white font-medium border border-[#303238]"
              : "text-[#a5a7ad] hover:bg-[#15171a] hover:text-[#eeeeec] border border-transparent"
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
            {isDir ? (
              <>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
                )}
                <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              </>
            ) : (
              getFileIcon(node.name)
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {/* Action buttons on hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingPath(node.path);
                setRenameInput(node.path);
              }}
              className="p-1 hover:text-white rounded text-[#8f9299] transition-colors"
              title="Rename"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${node.name}?`)) {
                  onDeletePath(node.path);
                }
              }}
              className="p-1 hover:text-rose-400 rounded text-[#8f9299] transition-colors"
              title="Delete"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {isDir && !isCollapsed && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#111215] border-r border-[#24262b] select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#24262b] bg-[#141518]">
        <span className="text-[11px] font-bold text-[#8f9299] uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewPathInput("");
            }}
            className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-[#1e2025] transition-colors cursor-pointer"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setNewPathInput("");
            }}
            className="p-1 rounded text-[#8f9299] hover:text-white hover:bg-[#1e2025] transition-colors cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* New File / Folder Input Prompt */}
      {(isCreatingFile || isCreatingFolder) && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-[#24262b] bg-[#16171c]">
          <div className="text-[10px] text-cyan-400 font-medium mb-1">
            {isCreatingFolder ? "New Folder Path:" : "New File Path (e.g. src/utils.py):"}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              placeholder={isCreatingFolder ? "folder_name" : "filename.py"}
              autoFocus
              className="flex-1 bg-[#111215] text-xs text-white px-2 py-1 rounded border border-[#303238] outline-none"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
              className="px-1.5 py-1 rounded text-[#8f9299] hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </form>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#666970] italic">
            Workspace is empty. Create a file to get started.
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};

