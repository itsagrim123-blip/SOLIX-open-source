/**
 * Centralized API & Environment Configuration for Solix.
 *
 * In production (e.g., Vercel deployment):
 * Set `NEXT_PUBLIC_API_URL` in Vercel Project Settings -> Environment Variables.
 * Example: NEXT_PUBLIC_API_URL=https://api.yourdomain.com (e.g., via Cloudflare Tunnel)
 *
 * In local development:
 * Defaults to `http://localhost:8000` when NEXT_PUBLIC_API_URL is omitted or unset.
 */

// Normalized base URL without trailing slash
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000"
).replace(/\/+$/, "");

/**
 * Returns the fully-qualified backend API endpoint URL for a given route path.
 *
 * @example
 * getApiUrl("/api/health") // -> "https://api.yourdomain.com/api/health"
 * getApiUrl("api/chat")    // -> "https://api.yourdomain.com/api/chat"
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
