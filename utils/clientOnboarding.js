import httpClient from "../api/httpClient"

const PENDING_CLIENT_EMAILS_KEY = "pendingClientEmailsByJobId"
const COMPLETED_ONBOARDING_JOBS_KEY = "completedClientOnboardingJobIds"
const CSRF_TOKEN_KEY = "csrfToken"
const GUEST_SESSION_KEY = "guestSessionKey"

const readJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

export const ensureCsrfAndSession = async () => {
  try {
    const response = await httpClient.get("/users/csrf-and-session/")
    const data = response?.data || {}

    if (typeof window !== "undefined") {
      const csrfToken = data.csrfToken || data.csrf_token
      const sessionKey = data.sessionId || data.session_key || data.sessionid
      if (csrfToken) localStorage.setItem(CSRF_TOKEN_KEY, csrfToken)
      if (sessionKey) localStorage.setItem(GUEST_SESSION_KEY, sessionKey)
    }
  } catch {
    // Some deployments may not require explicit bootstrap for this endpoint.
  }
}

export const requestPasswordSetupEmail = async (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error("Email is required.")
  }

  await ensureCsrfAndSession()
  return httpClient.post("/users/password/setup/request/", { email: normalizedEmail })
}

export const savePendingClientEmailForJob = (jobId, email) => {
  if (!jobId || !email || typeof window === "undefined") return
  const normalizedEmail = String(email).trim().toLowerCase()
  if (!normalizedEmail) return

  const existing = readJson(PENDING_CLIENT_EMAILS_KEY, {})
  existing[String(jobId)] = normalizedEmail
  writeJson(PENDING_CLIENT_EMAILS_KEY, existing)
}

export const getPendingClientEmailForJob = (jobId) => {
  if (!jobId || typeof window === "undefined") return ""
  const emails = readJson(PENDING_CLIENT_EMAILS_KEY, {})
  return emails[String(jobId)] || ""
}

const markOnboardingCompleted = (jobId) => {
  if (!jobId || typeof window === "undefined") return
  const jobs = new Set(readJson(COMPLETED_ONBOARDING_JOBS_KEY, []).map(String))
  jobs.add(String(jobId))
  writeJson(COMPLETED_ONBOARDING_JOBS_KEY, Array.from(jobs))
}

const isOnboardingCompleted = (jobId) => {
  if (!jobId || typeof window === "undefined") return false
  const jobs = new Set(readJson(COMPLETED_ONBOARDING_JOBS_KEY, []).map(String))
  return jobs.has(String(jobId))
}

export const triggerClientOnboardingAfterPayment = async (jobId, fallbackEmail = "") => {
  if (!jobId || isOnboardingCompleted(jobId)) {
    return { attempted: false, success: false }
  }

  const emailFromStorage = getPendingClientEmailForJob(jobId)
  const email = String(emailFromStorage || fallbackEmail || "").trim().toLowerCase()
  if (!email) {
    return { attempted: false, success: false }
  }

  try {
    const response = await requestPasswordSetupEmail(email)
    markOnboardingCompleted(jobId)
    return {
      attempted: true,
      success: true,
      message: response?.data?.detail || response?.data?.message || "",
    }
  } catch (error) {
    return {
      attempted: true,
      success: false,
      message: error?.response?.data?.detail || error?.message || "Onboarding request failed",
    }
  }
}
