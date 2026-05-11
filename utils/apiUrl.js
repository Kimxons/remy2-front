const DEFAULT_DEV_API_PORT = "8000"
const LOCAL_DEV_HOSTNAMES = new Set(["localhost", "127.0.0.1"])

const buildLocalDevApiOrigin = (port = DEFAULT_DEV_API_PORT) => {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${port}`
  }

  return `${window.location.protocol}//${window.location.hostname}:${port}`
}

export const getApiOrigin = () => {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (!configuredBase) {
    if (typeof window !== "undefined" && LOCAL_DEV_HOSTNAMES.has(window.location.hostname)) {
      return buildLocalDevApiOrigin()
    }

    return ""
  }

  const normalizedBase = configuredBase.replace(/\/api\/?$/, "")

  try {
    const parsedUrl = new URL(normalizedBase)
    if (
      typeof window !== "undefined" &&
      LOCAL_DEV_HOSTNAMES.has(window.location.hostname) &&
      LOCAL_DEV_HOSTNAMES.has(parsedUrl.hostname)
    ) {
      return buildLocalDevApiOrigin(parsedUrl.port || DEFAULT_DEV_API_PORT)
    }
  } catch {
    return normalizedBase
  }

  return normalizedBase
}
/**
 * Build absolute API URL while handling bases with or without trailing /api.
 * @param {string} path
 * @returns {string}
 */
export const buildApiUrl = (path) => {
  if (path.startsWith("http")) return path

  const base = String(getApiOrigin() || "").replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  if (!base) {
    return normalizedPath
  }

  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`
  }

  return `${base}${normalizedPath}`
}

export default buildApiUrl
