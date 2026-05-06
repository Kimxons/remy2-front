/**
 * Cookie utility functions for browser-side cookie management
 * @module utils/cookies
 */

export const AUTH_SESSION_COOKIE = "authSession";

/**
 * Set a cookie in the browser
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Expiry in days (default: 7)
 */
export const setCookie = (name, value, days = 7) => {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

/**
 * Get a cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
export const getCookie = (name) => {
  if (typeof window === 'undefined') return null;

  const nameEQ = name + "=";
  const ca = document.cookie.split(';');

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }

  return null;
};

/**
 * Delete a cookie by name
 * @param {string} name - Cookie name
 */
export const deleteCookie = (name) => {
  if (typeof window === 'undefined') return;

  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
};

/**
 * Set lightweight auth session cookie for middleware checks
 * @param {number} days - Expiry in days (default: 7)
 */
export const setAuthSessionCookie = (days = 7) => {
  setCookie(AUTH_SESSION_COOKIE, "1", days);
};

/**
 * Clear lightweight auth session cookie
 */
export const clearAuthSessionCookie = () => {
  deleteCookie(AUTH_SESSION_COOKIE);
};
