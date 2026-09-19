/**
 * LocalWorkspaceStorage — Primary client-side storage for Solix Workspace
 * 
 * Persists all projects, files, folders, settings, and editor state on the user's device
 * using browser IndexedDB ('solix-workspace-v1') and Origin Private File System (OPFS)
 * for large artifacts and binary caches.
 * 
 * Guarantees zero permanent server-side source code storage.
 */

import { FileNode, Problem, Workspace } from "@/types/workspace";
import JSZip from "jszip";

const DB_NAME = "solix-workspace-v1";
const DB_VERSION = 1;

export interface StoredFile {
  id: string; // `${workspaceId}:${path}`
  workspaceId: string;
  path: string; // e.g. 'main.py' or 'src/utils.py'
  name: string;
  type: "file";
  language: string;
  content: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  inOPFS?: boolean;
}

export interface StoredFolder {
  id: string; // `${workspaceId}:${path}`
  workspaceId: string;
  path: string;
  name: string;
  type: "folder";
  createdAt: number;
  updatedAt: number;
}

export interface StoredSettings {
  workspaceId: string;
  activeFile: string | null;
  openFiles: string[];
  lastResult?: any;
  updatedAt: number;
}

const LANGUAGE_EXT_MAP: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  md: "markdown",
  markdown: "markdown",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  txt: "plaintext",
};

export function detectFileLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_EXT_MAP[ext] || "plaintext";
}

// ── IndexedDB Database Helper ────────────────────────────────────────────────

function openWorkspaceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. workspaces
      if (!db.objectStoreNames.contains("workspaces")) {
        const wsStore = db.createObjectStore("workspaces", { keyPath: "id" });
        wsStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // 2. workspaceFiles
      if (!db.objectStoreNames.contains("workspaceFiles")) {
        const fileStore = db.createObjectStore("workspaceFiles", { keyPath: "id" });
        fileStore.createIndex("workspaceId", "workspaceId", { unique: false });
        fileStore.createIndex("path", ["workspaceId", "path"], { unique: true });
      }

      // 3. workspaceFolders
      if (!db.objectStoreNames.contains("workspaceFolders")) {
        const folderStore = db.createObjectStore("workspaceFolders", { keyPath: "id" });
        folderStore.createIndex("workspaceId", "workspaceId", { unique: false });
        folderStore.createIndex("path", ["workspaceId", "path"], { unique: true });
      }

      // 4. workspaceSettings
      if (!db.objectStoreNames.contains("workspaceSettings")) {
        db.createObjectStore("workspaceSettings", { keyPath: "workspaceId" });
      }

      // 5. editorState
      if (!db.objectStoreNames.contains("editorState")) {
        db.createObjectStore("editorState", { keyPath: "workspaceId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}

// ── OPFS (Origin Private File System) Helper ─────────────────────────────────

class OPFSHelper {
  private supported: boolean = false;
  private root: FileSystemDirectoryHandle | null = null;

  constructor() {
    if (typeof window !== "undefined" && navigator.storage && typeof navigator.storage.getDirectory === "function") {
      this.supported = true;
    }
  }

  async getRoot(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.supported) return null;
    if (!this.root) {
      try {
        this.root = await navigator.storage.getDirectory();
      } catch (e) {
        this.supported = false;
        return null;
      }
    }
    return this.root;
  }

  async writeOPFS(workspaceId: string, path: string, content: string): Promise<boolean> {
    const root = await this.getRoot();
    if (!root) return false;
    try {
      const wsDir = await root.getDirectoryHandle(workspaceId, { create: true });
      const parts = path.split("/").filter(Boolean);
      const filename = parts.pop()!;
      let curr = wsDir;
      for (const p of parts) {
        curr = await curr.getDirectoryHandle(p, { create: true });
      }
      const fileHandle = await curr.getFileHandle(filename, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      console.warn("OPFS write fallback:", err);
      return false;
    }
  }

  async readOPFS(workspaceId: string, path: string): Promise<string | null> {
    const root = await this.getRoot();
    if (!root) return null;
    try {
      const wsDir = await root.getDirectoryHandle(workspaceId);
      const parts = path.split("/").filter(Boolean);
      const filename = parts.pop()!;
      let curr = wsDir;
      for (const p of parts) {
        curr = await curr.getDirectoryHandle(p);
      }
      const fileHandle = await curr.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async deleteOPFS(workspaceId: string, path: string): Promise<boolean> {
    const root = await this.getRoot();
    if (!root) return false;
    try {
      const wsDir = await root.getDirectoryHandle(workspaceId);
      const parts = path.split("/").filter(Boolean);
      const filename = parts.pop()!;
      let curr = wsDir;
      for (const p of parts) {
        curr = await curr.getDirectoryHandle(p);
      }
      await curr.removeEntry(filename);
      return true;
    } catch {
      return false;
    }
  }

  async deleteWorkspaceOPFS(workspaceId: string): Promise<boolean> {
    const root = await this.getRoot();
    if (!root) return false;
    try {
      await root.removeEntry(workspaceId, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

const opfs = new OPFSHelper();

// ── Starter Templates ────────────────────────────────────────────────────────

export const STARTER_TEMPLATES: Record<string, { files: Array<{ path: string; content: string }> }> = {
  "starter-python": {
    files: [
      {
        path: "main.py",
        content: `"""
Solix Python Project
Browser-Local Execution via Pyodide WebAssembly
"""

def main():
    print("Hello from Solix Local-First Workspace!")
    print("Files and execution stay entirely on your device.")

if __name__ == "__main__":
    main()
`,
      },
      {
        path: "utils.py",
        content: `def format_output(message: str) -> str:
    return f"[Solix]: {message}"
`,
      },
      {
        path: "test_main.py",
        content: `import unittest
from utils import format_output

class TestMain(unittest.TestCase):
    def test_format_output(self):
        self.assertEqual(format_output("test"), "[Solix]: test")

if __name__ == "__main__":
    unittest.main()
`,
      },
      {
        path: "README.md",
        content: `# Local Python Workspace

This project runs 100% locally in your browser using WebAssembly.
Your code is never stored on a server.
`,
      },
    ],
  },
  "starter-web": {
    files: [
      {
        path: "index.js",
        content: `// Solix JavaScript / Node project
console.log("Hello from Solix Local JavaScript Worker!");

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const cart = [{ name: "Widget", price: 10 }, { name: "Gadget", price: 25 }];
console.log("Cart total:", calculateTotal(cart));
`,
      },
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "local-js-project",
            version: "1.0.0",
            description: "Solix Local-First Web Project",
            main: "index.js",
            scripts: { test: "node index.js" },
          },
          null,
          2
        ),
      },
      {
        path: "README.md",
        content: "# Local JavaScript Project\nRuns in an isolated browser Web Worker.",
      },
    ],
  },
  "starter-cpp": {
    files: [
      {
        path: "main.cpp",
        content: `// Solix C++ Starter
#include <iostream>

int main() {
    std::cout << "Solix C++ Project" << std::endl;
    std::cout << "Local project stored in IndexedDB." << std::endl;
    return 0;
}
`,
      },
      {
        path: "README.md",
        content: `# C++ Project

Project files are preserved locally in browser IndexedDB.
Connect the optional Solix Native Runtime for native GCC/Clang builds.
`,
      },
    ],
  },
};

// ── Main LocalWorkspaceStorage Class ─────────────────────────────────────────

export class LocalWorkspaceStorage {
  /**
   * List all stored workspaces, newest updated first.
   */
  async listWorkspaces(): Promise<Workspace[]> {
    if (typeof window === "undefined") return [];
    const db = await openWorkspaceDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readonly");
      const store = tx.objectStore("workspaces");
      const req = store.getAll();

      req.onsuccess = () => {
        const list: Workspace[] = req.result || [];
        list.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get single workspace metadata.
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    if (typeof window === "undefined") return null;
    const db = await openWorkspaceDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaces", "readonly");
      const store = tx.objectStore("workspaces");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Create a new workspace with starter files in local IndexedDB.
   */
  async createWorkspace(name: string, template: string = "starter-python"): Promise<Workspace> {
    const db = await openWorkspaceDB();
    const id = crypto.randomUUID ? crypto.randomUUID() : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    const ws: Workspace = {
      id,
      name: name.trim(),
      template,
      created_at: now,
      updated_at: now,
    };

    // Store workspace
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["workspaces", "workspaceSettings"], "readwrite");
      tx.objectStore("workspaces").put(ws);
      tx.objectStore("workspaceSettings").put({
        workspaceId: id,
        activeFile: template === "starter-web" ? "index.js" : template === "starter-cpp" ? "main.cpp" : "main.py",
        openFiles: [template === "starter-web" ? "index.js" : template === "starter-cpp" ? "main.cpp" : "main.py"],
        updatedAt: now,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Populate template files
    const tmpl = STARTER_TEMPLATES[template] || STARTER_TEMPLATES["starter-python"];
    for (const f of tmpl.files) {
      await this.writeFile(id, f.path, f.content);
    }

    return ws;
  }

  /**
   * Delete a workspace and all its local files, folders, settings, and OPFS caches.
   */
  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const db = await openWorkspaceDB();

    // Remove from IndexedDB
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["workspaces", "workspaceFiles", "workspaceFolders", "workspaceSettings", "editorState"],
        "readwrite"
      );

      tx.objectStore("workspaces").delete(workspaceId);
      tx.objectStore("workspaceSettings").delete(workspaceId);
      tx.objectStore("editorState").delete(workspaceId);

      // Delete files index
      const fileStore = tx.objectStore("workspaceFiles");
      const fileIdx = fileStore.index("workspaceId");
      const fileReq = fileIdx.openCursor(IDBKeyRange.only(workspaceId));
      fileReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete folders index
      const folderStore = tx.objectStore("workspaceFolders");
      const folderIdx = folderStore.index("workspaceId");
      const folderReq = folderIdx.openCursor(IDBKeyRange.only(workspaceId));
      folderReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Clean OPFS
    await opfs.deleteWorkspaceOPFS(workspaceId);
    return true;
  }

  /**
   * Read file content from local IndexedDB or OPFS.
   */
  async readFile(workspaceId: string, path: string): Promise<string> {
    const cleanPath = path.replace(/^[/\\]+/, "");
    const fileId = `${workspaceId}:${cleanPath}`;
    const db = await openWorkspaceDB();

    const storedFile: StoredFile | null = await new Promise((resolve, reject) => {
      const tx = db.transaction("workspaceFiles", "readonly");
      const store = tx.objectStore("workspaceFiles");
      const req = store.get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (!storedFile) {
      throw new Error(`File not found: ${cleanPath}`);
    }

    if (storedFile.inOPFS) {
      const opfsContent = await opfs.readOPFS(workspaceId, cleanPath);
      if (opfsContent !== null) return opfsContent;
    }

    return storedFile.content;
  }

  /**
   * Write or update a file in local IndexedDB (and OPFS if large > 500KB).
   */
  async writeFile(workspaceId: string, path: string, content: string): Promise<StoredFile> {
    const cleanPath = path.replace(/^[/\\]+/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const filename = parts[parts.length - 1];
    const now = Date.now();
    const size = new Blob([content]).size;
    const fileId = `${workspaceId}:${cleanPath}`;

    // Ensure parent folders are registered
    if (parts.length > 1) {
      let cumulative = "";
      for (let i = 0; i < parts.length - 1; i++) {
        cumulative = cumulative ? `${cumulative}/${parts[i]}` : parts[i];
        await this.createFolder(workspaceId, cumulative);
      }
    }

    const isLarge = size > 500 * 1024;
    let storedContent = content;
    let inOPFS = false;

    if (isLarge) {
      const wrote = await opfs.writeOPFS(workspaceId, cleanPath, content);
      if (wrote) {
        inOPFS = true;
        storedContent = ""; // store content in OPFS, keep metadata in IndexedDB
      }
    }

    const storedFile: StoredFile = {
      id: fileId,
      workspaceId,
      path: cleanPath,
      name: filename,
      type: "file",
      language: detectFileLanguage(filename),
      content: storedContent,
      size,
      createdAt: now,
      updatedAt: now,
      inOPFS,
    };

    const db = await openWorkspaceDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["workspaceFiles", "workspaces"], "readwrite");
      tx.objectStore("workspaceFiles").put(storedFile);

      // Update workspace timestamp
      const wsStore = tx.objectStore("workspaces");
      const wsReq = wsStore.get(workspaceId);
      wsReq.onsuccess = () => {
        if (wsReq.result) {
          wsReq.result.updated_at = now;
          wsStore.put(wsReq.result);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return storedFile;
  }

  /**
   * Delete a file from local IndexedDB and OPFS.
   */
  async deleteFile(workspaceId: string, path: string): Promise<boolean> {
    const cleanPath = path.replace(/^[/\\]+/, "");
    const fileId = `${workspaceId}:${cleanPath}`;
    const db = await openWorkspaceDB();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspaceFiles", "readwrite");
      tx.objectStore("workspaceFiles").delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await opfs.deleteOPFS(workspaceId, cleanPath);
    return true;
  }

  /**
   * Create folder entry in local IndexedDB.
   */
  async createFolder(workspaceId: string, path: string): Promise<StoredFolder> {
    const cleanPath = path.replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const folderName = parts[parts.length - 1] || cleanPath;
    const folderId = `${workspaceId}:${cleanPath}`;
    const now = Date.now();

    const storedFolder: StoredFolder = {
      id: folderId,
      workspaceId,
      path: cleanPath,
      name: folderName,
      type: "folder",
      createdAt: now,
      updatedAt: now,
    };

    const db = await openWorkspaceDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspaceFolders", "readwrite");
      tx.objectStore("workspaceFolders").put(storedFolder);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return storedFolder;
  }

  /**
   * Delete folder and all nested files/folders.
   */
  async deleteFolder(workspaceId: string, path: string): Promise<boolean> {
    const cleanPath = path.replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
    const prefix = `${cleanPath}/`;
    const db = await openWorkspaceDB();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["workspaceFiles", "workspaceFolders"], "readwrite");
      const fileStore = tx.objectStore("workspaceFiles");
      const folderStore = tx.objectStore("workspaceFolders");

      // Delete self folder
      folderStore.delete(`${workspaceId}:${cleanPath}`);

      // Delete nested folders
      const folderIdx = folderStore.index("workspaceId");
      const folderReq = folderIdx.openCursor(IDBKeyRange.only(workspaceId));
      folderReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.path.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      // Delete nested files
      const fileIdx = fileStore.index("workspaceId");
      const fileReq = fileIdx.openCursor(IDBKeyRange.only(workspaceId));
      fileReq.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.path.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return true;
  }

  /**
   * Rename a path (file or folder) in local storage.
   */
  async renamePath(workspaceId: string, oldPath: string, newPath: string): Promise<boolean> {
    const cleanOld = oldPath.replace(/^[/\\]+/, "");
    const cleanNew = newPath.replace(/^[/\\]+/, "");

    // Try reading as file
    try {
      const content = await this.readFile(workspaceId, cleanOld);
      await this.writeFile(workspaceId, cleanNew, content);
      await this.deleteFile(workspaceId, cleanOld);
      return true;
    } catch {
      // Is a folder: update all nested files and folders
      const files = await this.getAllFiles(workspaceId);
      for (const f of files) {
        if (f.path === cleanOld || f.path.startsWith(`${cleanOld}/`)) {
          const suffix = f.path.slice(cleanOld.length);
          const nextPath = `${cleanNew}${suffix}`;
          const content = f.inOPFS ? (await opfs.readOPFS(workspaceId, f.path)) || "" : f.content;
          await this.writeFile(workspaceId, nextPath, content);
          await this.deleteFile(workspaceId, f.path);
        }
      }
      await this.deleteFolder(workspaceId, cleanOld);
      await this.createFolder(workspaceId, cleanNew);
      return true;
    }
  }

  /**
   * Retrieve all files for a workspace.
   */
  async getAllFiles(workspaceId: string): Promise<StoredFile[]> {
    if (typeof window === "undefined") return [];
    const db = await openWorkspaceDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaceFiles", "readonly");
      const idx = tx.objectStore("workspaceFiles").index("workspaceId");
      const req = idx.getAll(IDBKeyRange.only(workspaceId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve all folders for a workspace.
   */
  async getAllFolders(workspaceId: string): Promise<StoredFolder[]> {
    if (typeof window === "undefined") return [];
    const db = await openWorkspaceDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspaceFolders", "readonly");
      const idx = tx.objectStore("workspaceFolders").index("workspaceId");
      const req = idx.getAll(IDBKeyRange.only(workspaceId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Build recursive hierarchical FileNode[] tree for UI file explorer.
   */
  async getFileTree(workspaceId: string): Promise<FileNode[]> {
    const [files, folders] = await Promise.all([
      this.getAllFiles(workspaceId),
      this.getAllFolders(workspaceId),
    ]);

    interface TempDir {
      name: string;
      path: string;
      is_directory: true;
      children: Map<string, FileNode>;
    }

    const rootChildren = new Map<string, FileNode>();
    const dirMap = new Map<string, TempDir>();

    // 1. Register folders
    for (const f of folders) {
      const parts = f.path.split("/").filter(Boolean);
      let currPath = "";
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const parentPath = currPath;
        currPath = currPath ? `${currPath}/${seg}` : seg;

        if (!dirMap.has(currPath)) {
          const dirObj: TempDir = {
            name: seg,
            path: currPath,
            is_directory: true,
            children: new Map(),
          };
          dirMap.set(currPath, dirObj);

          if (!parentPath) {
            rootChildren.set(seg, dirObj as unknown as FileNode);
          } else if (dirMap.has(parentPath)) {
            dirMap.get(parentPath)!.children.set(seg, dirObj as unknown as FileNode);
          }
        }
      }
    }

    // 2. Insert files
    for (const file of files) {
      const parts = file.path.split("/").filter(Boolean);
      const filename = parts.pop()!;
      const parentPath = parts.join("/");

      const fileObj: FileNode = {
        name: filename,
        path: file.path,
        is_directory: false,
        size: file.size,
        updated_at: file.updatedAt,
        language: file.language,
      };

      if (!parentPath) {
        rootChildren.set(filename, fileObj);
      } else {
        // Ensure parent dirs exist
        let currPath = "";
        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i];
          const prev = currPath;
          currPath = currPath ? `${currPath}/${seg}` : seg;
          if (!dirMap.has(currPath)) {
            const dirObj: TempDir = {
              name: seg,
              path: currPath,
              is_directory: true,
              children: new Map(),
            };
            dirMap.set(currPath, dirObj);
            if (!prev) {
              rootChildren.set(seg, dirObj as unknown as FileNode);
            } else if (dirMap.has(prev)) {
              dirMap.get(prev)!.children.set(seg, dirObj as unknown as FileNode);
            }
          }
        }
        dirMap.get(parentPath)?.children.set(filename, fileObj);
      }
    }

    // 3. Convert children Maps to sorted arrays
    function finalize(node: any): FileNode {
      if (node.is_directory && node.children instanceof Map) {
        const arr = Array.from(node.children.values()).map(finalize);
        // Sort: directories first, then alphabetical
        arr.sort((a, b) => {
          if (a.is_directory === b.is_directory) return a.name.localeCompare(b.name);
          return a.is_directory ? -1 : 1;
        });
        node.children = arr;
      }
      return node;
    }

    const tree = Array.from(rootChildren.values()).map(finalize);
    tree.sort((a, b) => {
      if (a.is_directory === b.is_directory) return a.name.localeCompare(b.name);
      return a.is_directory ? -1 : 1;
    });

    return tree;
  }

  /**
   * Search files for symbol or keyword across local workspace.
   */
  async searchFiles(workspaceId: string, query: string): Promise<Array<{ file: string; line: number; text: string }>> {
    const files = await this.getAllFiles(workspaceId);
    const results: Array<{ file: string; line: number; text: string }> = [];
    const qLower = query.toLowerCase();

    for (const f of files) {
      const content = f.inOPFS ? (await opfs.readOPFS(workspaceId, f.path)) || "" : f.content;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(qLower)) {
          results.push({
            file: f.path,
            line: i + 1,
            text: lines[i].trim(),
          });
          if (results.length >= 100) return results;
        }
      }
    }
    return results;
  }

  /**
   * Export workspace to client-side ZIP archive.
   * Completely local in browser — zero server uploads.
   */
  async exportWorkspace(workspaceId: string): Promise<Blob> {
    const files = await this.getAllFiles(workspaceId);
    const zip = new JSZip();

    for (const f of files) {
      const content = f.inOPFS ? (await opfs.readOPFS(workspaceId, f.path)) || "" : f.content;
      zip.file(f.path, content);
    }

    return await zip.generateAsync({ type: "blob" });
  }

  /**
   * Import project files from user's filesystem (webkitdirectory or drag & drop).
   * All files stay 100% local on device.
   */
  async importFiles(workspaceId: string, fileList: Array<{ path: string; content: string }>): Promise<number> {
    let imported = 0;
    for (const item of fileList) {
      if (item.path && typeof item.content === "string") {
        await this.writeFile(workspaceId, item.path, item.content);
        imported++;
      }
    }
    return imported;
  }

  /**
   * Calculate local storage usage (bytes & file count).
   */
  async getStorageUsage(workspaceId: string): Promise<{ bytes: number; fileCount: number }> {
    const files = await this.getAllFiles(workspaceId);
    let bytes = 0;
    for (const f of files) {
      bytes += f.size || 0;
    }
    return { bytes, fileCount: files.length };
  }

  /**
   * Load and save workspace UI settings (open tabs, active file).
   */
  async getSettings(workspaceId: string): Promise<StoredSettings | null> {
    if (typeof window === "undefined") return null;
    const db = await openWorkspaceDB();
    return new Promise((resolve) => {
      const tx = db.transaction("workspaceSettings", "readonly");
      const req = tx.objectStore("workspaceSettings").get(workspaceId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async saveSettings(settings: StoredSettings): Promise<void> {
    if (typeof window === "undefined") return;
    const db = await openWorkspaceDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("workspaceSettings", "readwrite");
      tx.objectStore("workspaceSettings").put({ ...settings, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const workspaceStorage = new LocalWorkspaceStorage();

