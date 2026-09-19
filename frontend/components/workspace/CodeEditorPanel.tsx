"use client";

import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Globe, Hammer, Play, PlayCircle, Save, X } from "lucide-react";
import { Problem } from "@/types/workspace";

// Dynamically load Monaco Editor with SSR disabled
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center text-xs text-[#858b94] gap-2">
        <div className="w-4 h-4 border-2 border-[#292c31] border-t-cyan-400 rounded-full animate-spin" />
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
  onBuild?: () => void;
  onRun: () => void;
  onTest: () => void;
  isRunning: boolean;
  onSelectionChange: (code: string, range: { start: number; end: number } | null) => void;
  onCursorChange?: (line: number, column: number) => void;
  problems?: Problem[];
  targetProblem?: Problem | null;
  isWebProject?: boolean;
  isPreviewOpen?: boolean;
  onTogglePreview?: () => void;
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
  onBuild,
  onRun,
  onTest,
  isRunning,
  onSelectionChange,
  onCursorChange,
  problems,
  targetProblem,
  isWebProject,
  isPreviewOpen,
  onTogglePreview,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

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
    monacoRef.current = monaco;

    // Classic dark theme matching professional IDE palette
    monaco.editor.defineTheme("solix-ide-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a737d", fontStyle: "italic" },
        { token: "keyword", foreground: "79b8ff", fontStyle: "bold" },
        { token: "string", foreground: "9ecbff" },
        { token: "number", foreground: "ffab70" },
        { token: "type", foreground: "b392f0" },
        { token: "function", foreground: "b392f0" },
        { token: "variable", foreground: "d4d7dc" },
      ],
      colors: {
        "editor.background": "#0d0f12",
        "editor.foreground": "#d4d7dc",
        "editor.lineHighlightBackground": "#15181e",
        "editorCursor.foreground": "#38bdf8",
        "editorLineNumber.foreground": "#454b56",
        "editorLineNumber.activeForeground": "#e2e8f0",
        "editor.selectionBackground": "#222f42",
        "editor.inactiveSelectionBackground": "#182230",
        "editorIndentGuide.background": "#1a1e26",
        "editorIndentGuide.activeBackground": "#2c3546",
        "editorBracketMatch.background": "#1e293b",
        "editorBracketMatch.border": "#38bdf8",
      },
    });
    monaco.editor.setTheme("solix-ide-dark");

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

    // Track cursor line & column position for status bar
    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // Initial position
    const pos = editor.getPosition();
    if (pos && onCursorChange) {
      onCursorChange(pos.lineNumber, pos.column);
    }

    // Keyboard Shortcuts: Ctrl+S to save, Ctrl+Enter to run, Ctrl+Shift+V for preview
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveFile();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun();
    });
    if (onTogglePreview) {
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
        () => {
          onTogglePreview();
        }
      );
    }
  };

  // Set real compiler / interpreter error and warning markers on Monaco editor model
  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || !activeFile) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const fileProblems = (problems || []).filter((p) => {
      if (!p.file) return false;
      const cleanP = p.file.replace(/\\/g, "/").toLowerCase();
      const cleanActive = activeFile.replace(/\\/g, "/").toLowerCase();
      return (
        cleanP === cleanActive ||
        cleanP.endsWith("/" + cleanActive) ||
        cleanActive.endsWith("/" + cleanP)
      );
    });

    const markers = fileProblems.map((p) => {
      const severity =
        p.severity === "error"
          ? monacoRef.current.MarkerSeverity.Error
          : p.severity === "warning"
          ? monacoRef.current.MarkerSeverity.Warning
          : monacoRef.current.MarkerSeverity.Info;

      const line = Math.max(1, p.line || 1);
      const col = Math.max(1, p.column || 1);

      return {
        severity,
        message: p.message,
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col + 60,
        source: p.source || "compiler",
      };
    });

    monacoRef.current.editor.setModelMarkers(model, "workspace-diagnostics", markers);
  }, [problems, activeFile]);

  // Navigate to problem position when clicked from Problems tab
  useEffect(() => {
    if (!editorRef.current || !targetProblem || !activeFile) return;
    const cleanP = (targetProblem.file || "").replace(/\\/g, "/").toLowerCase();
    const cleanActive = activeFile.replace(/\\/g, "/").toLowerCase();

    if (
      cleanP === cleanActive ||
      cleanP.endsWith("/" + cleanActive) ||
      cleanActive.endsWith("/" + cleanP)
    ) {
      const line = Math.max(1, targetProblem.line || 1);
      const col = Math.max(1, targetProblem.column || 1);
      editorRef.current.revealPositionInCenter({ lineNumber: line, column: col });
      editorRef.current.setPosition({ lineNumber: line, column: col });
      editorRef.current.focus();
    }
  }, [targetProblem, activeFile]);

  // Breadcrumb path parts
  const pathParts = activeFile ? activeFile.split("/") : [];

  return (
    <div className="h-full flex flex-col bg-[#0d0f12] overflow-hidden select-none">
      {/* Top Tabs Bar: Classic IDE Rectangular Tabs (32px) */}
      <div className="flex items-center justify-between border-b border-[#22242a] bg-[#111214] h-8 flex-shrink-0 select-none overflow-hidden">
        {/* Tab List */}
        <div className="flex items-center overflow-x-auto h-full scrollbar-none flex-1 min-w-0">
          {openFiles.map((path) => {
            const fileName = path.split("/").pop() || path;
            const isActive = activeFile === path;
            const hasUnsaved = dirtyFiles[path] !== undefined;

            return (
              <div
                key={path}
                onClick={() => onSelectFile(path)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseFile(path);
                  }
                }}
                className={`group flex items-center gap-2 px-3 h-full text-xs font-medium cursor-pointer border-r border-[#22242a] transition-colors flex-shrink-0 relative ${
                  isActive
                    ? "bg-[#0d0f12] text-[#e2e8f0] border-t-2 border-t-cyan-500 font-semibold"
                    : "bg-[#111214] text-[#858b94] hover:bg-[#15171b] hover:text-[#d4d7dc] border-t-2 border-t-transparent"
                }`}
                title={`${path} (middle-click to close)`}
              >
                <span className="truncate max-w-[150px]">{fileName}</span>

                {/* Unsaved indicator or close icon */}
                <div className="flex items-center justify-center w-3.5 h-3.5 flex-shrink-0">
                  {hasUnsaved ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseFile(path);
                      }}
                      className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                      title="Unsaved changes (Ctrl+S to save)"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(path);
                    }}
                    className={`p-0.5 rounded-xs hover:bg-[#22252a] text-[#858b94] hover:text-white transition-colors ${
                      hasUnsaved ? "hidden group-hover:block" : ""
                    }`}
                    title="Close tab"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls: Compact IDE Toolbar Buttons */}
        <div className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-[#292c31] bg-[#111214] h-full">
          <button
            type="button"
            onClick={() => onSaveFile()}
            disabled={!activeFile || !isDirty}
            className={`flex items-center gap-1 px-2 h-6 rounded-xs text-[11px] font-medium transition-colors ${
              isDirty
                ? "text-cyan-400 hover:bg-[#1c1f24] cursor-pointer"
                : "text-[#555a62] cursor-not-allowed"
            }`}
            title="Save file (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            <span className="hidden md:inline">Save</span>
          </button>

          {onBuild && (
            <button
              type="button"
              onClick={onBuild}
              disabled={isRunning}
              className="flex items-center gap-1 px-2 h-6 rounded-xs text-[11px] font-medium text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1c1f24] transition-colors cursor-pointer"
              title="Build / Compile Sources"
            >
              <Hammer className="w-3 h-3" />
              <span className="hidden md:inline">Build</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTest}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 h-6 rounded-xs text-[11px] font-medium text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1c1f24] transition-colors cursor-pointer"
            title="Run tests in browser sandbox"
          >
            <PlayCircle className="w-3 h-3" />
            <span className="hidden md:inline">Test</span>
          </button>

          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className={`flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-semibold transition-colors cursor-pointer ${
              isRunning
                ? "bg-amber-950/60 text-amber-300 border border-amber-800/60"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
            title="Execute project (Ctrl+Enter)"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunning ? "Running" : "Run"}</span>
          </button>

          {(isWebProject || onTogglePreview) && (
            <button
              type="button"
              onClick={onTogglePreview}
              className={`flex items-center gap-1 px-2.5 h-6 rounded-xs text-[11px] font-medium transition-colors cursor-pointer ${
                isPreviewOpen
                  ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800"
                  : "text-[#858b94] hover:text-[#d4d7dc] hover:bg-[#1c1f24]"
              }`}
              title="Toggle Website Live Preview (Ctrl+Shift+V)"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span className="hidden md:inline">Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Classic IDE Breadcrumb Path Bar (22px) */}
      {activeFile && (
        <div className="h-[22px] px-3 bg-[#0d0f12] border-b border-[#202227] text-[11px] font-mono text-[#666c75] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-1 truncate">
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-2.5 h-2.5 text-[#444850] shrink-0" />}
                <span className={idx === pathParts.length - 1 ? "text-[#a5abb5] font-medium" : "text-[#666c75]"}>
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
          <span className="uppercase text-[10px] text-[#525760] font-mono">{language}</span>
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
            theme="solix-ide-dark"
            options={{
              fontSize: 13,
              lineHeight: 21,
              fontFamily: "JetBrains Mono, Cascadia Code, Monaco, Menlo, Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
              renderLineHighlight: "line",
              lineNumbers: "on",
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              suggestOnTriggerCharacters: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              cursorWidth: 2,
              renderWhitespace: "selection",
              guides: { indentation: true, bracketPairs: true },
              padding: { top: 8, bottom: 8 },
              smoothScrolling: true,
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#666c75] select-none">
            <p className="text-xs font-medium text-[#858b94] mb-1">No file is currently open</p>
            <p className="text-[11px] max-w-xs text-[#525760]">
              Select a file from the explorer on the left or create a new file to begin editing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
