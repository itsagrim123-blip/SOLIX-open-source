"use client";

import React from "react";
import { SolixLogo } from "@/components/brand/SolixLogo";

interface WorkspaceTransitionOverlayProps {
  state: "idle" | "entering" | "active" | "exiting";
}

export const WorkspaceTransitionOverlay: React.FC<WorkspaceTransitionOverlayProps> = ({ state }) => {
  // Only render during actual mode transitions (entering or exiting)
  if (state !== "entering" && state !== "exiting") {
    return null;
  }

  const isEntering = state === "entering";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none"
      aria-hidden="true"
    >
      <div className="relative flex items-center justify-center">
        {/* Ambient Cyan Radial Glow Aura */}
        <div
          className={`absolute w-48 h-48 rounded-full bg-cyan-500/20 blur-2xl pointer-events-none ${
            isEntering ? "solix-glow-enter" : "solix-glow-exit"
          }`}
        />

        {/* Existing Solix Dragon Logo Asset */}
        <div className={isEntering ? "solix-logo-enter" : "solix-logo-exit"}>
          <SolixLogo
            size="lg"
            px={88}
            className="drop-shadow-[0_0_24px_rgba(6,182,212,0.4)] mix-blend-screen"
          />
        </div>
      </div>
    </div>
  );
};
