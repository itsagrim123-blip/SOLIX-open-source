"use client";

import { useEffect, useState } from "react";
import {
  checkWorkspaceCapability,
  WorkspaceCapability,
} from "@/lib/workspaceAvailability";

/**
 * Hook to reactively track Solix Workspace availability on the client device.
 *
 * Guaranteed SSR / Hydration Safe:
 * - Returns `{ isSupported: false, status: "unknown" }` during server-side rendering and initial client hydration.
 * - Computes true capability inside `useEffect` once mounted on client.
 * - Re-evaluates on window resize or orientationchange with light debouncing.
 */
export function useWorkspaceAvailability(): WorkspaceCapability {
  const [capability, setCapability] = useState<WorkspaceCapability>({
    isSupported: false,
    status: "unknown",
  });

  useEffect(() => {
    // Initial client evaluation
    const evaluate = () => {
      const result = checkWorkspaceCapability();
      setCapability(result);
    };

    evaluate();

    // Listen to resize and orientation changes
    let timer: NodeJS.Timeout;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(evaluate, 120);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return capability;
}

