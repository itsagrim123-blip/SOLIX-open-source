/**
 * Solix Workspace Sound Effects Controller
 *
 * Plays the Solix Workspace transition SFX during CHAT -> WORKSPACE transitions.
 * - Guaranteed non-blocking & failure-safe (silently catches missing file or browser autoplay rejection).
 * - Never loops, never autoplays on page load, only triggers on explicit user switch.
 */

export function playWorkspaceTransitionSFX(): void {
  if (typeof window === "undefined") return;

  try {
    // Attempt playback using the provided Solix Workspace SFX asset
    // Looks for /workspace-transition.mp3 with fallback to /sounds/workspace-transition.mp3
    const audio = new Audio("/workspace-transition.mp3");
    audio.volume = 0.45;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback check if the asset is in /sounds/
        try {
          const fallback = new Audio("/sounds/workspace-transition.mp3");
          fallback.volume = 0.45;
          fallback.play().catch(() => {
            // Failure-safe: animation continues uninterrupted
          });
        } catch {
          // Failure-safe
        }
      });
    }
  } catch {
    // Failure-safe
  }
}
