/**
 * Unified HTTP Client for RemyInk API
 * Combines authentication, token refresh, and error handling
 *
 * @module httpClient
 */

import axios from "axios";
import { deleteCookie, clearAuthSessionCookie } from "../utils/cookies";

const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:8000";

const resolveApiOrigin = () => {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configuredBase) {
    return DEFAULT_DEV_API_ORIGIN;
  }

  return configuredBase.replace(/\/api\/?$/, "");
};

/** @type {string} Base origin for all API requests */
const API_BASE_URL = resolveApiOrigin();

/**
 * Retrieves the current authentication token from localStorage
 * Tries multiple storage locations for backward compatibility
 * @returns {string|null} The authentication token or null
 */
const getAuthToken = () => {
  try {
    // Primary location: currentUser object
    const userString = localStorage.getItem("currentUser");
    if (userString) {
      const user = JSON.parse(userString);
      if (user?.token) return user.token;
    }

    // Fallback locations
    return localStorage.getItem("accessToken") || localStorage.getItem("token");
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return null;
  }
};

/**
 * Retrieves the refresh token from localStorage
 * @returns {string|null} The refresh token or null
 */
const getRefreshToken = () => {
  try {
    const userString = localStorage.getItem("currentUser");
    if (userString) {
      const user = JSON.parse(userString);
      return user?.refreshToken;
    }
    return localStorage.getItem("refreshToken");
  } catch (error) {
    console.error("Error retrieving refresh token:", error);
    return null;
  }
};

/**
 * Retrieves the guest session key for unauthenticated users
 * @returns {string|null} The guest session key or null
 */
const getGuestSessionKey = () => {
  try {
    const canonical = localStorage.getItem("guestSessionKey");
    if (canonical) return canonical;

    // Legacy fallback key used by older chat modal implementations.
    const legacy = localStorage.getItem("guest_session_key");
    if (legacy) {
      localStorage.setItem("guestSessionKey", legacy);
      localStorage.removeItem("guest_session_key");
      return legacy;
    }

    return null;
  } catch (error) {
    console.error("Error retrieving guest session key:", error);
    return null;
  }
};

/**
 * Clears all authentication data and redirects to login
 */
const clearAuthAndRedirect = () => {
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("token");

    // Delete auth cookies used by route protection
    deleteCookie("currentUser");
    clearAuthSessionCookie();

    // Trigger storage event for other tabs/components
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event("auth:changed"));

    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Error clearing auth data:", error);
  }
};

/**
 * Main HTTP client instance with /api prefix
 * Use this for endpoints that start with /api
 */
const httpClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

/**
 * HTTP client instance without /api prefix
 * Use this for endpoints that don't start with /api
 */
const httpClientRaw = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const getCsrfToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("csrfToken");
};

/**
 * Request interceptor to attach authentication headers
 * @param {Object} config - Axios request config
 * @returns {Object} Modified config with auth headers
 */
const requestInterceptor = (config) => {
  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add guest session key for unauthenticated requests
  if (!token) {
    const guestSessionKey = getGuestSessionKey();
    if (guestSessionKey) {
      config.params = {
        ...config.params,
        session_key: guestSessionKey,
      };
    }
  }

  const csrfToken = getCsrfToken();
  if (csrfToken) {
    config.headers["X-CSRFToken"] = csrfToken;
  }

  // Log requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  }

  return config;
};

/**
 * Request error interceptor
 * @param {Error} error - Request error
 * @returns {Promise} Rejected promise with error
 */
const requestErrorInterceptor = (error) => {
  console.error("[API] Request error:", error);
  return Promise.reject(error);
};

/**
 * Response interceptor for successful responses
 * @param {Object} response - Axios response
 * @returns {Object} Response data
 */
const responseInterceptor = (response) => {
  // Log responses in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] Response:`, response.status, response.config.url);
  }
  return response;
};

/**
 * Response error interceptor with automatic token refresh
 * @param {Error} error - Response error
 * @returns {Promise} Retried request or rejected promise
 */
const responseErrorInterceptor = async (error) => {
  const originalRequest = error.config;
  const suppressConsoleError = Boolean(originalRequest?.suppressConsoleError);

  // Handle 401 Unauthorized with token refresh
  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      if (getGuestSessionKey()) {
        console.warn("[API] Guest request unauthorized, skipping redirect:", originalRequest.url);
        return Promise.reject(error);
      }
      console.warn("[API] No refresh token available, redirecting to login");
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    try {
      console.log("[API] Attempting token refresh...");

      // Request new access token
      const response = await axios.post(
        `${API_BASE_URL}/api/users/token/refresh/`,
        { refresh: refreshToken },
        { withCredentials: true }
      );

      const newAccessToken = response.data.access;

      // Update stored user data with new token
      const userString = localStorage.getItem("currentUser");
      if (userString) {
        const user = JSON.parse(userString);
        const updatedUser = { ...user, token: newAccessToken };
        localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      }

      // Also update standalone token storage
      localStorage.setItem("accessToken", newAccessToken);

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      console.log("[API] Token refreshed successfully");
      return httpClient(originalRequest);

    } catch (refreshError) {
      console.error("[API] Token refresh failed:", refreshError);
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    }
  }

  // Handle other error statuses
  if (error.response) {
    const { status, data } = error.response;
    const logError = (...args) => {
      if (!suppressConsoleError) {
        console.error(...args);
      }
    };
    const logWarn = (...args) => {
      if (!suppressConsoleError) {
        console.warn(...args);
      }
    };
    const summarizeErrorData = (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) {
        return "[HTML error response omitted]"
      }
      if (trimmed.length > 300) {
        return `${trimmed.slice(0, 300)}...`
      }
      return trimmed
    };
    const safeData = summarizeErrorData(data);
    const requestUrl = error.config?.url || "";
    const isChatThreadNotFound =
      status === 404 &&
      typeof requestUrl === "string" &&
      /\/chat\/threads\/[^/]+\/?$/.test(requestUrl);

    switch (status) {
      case 403:
        logError("[API] Forbidden:", data);
        break;
      case 404:
        if (isChatThreadNotFound) {
          // This can happen transiently during guest/auth thread resolution.
          // Keep it visible but avoid noisy console error overlays in dev.
          logWarn("[API] Chat thread not found (non-fatal):", requestUrl);
        } else {
          logError("[API] Not found:", requestUrl);
        }
        break;
      case 500:
      case 502:
      case 503:
        logError("[API] Server error:", status, safeData);
        break;
      default:
        logError("[API] Error:", status, safeData);
    }
  } else if (error.request) {
    const method = originalRequest?.method?.toUpperCase?.() || "REQUEST";
    const url = originalRequest?.url || "unknown-url";
    const errorCode = error.code || "";

    // Abort/cancel/timeout/no-response cases are common in dev and during route transitions.
    // Log as warnings to avoid noisy "Console Error" overlays in Next dev.
    if (
      axios.isCancel(error) ||
      errorCode === "ERR_CANCELED" ||
      errorCode === "ECONNABORTED"
    ) {
      if (!suppressConsoleError) {
        console.warn(`[API] ${method} ${url} canceled or timed out (${errorCode || "no-code"})`);
      }
    } else {
      if (!suppressConsoleError) {
        console.warn(`[API] ${method} ${url} network issue: no response received`);
      }
    }
  } else {
    if (!suppressConsoleError) {
      console.error("[API] Request setup error:", error.message);
    }
  }

  return Promise.reject(error);
};

// Apply interceptors to both clients
[httpClient, httpClientRaw].forEach(client => {
  client.interceptors.request.use(requestInterceptor, requestErrorInterceptor);
  client.interceptors.response.use(responseInterceptor, responseErrorInterceptor);
});

/**
 * @typedef {Object} HttpClientExport
 * @property {import('axios').AxiosInstance} default - HTTP client with /api prefix
 * @property {import('axios').AxiosInstance} httpClient - HTTP client with /api prefix
 * @property {import('axios').AxiosInstance} httpClientRaw - HTTP client without prefix
 * @property {Function} getAuthToken - Get current auth token
 * @property {Function} getRefreshToken - Get refresh token
 * @property {Function} getGuestSessionKey - Get guest session key
 * @property {Function} clearAuthAndRedirect - Clear auth and redirect to login
 */

export { httpClient, httpClientRaw, getAuthToken, getRefreshToken, getGuestSessionKey, clearAuthAndRedirect };
export default httpClient;
