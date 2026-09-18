/**
 * Solix Workspace Sound Effects Controller
 *
 * Plays the Solix Workspace transition SFX (/sounds/solix-workspace.wav) during CHAT -> WORKSPACE transitions.
 * - Guaranteed non-blocking & failure-safe.
 * - Never loops, never autoplays on page load, only triggers on explicit user switch.
 */

export function playWorkspaceTransitionSFX(): void {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio("/sounds/solix-workspace.wav");
    audio.volume = 0.5;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Safe catch: browser autoplay policy or audio disabled
        console.debug("[Solix Audio] Autoplay prevented or unavailable:", err);
      });
    }
  } catch {
    // Failure-safe
  }
}
