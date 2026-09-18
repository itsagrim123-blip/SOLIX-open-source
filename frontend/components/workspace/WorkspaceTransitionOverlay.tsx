"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SolixLogo } from "@/components/brand/SolixLogo";

export type WorkspaceTransitionState =
  | "idle"
  | "entering-workspace"
  | "workspace-active"
  | "exiting-workspace"
  | "chat-active";

interface WorkspaceTransitionOverlayProps {
  transitionState: WorkspaceTransitionState;
}

export const WorkspaceTransitionOverlay: React.FC<WorkspaceTransitionOverlayProps> = ({
  transitionState,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render during active transition sequence
  if (
    !mounted ||
    (transitionState !== "entering-workspace" && transitionState !== "exiting-workspace")
  ) {
    return null;
  }

  const isEntering = transitionState === "entering-workspace";

  const overlayNode = (
    <div
      id="solix-workspace-transition-overlay"
      className="fixed inset-0 z-[9999] pointer-events-none select-none overflow-hidden"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        zIndex: 9999,
      }}
      aria-hidden="true"
    >
      {/* Fullscreen Solix Dark Backdrop Layer */}
      <div
        className={`absolute inset-0 bg-[#0d0e10] ${
          isEntering ? "animate-overlay-backdrop-enter" : "animate-overlay-backdrop-exit"
        }`}
      />

      {/* Centered Solix Dragon Logo Reveal */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Soft Ambient Cyan Glow Aura */}
        <div
          className={`absolute w-56 h-56 rounded-full bg-cyan-500/25 blur-3xl pointer-events-none ${
            isEntering ? "animate-overlay-glow-enter" : "animate-overlay-glow-exit"
          }`}
        />

        {/* Existing Solix Dragon Logo Asset */}
        <div
          className={
            isEntering ? "animate-overlay-logo-enter" : "animate-overlay-logo-exit"
          }
        >
          <SolixLogo
            size="lg"
            px={96}
            className="drop-shadow-[0_0_28px_rgba(6,182,212,0.45)] mix-blend-screen"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(overlayNode, document.body);
};
