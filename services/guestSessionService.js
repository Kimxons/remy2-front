/**
 * Guest Session Service
 * Centralized management of guest user sessions
 * Handles session creation, persistence, and cleanup
 *
 * @module guestSessionService
 */

import chatApi from "../api/chatApi";

const GUEST_SESSION_KEY = "guestSessionKey";
const LEGACY_GUEST_SESSION_KEY = "guest_session_key";
const GUEST_LABEL_KEY = "guestLabel";
const GUEST_SESSION_EXPIRY = "guestSessionExpiry";
const CSRF_TOKEN_KEY = "csrfToken";
const GUEST_SESSION_RETRY_AT_KEY = "guestSessionRetryAt";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const THREAD_SESSION_KEY_PREFIX = "threadSessionKey:";

const parseThrottleRetryAt = (error) => {
  const detail = String(error?.response?.data?.detail || "");
  const match = detail.match(/available in\s+(\d+)\s+seconds?/i);
  if (!match) return null;

  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Date.now() + (seconds * 1000);
};

const getStoredRetryAt = () => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(GUEST_SESSION_RETRY_AT_KEY);
  if (!raw) return null;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    localStorage.removeItem(GUEST_SESSION_RETRY_AT_KEY);
    return null;
  }

  if (Date.now() >= value) {
    localStorage.removeItem(GUEST_SESSION_RETRY_AT_KEY);
    return null;
  }

  return value;
};

const storeRetryAt = (retryAt) => {
  if (typeof window === "undefined") return;
  if (!retryAt) {
    localStorage.removeItem(GUEST_SESSION_RETRY_AT_KEY);
    return;
  }

  localStorage.setItem(GUEST_SESSION_RETRY_AT_KEY, String(retryAt));
};

const makeThreadStorageKey = (threadId) => threadId ? `${THREAD_SESSION_KEY_PREFIX}${threadId}` : null;

const clearThreadSessionKeysFromStorage = () => {
  if (typeof window === "undefined") return;

  Object.keys(localStorage)
    .filter((key) => key.startsWith(THREAD_SESSION_KEY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
};

const persistSessionData = ({ sessionKey, guestLabel, csrfToken }) => {
  if (typeof window === "undefined") return;
  if (sessionKey) {
    localStorage.setItem(GUEST_SESSION_KEY, sessionKey);
  }
  if (guestLabel) {
    localStorage.setItem(GUEST_LABEL_KEY, guestLabel);
  }
  if (csrfToken) {
    localStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
  }
};

/**
 * Guest Session Service
 * Provides utilities for managing guest sessions
 */
let isInitializing = false;

export const guestSessionService = {
  /**
   * Initialize a new guest session or retrieve existing one
   */
  initializeSession: async () => {
    // 2. CHECK THE LOCK: If a request is already flying, stop this one.
    if (isInitializing) {
      // Wait a tiny bit or return the existing check
      return new Promise((resolve) => {
        const check = setInterval(() => {
          const session = guestSessionService.getSessionKey();
          if (session) {
            clearInterval(check);
            resolve({
              sessionKey: session,
              guestLabel: guestSessionService.getGuestLabel(),
              csrfToken: guestSessionService.getCsrfToken()
            });
          }
        }, 100);
      });
    }

    // Check if we have a valid existing session
    const existingSession = guestSessionService.getSessionKey();
    const isExpired = guestSessionService.isSessionExpired();

    if (existingSession && !isExpired) {
      const label = guestSessionService.getGuestLabel();
      const csrfToken = guestSessionService.getCsrfToken();
      if (label) {
        return { sessionKey: existingSession, guestLabel: label, csrfToken };
      }
    }

    const retryAt = getStoredRetryAt();
    if (retryAt) {
      const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
      const throttleError = new Error(`Guest session bootstrap is throttled. Retry in ${retryAfterSeconds} seconds.`);
      throttleError.code = "GUEST_SESSION_THROTTLED";
      throttleError.retryAt = retryAt;
      throw throttleError;
    }

    // 3. START THE INITIALIZATION
    try {
      isInitializing = true; // Lock the door

      const { sessionId, guestLabel, csrfToken } = await chatApi.initGuestSession();

      if (typeof window !== "undefined") {
        persistSessionData({ sessionKey: sessionId, guestLabel, csrfToken });
        storeRetryAt(null);

        const expiryTime = Date.now() + SESSION_DURATION;
        localStorage.setItem(GUEST_SESSION_EXPIRY, expiryTime.toString());
      }

      return { sessionKey: sessionId, guestLabel, csrfToken };
    } catch (error) {
      if (error?.response?.status === 429) {
        storeRetryAt(parseThrottleRetryAt(error));
      }
      console.error("Failed to initialize guest session:", error);
      throw error;
    } finally {
      isInitializing = false; // Open the door when finished
    }
  },
  /**
   * Get the current guest session key
   * @returns {string|null}
   */
  getSessionKey: () => {
    if (typeof window === "undefined") return null;
    const canonical = localStorage.getItem(GUEST_SESSION_KEY);
    if (canonical) return canonical;

    // Backward compatibility for older storage key names.
    const legacy = localStorage.getItem(LEGACY_GUEST_SESSION_KEY);
    if (legacy) {
      localStorage.setItem(GUEST_SESSION_KEY, legacy);
      localStorage.removeItem(LEGACY_GUEST_SESSION_KEY);
      return legacy;
    }

    return null;
  },

  /**
   * Get the guest display label (e.g., "Client001")
   * @returns {string|null}
   */
  getGuestLabel: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(GUEST_LABEL_KEY);
  },

  getCsrfToken: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CSRF_TOKEN_KEY);
  },

  setSessionKey: (sessionKey) => {
    if (typeof window === "undefined" || !sessionKey) return;
    localStorage.setItem(GUEST_SESSION_KEY, sessionKey);
    localStorage.removeItem(LEGACY_GUEST_SESSION_KEY);
  },

  setThreadSessionKey: (threadId, sessionKey) => {
    if (typeof window === "undefined" || !threadId || !sessionKey) return;
    const storageKey = makeThreadStorageKey(threadId);
    if (storageKey) {
      localStorage.setItem(storageKey, sessionKey);
    }
  },

  getThreadSessionKey: (threadId) => {
    if (typeof window === "undefined" || !threadId) return null;
    const storageKey = makeThreadStorageKey(threadId);
    return storageKey ? localStorage.getItem(storageKey) : null;
  },

  clearThreadSessionKey: (threadId) => {
    if (typeof window === "undefined" || !threadId) return;
    const storageKey = makeThreadStorageKey(threadId);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  },

  /**
   * Check if the current session is expired
   * @returns {boolean}
   */
  isSessionExpired: () => {
    if (typeof window === "undefined") return true;

    const expiryTime = localStorage.getItem(GUEST_SESSION_EXPIRY);
    if (!expiryTime) return true;

    const now = Date.now();
    const expiry = parseInt(expiryTime, 10);

    return now > expiry;
  },

  /**
   * Update session activity timestamp (refresh expiry)
   */
  updateActivity: () => {
    if (typeof window === "undefined") return;

    const sessionKey = guestSessionService.getSessionKey();
    if (sessionKey) {
      const expiryTime = Date.now() + SESSION_DURATION;
      localStorage.setItem(GUEST_SESSION_EXPIRY, expiryTime.toString());
    }
  },

  /**
   * Clear all guest session data
   * Used after successful account linking
   */
  clearSession: () => {
    if (typeof window === "undefined") return;

    localStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem(LEGACY_GUEST_SESSION_KEY);
    localStorage.removeItem(GUEST_LABEL_KEY);
    localStorage.removeItem(GUEST_SESSION_EXPIRY);
    localStorage.removeItem(CSRF_TOKEN_KEY);
    localStorage.removeItem(GUEST_SESSION_RETRY_AT_KEY);
    clearThreadSessionKeysFromStorage();
  },

  /**
   * Check if user is currently in guest mode
   * @returns {boolean}
   */
  isGuestMode: () => {
    const sessionKey = guestSessionService.getSessionKey();
    const isExpired = guestSessionService.isSessionExpired();

    return !!(sessionKey && !isExpired);
  },

  getSessionRetryAt: () => getStoredRetryAt(),

  /**
   * Preview threads that will be linked when guest converts to user
   * @returns {Promise<{thread_count: number, threads: Array}>}
   */
  previewThreadsForLinking: async () => {
    const sessionKey = guestSessionService.getSessionKey();
    if (!sessionKey) {
      throw new Error("No guest session found");
    }

    try {
      const data = await chatApi.previewGuestThreads(sessionKey);
      return data;
    } catch (error) {
      console.error("Failed to preview threads:", error);
      throw error;
    }
  },

  /**
   * Link guest threads to newly created user account
   * @param {Array<number>|null} threadIds - Optional specific thread IDs to link
   * @returns {Promise<{linked_count: number}>}
   */
  linkThreadsToAccount: async (threadIds = null) => {
    const sessionKey = guestSessionService.getSessionKey();
    if (!sessionKey) {
      throw new Error("No guest session found");
    }

    try {
      const result = await chatApi.linkGuestThreads(sessionKey, threadIds);

      // Clear guest session after successful linking
      guestSessionService.clearSession();

      return result;
    } catch (error) {
      console.error("Failed to link threads:", error);
      throw error;
    }
  },

  /**
   * Get guest threads for current session
   * @returns {Promise<Array>}
   */
  getGuestThreads: async () => {
    const sessionKey = guestSessionService.getSessionKey();
    if (!sessionKey) {
      return [];
    }

    try {
      const data = await chatApi.getGuestThreads();
      return data.results || [];
    } catch (error) {
      console.error("Failed to get guest threads:", error);
      return [];
    }
  },

  /**
   * Get session info for debugging
   * @returns {Object}
   */
  getSessionInfo: () => {
    return {
      sessionKey: guestSessionService.getSessionKey(),
      guestLabel: guestSessionService.getGuestLabel(),
      isExpired: guestSessionService.isSessionExpired(),
      isGuestMode: guestSessionService.isGuestMode(),
    };
  },
};

export default guestSessionService;
