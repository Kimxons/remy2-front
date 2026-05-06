const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
/**
 * Build absolute API URL while handling bases with or without trailing /api.
 * @param {string} path
 * @returns {string}
 */
export const buildApiUrl = (path) => {
  if (path.startsWith("http")) return path

  const base = String(API_BASE || "").replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`
  }

  return `${base}${normalizedPath}`
}

export default buildApiUrl
