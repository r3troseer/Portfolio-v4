// Shared helpers for Layer 1 API clients (retrieve + answer). Keeps base-URL
// resolution and safe JSON parsing in one place so a bad proxy / HTML body
// becomes a typed result instead of a thrown SyntaxError in React.

/**
 * Resolve the API origin used by fetch clients.
 * VITE_API_BASE_URL wins; local DEV falls back to Django on :8000.
 * Production builds require an explicit API origin.
 *
 * @returns {string} origin without a trailing slash
 */
export function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:8000";
  throw new Error("VITE_API_BASE_URL is required in production");
}

/**
 * Read a JSON body without throwing. Empty / HTML / malformed -> ok:false.
 *
 * @param {Response} res
 * @returns {Promise<{ ok: true, data: any } | { ok: false }>}
 */
export async function safeReadJson(res) {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return { ok: false };
    const data = JSON.parse(text);
    if (data === null || typeof data !== "object") return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

/**
 * Best-effort error message from a non-OK JSON body.
 *
 * @param {Response} res
 * @param {string} fallback
 * @returns {Promise<string>}
 */
export async function readErrorMessage(res, fallback) {
  try {
    const data = await res.json();
    return typeof data?.error === "string" && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}
