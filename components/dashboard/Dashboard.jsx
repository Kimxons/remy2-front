"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import PropTypes from "prop-types"
import httpClient from "../../api/httpClient"
import chatApi from "../../api/chatApi"
import ErrorBoundary from "../../components/ErrorBoundary"
import DashboardStats from "../../components/DashboardStats"
import MessageCenter from "../../components/MessageCenter"
import OfferManagement from "../../components/OfferManagement"
import EmptyState from "../../components/EmptyState"
import LoadingState from "../../components/LoadingState"
import "./Dashboard.scss"

/**
 * Dashboard Component - Production-Grade Implementation
 *
 * Features:
 * - Role-based UI (Freelancer, Client, Admin)
 * - Real-time message and offer management
 * - Comprehensive error handling with retry logic
 * - Loading states and skeleton loaders
 * - Empty states with actionable CTAs
 * - Auto-refresh with configurable intervals
 * - Responsive design with accessibility
 *
 * @component
 */
const Dashboard = () => {
  const PAYMENT_TRACKING_KEY = "pendingPaymentJobId"
  const formatKES = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0))

  const createDefaultSummary = () => ({
    stats: {
      activeOrders: 0,
      completed: 0,
      earnings: 0,
      rating: 0,
      avgResponseTime: "N/A",
      totalThreads: 0,
      unreadMessages: 0,
    },
    recentJobs: [],
    notifications: [],
    timestamp: null,
  })

  const normalizeSummaryResponse = (payload) => {
    const data = payload && typeof payload === "object" ? payload : {}
    const statsSource = data.stats && typeof data.stats === "object" ? data.stats : data

    return {
      stats: {
        activeOrders: Number(
          statsSource.activeOrders ??
            statsSource.active_orders ??
            statsSource.activeJobs ??
            statsSource.active_jobs ??
            0
        ),
        completed: Number(
          statsSource.completed ??
            statsSource.completed_orders ??
            statsSource.completedJobs ??
            statsSource.completed_jobs ??
            0
        ),
        earnings: Number(
          statsSource.earnings ??
            statsSource.total_earnings ??
            statsSource.revenue ??
            statsSource.total_revenue ??
            0
        ),
        rating: Number(statsSource.rating ?? statsSource.avg_rating ?? 0),
        avgResponseTime:
          statsSource.avgResponseTime ?? statsSource.avg_response_time ?? "N/A",
        totalThreads: Number(statsSource.totalThreads ?? statsSource.total_threads ?? 0),
        unreadMessages: Number(
          statsSource.unreadMessages ?? statsSource.unread_messages ?? 0
        ),
      },
      recentJobs: Array.isArray(data.recentJobs)
        ? data.recentJobs
        : Array.isArray(data.recent_jobs)
        ? data.recent_jobs
        : Array.isArray(data.jobs)
        ? data.jobs
        : [],
      notifications: Array.isArray(data.notifications)
        ? data.notifications
        : Array.isArray(data.recent_notifications)
        ? data.recent_notifications
        : [],
      timestamp: data.timestamp || new Date().toISOString(),
    }
  }

  const normalizeListResponse = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.results)) return payload.results
    if (Array.isArray(payload?.data)) return payload.data
    return []
  }

  const parseNumber = (...values) => {
    for (const value of values) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
  }

  // ===== State Management =====
  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return null;

    try {
      const userString = localStorage.getItem("currentUser")
      return userString ? JSON.parse(userString) : null
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error)
      return null
    }
  }, [])

  const userRole = storedUser?.role

  // Check for token in multiple locations - the token might be stored separately
  const hasToken = useMemo(() => {
    if (typeof window === 'undefined') return false;

    return !!(
      storedUser?.token ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token")
    )
  }, [storedUser])

  const userName = storedUser?.username || 'User'
  const router = useRouter()
  const queryClient = useQueryClient()

  const [summaryData, setSummaryData] = useState(createDefaultSummary)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const isFreelancer = userRole === "FREELANCER" || userRole === "ADMIN"
  const isClient = userRole === "CLIENT"

  // ===== Auto-refresh Configuration =====
  const REFETCH_INTERVAL = 30000 // 30 seconds
  const MAX_RETRY_ATTEMPTS = 3

  // ===== Authentication Check =====
  useEffect(() => {
    // Only redirect if we definitively have no authentication
    // If we have a user object with a role, consider them authenticated
    if (!storedUser || !userRole) {
      console.warn("No user data found, redirecting to login")
      router.push("/login", { replace: true })
    } else {
      console.log("Dashboard: User authenticated", { username: userName, role: userRole, hasToken })
    }
  }, [storedUser, userRole, router, userName, hasToken])

  // ===== Dashboard Summary Fetch with Error Handling =====
  const fetchDashboardSummary = useCallback(async () => {
    if (!userRole) {
      setSummaryLoading(false)
      return
    }

    try {
      const res = await httpClient.get("/users/dashboard/summary/")
      setSummaryData(normalizeSummaryResponse(res.data))
      setSummaryError(null)
      setRetryCount(0)
    } catch (err) {
      console.error("Dashboard summary fetch error:", err)

      // Fallback for deployments where /users/dashboard/summary/ is unstable
      try {
        const fallback = await chatApi.getDashboardSummary()
        setSummaryData(normalizeSummaryResponse(fallback))
        setSummaryError(null)
        setRetryCount(0)
        return
      } catch (fallbackErr) {
        console.error("Dashboard fallback summary fetch error:", fallbackErr)
        setSummaryError(fallbackErr)
      }

      // Auto-retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS && err.response?.status !== 401) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
        }, 2000 * (retryCount + 1)) // Exponential backoff
      }
    } finally {
      setSummaryLoading(false)
    }
  }, [userRole, retryCount])

  useEffect(() => {
    fetchDashboardSummary()
  }, [fetchDashboardSummary])

  // ===== Fetch Chat Threads =====
  const {
    data: threadsData,
    isLoading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads
  } = useQuery({
    queryKey: ["chatThreads", userRole],
    queryFn: chatApi.getThreads,
    enabled: !!userRole && userRole !== "GUEST",
    refetchInterval: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error("Threads query error:", error)
      if (error.response?.status === 401) {
        router.push("/login", { replace: true })
      }
    }
  })

  const recentThreads = useMemo(() => threadsData?.results || [], [threadsData])

  const {
    data: allJobs = [],
    isLoading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ["dashboardJobs", userRole],
    queryFn: async () => {
      const pageSize = 100
      let page = 1
      let hasNext = true
      const collected = []

      while (hasNext) {
        const response = await httpClient.get("/orders/jobs/", {
          params: { page, page_size: pageSize }
        })
        const data = response.data
        const results = normalizeListResponse(data)
        collected.push(...results)

        if (Array.isArray(data) || !data?.next || results.length === 0) {
          hasNext = false
        } else {
          page += 1
        }

        if (page > 50) {
          hasNext = false
        }
      }

      return collected
    },
    enabled: !!userRole && userRole !== "GUEST",
    refetchInterval: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  const { data: unreadCountData } = useQuery({
    queryKey: ["dashboardUnreadCount", userRole],
    queryFn: chatApi.getUnreadCount,
    enabled: !!userRole && userRole !== "GUEST",
    refetchInterval: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // ===== Fetch Pending Offers (Freelancers Only) =====
  const {
    data: pendingOffersData,
    isLoading: offersLoading,
    error: offersError,
    refetch: refetchOffers
  } = useQuery({
    queryKey: ["pendingOffers", userRole],
    queryFn: chatApi.getPendingOffers,
    enabled: isFreelancer,
    refetchInterval: REFETCH_INTERVAL,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error("Pending offers query error:", error)
      if (error.response?.status === 401) {
        router.push("/login", { replace: true })
      }
    }
  })

  const pendingOffers = useMemo(
    () => pendingOffersData?.pending_offers || [],
    [pendingOffersData]
  )

  const computedStats = useMemo(() => {
    const fallbackStats = summaryData.stats || {}
    const useJobDerived = !jobsLoading && !jobsError
    const normalizedRole = String(userRole || "").toUpperCase()
    const currentUserId = String(
      storedUser?.id || storedUser?.user_id || storedUser?.pk || ""
    )
    const activeStatuses = new Set(["PAID", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "DISPUTE_OPEN"])
    const completedStatuses = new Set(["CLIENT_COMPLETED", "DISPUTE_RESOLVED"])
    const cancelledStatuses = new Set(["CANCELLED", "PAYMENT_FAILED"])
    const myJobs = allJobs.filter((job) => {
      if (!job || typeof job !== "object") return false
      const freelancerId = String(job.freelancer_id || job.freelancer?.id || job.freelancer?.pk || "")
      const clientId = String(job.client_id || job.client?.id || job.client?.pk || "")
      if (normalizedRole === "CLIENT") return !!currentUserId && clientId === currentUserId
      if (normalizedRole === "FREELANCER" || normalizedRole === "ADMIN") {
        return !!currentUserId && freelancerId === currentUserId
      }
      return false
    })

    const activeOrdersFromJobs = myJobs.filter((job) => activeStatuses.has(String(job.status || "").toUpperCase())).length
    const completedFromJobs = myJobs.filter((job) => completedStatuses.has(String(job.status || "").toUpperCase())).length
    const earningsFromJobs = myJobs
      .filter((job) => completedStatuses.has(String(job.status || "").toUpperCase()))
      .reduce((sum, job) => {
        const payout = parseNumber(
          job.freelancer_earnings,
          job.freelancer_payout_amount,
          job.freelancer_amount,
          job.amount_to_freelancer,
          job.net_amount,
          job.total_amount,
          job.price
        )
        return sum + (payout || 0)
      }, 0)

    const unreadFromThreads = recentThreads.reduce((sum, thread) => {
      const unread = parseNumber(thread?.unread_count, thread?.unread_messages, thread?.unread)
      return sum + (unread || 0)
    }, 0)
    const unreadFromApi = parseNumber(unreadCountData?.unread_count, unreadCountData?.count)

    const responseSamples = recentThreads
      .map((thread) =>
        parseNumber(
          thread?.avg_response_minutes,
          thread?.avg_response_time_minutes,
          thread?.response_time_minutes,
          thread?.response_minutes,
          thread?.first_response_minutes
        )
      )
      .filter((value) => value != null && value >= 0)
    const avgResponseFromThreads = responseSamples.length
      ? `${Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length)} min`
      : null

    const ratingFromUser = parseNumber(
      storedUser?.average_rating,
      storedUser?.avg_rating,
      storedUser?.rating,
      storedUser?.profile?.average_rating,
      storedUser?.profile?.avg_rating,
      storedUser?.profile?.rating
    )
    const ratingFromSummary = parseNumber(fallbackStats.rating, fallbackStats.avg_rating)

    return {
      activeOrders: useJobDerived
        ? activeOrdersFromJobs
        : parseNumber(fallbackStats.activeOrders, fallbackStats.active_orders) || 0,
      completed: useJobDerived
        ? completedFromJobs
        : parseNumber(fallbackStats.completed, fallbackStats.completed_orders) || 0,
      earnings: useJobDerived
        ? earningsFromJobs
        : parseNumber(fallbackStats.earnings, fallbackStats.total_earnings, fallbackStats.revenue) || 0,
      rating: ratingFromUser ?? ratingFromSummary ?? 0,
      avgResponseTime: avgResponseFromThreads || fallbackStats.avgResponseTime || fallbackStats.avg_response_time || "N/A",
      unreadMessages:
        unreadFromApi ?? unreadFromThreads ?? parseNumber(fallbackStats.unreadMessages, fallbackStats.unread_messages) ?? 0,
      cancelledOrders: myJobs.filter((job) => cancelledStatuses.has(String(job.status || "").toUpperCase())).length,
      totalThreads: parseNumber(fallbackStats.totalThreads, fallbackStats.total_threads) || recentThreads.length || 0,
    }
  }, [summaryData.stats, userRole, storedUser, allJobs, recentThreads, unreadCountData, jobsLoading, jobsError])

  const dashboardJobsForRole = useMemo(() => {
    const normalizedRole = String(userRole || "").toUpperCase()
    const currentUserId = String(
      storedUser?.id || storedUser?.user_id || storedUser?.pk || ""
    )

    const roleJobs = allJobs.filter((job) => {
      if (!job || typeof job !== "object") return false
      const freelancerId = String(job.freelancer_id || job.freelancer?.id || job.freelancer?.pk || "")
      const clientId = String(job.client_id || job.client?.id || job.client?.pk || "")
      if (normalizedRole === "CLIENT") return !!currentUserId && clientId === currentUserId
      if (normalizedRole === "FREELANCER" || normalizedRole === "ADMIN") {
        return !!currentUserId && freelancerId === currentUserId
      }
      return false
    })

    return roleJobs
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 6)
  }, [allJobs, userRole, storedUser])

  // ===== Offer Accept/Reject Mutation =====
  const updateOfferMutation = useMutation({
    mutationFn: ({ threadId, offerId, decision }) =>
      chatApi.updateOfferStatus(threadId, offerId, decision),
    onMutate: async () => {
      // Optimistic update could be added here
      return { startTime: Date.now() }
    },
    onSuccess: async (data, variables, context) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["pendingOffers"] })
      queryClient.invalidateQueries({ queryKey: ["chatThreads"] })

      // Show success notification
      if (data.job_created) {
        const message = `✓ Offer ${variables.decision}! Job "${data.job_created.title}" created successfully.`
        alert(message) // Replace with toast notification in production

        if (data.job_created.payment_required && data.job_created.id) {
          try {
            const paymentData = await chatApi.initializeJobPayment(data.job_created.id)
            if (paymentData.authorizationUrl) {
              localStorage.setItem(PAYMENT_TRACKING_KEY, String(data.job_created.id))
              window.location.href = paymentData.authorizationUrl
              return
            }
          } catch (error) {
            console.error("Payment initialization failed:", error)
            alert(error.response?.data?.detail || "Failed to initialize payment. Open the accepted offer and use Pay Now to retry.")
          }
        }
      } else {
        alert(`✓ Offer ${variables.decision} successfully!`)
      }

      // Refetch summary to update stats
      fetchDashboardSummary()
    },
    onError: (error, variables) => {
      console.error("Failed to update offer:", error)
      const errorMessage = error.response?.data?.error || error.message || "Failed to update offer"
      alert(`✗ Error: ${errorMessage}. Please try again.`)
    },
  })

  // ===== Offer Handlers =====
  const handleAcceptOffer = useCallback((offerId, threadId) => {
    if (!offerId || !threadId) {
      console.error("Missing offerId or threadId")
      return
    }

    if (window.confirm("Are you sure you want to accept this offer? This will create a job.")) {
      updateOfferMutation.mutate({
        threadId,
        offerId,
        decision: "accepted",
      })
    }
  }, [updateOfferMutation])

  const handleRejectOffer = useCallback((offerId, threadId) => {
    if (!offerId || !threadId) {
      console.error("Missing offerId or threadId")
      return
    }

    if (window.confirm("Are you sure you want to reject this offer?")) {
      updateOfferMutation.mutate({
        threadId,
        offerId,
        decision: "rejected",
      })
    }
  }, [updateOfferMutation])

  // ===== Notification Helpers =====
  const getNoteClass = useCallback((note) => {
    if (note.type === 'message') return 'message'
    if (note.text.toLowerCase().includes('order') || note.text.toLowerCase().includes('job')) {
      return 'order'
    }
    if (note.text.toLowerCase().includes('payment') || note.text.toLowerCase().includes('earnings')) {
      return 'payment'
    }
    if (note.text.toLowerCase().includes('review') || note.text.toLowerCase().includes('rating')) {
      return 'review'
    }
    return ''
  }, [])

  // ===== Render: Loading State =====
  if (summaryLoading && !summaryData.timestamp) {
    return <LoadingState fullScreen message="Loading your dashboard..." />
  }

  // ===== Render: Error State with Retry =====
  if (summaryError && !summaryData.timestamp) {
    return (
      <div className="dashboard-error">
        <EmptyState
          icon="inbox"
          title="Failed to load dashboard"
          message={summaryError.response?.data?.error || "An error occurred while loading your dashboard"}
        />
        <button
          onClick={() => {
            setRetryCount(0)
            fetchDashboardSummary()
          }}
          className="retry-btn"
        >
          Retry
        </button>
      </div>
    )
  }

  const { notifications } = summaryData
  const jobsToRender = dashboardJobsForRole

  // ===== Main Render =====
  return (
    <ErrorBoundary
      fallbackMessage="Something went wrong with the dashboard. Please refresh the page."
      onReset={() => window.location.reload()}
    >
      <div className="dashboard">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="dashboard-title">Welcome back, {userName}. Let’s make progress today.</h1>
              <p className="dashboard-subtitle">
                {isClient
                  ? "Launch your next request in minutes and track every deliverable from one place."
                  : "Respond faster, close more offers, and keep your active work moving forward."}
              </p>
            </div>
          </div>
        </header>

        {/* Stats Section */}
        
        {!isClient && (
          <section className="stats-section">
            <DashboardStats stats={computedStats} userRole={userRole} />
          </section>
        )}

        {/* Recent Activity / Notifications */}
        <section className="notifications-section">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
            {notifications.length > 5 && (
                <Link href="/notifications" className="section-link">
                  See All Activity
                </Link>
              )}
          </div>

          {notifications.length > 0 ? (
            <ul className="notifications-list">
              {notifications.slice(0, 5).map((note) => (
                <li
                  key={note.id}
                  className={`notification-item ${getNoteClass(note)} ${
                    note.is_read ? '' : 'unread'
                  }`}
                >
                  <Link href={note.link || '#'} className="notification-link">
                    <span className="notification-text">{note.text}</span>
                    <span className="notification-time">
                      {new Date(note.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="inbox"
              title="No recent activity"
              message="Your recent activity will appear here"
            />
          )}
        </section>

        {/* Messages Section */}
        <section className="messages-section">
          <div className="section-header">
            <h2 className="section-title">Recent Messages</h2>
            {recentThreads.length > 0 && (
                <Link href="/messages" className="section-link">
                  Open Inbox
                </Link>
              )}
          </div>

          <ErrorBoundary fallbackMessage="Failed to load messages">
            <MessageCenter
              threads={recentThreads}
              isLoading={threadsLoading}
              currentUsername={userName}
              maxDisplay={5}
            />
          </ErrorBoundary>

          {threadsError && (
            <div className="section-error">
              <p>Failed to load messages</p>
              <button onClick={() => refetchThreads()} className="retry-link">
                Retry
              </button>
            </div>
          )}
        </section>

        {/* Pending Offers Section (Freelancers Only) */}
        {isFreelancer && (
          <section className="offers-section">
            <div className="section-header">
              <h2 className="section-title">
                Pending Offers
                {pendingOffers.length > 0 && (
                  <span className="section-badge">{pendingOffers.length}</span>
                )}
              </h2>
            </div>

            <ErrorBoundary fallbackMessage="Failed to load offers">
              <OfferManagement
                offers={pendingOffers}
                isLoading={offersLoading}
                onAccept={handleAcceptOffer}
                onReject={handleRejectOffer}
                isProcessing={updateOfferMutation.isPending}
              />
            </ErrorBoundary>

            {offersError && (
              <div className="section-error">
                <p>Failed to load offers</p>
                <button onClick={() => refetchOffers()} className="retry-link">
                  Retry
                </button>
              </div>
            )}
          </section>
        )}

        {/* Recent Jobs/Orders Section */}
        <section className="jobs-section">
          <div className="section-header">
            <h2 className="section-title">
              {isClient ? "My Recent Orders" : "Active Tasks"}
            </h2>
            {jobsToRender.length > 0 && (
              <Link href="/orders" className="section-link">
                See All {isClient ? "Orders" : "Tasks"}
              </Link>
            )}
          </div>

          {jobsToRender.length > 0 ? (
            <div className="job-grid">
              {jobsToRender.map((job) => (
                <div className="job-card" key={job.id}>
                  <div className="job-card-header">
                    <h3 className="job-title">{job.title}</h3>
                    <span className={`job-status status-${job.status}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="job-subject">{job.subject?.name || 'N/A'}</p>
                  <div className="job-meta">
                    <span className="job-price">
                      {formatKES(job.price ?? job.total_amount ?? 0)}
                    </span>
                    <span className="job-deadline">
                      {job.deadline
                        ? `Due: ${new Date(job.deadline).toLocaleDateString()}`
                        : `Updated: ${new Date(job.updated_at || job.created_at || Date.now()).toLocaleDateString()}`}
                    </span>
                  </div>
                  {job.id && (
                    <Link href={`/orders/${job.id}`} className="job-view-btn">
                      Open Details
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="job"
              title={isClient ? "No orders yet" : "No active tasks"}
              message={
                isClient
                  ? "Post a job to get started with your first order"
                  : "Active tasks will appear here"
              }
              actionLabel={isClient ? "Create Your First Job" : undefined}
              actionLink={isClient ? "/post-job" : undefined}
            />
          )}
        </section>

        {/* Auto-refresh indicator */}
        {(threadsLoading || offersLoading) && summaryData.timestamp && (
          <div className="auto-refresh-indicator">
            <span className="refresh-spinner"></span>
            Refreshing...
          </div>
        )}

        {(jobsError || jobsLoading) && summaryData.timestamp && (
          <div className="auto-refresh-indicator">
            {jobsLoading ? (
              <>
                <span className="refresh-spinner"></span>
                Syncing order metrics...
              </>
            ) : (
              <button onClick={() => refetchJobs()} className="retry-link">
                Retry order metrics
              </button>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

Dashboard.propTypes = {}

export default Dashboard
