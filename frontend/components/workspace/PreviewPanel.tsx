"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  Globe,
  Laptop,
  Maximize2,
  RefreshCw,
  Smartphone,
  Tablet,
  X,
  AlertTriangle,
} from "lucide-react";
import { Problem } from "@/types/workspace";

export type PreviewViewport = "desktop" | "tablet" | "mobile" | "responsive";

interface PreviewPanelProps {
  html: string;
  isBuilding?: boolean;
  onRefresh: () => void;
  onClose: () => void;
  isLive: boolean;
  onToggleLive: () => void;
  viewport: PreviewViewport;
  onViewportChange: (vp: PreviewViewport) => void;
  problems?: Problem[];
  onSelectProblem?: (p: Problem) => void;
  entryFile?: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  html,
  isBuilding = false,
  onRefresh,
  onClose,
  isLive,
  onToggleLive,
  viewport,
  onViewportChange,
  problems = [],
  onSelectProblem,
  entryFile = "index.html",
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const errors = problems.filter((p) => p.severity === "error");

  const handleOpenExternal = () => {
    if (!html) return;
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      console.error("Failed to open preview externally:", e);
    }
  };

  // Compute viewport container widths
  const getViewportStyle = () => {
    switch (viewport) {
      case "mobile":
        return { width: "375px", height: "100%" };
      case "tablet":
        return { width: "768px", height: "100%" };
      case "responsive":
      case "desktop":
      default:
        return { width: "100%", height: "100%" };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0c0e] border-l border-[#22242a] overflow-hidden select-none">
      {/* ── Top Browser-Like Bar (32px) ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2.5 h-8 bg-[#111214] border-b border-[#22242a] shrink-0 text-xs">
        {/* Left: Title & Live indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#e2e8f0] font-semibold text-[11px] tracking-wider uppercase font-mono">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>PREVIEW</span>
          </div>

          <span className="text-[#3c4048] font-mono text-[10px]">·</span>
          <span className="text-[10.5px] font-mono text-[#858b94] truncate max-w-[110px]">
            {entryFile}
          </span>
        </div>

        {/* Center: Device Viewport Controls */}
        <div className="hidden sm:flex items-center rounded-xs bg-[#0d0e10] p-0.5 border border-[#222429]">
          <button
            type="button"
            onClick={() => onViewportChange("desktop")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
              viewport === "desktop"
                ? "bg-[#20232a] text-white font-medium"
                : "text-[#717680] hover:text-[#d4d7dc]"
            }`}
            title="Desktop (100%)"
          >
            <Laptop className="w-3 h-3" />
            <span>Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => onViewportChange("tablet")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
              viewport === "tablet"
                ? "bg-[#20232a] text-white font-medium"
                : "text-[#717680] hover:text-[#d4d7dc]"
            }`}
            title="Tablet (768px)"
          >
            <Tablet className="w-3 h-3" />
            <span>Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => onViewportChange("mobile")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10.5px] transition-colors cursor-pointer ${
              viewport === "mobile"
                ? "bg-[#20232a] text-white font-medium"
                : "text-[#717680] hover:text-[#d4d7dc]"
            }`}
            title="Mobile (375px)"
          >
            <Smartphone className="w-3 h-3" />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right: Actions (Live, Refresh, External, Close) */}
        <div className="flex items-center gap-1">
          {/* Live Reload Toggle */}
          <button
            type="button"
            onClick={onToggleLive}
            className={`flex items-center gap-1 px-1.5 h-5.5 rounded-xs text-[10.5px] font-medium border transition-colors cursor-pointer ${
              isLive
                ? "bg-emerald-950/70 text-emerald-300 border-emerald-700/80"
                : "bg-[#16171a] text-[#717680] border-[#222429] hover:text-[#d4d7dc]"
            }`}
            title={isLive ? "Live preview ON (auto-refreshes on edits)" : "Live preview OFF"}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-[#555a62]"}`}
            />
            <span>Live</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isBuilding}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer disabled:opacity-50"
            title="Rebuild & Refresh Preview"
            aria-label="Refresh Preview"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBuilding ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          {/* Open Externally Button */}
          <button
            type="button"
            onClick={handleOpenExternal}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="Open in new window (Blob URL)"
            aria-label="Open externally"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Close Panel Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xs text-[#858b94] hover:text-white hover:bg-[#1a1c21] transition-colors cursor-pointer"
            title="Close Preview (Ctrl+Shift+V)"
            aria-label="Close Preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Optional Diagnostic Error Warning Banner ──────────────────────── */}
      {errors.length > 0 && (
        <div className="px-3 py-1 bg-rose-950/60 border-b border-rose-900/60 text-rose-300 text-[11px] font-mono flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">
              {errors[0].message} ({errors[0].file}:{errors[0].line})
            </span>
          </div>
          {onSelectProblem && (
            <button
              type="button"
              onClick={() => onSelectProblem(errors[0])}
              className="px-1.5 py-0.5 rounded-xs bg-rose-900/70 hover:bg-rose-800 text-white text-[10px] shrink-0 cursor-pointer"
            >
              Open Line
            </button>
          )}
        </div>
      )}

      {/* ── Main Preview Iframe Display ───────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-[#07080a] flex items-center justify-center p-0 overflow-auto">
        {html ? (
          <div
            style={getViewportStyle()}
            className={`transition-all duration-150 flex flex-col ${
              viewport !== "desktop" && viewport !== "responsive"
                ? "border-x border-[#23262d] shadow-2xl my-auto"
                : ""
            }`}
          >
            <iframe
              key={entryFile}
              srcDoc={html}
              sandbox="allow-scripts allow-modals"
              title="Website Preview Sandbox"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-[#666c75] space-y-2">
            <Globe className="w-8 h-8 text-[#333842]" />
            <p className="text-xs font-mono">No website preview ready</p>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1 bg-[#181a1f] hover:bg-[#22252c] text-cyan-300 border border-[#2b303c] rounded-xs text-xs font-mono transition-colors cursor-pointer"
            >
              Build &amp; Preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

