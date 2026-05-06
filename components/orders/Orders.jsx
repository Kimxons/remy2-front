"use client"

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import httpClient from "../../api/httpClient"
import moment from "moment"
import { triggerClientOnboardingAfterPayment } from "../../utils/clientOnboarding"
import "./Orders.scss"

const PAYMENT_TRACKING_KEY = "pendingPaymentJobId"
const CONFIRMED_PAID_JOBS_KEY = "confirmedPaidJobIds"
const PAYMENT_SUCCESS_STATUSES = ["PAID", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "CLIENT_COMPLETED"]
const PAYMENT_PENDING_STATUSES = ["PROVISIONAL", "PENDING_PAYMENT"]
const formatKES = (value) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

const getConfirmedPaidJobIds = () => {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(CONFIRMED_PAID_JOBS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

const persistConfirmedPaidJobIds = (ids) => {
  if (typeof window === "undefined") return
  localStorage.setItem(CONFIRMED_PAID_JOBS_KEY, JSON.stringify(Array.from(ids)))
}

const getSearchParamValue = (searchParams, key) => {
  const value = searchParams?.[key]
  if (Array.isArray(value)) return value[0] || ""
  return typeof value === "string" ? value : ""
}

const Orders = ({ initialSearchParams = {} }) => {
  const router = useRouter()
  const paymentReference =
    getSearchParamValue(initialSearchParams, "reference") ||
    getSearchParamValue(initialSearchParams, "trxref")
  const paymentStatus = getSearchParamValue(initialSearchParams, "status").toLowerCase()
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem("currentUser")
      return raw ? JSON.parse(raw) : null
    } catch (error) {
      console.error("Failed to parse currentUser from localStorage", error)
      return null
    }
  }, [])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [paymentNotice, setPaymentNotice] = useState(null)
  const isClient = String(currentUser?.role || currentUser?.user?.role || "").toUpperCase() === "CLIENT"

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await httpClient.get("/orders/jobs/")
      setJobs(Array.isArray(res.data) ? res.data : (res.data?.results || []))
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'PROVISIONAL': 'status-provisional',
      'PENDING_PAYMENT': 'status-pending-payment',
      'PAYMENT_FAILED': 'status-failed',
      'PAID': 'status-paid',
      'ASSIGNED': 'status-assigned',
      'IN_PROGRESS': 'status-in-progress',
      'DELIVERED': 'status-delivered',
      'CLIENT_COMPLETED': 'status-completed',
      'DISPUTE_OPEN': 'status-dispute',
      'DISPUTE_RESOLVED': 'status-dispute-resolved',
      'CANCELLED': 'status-cancelled'
    }
    return statusClasses[status] || 'status-default'
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'PROVISIONAL':
      case 'PENDING_PAYMENT':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )
      case 'PAID':
      case 'IN_PROGRESS':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        )
      case 'DELIVERED':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        )
      case 'CLIENT_COMPLETED':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        )
    }
  }

  const handlePayNow = async (job) => {
    try {
      const paidIds = getConfirmedPaidJobIds()
      paidIds.delete(String(job.id))
      persistConfirmedPaidJobIds(paidIds)

      const res = await httpClient.post('/orders/payments/paystack/initialize/', {
        job_id: job.id,
      })

      if (res.data.authorizationUrl) {
        localStorage.setItem(PAYMENT_TRACKING_KEY, String(job.id))
        window.location.href = res.data.authorizationUrl
        return
      }

      alert('Unable to start payment: checkout URL is missing.')
    } catch (err) {
      console.error('Payment initialization failed:', err)
      alert(err.response?.data?.detail || 'Failed to initialize payment')
    }
  }

  const reconcilePaymentAfterRedirect = useCallback(async () => {
    const reference = paymentReference
    const status = paymentStatus
    const trackedJobId = localStorage.getItem(PAYMENT_TRACKING_KEY)

    if (!reference && !trackedJobId && !status) return

    if (status === "failed") {
      setPaymentNotice({ type: "error", message: "Payment failed. You can retry immediately below." })
      return
    }

    setPaymentNotice({ type: "info", message: "Confirming payment status..." })

    // Best-effort verification for backends that expose verify endpoint.
    if (reference) {
      try {
        await httpClient.post("/orders/payments/paystack/verify/", { reference })
      } catch (error) {
        // Verification endpoint may not exist in all deployments; continue with polling.
      }
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const res = await httpClient.get("/orders/jobs/")
        const jobsData = Array.isArray(res.data) ? res.data : (res.data?.results || [])
        setJobs(jobsData)

        if (trackedJobId) {
          const tracked = jobsData.find((job) => String(job.id) === String(trackedJobId))
          if (tracked) {
            if (PAYMENT_SUCCESS_STATUSES.includes(tracked.status)) {
              await triggerClientOnboardingAfterPayment(tracked.id, currentUser?.email || "")
              setPaymentNotice({ type: "success", message: "Payment successful. Your order is now active." })
              const paidIds = getConfirmedPaidJobIds()
              paidIds.add(String(tracked.id))
              persistConfirmedPaidJobIds(paidIds)
              localStorage.removeItem(PAYMENT_TRACKING_KEY)
              return
            }
            if (tracked.status === "PAYMENT_FAILED") {
              setPaymentNotice({ type: "error", message: "Payment failed. You can retry immediately below." })
              const paidIds = getConfirmedPaidJobIds()
              paidIds.delete(String(tracked.id))
              persistConfirmedPaidJobIds(paidIds)
              return
            }
            if (!PAYMENT_PENDING_STATUSES.includes(tracked.status)) {
              localStorage.removeItem(PAYMENT_TRACKING_KEY)
              return
            }
          }
        } else if (status === "success" || status === "successful" || reference) {
          setPaymentNotice({ type: "success", message: "Payment successful. Your order will update shortly." })
          if (trackedJobId) {
            const paidIds = getConfirmedPaidJobIds()
            paidIds.add(String(trackedJobId))
            persistConfirmedPaidJobIds(paidIds)
          }
          return
        }
      } catch (error) {
        // Keep retrying below
      }

      await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    if (status === "success" || status === "successful" || reference) {
      setPaymentNotice({ type: "info", message: "Payment received. Order status update may take a moment." })
    }
  }, [paymentReference, paymentStatus, currentUser?.email])

  useEffect(() => {
    reconcilePaymentAfterRedirect()
  }, [reconcilePaymentAfterRedirect])

  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs

    // Apply status filter
    if (filter === 'pending') {
      filtered = filtered.filter(j => ['PROVISIONAL', 'PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(j.status))
    } else if (filter === 'active') {
      filtered = filtered.filter(j => ['PAID', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'].includes(j.status))
    } else if (filter === 'completed') {
      filtered = filtered.filter(j => j.status === 'CLIENT_COMPLETED')
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(j =>
        j.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.freelancer_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.client_username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    if (sortBy === 'newest') {
      filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (sortBy === 'oldest') {
      filtered = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } else if (sortBy === 'amount-high') {
      filtered = [...filtered].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    } else if (sortBy === 'amount-low') {
      filtered = [...filtered].sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
    }

    return filtered
  }, [jobs, filter, searchQuery, sortBy])

  const stats = useMemo(() => ({
    total: jobs.length,
    active: jobs.filter(j => ['PAID', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'].includes(j.status)).length,
    pending: jobs.filter(j => ['PROVISIONAL', 'PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'CLIENT_COMPLETED').length,
    totalValue: isClient
      ? jobs
          .filter((j) => PAYMENT_SUCCESS_STATUSES.includes(j.status))
          .reduce((sum, j) => sum + Number(j.total_amount || j.price || 0), 0)
      : jobs
          .filter((j) => j.status === "CLIENT_COMPLETED")
          .reduce((sum, j) => {
            const earned = Number(
              j.freelancer_earnings ??
              j.freelancer_payout_amount ??
              j.freelancer_amount ??
              j.amount_to_freelancer ??
              j.net_amount ??
              j.total_amount ??
              0
            )
            return sum + (Number.isFinite(earned) ? earned : 0)
          }, 0),
  }), [jobs, isClient])

  if (loading) {
    return (
      <div className="orders-page">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading your orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="orders-page">
        <div className="error-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Failed to Load Orders</h3>
          <p className="error-message">{error}</p>
          <button onClick={fetchJobs} className="btn-retry">Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="orders-page">
      {/* Hero Header */}
      <div className="orders-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            My Orders
          </h1>
          <p className="hero-subtitle">Track progress, payments, and delivery timelines in one streamlined view.</p>
        </div>
      </div>

      {paymentNotice && (
        <div className={`status-banner ${paymentNotice.type || "info"}`} role="status">
          {paymentNotice.message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="stat-card stat-active">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Active</span>
            <span className="stat-value">{stats.active}</span>
          </div>
        </div>

        <div className="stat-card stat-pending">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Awaiting Payment</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
        </div>

        <div className="stat-card stat-revenue">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">{isClient ? "Total Spent" : "Total Earnings"}</span>
            <span className="stat-value">{formatKES(stats.totalValue)}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search orders by title, description, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div className="filter-group">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>

        <div className="sort-dropdown">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount-high">Amount: High to Low</option>
            <option value="amount-low">Amount: Low to High</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      {filteredAndSortedJobs.length === 0 ? (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <h3>No Orders Found</h3>
          <p>
            {searchQuery
              ? `No orders match "${searchQuery}"`
              : filter !== 'all'
              ? `You don't have any ${filter} orders yet.`
              : "You don't have any orders yet."}
          </p>
          {(searchQuery || filter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setFilter('all')
              }}
              className="btn-clear-filters"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="orders-grid">
          {filteredAndSortedJobs.map((job) => (
            <div key={job.id} className="order-card">
              <div className="order-card-header">
                <div className="order-title-section">
                  <h3 className="order-title">{job.title}</h3>
                  <span className={`status-badge ${getStatusBadgeClass(job.status)}`}>
                    {getStatusIcon(job.status)}
                    {job.status_display || job.status}
                  </span>
                </div>
              </div>

              <div className="order-card-body">
                {job.description && (
                  <p className="order-description">
                    {job.description.length > 120
                      ? `${job.description.substring(0, 120)}...`
                      : job.description}
                  </p>
                )}

                <div className="order-meta">
                  <div className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>{currentUser?.id === job.client_id ? job.freelancer_username : job.client_username}</span>
                  </div>

                  <div className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>{moment(job.created_at).format('MMM DD, YYYY')}</span>
                  </div>

                  {job.delivery_time_days && (
                    <div className="meta-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>{job.delivery_time_days} days</span>
                    </div>
                  )}
                </div>

                <div className="order-amount">
                  <span className="amount-label">Total Amount</span>
                  <span className="amount-value">{formatKES(job.total_amount)}</span>
                </div>
              </div>

              <div className="order-card-footer">
                {['PROVISIONAL', 'PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(job.status) && (
                  <button className="btn-action btn-pay" onClick={() => handlePayNow(job)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                      <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                    {job.status === "PAYMENT_FAILED" ? "Pay Again" : "Pay Now"}
                  </button>
                )}

                <button className="btn-action btn-view" onClick={() => router.push(`/job/${job.id}`)}>
                  View Details
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Orders
