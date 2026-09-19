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
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solix Web Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="app-container">
    <header class="header">
      <div class="badge">Local Web Development</div>
      <h1>Welcome to Solix Web</h1>
      <p class="subtitle">Edit HTML, CSS, and JavaScript with instant live preview.</p>
    </header>

    <section class="interactive-card">
      <div class="counter-display">
        <span class="label">Click Counter</span>
        <span id="counter" class="count">0</span>
      </div>
      <div class="actions">
        <button id="increment-btn" class="btn primary">Click Me</button>
        <button id="reset-btn" class="btn secondary">Reset</button>
      </div>
      <p id="status-text" class="status-msg">Click the button to test live JavaScript!</p>
    </section>

    <footer class="footer">
      <span>100% Client-side sandbox · Instant reload</span>
    </footer>
  </main>

  <script src="script.js"></script>
</body>
</html>
`,
      },
      {
        path: "style.css",
        content: `:root {
  --bg: #0d0f12;
  --surface: #15181e;
  --border: #262930;
  --text: #f0f2f5;
  --muted: #8c929d;
  --accent: #38bdf8;
  --accent-hover: #0ea5e9;
  --radius: 10px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.app-container {
  width: 100%;
  max-width: 540px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  text-align: center;
}

.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 4px 10px;
  border-radius: 9999px;
  margin-bottom: 14px;
}

h1 {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.subtitle {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 24px;
}

.interactive-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 20px;
}

.counter-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

.counter-display .label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.counter-display .count {
  font-size: 42px;
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 14px;
}

.btn {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn.primary {
  background: var(--accent);
  color: #030712;
}

.btn.primary:hover {
  background: var(--accent-hover);
}

.btn.secondary {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}

.btn.secondary:hover {
  background: rgba(255, 255, 255, 0.06);
}

.status-msg {
  font-size: 12px;
  color: var(--muted);
}

.footer {
  font-size: 11px;
  color: var(--muted);
  opacity: 0.8;
}
`,
      },
      {
        path: "script.js",
        content: `// Solix Web Starter Script
console.log("🚀 Solix Web Preview loaded successfully!");

let count = 0;
const counterEl = document.getElementById("counter");
const incrementBtn = document.getElementById("increment-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status-text");

if (incrementBtn && counterEl) {
  incrementBtn.addEventListener("click", () => {
    count++;
    counterEl.textContent = count;
    statusEl.textContent = \`Updated! Count is now \${count}.\`;
    console.log(\`[Counter]: Button clicked, count = \${count}\`);
  });
}

if (resetBtn && counterEl) {
  resetBtn.addEventListener("click", () => {
    count = 0;
    counterEl.textContent = count;
    statusEl.textContent = "Counter reset to 0.";
    console.info("[Counter]: Reset to 0");
  });
}
`,
      },
      {
        path: "README.md",
        content: `# Solix Web Project

A browser-based HTML, CSS, and JavaScript project with live preview.

## Features
- **Instant Live Preview**: Automatically updates when you edit code.
- **Isolated Sandbox**: Runs securely inside a browser iframe.
- **Console Inspector**: Captures \`console.log\` messages and runtime errors in real time.
- **Local-First**: All files persist locally in your browser IndexedDB.
`,
      },
    ],
  },
  "starter-web-blank": {
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blank Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Blank Website</h1>
  <p>Start building your HTML, CSS, and JavaScript application.</p>
  <script src="script.js"></script>
</body>
</html>
`,
      },
      {
        path: "style.css",
        content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  padding: 2rem;
  background: #0f172a;
  color: #f8fafc;
}
`,
      },
      {
        path: "script.js",
        content: `// Blank Web Application
console.log("Website initialized.");
`,
      },
    ],
  },
  "starter-web-landing": {
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern Landing Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="nav">
    <div class="logo">✦ Aurora</div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <button class="nav-btn">Get Started</button>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-badge">Next-Gen Web Architecture</div>
    <h1 class="hero-title">Build faster, deliver sooner with Aurora.</h1>
    <p class="hero-sub">The modern toolset designed for engineering teams that ship remarkable digital experiences.</p>
    <div class="hero-cta">
      <button id="primary-cta" class="btn primary">Start Free Trial</button>
      <button class="btn ghost">View Documentation</button>
    </div>
  </header>

  <section id="features" class="features">
    <div class="card">
      <div class="icon">⚡</div>
      <h3>Lightning Speed</h3>
      <p>Sub-millisecond latency and edge delivery straight to your users.</p>
    </div>
    <div class="card">
      <div class="icon">🔒</div>
      <h3>Zero-Trust Security</h3>
      <p>End-to-end encrypted execution sandboxes for total isolation.</p>
    </div>
    <div class="card">
      <div class="icon">📈</div>
      <h3>Real-Time Analytics</h3>
      <p>Live metrics and performance tracing without telemetry bloat.</p>
    </div>
  </section>

  <script src="script.js"></script>
</body>
</html>
`,
      },
      {
        path: "style.css",
        content: `:root {
  --bg: #090b10;
  --surface: #11141c;
  --border: #1f2430;
  --text: #f1f5f9;
  --muted: #94a3b8;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.6;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 40px;
  border-bottom: 1px solid var(--border);
}
.logo { font-weight: 700; font-size: 18px; letter-spacing: -0.02em; color: var(--primary); }
.nav-links { display: flex; gap: 24px; align-items: center; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; }
.nav-links a:hover { color: var(--text); }
.nav-btn {
  padding: 7px 16px;
  background: var(--primary);
  border: 0;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.hero {
  max-width: 780px;
  margin: 60px auto 40px;
  text-align: center;
  padding: 0 20px;
}
.hero-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 16px;
}
.hero-title { font-size: 42px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.2; margin-bottom: 16px; }
.hero-sub { font-size: 16px; color: var(--muted); margin-bottom: 28px; }
.hero-cta { display: flex; gap: 12px; justify-content: center; }

.btn {
  padding: 10px 22px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn.primary { background: var(--primary); color: white; }
.btn.primary:hover { background: var(--primary-hover); }
.btn.ghost { background: transparent; color: var(--text); border-color: var(--border); }
.btn.ghost:hover { background: rgba(255, 255, 255, 0.05); }

.features {
  max-width: 960px;
  margin: 40px auto 80px;
  padding: 0 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
}
.card .icon { font-size: 24px; margin-bottom: 12px; }
.card h3 { font-size: 16px; margin-bottom: 8px; }
.card p { font-size: 13.5px; color: var(--muted); }
`,
      },
      {
        path: "script.js",
        content: `// Landing page interactive behaviors
console.log("Landing page loaded.");

document.getElementById("primary-cta")?.addEventListener("click", () => {
  alert("Thank you for trying Aurora!");
  console.log("User converted on hero CTA");
});
`,
      },
    ],
  },
  "starter-web-app": {
    files: [
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quick Tasks SPA</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <header>
      <h1>Task Board</h1>
      <p id="task-summary">0 tasks remaining</p>
    </header>

    <form id="todo-form">
      <input id="todo-input" type="text" placeholder="Add a new task..." required autocomplete="off">
      <button type="submit">Add Task</button>
    </form>

    <ul id="todo-list"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
      },
      {
        path: "style.css",
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #0f1117;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  display: flex;
  justify-content: center;
  padding: 40px 16px;
}
.app {
  width: 100%;
  max-width: 440px;
  background: #181b24;
  border: 1px solid #272c3b;
  border-radius: 10px;
  padding: 24px;
}
header { margin-bottom: 20px; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
#task-summary { font-size: 13px; color: #818cf8; }

#todo-form { display: flex; gap: 8px; margin-bottom: 20px; }
#todo-input {
  flex: 1;
  background: #0f1117;
  border: 1px solid #272c3b;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  outline: none;
}
#todo-input:focus { border-color: #6366f1; }
#todo-form button {
  background: #6366f1;
  border: 0;
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

#todo-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #0f1117;
  border: 1px solid #202430;
  border-radius: 6px;
  font-size: 13.5px;
}
.todo-item.completed span { text-decoration: line-through; opacity: 0.5; }
.todo-item button { background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; }
`,
      },
      {
        path: "script.js",
        content: `// Task Manager SPA
console.log("Task manager initialized.");

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const summary = document.getElementById("task-summary");

let tasks = [
  { id: 1, text: "Explore Solix Web Preview", completed: true },
  { id: 2, text: "Test live HTML/CSS updates", completed: false }
];

function render() {
  list.innerHTML = "";
  tasks.forEach((t) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (t.completed ? " completed" : "");
    li.innerHTML = \`
      <span style="cursor:pointer;">\${t.text}</span>
      <button data-id="\${t.id}">✕</button>
    \`;

    li.querySelector("span").addEventListener("click", () => {
      t.completed = !t.completed;
      render();
    });

    li.querySelector("button").addEventListener("click", () => {
      tasks = tasks.filter((item) => item.id !== t.id);
      render();
    });

    list.appendChild(li);
  });

  const pending = tasks.filter((t) => !t.completed).length;
  summary.textContent = \`\${pending} task\${pending === 1 ? "" : "s"} remaining\`;
  console.log(\`Rendered \${tasks.length} tasks (\${pending} remaining)\`);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = input.value.trim();
  if (!val) return;
  tasks.push({ id: Date.now(), text: val, completed: false });
  input.value = "";
  render();
});

render();
`,
      },
    ],
  },
  "starter-js": {
    files: [
      {
        path: "index.js",
        content: `// Solix JavaScript Worker project
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

    const initialActiveFile = template.startsWith("starter-web")
      ? "index.html"
      : template === "starter-js"
      ? "index.js"
      : template === "starter-cpp"
      ? "main.cpp"
      : "main.py";

    // Store workspace
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["workspaces", "workspaceSettings"], "readwrite");
      tx.objectStore("workspaces").put(ws);
      tx.objectStore("workspaceSettings").put({
        workspaceId: id,
        activeFile: initialActiveFile,
        openFiles: [initialActiveFile],
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

