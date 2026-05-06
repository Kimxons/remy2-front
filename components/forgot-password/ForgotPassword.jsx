"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { requestPasswordSetupEmail } from "../../utils/clientOnboarding"
import "./ForgotPassword.scss"

export default function ForgotPassword({ initialEmail = "" }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const isValidEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    [email]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!isValidEmail) {
      setError("Enter a valid email address.")
      return
    }

    setLoading(true)

    try {
      const response = await requestPasswordSetupEmail(email)
      setSuccess(response?.data?.detail || response?.data?.message || "Check your email for the secure setup link.")
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err.message ||
          "Could not send password setup email. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-password">
      <div className="forgot-password__card">
        <h1 className="forgot-password__title">Forgot password?</h1>
        <p className="forgot-password__subtitle">
          Enter your email and we will send you a secure link to set a new password.
        </p>

        {error ? <div className="forgot-password__error">{error}</div> : null}
        {success ? <div className="forgot-password__success">{success}</div> : null}

        <form className="forgot-password__form" onSubmit={handleSubmit}>
          <label htmlFor="email" className="forgot-password__label">Email</label>
          <input
            id="email"
            type="email"
            className="forgot-password__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
            required
          />

          <button
            type="submit"
            className="forgot-password__btn"
            disabled={loading || !isValidEmail}
          >
            {loading ? "Sending..." : "Send setup link"}
          </button>
        </form>

        <Link
          href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className="forgot-password__back"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
