// 1. THIS IS THE LOCK: It must stay outside the function.
// It tracks if a guest account request is currently "in flight."
let guestAuthPromise = null;
const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:8000";

const resolveApiOrigin = () => {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configuredBase) {
    return DEFAULT_DEV_API_ORIGIN;
  }

  return configuredBase.replace(/\/api\/?$/, "");
};

export const ensureGuestAuth = async () => {
  // Check if we already have a token in storage
  const access = localStorage.getItem("access");
  if (access) return true;

  // 2. CHECK THE LOCK: 
  // If a request is already running, return that existing promise 
  // instead of starting a second network call.
  if (guestAuthPromise) {
    return guestAuthPromise;
  }

  // 3. START THE REQUEST:
  // We wrap the logic in a promise and assign it to our lock variable.
  guestAuthPromise = (async () => {
    const baseUrl = resolveApiOrigin();

    try {
      const res = await fetch(`${baseUrl}/api/users/token/guest/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Guest auth failed");

      const data = await res.json();

      // Save the credentials to storage
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      localStorage.setItem("username", data.username);

      return true;
    } catch (err) {
      console.error("Guest auth failed:", err);
      return false;
    } finally {
      // 4. RELEASE THE LOCK:
      // Once the request is done (success or failure), clear the promise
      // so the function can be used again if needed later.
      guestAuthPromise = null;
    }
  })();

  return guestAuthPromise;
};
