"use client";

import React from "react";
import { SolixLogo } from "@/components/brand/SolixLogo";

interface WorkspaceTransitionOverlayProps {
  stage: "idle" | "fading-out" | "showing-logo" | "fading-in";
  targetView: "chat" | "coding";
}

export const WorkspaceTransitionOverlay: React.FC<WorkspaceTransitionOverlayProps> = ({
  stage,
  targetView,
}) => {
  if (stage === "idle") return null;

  const isEnteringWorkspace = targetView === "coding";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0e10]/94 backdrop-blur-md select-none pointer-events-auto transition-opacity duration-200 ease-out ${
        stage === "showing-logo" ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-5 transition-all duration-300 transform scale-100">
        {/* Ambient Glow + Existing Solix Dragon Logo */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-6 bg-cyan-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative animate-dragon-glow">
            <SolixLogo size="lg" px={76} className="drop-shadow-[0_0_24px_rgba(6,182,212,0.4)]" />
          </div>
        </div>

        {/* Transition Status Label */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold tracking-[0.22em] text-[#dedfe2] uppercase">
            <span>{isEnteringWorkspace ? "Opening Workspace" : "Returning to Chat"}</span>
            <span className="inline-flex gap-0.5 text-cyan-400">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
            </span>
          </div>
          <span className="text-[11px] text-[#72757e] font-sans">
            {isEnteringWorkspace
              ? "Entering full-screen developer workspace"
              : "Restoring active chat conversation"}
          </span>
        </div>
      </div>
    </div>
  );
};
