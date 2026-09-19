"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import with SSR disabled ensures Three.js/WebGL only instantiates in browser
const ParticleSaturn = dynamic(
  () => import("@/components/ui/ParticleSaturn").then((mod) => mod.ParticleSaturn),
  {
    ssr: false,
    loading: () => null,
  }
);

interface HeaderSaturnProps {
  className?: string;
}

export const HeaderSaturn: React.FC<HeaderSaturnProps> = ({ className = "" }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`header-saturn hidden sm:flex items-center justify-center w-[92px] h-[40px] shrink-0 pointer-events-none select-none opacity-0 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`header-saturn hidden sm:flex items-center justify-center w-[92px] h-[40px] shrink-0 pointer-events-none select-none relative overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <ParticleSaturn
        coreColor="#FFD600"
        ringColor="#FFD400"
        density={10}
        particleSize={10}
        glow={8}
        tilt={6}
        roll={-3}
        spinSpeed={4}
        dragSensitivity={0}
        sizePercent={85}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
        }}
        aria-hidden="true"
      />
    </div>
  );
};

export default HeaderSaturn;

