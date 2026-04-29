/**
 * Tiny fetch wrapper that prefixes API calls with NEXT_PUBLIC_API_URL.
 *
 * Set in apps/web/.env.local for local dev:
 *   NEXT_PUBLIC_API_URL="http://localhost:3001"
 *
 * On Railway, set NEXT_PUBLIC_API_URL on the web service to the api service's
 * public URL (e.g. https://api-service.up.railway.app). When unset, falls
 * back to same-origin (useful when running the legacy single-service mode).
 */

export const API_BASE_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '';

export function apiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (/^https?:\/\//.test(path)) return path;
  const base = API_BASE_URL.replace(/\/+$/, '');
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${base}${tail}`;
}

/** Build a public asset URL (svg / sprite / package tarball) for end-user copy/paste. */
export function assetUrl(path: string): string {
  if (API_BASE_URL) return apiUrl(path);
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}
