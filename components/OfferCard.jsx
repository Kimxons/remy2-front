"use client"

import { useEffect, useState } from "react"
import chatApi from "../api/chatApi"
import httpClient from "../api/httpClient"
import {
  getPendingClientEmailForJob,
  savePendingClientEmailForJob,
  triggerClientOnboardingAfterPayment,
} from "../utils/clientOnboarding"
import "./OfferCard.scss"

const PAYMENT_TRACKING_KEY = "pendingPaymentJobId"
const CONFIRMED_PAID_JOBS_KEY = "confirmedPaidJobIds"
const PAYMENT_SUCCESS_STATUSES = ["PAID", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "CLIENT_COMPLETED"]
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

const formatUSD = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)

const OfferCard = ({ offer, onAccept, onReject, canRespond, isPending, isCreator }) => {
  const [responding, setResponding] = useState(false)
  const [isInitializingPayment, setIsInitializingPayment] = useState(false)
  const [liveJob, setLiveJob] = useState(null)
  const [paymentSyncState, setPaymentSyncState] = useState("")
  const [isLocallyConfirmedPaid, setIsLocallyConfirmedPaid] = useState(false)

  // Guest Form State
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPassword, setGuestPassword] = useState("")
  const [guestPasswordConfirm, setGuestPasswordConfirm] = useState("")
  const [formError, setFormError] = useState("")

  const readLocalPaidConfirmation = (jobId) => {
    if (!jobId || typeof window === "undefined") return false
    try {
      const raw = localStorage.getItem(CONFIRMED_PAID_JOBS_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) && arr.map(String).includes(String(jobId))
    } catch {
      return false
    }
  }

  // Effect: Poll for job status
  useEffect(() => {
    const jobId = offer?.created_job?.id
    if (!jobId) return
    let isMounted = true
    let intervalId = null
    const fetchJobStatus = async () => {
      try {
        const response = await httpClient.get(`/orders/jobs/${jobId}/`)
        if (!isMounted) return
        setLiveJob(response.data)
      } catch (error) {}
    }
    fetchJobStatus()
    intervalId = window.setInterval(fetchJobStatus, 8000)
    return () => {
      isMounted = false
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [offer?.created_job?.id])

  // Effect: Watch local storage for payment updates
  useEffect(() => {
    const jobId = offer?.created_job?.id
    if (!jobId || typeof window === "undefined") return
    const refresh = () => setIsLocallyConfirmedPaid(readLocalPaidConfirmation(jobId))
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [offer?.created_job?.id])

  // Effect: Handle redirect back from payment provider
  useEffect(() => {
    const jobId = offer?.created_job?.id
    if (!jobId || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const statusParam = String(params.get("status") || "").toLowerCase()
    if (!statusParam) return
    let isMounted = true

    const clearPaymentParams = () => {
      const current = new URL(window.location.href)
      current.searchParams.delete("status")
      current.searchParams.delete("job_id")
      window.history.replaceState({}, "", `${current.pathname}${current.search}`)
    }

    const syncPaymentState = async () => {
      if (statusParam === "failed" || statusParam === "cancelled") {
        if (!isMounted) return
        setPaymentSyncState("failed")
        clearPaymentParams()
        return
      }
      setPaymentSyncState("syncing")
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          const response = await httpClient.get(`/orders/jobs/${jobId}/`)
          const job = response.data
          if (!isMounted) return
          setLiveJob(job)
          if (PAYMENT_SUCCESS_STATUSES.includes(job?.status)) {
            setPaymentSyncState("success")
            setIsLocallyConfirmedPaid(true)
            const raw = localStorage.getItem(CONFIRMED_PAID_JOBS_KEY)
            const arr = raw ? JSON.parse(raw) : []
            const ids = new Set(arr.map(String))
            ids.add(String(jobId))
            localStorage.setItem(CONFIRMED_PAID_JOBS_KEY, JSON.stringify(Array.from(ids)))
            await triggerClientOnboardingAfterPayment(jobId)
            clearPaymentParams()
            return
          }
        } catch (error) {}
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      setPaymentSyncState("")
      clearPaymentParams()
    }
    syncPaymentState()
    return () => { isMounted = false }
  }, [offer?.created_job?.id])

  const jobStatus = liveJob?.status || offer?.created_job?.status
  const jobStatusDisplay = liveJob?.status_display || offer?.created_job?.status_display || jobStatus
  const initialPaymentRequired =
    typeof liveJob?.payment_required === "boolean"
      ? liveJob.payment_required
      : !!offer?.created_job?.payment_required
  const hasConfirmedPayment = paymentSyncState === "success" || isLocallyConfirmedPaid
  const paymentRequired = !hasConfirmedPayment && initialPaymentRequired && !PAYMENT_SUCCESS_STATUSES.includes(jobStatus)
  const isPaymentFailed = jobStatus === "PAYMENT_FAILED"

  const handleAccept = async () => {
    setResponding(true)
    try { await onAccept(offer.id) } catch (error) {} finally { setResponding(false) }
  }

  const handleReject = async () => {
    setResponding(true)
    try { await onReject(offer.id) } catch (error) {} finally { setResponding(false) }
  }

  const handlePayNowTrigger = () => {
    const jobId = offer?.created_job?.id
    if (!jobId) return alert("Missing job reference.")

    const accessToken = localStorage.getItem("accessToken")
    const guestSessionKey = localStorage.getItem("guestSessionKey")
    const isGuestFlow = !accessToken && !!guestSessionKey

    if (isGuestFlow) {
      setGuestEmail(getPendingClientEmailForJob(jobId) || "")
      setShowGuestForm(true)
    } else {
      processPayment({}) 
    }
  }

  const processPayment = async (onboardingData) => {
    const jobId = offer?.created_job?.id
    setIsInitializingPayment(true)
    setFormError("")

    setIsLocallyConfirmedPaid(false)
    try {
      const raw = localStorage.getItem(CONFIRMED_PAID_JOBS_KEY)
      const arr = raw ? JSON.parse(raw) : []
      const ids = new Set(arr.map(String))
      ids.delete(String(jobId))
      localStorage.setItem(CONFIRMED_PAID_JOBS_KEY, JSON.stringify(Array.from(ids)))
    } catch {}

    try {

      const paymentOptions = {
        session_key: localStorage.getItem("guestSessionKey"),

        client_email: onboardingData.client_email,
        client_password: onboardingData.client_password,
        client_password_confirm: onboardingData.client_password_confirm,
      }
      const paymentData = await chatApi.initializeJobPayment(jobId, paymentOptions)
      
      // backend returns 'authorization_url'
      const redirectUrl = paymentData.authorization_url || paymentData.authorizationUrl

      if (redirectUrl) {
        if (onboardingData.client_email) {
            savePendingClientEmailForJob(jobId, onboardingData.client_email)
        }
        localStorage.setItem(PAYMENT_TRACKING_KEY, String(jobId))
        window.location.href = redirectUrl
      } else {
        throw new Error("No payment link received.")
      }
    } catch (error) {
      const detail = error.response?.data?.error || error.response?.data?.detail || "Failed to initialize payment."
      setFormError(detail)
    } finally {
      setIsInitializingPayment(false)
    }
  }

  const handleGuestFormSubmit = (e) => {
    e.preventDefault()
    if (!EMAIL_REGEX.test(guestEmail)) return setFormError("Invalid email address.")
    if (guestPassword.length < MIN_PASSWORD_LENGTH) return setFormError("Password must be 8+ characters.")
    if (guestPassword !== guestPasswordConfirm) return setFormError("Passwords do not match.")

    // Sending snake_case keys to match Django Serializer
    processPayment({
      client_email: guestEmail.trim().toLowerCase(),
      client_password: guestPassword,
      client_password_confirm: guestPasswordConfirm,
    })
  }

  const getStatusBadge = () => {
    if (offer.status === "accepted") return <span className="status-badge status-accepted">Accepted</span>
    if (offer.status === "rejected") return <span className="status-badge status-rejected">Rejected</span>
    return <span className="status-badge status-pending">Pending Response</span>
  }

  return (
    <div className="offer-card">
      <div className="offer-card-header">
        <div className="offer-title-section">
          <h3 className="offer-label">Project Offer</h3>
        </div>
        {getStatusBadge()}
      </div>

      <div className="offer-card-body">
        <div className="offer-detail">
          <label>Title</label>
          <p className="offer-title">{offer.title}</p>
        </div>
        <div className="offer-metrics">
          <div className="metric-item">
            <label>Price</label>
            <p className="metric-value">{formatUSD(offer.price)}</p>
          </div>
          <div className="metric-item">
            <label>Timeline</label>
            <p className="metric-value">{offer.timeline} days</p>
          </div>
        </div>
      </div>

      {offer.status === 'accepted' && offer.created_job && (
        <div className="offer-job-created">
          <div className="job-created-header">
            <h4>{paymentRequired ? "Job Created!" : "Payment Confirmed"}</h4>
            <p className="job-status">Status: <strong>{jobStatusDisplay}</strong></p>
          </div>

          {paymentRequired && (
            <div className="payment-required-section">
              {!showGuestForm ? (
                <>
                  <div className="payment-warning">
                    <span>
                      {paymentSyncState === "syncing" ? "Confirming..." : "Payment required to start work"}
                    </span>
                  </div>
                  <button onClick={handlePayNowTrigger} disabled={isInitializingPayment} className="btn-pay-now">
                    {isInitializingPayment ? "Loading..." : isPaymentFailed ? "Retry Payment" : "Pay Now"}
                  </button>
                </>
              ) : (
                <form onSubmit={handleGuestFormSubmit} className="guest-auth-form">
                  <div className="auth-row">
                    <p>Create Account</p>
                    <button type="button" onClick={() => setShowGuestForm(false)}>✕</button>
                  </div>
                  <input 
                    type="email" placeholder="Email Address" required
                    value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
                  />
                  <div className="auth-grid">
                    <input 
                      type="password" placeholder="Password" required
                      value={guestPassword} onChange={(e) => setGuestPassword(e.target.value)}
                    />
                    <input 
                      type="password" placeholder="Confirm" required
                      value={guestPasswordConfirm} onChange={(e) => setGuestPasswordConfirm(e.target.value)}
                    />
                  </div>
                  {formError && <p className="auth-error">{formError}</p>}
                  <button type="submit" disabled={isInitializingPayment} className="btn-auth-submit">
                    {isInitializingPayment ? "Initializing..." : "Secure & Pay Now"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {canRespond && isPending && !isCreator && (
        <div className="offer-card-actions">
          <button onClick={handleAccept} disabled={responding} className="btn-action btn-accept">Accept</button>
          <button onClick={handleReject} disabled={responding} className="btn-action btn-reject">Reject</button>
        </div>
      )}
    </div>
  )
}

export default OfferCard 