"use client";

import React, { useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { FileNode } from "@/types/workspace";

interface FileExplorerProps {
  tree: FileNode[];
  activeFile: string | null;
  projectName?: string;
  onSelectFile: (path: string) => void;
  onCreateFileOrDir: (path: string, isDirectory: boolean) => Promise<void>;
  onDeletePath: (path: string) => Promise<void>;
  onRenamePath: (oldPath: string, newPath: string) => Promise<void>;
  onExportZip?: () => Promise<void>;
  onImportFiles?: (files: Array<{ path: string; content: string }>) => Promise<number | void>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activeFile,
  projectName = "PROJECT",
  onSelectFile,
  onCreateFileOrDir,
  onDeletePath,
  onRenamePath,
  onExportZip,
  onImportFiles,
}) => {
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newPathInput, setNewPathInput] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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

  // Process a standard FileList from input
  const processFileList = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onImportFiles) return;
    setIsImporting(true);
    try {
      const items: Array<{ path: string; content: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let relPath = file.webkitRelativePath || file.name;
        const parts = relPath.split("/").filter(Boolean);
        if (parts.length > 1) {
          relPath = parts.slice(1).join("/");
        }
        if (!relPath) relPath = file.name;

        if (relPath.startsWith(".git/") || relPath.includes("/.git/") || relPath === ".DS_Store") {
          continue;
        }

        try {
          const content = await file.text();
          items.push({ path: relPath, content });
        } catch {
          // Binary or unreadable
        }
      }

      if (items.length > 0) {
        await onImportFiles(items);
      }
    } catch (err: any) {
      console.error("Import error:", err);
      alert("Failed to import files: " + (err.message || "Unknown error"));
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Drag & Drop Directory / File Traversal
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const traverseEntry = async (
    entry: any,
    currentPath: string = ""
  ): Promise<Array<{ path: string; content: string }>> => {
    const results: Array<{ path: string; content: string }> = [];

    if (entry.isFile) {
      const file: File = await new Promise((res, rej) => entry.file(res, rej));
      const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      try {
        const text = await file.text();
        results.push({ path: fullPath, content: text });
      } catch {
        // Skip unreadable files
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries: any[] = await new Promise((res, rej) => {
        const all: any[] = [];
        const readNext = () => {
          dirReader.readEntries((batch: any[]) => {
            if (batch.length === 0) {
              res(all);
            } else {
              all.push(...batch);
              readNext();
            }
          }, rej);
        };
        readNext();
      });

      const nextBase = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const child of entries) {
        if (child.name === ".git" || child.name === "node_modules") continue;
        const sub = await traverseEntry(child, nextBase);
        results.push(...sub);
      }
    }

    return results;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingOver(false);

    if (!onImportFiles) return;

    setIsImporting(true);
    try {
      const items: Array<{ path: string; content: string }> = [];
      const dtItems = e.dataTransfer.items;

      if (dtItems && dtItems.length > 0) {
        for (let i = 0; i < dtItems.length; i++) {
          const item = dtItems[i];
          const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
          if (entry) {
            if (entry.isDirectory) {
              const dirReader = entry.createReader();
              const entries: any[] = await new Promise((res, rej) => {
                const all: any[] = [];
                const readNext = () => {
                  dirReader.readEntries((batch: any[]) => {
                    if (batch.length === 0) {
                      res(all);
                    } else {
                      all.push(...batch);
                      readNext();
                    }
                  }, rej);
                };
                readNext();
              });

              for (const child of entries) {
                if (child.name === ".git" || child.name === "node_modules") continue;
                const sub = await traverseEntry(child, "");
                items.push(...sub);
              }
            } else {
              const fileSub = await traverseEntry(entry, "");
              items.push(...fileSub);
            }
          } else {
            const f = item.getAsFile();
            if (f) {
              const text = await f.text();
              items.push({ path: f.name, content: text });
            }
          }
        }
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          const text = await f.text();
          items.push({ path: f.name, content: text });
        }
      }

      if (items.length > 0) {
        await onImportFiles(items);
      }
    } catch (err: any) {
      console.error("Drop import failed:", err);
      alert("Failed to import dropped files: " + (err.message || "Unknown error"));
    } finally {
      setIsImporting(false);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "py" || ext === "js" || ext === "ts" || ext === "tsx" || ext === "jsx") {
      return <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
    if (ext === "md" || ext === "txt") {
      return <FileText className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
    }
    if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml") {
      return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-[#858b94] shrink-0" />;
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
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
        >
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            autoFocus
            onBlur={() => setEditingPath(null)}
            className="w-full bg-[#1b1d22] text-xs text-[#d4d7dc] px-2 py-0.5 rounded-xs border border-[#3a3d43] outline-none"
          />
        </form>
      );
    }

    return (
      <div key={node.path}>
        <div
          onClick={() => (isDir ? toggleDir(node.path) : onSelectFile(node.path))}
          className={`group flex items-center justify-between h-7 px-2 text-xs cursor-pointer select-none transition-colors ${
            isActive
              ? "bg-[#1d2026] text-white font-medium border-l-2 border-cyan-500"
              : "text-[#858b94] hover:bg-[#151619] hover:text-[#d4d7dc] border-l-2 border-transparent"
          }`}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
            {isDir ? (
              <>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-[#666c75] shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-[#666c75] shrink-0" />
                )}
                <Folder className="w-3.5 h-3.5 text-[#e5a855] shrink-0" />
              </>
            ) : (
              getFileIcon(node.name)
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {/* Action buttons on hover */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 pr-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingPath(node.path);
                setRenameInput(node.path);
              }}
              className="p-1 hover:text-white rounded-xs text-[#666c75] hover:bg-[#22252b] transition-colors"
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
              className="p-1 hover:text-rose-400 rounded-xs text-[#666c75] hover:bg-[#22252b] transition-colors"
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
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative h-full flex flex-col bg-[#111214] border-r border-[#292c31] select-none"
    >
      {/* Hidden File / Folder Inputs */}
      <input
        type="file"
        ref={folderInputRef}
        {...({ webkitdirectory: "", directory: "" } as any)}
        multiple
        className="hidden"
        onChange={(e) => {
          processFileList(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => {
          processFileList(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Top Header: Classic IDE Explorer Header (32px) */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-[#292c31] bg-[#111214]">
        <span className="text-[10.5px] font-mono font-semibold text-[#858b94] uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewPathInput("");
            }}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
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
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          {onImportFiles && (
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="p-1 rounded-xs text-[#858b94] hover:text-cyan-400 hover:bg-[#1a1c21] transition-colors cursor-pointer"
              title="Import Folder into Workspace"
            >
              <FolderUp className="w-3.5 h-3.5" />
            </button>
          )}

          {onExportZip && (
            <button
              type="button"
              onClick={() => onExportZip()}
              className="p-1 rounded-xs text-[#858b94] hover:text-emerald-400 hover:bg-[#1a1c21] transition-colors cursor-pointer"
              title="Export Project as ZIP"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* New File / Folder Input Prompt */}
      {(isCreatingFile || isCreatingFolder) && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-[#292c31] bg-[#151619]">
          <div className="text-[10px] text-cyan-400 font-medium mb-1">
            {isCreatingFolder ? "New Folder Name:" : "New File Path (e.g. src/utils.py):"}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              placeholder={isCreatingFolder ? "folder_name" : "filename.py"}
              autoFocus
              className="flex-1 bg-[#0d0e10] text-xs text-[#d4d7dc] px-2 py-1 rounded-xs border border-[#292c31] outline-none"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded-xs bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
              className="px-1.5 py-1 rounded-xs text-[#858b94] hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </form>
      )}

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-30 bg-[#0d0e10]/90 border-2 border-dashed border-cyan-500/80 flex flex-col items-center justify-center p-4 text-center">
          <Upload className="w-6 h-6 text-cyan-400 mb-2" />
          <div className="text-xs font-semibold text-white">Drop to import into workspace</div>
          <div className="text-[10.5px] text-[#858b94] mt-0.5">
            Files stored locally on device
          </div>
        </div>
      )}

      {/* Importing Loader Indicator */}
      {isImporting && (
        <div className="px-3 py-1 bg-cyan-950/40 border-b border-cyan-900/50 flex items-center gap-2 text-xs text-cyan-300">
          <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px]">Importing files locally...</span>
        </div>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
        {/* Project root folder header */}
        <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono text-[#858b94] uppercase tracking-wide">
          <ChevronDown className="w-3 h-3 text-[#666c75]" />
          <span className="truncate">{projectName}</span>
        </div>

        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#525760] italic">
            Workspace is empty. Create a file or drop a folder to start.
          </div>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  );
};
