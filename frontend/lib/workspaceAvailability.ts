/**
 * Centralized Workspace Capability & Desktop Detection Utility
 * 
 * Solix Workspace is a desktop-grade IDE environment requiring:
 * 1. Sufficient viewport dimensions (min 1024px width, 560px height) for editor, explorer, terminal, and AI panel.
 * 2. Desktop-class precision pointer (mouse or trackpad) via media query fine pointer check.
 * 3. Exclusion of pure mobile/tablet touch devices without fine pointer input.
 * 4. Full support for desktop touchscreen laptops (Windows laptops, Surface, etc.) having both touch and precision pointer.
 */

export interface WorkspaceCapability {
  isSupported: boolean;
  status: "unknown" | "supported" | "unsupported";
  reason?: string;
}

export const MIN_WORKSPACE_WIDTH = 1024;
export const MIN_WORKSPACE_HEIGHT = 560;

/**
 * Evaluates whether the current client device environment meets the
 * requirements to run Solix Coding Workspace.
 *
 * Safe for SSR: returns { isSupported: false, status: "unknown" } on server.
 */
export function checkWorkspaceCapability(): WorkspaceCapability {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isSupported: false, status: "unknown" };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  // 1. Viewport Dimension Check
  if (width < MIN_WORKSPACE_WIDTH || height < MIN_WORKSPACE_HEIGHT) {
    return {
      isSupported: false,
      status: "unsupported",
      reason: `Viewport dimensions (${width}x${height}) are below desktop threshold (${MIN_WORKSPACE_WIDTH}x${MIN_WORKSPACE_HEIGHT}).`,
    };
  }

  // 2. Pointer & Input Capabilities
  // Check if device has fine pointer (mouse, trackpad)
  let hasFinePointer = false;
  let hasOnlyCoarsePointer = false;

  try {
    const fineQuery = window.matchMedia("(pointer: fine), (any-pointer: fine)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const anyFineQuery = window.matchMedia("(any-pointer: fine)");

    hasFinePointer = fineQuery.matches || anyFineQuery.matches;
    hasOnlyCoarsePointer = coarseQuery.matches && !anyFineQuery.matches;
  } catch {
    // If matchMedia fails or is unsupported, fallback to width check
    hasFinePointer = width >= MIN_WORKSPACE_WIDTH;
  }

  // Pure touch devices without precision mouse/trackpad cannot operate the IDE comfortably
  if (hasOnlyCoarsePointer) {
    return {
      isSupported: false,
      status: "unsupported",
      reason: "Device only has coarse touch input without a precision pointer.",
    };
  }

  // 3. User Agent Heuristics for Phones & Tablets
  const ua = navigator.userAgent || "";
  const isMobilePhone = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // iPad / Android tablet without fine pointer
  const isPureTablet =
    (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || /Android(?!.*Mobile)/i.test(ua)) &&
    !hasFinePointer;

  if (isMobilePhone || isPureTablet) {
    return {
      isSupported: false,
      status: "unsupported",
      reason: "Mobile or tablet device environment detected.",
    };
  }

  // 4. If device has no fine pointer and screen is not decisively large, treat as unsupported
  if (!hasFinePointer && width < 1280) {
    return {
      isSupported: false,
      status: "unsupported",
      reason: "No precision pointer detected on moderate display size.",
    };
  }

  return {
    isSupported: true,
    status: "supported",
  };
}

