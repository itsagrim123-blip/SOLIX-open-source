"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Monitor } from "lucide-react";
import { SolixLogo } from "@/components/brand/SolixLogo";
import { useWorkspaceAvailability } from "@/hooks/useWorkspaceAvailability";

export default function WorkspaceDirectPage() {
  const router = useRouter();
  const { isSupported, status } = useWorkspaceAvailability();

  useEffect(() => {
    if (status !== "unknown" && isSupported) {
      router.replace("/?view=workspace");
    }
  }, [status, isSupported, router]);

  // While detecting device hardware capabilities
  if (status === "unknown") {
    return (
      <div className="w-screen h-[100dvh] bg-[#0d0e10] flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <SolixLogo size="md" px={32} />
          <span className="text-xs font-mono text-[#666c75] animate-pulse">
            Checking environment…
          </span>
        </div>
      </div>
    );
  }

  // Desktop supported: redirecting to workspace view
  if (isSupported) {
    return (
      <div className="w-screen h-[100dvh] bg-[#0d0e10] flex items-center justify-center select-none">
        <div className="flex flex-col items-center gap-3">
          <SolixLogo size="md" px={32} />
          <span className="text-xs font-mono text-[#858b94]">
            Launching Solix Workspace…
          </span>
        </div>
      </div>
    );
  }

  // Mobile / Tablet / Unsupported device fallback view
  return (
    <div className="w-screen h-[100dvh] bg-[#0d0e10] text-[#eeeeec] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-sm w-full flex flex-col items-center">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2 mb-8">
          <SolixLogo size="md" px={28} />
          <span className="text-sm font-semibold text-white tracking-wide font-sans">
            Solix
          </span>
        </div>

        {/* Icon & Title Group */}
        <div className="w-12 h-12 rounded-xs bg-[#141518] border border-[#22242a] flex items-center justify-center mb-5 text-[#858b94] shadow-xs">
          <Monitor className="w-5 h-5 text-cyan-400" />
        </div>

        <h1 className="text-xs font-mono font-semibold tracking-widest text-[#858b94] uppercase mb-1">
          SOLIX WORKSPACE
        </h1>

        <h2 className="text-base font-semibold text-white font-sans tracking-tight mb-2">
          Desktop development environment
        </h2>

        <p className="text-xs text-[#858b94] font-sans leading-relaxed mb-6">
          Workspace is available on desktop devices.
        </p>

        {/* Return to Chat Button */}
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-xs bg-[#16171b] border border-[#272a31] hover:bg-[#1c1e24] hover:border-[#383d47] text-xs font-semibold text-white transition-all shadow-xs active:scale-98"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Chat</span>
        </Link>
      </div>
    </div>
  );
}

