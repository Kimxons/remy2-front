"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import httpClient from "../../api/httpClient"
import { requestPasswordSetupEmail } from "../../utils/clientOnboarding"
import "./PasswordSetup.scss"

const getSearchParamValue = (searchParams, key) => {
  const value = searchParams?.[key]
  if (Array.isArray(value)) return value[0] || ""
  return typeof value === "string" ? value : ""
}

export default function PasswordSetup({ initialSearchParams = {} }) {
  const router = useRouter()
  const uid =
    getSearchParamValue(initialSearchParams, "uid") ||
    getSearchParamValue(initialSearchParams, "uidb64")
  const token = getSearchParamValue(initialSearchParams, "token")
  const emailHint = getSearchParamValue(initialSearchParams, "email")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [requestEmail, setRequestEmail] = useState(emailHint)
  const [setupLink, setSetupLink] = useState("")
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestMessage, setRequestMessage] = useState("")

  const canSubmit = useMemo(
    () => Boolean(uid && token && password && confirmPassword && !loading),
    [uid, token, password, confirmPassword, loading]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!uid || !token) {
      setError("Invalid or missing setup link. Open the latest email link and try again.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await httpClient.post("/users/password/setup/confirm/", {
        uid,
        token,
        password,
        confirm_password: confirmPassword,
      })

      setSuccess("Password set successfully. You can now sign in.")
      setTimeout(() => {
        const target = emailHint
          ? `/login?email=${encodeURIComponent(emailHint)}`
          : "/login"
        router.push(target, { replace: true })
      }, 1200)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err?.response?.data?.token ||
          err?.response?.data?.uid ||
          err.message ||
          "Unable to set password. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSetupLink = async (e) => {
    e.preventDefault()
    setError("")
    setRequestMessage("")

    if (!requestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail)) {
      setError("Enter a valid email address.")
      return
    }

    setRequestLoading(true)
    try {
      const response = await requestPasswordSetupEmail(requestEmail)
      const data = response?.data || {}

      setRequestMessage(
        data?.detail || data?.message || "Setup link sent. Check your email."
      )
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err.message ||
          "Unable to send setup link. Please try again."
      )
    } finally {
      setRequestLoading(false)
    }
  }

  const handleUseSetupLink = (e) => {
    e.preventDefault()
    setError("")
    setRequestMessage("")

    if (!setupLink.trim()) {
      setError("Paste the full setup link from your email.")
      return
    }

    try {
      const url = new URL(setupLink.trim())
      const parsedUid = url.searchParams.get("uid") || url.searchParams.get("uidb64")
      const parsedToken = url.searchParams.get("token")
      const parsedEmail = url.searchParams.get("email") || requestEmail || emailHint

      if (!parsedUid || !parsedToken) {
        setError("This link is missing uid/token. Use the latest setup link email.")
        return
      }

      const params = new URLSearchParams({
        uid: parsedUid,
        token: parsedToken,
      })
      if (parsedEmail) {
        params.set("email", parsedEmail)
      }

      router.replace(`/password/setup?${params.toString()}`)
    } catch {
      setError("Invalid link format. Paste the full URL from your setup email.")
    }
  }

  return (
    <div className="password-setup">
      <div className="password-setup__card">
        <h1 className="password-setup__title">Set your account password</h1>

        {!uid || !token ? (
          <div className="password-setup__notice">
            <p>
              Open the secure setup link sent to your email to continue.
            </p>
            <form className="password-setup__request-form" onSubmit={handleUseSetupLink}>
              <label className="password-setup__label" htmlFor="setupLink">I have my setup link</label>
              <input
                id="setupLink"
                className="password-setup__input"
                type="url"
                value={setupLink}
                onChange={(e) => setSetupLink(e.target.value)}
                placeholder="https://.../password/setup?uid=...&token=..."
                disabled={requestLoading}
              />
              <button type="submit" className="password-setup__btn" disabled={requestLoading}>
                Use this link
              </button>
            </form>
            <form className="password-setup__request-form" onSubmit={handleRequestSetupLink}>
              <label className="password-setup__label" htmlFor="requestEmail">Email</label>
              <input
                id="requestEmail"
                className="password-setup__input"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={requestLoading}
                required
              />
              <button type="submit" className="password-setup__btn" disabled={requestLoading}>
                {requestLoading ? "Sending..." : "Send setup link"}
              </button>
            </form>
            {requestMessage ? <p className="password-setup__inline-success">{requestMessage}</p> : null}
            {emailHint ? <p>Check <strong>{emailHint}</strong> for the latest email.</p> : null}
            <Link href="/login" className="password-setup__link">Back to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="password-setup__form">
            {error ? <div className="password-setup__error">{error}</div> : null}
            {success ? <div className="password-setup__success">{success}</div> : null}

            <label className="password-setup__label" htmlFor="password">New password</label>
            <input
              id="password"
              className="password-setup__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <label className="password-setup__label" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              className="password-setup__input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              required
            />

            <button type="submit" className="password-setup__btn" disabled={!canSubmit}>
              {loading ? "Saving..." : "Set Password"}
            </button>

            <Link href="/login" className="password-setup__link">Back to Sign In</Link>
          </form>
        )}
      </div>
    </div>
  )
}
