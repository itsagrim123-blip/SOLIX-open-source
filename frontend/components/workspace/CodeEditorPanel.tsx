"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import { Play, PlayCircle, Save, X } from "lucide-react";

// Dynamically load Monaco Editor with SSR disabled
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-xs text-[#8f9299] gap-2">
        <div className="w-5 h-5 border-2 border-[#3a3d43] border-t-cyan-400 rounded-full animate-spin" />
        <span>Loading Editor...</span>
      </div>
    ),
  }
);

interface CodeEditorPanelProps {
  openFiles: string[];
  activeFile: string | null;
  fileContents: Record<string, string>;
  dirtyFiles: Record<string, string>;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onUpdateContent: (path: string, content: string) => void;
  onSaveFile: (path?: string) => Promise<void>;
  onRun: () => void;
  onTest: () => void;
  isRunning: boolean;
  onSelectionChange: (code: string, range: { start: number; end: number } | null) => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  css: "css",
  md: "markdown",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  sql: "sql",
  sh: "shell",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
};

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  openFiles,
  activeFile,
  fileContents,
  dirtyFiles,
  onSelectFile,
  onCloseFile,
  onUpdateContent,
  onSaveFile,
  onRun,
  onTest,
  isRunning,
  onSelectionChange,
}) => {
  const editorRef = useRef<any>(null);

  const activeContent = activeFile
    ? dirtyFiles[activeFile] !== undefined
      ? dirtyFiles[activeFile]
      : fileContents[activeFile] || ""
    : "";

  const isDirty = activeFile ? dirtyFiles[activeFile] !== undefined : false;

  const ext = activeFile ? activeFile.split(".").pop()?.toLowerCase() || "" : "";
  const language = LANGUAGE_MAP[ext] || "plaintext";

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Custom dark theme matching Solix aesthetic
    monaco.editor.defineTheme("solix-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "73767d", fontStyle: "italic" },
        { token: "keyword", foreground: "67b0ff", fontStyle: "bold" },
        { token: "string", foreground: "9ae8a2" },
        { token: "number", foreground: "fbc02d" },
        { token: "type", foreground: "4fd1c5" },
      ],
      colors: {
        "editor.background": "#0e0f12",
        "editor.foreground": "#eeeeec",
        "editor.lineHighlightBackground": "#16171c",
        "editorCursor.foreground": "#67b0ff",
        "editorLineNumber.foreground": "#4a4d56",
        "editorLineNumber.activeForeground": "#eeeeec",
        "editor.selectionBackground": "#282a31",
        "editor.inactiveSelectionBackground": "#1e2026",
      },
    });
    monaco.editor.setTheme("solix-dark");

    // Track text selection for AI panel
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        onSelectionChange("", null);
      } else {
        const model = editor.getModel();
        const selectedText = model.getValueInRange(selection);
        onSelectionChange(selectedText, {
          start: selection.startLineNumber,
          end: selection.endLineNumber,
        });
      }
    });

    // Keyboard Shortcuts: Ctrl+S to save, Ctrl+Enter to run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveFile();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#0e0f12] overflow-hidden">
      {/* Top Bar: Open Tabs + Run / Save Toolbar */}
      <div className="flex items-center justify-between border-b border-[#24262b] bg-[#141518] px-2 flex-shrink-0 h-10 overflow-x-auto select-none">
        {/* Tab List */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[calc(100%-180px)]">
          {openFiles.map((path) => {
            const fileName = path.split("/").pop() || path;
            const isActive = activeFile === path;
            const hasUnsaved = dirtyFiles[path] !== undefined;

            return (
              <div
                key={path}
                onClick={() => onSelectFile(path)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer border-t-2 transition-all flex-shrink-0 ${
                  isActive
                    ? "bg-[#0e0f12] text-white border-cyan-400 font-semibold"
                    : "bg-[#15171a] text-[#8f9299] border-transparent hover:text-[#eeeeec] hover:bg-[#1a1c20]"
                }`}
                title={path}
              >
                <span>{fileName}</span>
                {hasUnsaved && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Unsaved changes" />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(path);
                  }}
                  className="p-0.5 hover:text-white rounded text-[#8f9299] transition-colors"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Action Controls: Save, Run, Test */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onSaveFile()}
            disabled={!activeFile || !isDirty}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              isDirty
                ? "bg-[#1f2228] text-cyan-400 border border-cyan-500/40 hover:bg-[#252830] cursor-pointer"
                : "text-[#555860] border border-transparent cursor-not-allowed"
            }`}
            title="Save file (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={onTest}
            disabled={isRunning}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1a1c20] hover:bg-[#22252b] text-[#dedfe2] border border-[#2e3138] transition-colors cursor-pointer"
            title="Run test suite"
          >
            <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Test</span>
          </button>

          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              isRunning
                ? "bg-cyan-900/40 text-cyan-300 border border-cyan-700/50 animate-pulse"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs"
            }`}
            title="Execute project (Ctrl+Enter)"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Path Info */}
      {activeFile && (
        <div className="px-3 py-1 bg-[#101114] border-b border-[#24262b] text-[11px] font-mono text-[#73767d] flex items-center justify-between">
          <span>{activeFile}</span>
          <span className="uppercase tracking-wider text-[10px] text-[#555860]">{language}</span>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 min-h-0 relative">
        {activeFile ? (
          <MonacoEditor
            height="100%"
            language={language}
            value={activeContent}
            onChange={(val) => onUpdateContent(activeFile, val || "")}
            onMount={handleEditorMount}
            theme="solix-dark"
            options={{
              fontSize: 14,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
              renderLineHighlight: "all",
              lineNumbers: "on",
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              suggestOnTriggerCharacters: true,
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#73767d] select-none">
            <div className="w-12 h-12 rounded-xl bg-[#141518] border border-[#24262b] flex items-center justify-center text-xl mb-3">
              💻
            </div>
            <p className="text-sm text-[#eeeeec] font-medium mb-1">No file open</p>
            <p className="text-xs max-w-xs text-[#73767d]">
              Select a file from the explorer on the left or create a new file to start coding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

