"use client"

import React, { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useParams } from "next/navigation"
import httpClient from "../../api/httpClient"
import { useNotification } from "../../contexts/AppContexts"
import JobSubmissionForm from "../../components/JobSubmissionForm"
import "./Job.scss"

export default function Job() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { showSuccess, showError, showInfo } = useNotification()
  const [currentUser, setCurrentUser] = useState(null)

  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [ratingScore, setRatingScore] = useState("5")
  const [ratingReview, setRatingReview] = useState("")
  const [latestRating, setLatestRating] = useState(null)
  const [downloadingAssetKey, setDownloadingAssetKey] = useState("")
  const [disputeReason, setDisputeReason] = useState("")
  const [adminResolution, setAdminResolution] = useState("pay_freelancer")
  const [adminResolutionNotes, setAdminResolutionNotes] = useState("")
  const formatUSD = (value) => `$ ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const toAbsoluteUrl = (value) => {
    if (!value || typeof value !== "string") return ""
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) {
      return value
    }
    const normalized = value.startsWith("/") ? value : `/${value}`
    return `${API_BASE_URL}${normalized}`
  }
  const resolveAttachmentUrl = (attachment) =>
    typeof attachment === "string"
      ? toAbsoluteUrl(attachment)
      :
    toAbsoluteUrl(
      attachment?.download_url ||
      attachment?.file_url ||
      attachment?.url ||
      attachment?.file ||
      attachment?.file_path ||
      attachment?.path ||
      attachment?.file?.url ||
      ""
    )
  const getSubmissionFileItems = (submission) => {
    if (!submission || typeof submission !== "object") return []

    const items = []
    const attachments = Array.isArray(submission?.attachments)
      ? submission.attachments
      : Array.isArray(submission?.files)
        ? submission.files
        : Array.isArray(submission?.uploaded_files)
          ? submission.uploaded_files
          : []

    attachments.forEach((attachment, index) => {
      const fileUrl = resolveAttachmentUrl(attachment)
      if (!fileUrl) return
      const fileName =
        (typeof attachment === "string" ? attachment.split("/").pop() : "") ||
        attachment?.name ||
        attachment?.filename ||
        attachment?.file_name ||
        `Attachment ${index + 1}`
      items.push({
        key: `att-${attachment?.id || index}-${fileName}`,
        url: fileUrl,
        name: fileName,
      })
    })

    const legacyFiles = [
      { key: "assignment", label: "Assignment File (Legacy)" },
      { key: "plag_report", label: "Plagiarism Report (Legacy)" },
      { key: "ai_report", label: "AI Detection Report (Legacy)" },
    ]

    legacyFiles.forEach(({ key, label }) => {
      const fileUrl = toAbsoluteUrl(submission?.[key])
      if (!fileUrl) return
      items.push({
        key: `legacy-${key}`,
        url: fileUrl,
        name: label,
      })
    })

    return items
  }
  const resolveFreelancerEarnings = (jobData) => {
    const candidates = [
      jobData?.freelancer_earnings,
      jobData?.freelancer_payout_amount,
      jobData?.freelancer_amount,
      jobData?.payout_amount,
      jobData?.amount_to_freelancer,
      jobData?.net_amount,
      jobData?.price,
      jobData?.total_amount,
    ]
    const matched = candidates.find((value) => Number.isFinite(Number(value)))
    return Number(matched || 0)
  }

  const getApiErrorMessage = (error, fallback) => {
    const data = error?.response?.data
  
    // backend returned plain string
    if (typeof data === "string" && data.trim()) {
      return data
    }
  
    // DRF standard error
    if (data?.detail) {
      return data.detail
    }
  
    // non_field_errors
    if (
      Array.isArray(data?.non_field_errors) &&
      data.non_field_errors.length > 0
    ) {
      return data.non_field_errors[0]
    }
  
    // field errors object
    if (data && typeof data === "object") {
      const firstKey = Object.keys(data)[0]
      const firstValue = data[firstKey]
  
      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return String(firstValue[0])
      }
  
      if (typeof firstValue === "string") {
        return firstValue
      }
    }
  
    return fallback || "Something went wrong."
  }

  const parseContentDispositionFilename = (headerValue) => {
    if (!headerValue || typeof headerValue !== "string") return ""
    const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1].replace(/["']/g, ""))
      } catch (_) {
        return utf8Match[1].replace(/["']/g, "")
      }
    }
    const plainMatch = headerValue.match(/filename="?([^"]+)"?/i)
    return plainMatch?.[1] || ""
  }

  const triggerBlobDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename || "download"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("currentUser")
      setCurrentUser(rawUser ? JSON.parse(rawUser) : null)
    } catch (error) {
      console.error("Failed to parse currentUser from localStorage:", error)
      setCurrentUser(null)
    }
  }, [])

  const { data: job, isLoading, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => httpClient.get(`/orders/jobs/${id}/`).then((r) => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (formData) => {
      const normalizedStatus = String(job?.status || "").toUpperCase()
      if (!["IN_PROGRESS", "DISPUTE_OPEN"].includes(normalizedStatus)) {
        throw new Error("Job must be IN_PROGRESS or DISPUTE_OPEN before submission.")
      }
      if (!isFreelancer) {
        throw new Error("Only the assigned freelancer can submit this job.")
      }
      return httpClient.post(`/orders/jobs/${id}/submit/`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      setShowSubmissionForm(false)
      showSuccess("Work submitted successfully. Job status is now DELIVERED.")
    },
    onError: (error) => {
      const fallback = error?.message || "Failed to submit work. Please try again."
      showError(getApiErrorMessage(error, fallback))
    }
  })

  const completeMutation = useMutation({
    mutationFn: () => {
      const normalizedStatus = String(job?.status || "").toUpperCase()
      if (normalizedStatus !== "DELIVERED") {
        throw new Error("Job must be DELIVERED before completion.")
      }
      if (!isClient) {
        throw new Error("Only the client can complete this job.")
      }
      return httpClient.post(`/orders/jobs/${id}/complete/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      queryClient.invalidateQueries(["job-dispute", id])
      queryClient.invalidateQueries(["dashboardSummary"])
      queryClient.invalidateQueries(["dashboardJobs"])
      const earnedAmount = resolveFreelancerEarnings(job)
      showSuccess(`Job accepted and completed. Freelancer earnings: ${formatUSD(earnedAmount)}.`)
      
      if (isClient) {
        showInfo("Freelancer has been notified. Any open dispute was auto-resolved as RESOLVED_PAID.")
      }
    },
    onError: (error) => {
      const fallback = error?.message || "Failed to complete job. Please try again."
      showError(getApiErrorMessage(error, fallback))
    }
  })

  const rateFreelancerMutation = useMutation({
    mutationFn: () => {
      if (!isClient) {
        throw new Error("Only the client can rate the freelancer.")
      }
      if (!["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)) {
        throw new Error("Rate freelancer is available when job is DELIVERED or CLIENT_COMPLETED.")
      }

      const parsedScore = Number(ratingScore)
      if (!Number.isFinite(parsedScore) || parsedScore < 1 || parsedScore > 5) {
        throw new Error("Score must be between 1 and 5.")
      }

      return httpClient.post(`/orders/jobs/${id}/rate-freelancer/`, {
        score: parsedScore,
        review: ratingReview.trim(),
      })
    },
    onSuccess: (response) => {
      const wasCreated = Boolean(response?.data?.created)
      setLatestRating(response?.data?.rating || null)
      queryClient.invalidateQueries(["job", id])
      queryClient.invalidateQueries(["job-dispute", id])
      queryClient.invalidateQueries(["dashboardJobs"])
      queryClient.invalidateQueries(["dashboardSummary"])
      setShowRatingForm(false)
      if (normalizedStatus === "DELIVERED") {
        showSuccess(
          wasCreated
            ? "Review submitted. Job moved to CLIENT_COMPLETED and open dispute auto-resolved (RESOLVED_PAID)."
            : "Review updated. Job moved to CLIENT_COMPLETED and open dispute auto-resolved (RESOLVED_PAID)."
        )
      } else {
        showSuccess(wasCreated ? "Freelancer review submitted." : "Freelancer review updated.")
      }
    },
    onError: (error) => {
      const fallback = error?.message || "Failed to submit freelancer review."
      showError(getApiErrorMessage(error, fallback))
    }
  })

  const startWorkMutation = useMutation({
    mutationFn: async () => {
      const allowedStatuses = ["PAID", "ASSIGNED"]
      if (!allowedStatuses.includes(normalizedStatus)) {
        throw new Error("Job must be PAID or ASSIGNED before starting work.")
      }
      if (!isFreelancer) {
        throw new Error("Only the assigned freelancer can start this job.")
      }

      const candidates = [
        { method: "post", url: `/orders/jobs/${id}/start/`, data: {} },
        { method: "post", url: `/orders/jobs/${id}/start-work/`, data: {} },
        { method: "post", url: `/orders/jobs/${id}/mark-in-progress/`, data: {} },
        { method: "post", url: `/orders/jobs/${id}/in-progress/`, data: {} },
        { method: "post", url: `/orders/jobs/${id}/status/`, data: { status: "IN_PROGRESS" } },
        { method: "patch", url: `/orders/jobs/${id}/`, data: { status: "IN_PROGRESS" } },
      ]

      let lastError = null
      for (const candidate of candidates) {
        try {
          return await httpClient.request(candidate)
        } catch (error) {
          const status = error?.response?.status
          lastError = error
          if (status === 404 || status === 405) {
            continue
          }
          throw error
        }
      }

      throw lastError || new Error("No API endpoint found to mark job IN_PROGRESS.")
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      showSuccess("Job is now IN_PROGRESS. You can submit delivery when ready.")
    },
    onError: (error) => {
      const fallback = error?.message || "Failed to start work. Please try again."
      showError(getApiErrorMessage(error, fallback))
    }
  })

  const { data: disputeData } = useQuery({
    queryKey: ["job-dispute", id],
    queryFn: async () => {
      try {
        const response = await httpClient.get(`/orders/jobs/${id}/dispute/`)
        return response?.data
      } catch (error) {
        const status = error?.response?.status
        if (status === 400 || status === 403 || status === 404) return null
        throw error
      }
    },
    enabled: Boolean(id && currentUser),
    retry: 1,
  })

  const openDisputeMutation = useMutation({
    mutationFn: () => {
      if (!isClient) {
        throw new Error("Only the job client can open a dispute.")
      }
      if (!["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)) {
        throw new Error("Disputes can only be opened when job is DELIVERED or CLIENT_COMPLETED.")
      }
      return httpClient.post(`/orders/jobs/${id}/dispute/`, disputeReason.trim() ? { reason: disputeReason.trim() } : {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      queryClient.invalidateQueries(["job-dispute", id])
      setDisputeReason("")
      showSuccess("Dispute opened. Client and freelancer have been notified.")
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, "Failed to open dispute."))
    },
  })

  const markDisputeInReviewMutation = useMutation({
    mutationFn: () => {
      if (currentRole !== "ADMIN") {
        throw new Error("Only admin can move dispute to in review.")
      }
      return httpClient.post(`/orders/jobs/${id}/dispute/in-review/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      queryClient.invalidateQueries(["job-dispute", id])
      showSuccess("Dispute moved to IN_REVIEW.")
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, "Failed to move dispute to in review."))
    },
  })

  const resolveDisputeMutation = useMutation({
    mutationFn: () => {
      if (currentRole !== "ADMIN") {
        throw new Error("Only admin can resolve disputes.")
      }
      return httpClient.post(`/orders/jobs/${id}/dispute/resolve/`, {
        resolution: adminResolution,
        admin_resolution_notes: adminResolutionNotes.trim(),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job", id])
      queryClient.invalidateQueries(["job-dispute", id])
      setAdminResolutionNotes("")
      showSuccess("Dispute resolved and parties notified.")
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, "Failed to resolve dispute."))
    },
  })

  const normalizedStatus = String(job?.status || "").toUpperCase()
  const currentUserId =
    currentUser?.id ||
    currentUser?.user_id ||
    currentUser?.pk ||
    currentUser?.user?.id ||
    currentUser?.user?.user_id ||
    currentUser?.user?.pk ||
    null
  const currentUsername = (
    currentUser?.username ||
    currentUser?.user?.username ||
    ""
  ).trim().toLowerCase()
  const currentRole = String(
    currentUser?.role ||
    currentUser?.user?.role ||
    ""
  ).toUpperCase()
  const freelancerJobId = job?.freelancer_id || job?.freelancer?.id || job?.freelancer?.pk || null
  const clientJobId = job?.client_id || job?.client?.id || job?.client?.pk || null
  const freelancerUsername = String(job?.freelancer_username || job?.freelancer?.username || "").trim().toLowerCase()
  const clientUsername = String(job?.client_username || job?.client?.username || "").trim().toLowerCase()

  const matchesFreelancerById = currentUserId != null && freelancerJobId != null && String(currentUserId) === String(freelancerJobId)
  const matchesClientById = currentUserId != null && clientJobId != null && String(currentUserId) === String(clientJobId)
  const matchesFreelancerByUsername = !!currentUsername && !!freelancerUsername && currentUsername === freelancerUsername
  const matchesClientByUsername = !!currentUsername && !!clientUsername && currentUsername === clientUsername

  const isFreelancer = matchesFreelancerById || matchesFreelancerByUsername
  const isClient = matchesClientById || matchesClientByUsername
  const isFreelancerRole = currentRole === "FREELANCER"
  const allowedReviewsRaw = Number(job?.allowed_reviews)
  const reviewsUsedRaw = Number(job?.reviews_used)
  const reviewsRemainingRaw = Number(job?.reviews_remaining)
  const hasReviewPolicy = Number.isFinite(allowedReviewsRaw) || Number.isFinite(reviewsUsedRaw) || Number.isFinite(reviewsRemainingRaw)
  const allowedReviews = Number.isFinite(allowedReviewsRaw) ? allowedReviewsRaw : null
  const reviewsUsed = Number.isFinite(reviewsUsedRaw) ? reviewsUsedRaw : null
  const reviewsRemaining = Number.isFinite(reviewsRemainingRaw)
    ? reviewsRemainingRaw
    : (allowedReviews != null && reviewsUsed != null ? Math.max(allowedReviews - reviewsUsed, 0) : null)
  const canSubmit =
    isFreelancer &&
    ["IN_PROGRESS", "DISPUTE_OPEN"].includes(normalizedStatus) &&
    !(normalizedStatus === "DISPUTE_OPEN" && reviewsRemaining != null && reviewsRemaining <= 0)
  const canComplete = isClient && normalizedStatus === "DELIVERED"
  const canStartWork = isFreelancer && ["PAID", "ASSIGNED"].includes(normalizedStatus)
  const showFreelancerSubmitAction = isFreelancer || isFreelancerRole
  const showClientCompleteAction = isClient && ["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)
  const showClientReviewChecklist = isClient && ["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)
  const canRateFreelancer = isClient && ["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)
  const dispute = job?.dispute || disputeData || null
  const disputeStatus = String(dispute?.status || normalizedStatus).toUpperCase()
  const hasDispute = Boolean(dispute?.id || ["DISPUTE_OPEN", "DISPUTE_RESOLVED"].includes(normalizedStatus))
  const canOpenDispute =
    isClient &&
    ["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus) &&
    (!dispute?.id || ["OPEN", "IN_REVIEW"].includes(disputeStatus))
  const canMoveDisputeInReview = currentRole === "ADMIN" && dispute?.id && disputeStatus === "OPEN"
  const canResolveDispute = currentRole === "ADMIN" && dispute?.id && ["OPEN", "IN_REVIEW"].includes(disputeStatus)
  const disputeDisplayStatus = dispute?.status_display || dispute?.status || (hasDispute ? job?.status_display || normalizedStatus : null)
  const disputeCycleCount = (() => {
    const candidates = [
      dispute?.reopen_count,
      dispute?.reopened_count,
      dispute?.reopenings,
      dispute?.cycle,
      dispute?.revision_cycle,
      job?.reviews_used,
    ]
    for (const candidate of candidates) {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
    return 0
  })()
  const isDisputeReopened = hasDispute && disputeCycleCount > 0 && ["OPEN", "IN_REVIEW", "DISPUTE_OPEN"].includes(disputeStatus || normalizedStatus)
  const disputeClosedByClientApproval =
    hasDispute &&
    normalizedStatus === "CLIENT_COMPLETED" &&
    ["OPEN", "IN_REVIEW", "DISPUTE_OPEN"].includes(disputeStatus || normalizedStatus)
  const isDisputeActiveWorkflow =
    normalizedStatus === "DISPUTE_OPEN" ||
    (["OPEN", "IN_REVIEW"].includes(disputeStatus) && normalizedStatus !== "CLIENT_COMPLETED")
  const isDisputeDoneWorkflow =
    ["DISPUTE_RESOLVED", "RESOLVED_REFUND", "RESOLVED_PAID"].includes(disputeStatus) ||
    normalizedStatus === "DISPUTE_RESOLVED" ||
    disputeClosedByClientApproval
  const existingRating =
    latestRating ||
    job?.rating ||
    job?.freelancer_rating ||
    job?.client_rating ||
    job?.review_rating ||
    null
  const hasExistingRating =
    existingRating != null &&
    (typeof existingRating === "object"
      ? Number.isFinite(Number(existingRating?.score))
      : Number.isFinite(Number(existingRating)))
  const existingRatingScore = hasExistingRating
    ? Number(typeof existingRating === "object" ? existingRating?.score : existingRating)
    : null
  const existingRatingReview =
    typeof existingRating === "object"
      ? existingRating?.review || ""
      : ""
  const rawSubmissionList = Array.isArray(job?.submissions)
    ? job.submissions
    : Array.isArray(job?.submission_history)
      ? job.submission_history
      : []
  const submissions = rawSubmissionList.length > 0
    ? rawSubmissionList
    : [job?.submission, job?.latest_submission].filter(Boolean)
  const latestSubmission = submissions[0] || null
  const shouldShowClientReviewDownloads = isClient && ["DELIVERED", "CLIENT_COMPLETED"].includes(normalizedStatus)
  const { data: reviewDownloadsData } = useQuery({
    queryKey: ["job-submission-downloads", id],
    queryFn: async () => {
      try {
        const response = await httpClient.get(`/orders/jobs/${id}/submission/attachments/`)
        return response?.data
      } catch (error) {
        const status = error?.response?.status
        if (status === 400 || status === 403 || status === 404) return null
        throw error
      }
    },
    enabled: Boolean(id && shouldShowClientReviewDownloads),
    retry: 1,
  })
  const reviewedAttachmentItems = (() => {
    const payload = reviewDownloadsData
    const rawList = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.attachments)
        ? payload.attachments
        : Array.isArray(payload?.results)
          ? payload.results
          : []
    return rawList
      .map((item, index) => ({
        id: item?.id || item?.attachment_id || item?.pk,
        name: item?.name || item?.filename || item?.file_name || `Attachment ${index + 1}`,
      }))
      .filter((item) => item.id != null)
  })()
  const legacyReviewConfig = [
    { key: "assignment", label: "Assignment File (Legacy)" },
    { key: "plag_report", label: "Plagiarism Report (Legacy)" },
    { key: "ai_report", label: "AI Detection Report (Legacy)" },
  ]
  const hasLegacyFileFromReviewEndpoint = (legacyKey) => {
    const payload = reviewDownloadsData
    if (payload && typeof payload === "object") {
      const groups = [payload?.legacy, payload?.legacy_files, payload?.legacy_attachments]
      for (const group of groups) {
        if (!group || typeof group !== "object") continue
        const value = group[legacyKey]
        if (value == null) continue
        if (typeof value === "boolean") return value
        if (typeof value === "object") return Boolean(value.exists ?? value.available ?? value.url ?? value.file_url)
        return Boolean(value)
      }
    }
    return Boolean(latestSubmission?.[legacyKey])
  }

  const handleSecureDownload = async ({ url, fallbackName, key }) => {
    setDownloadingAssetKey(key)
    try {
      const response = await httpClient.get(url, { responseType: "blob" })
      const headerFilename = parseContentDispositionFilename(response?.headers?.["content-disposition"])
      triggerBlobDownload(response.data, headerFilename || fallbackName || "download")
    } catch (error) {
      showError(getApiErrorMessage(error, "Failed to download file. Please try again."))
    } finally {
      setDownloadingAssetKey("")
    }
  }
  const paymentDoneStatuses = ["PAID", "ASSIGNED", "IN_PROGRESS", "DELIVERED", "CLIENT_COMPLETED", "DISPUTE_OPEN", "DISPUTE_RESOLVED", "CANCELLED"]
  const startedStatuses = ["IN_PROGRESS", "DELIVERED", "CLIENT_COMPLETED", "DISPUTE_OPEN", "DISPUTE_RESOLVED", "CANCELLED"]
  const deliveredStatuses = ["DELIVERED", "CLIENT_COMPLETED", "DISPUTE_OPEN", "DISPUTE_RESOLVED"]
  const isPaymentDone = paymentDoneStatuses.includes(normalizedStatus)
  const isStarted = startedStatuses.includes(normalizedStatus)
  const isDelivered = deliveredStatuses.includes(normalizedStatus)
  const isCompleted = normalizedStatus === "CLIENT_COMPLETED"
  const workflowSteps = [
    {
      key: "created",
      title: "1. Job Created",
      done: true,
      timestamp: job?.created_at || null,
      description: "Job record created and visible to both parties.",
    },
    {
      key: "paid",
      title: "2. Payment Secured",
      done: isPaymentDone,
      active: !isPaymentDone,
      timestamp: isPaymentDone ? job.updated_at : null,
      description: "Client payment is held in escrow.",
    },
    {
      key: "started",
      title: "3. Work In Progress",
      done: isStarted,
      active: isPaymentDone && !isStarted,
      timestamp: isStarted ? job.updated_at : null,
      description: "Freelancer starts work (status = IN_PROGRESS).",
    },
    {
      key: "delivered",
      title: "4. Delivery Submitted",
      done: isDelivered,
      active: isStarted && !isDelivered,
      timestamp: latestSubmission?.submitted_at || null,
      description: "Freelancer submits files/note (status = DELIVERED).",
    },
    {
      key: "completed",
      title: "5. Client Completed",
      done: isCompleted,
      active: isDelivered && !isCompleted,
      timestamp: job?.client_marked_complete_at || null,
      description: "Client approves delivery (status = CLIENT_COMPLETED).",
    },
    ...(hasDispute ? [{
      key: "dispute",
      title: isDisputeReopened ? "6. Dispute Reopened" : "6. Dispute Opened",
      done: isDisputeDoneWorkflow,
      active: isDisputeActiveWorkflow,
      timestamp: dispute?.updated_at || dispute?.created_at || job?.updated_at || null,
      description: disputeClosedByClientApproval
        ? "Revision accepted by client. Job marked CLIENT_COMPLETED."
        : isDisputeReopened
          ? `Dispute reopened for revision cycle ${disputeCycleCount}. Status: ${disputeDisplayStatus || "Open"}.`
          : `Dispute status: ${disputeDisplayStatus || "Open"}.`,
      variant: isDisputeReopened ? "reopened" : "opened",
    }] : []),
  ]
  const currentStageLabel = workflowSteps.find((step) => step.active)?.title
    || (isCompleted ? "5. Client Completed" : `Current status: ${job?.status_display || normalizedStatus}`)

  useEffect(() => {
    if (!job?.id || !isFreelancer || normalizedStatus !== "CLIENT_COMPLETED") return
    const storageKey = `job_completion_notified_${job.id}`
    if (typeof window === "undefined" || localStorage.getItem(storageKey)) return

    const earnedAmount = resolveFreelancerEarnings(job)
    showSuccess(`Job accepted by client. You earned ${formatUSD(earnedAmount)}.`)
    showInfo("Project status updated to CLIENT_COMPLETED.")
    localStorage.setItem(storageKey, "1")
  }, [job, isFreelancer, normalizedStatus, showInfo, showSuccess])

  if (isLoading) {
    return (
      <div className="job-detail">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="job-detail">
        <div className="error-container">
          <p className="error-message">{error.response?.data?.detail || "Failed to load job"}</p>
          <button onClick={() => router.push("/orders")}>Back to Orders</button>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="job-detail">
        <div className="error-container">
          <p className="error-message">Job details are unavailable right now. Please refresh.</p>
          <button onClick={() => router.push("/orders")}>Back to Orders</button>
        </div>
      </div>
    )
  }

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

  return (
    <div className="job-detail">
      {showSubmissionForm && (
        <div className="modal-overlay" onClick={() => setShowSubmissionForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <JobSubmissionForm
              jobId={id}
              onSubmit={(formData) => submitMutation.mutate(formData)}
              onCancel={() => setShowSubmissionForm(false)}
              isSubmitting={submitMutation.isLoading}
            />
          </div>
        </div>
      )}
      {showRatingForm && (
        <div className="modal-overlay" onClick={() => setShowRatingForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="job-section">
              <h3>Rate Freelancer</h3>
              <p className="job-description">Share how the delivery quality and communication were.</p>
              <div className="details-grid" style={{ marginTop: "1rem" }}>
                <div className="detail-item">
                  <label htmlFor="rating-score">Score (1-5)</label>
                  <input
                    id="rating-score"
                    type="number"
                    min="1"
                    max="5"
                    step="0.5"
                    value={ratingScore}
                    onChange={(e) => setRatingScore(e.target.value)}
                    style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid #d7d7d7" }}
                  />
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <label htmlFor="rating-review" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700 }}>
                  Review
                </label>
                <textarea
                  id="rating-review"
                  rows={4}
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Great delivery and communication."
                  style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #d7d7d7", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowRatingForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-success"
                  onClick={() => rateFreelancerMutation.mutate()}
                  disabled={rateFreelancerMutation.isLoading}
                >
                  {rateFreelancerMutation.isLoading ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="job-header">
        <button onClick={() => router.push("/orders")} className="btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Orders
        </button>
        <div className="job-title-section">
          <h1>{job.title}</h1>
          <span className={`status-badge ${getStatusBadgeClass(job.status)} ${normalizedStatus === "DISPUTE_OPEN" && isDisputeReopened ? "status-dispute-reopened" : ""}`}>
            {job.status_display || job.status}
          </span>
        </div>
      </div>

      <div className="job-content">
        <div className="job-main">
          <div className="job-section">
            <h3>Job Description</h3>
            <p className="job-description">{job.description || "No description provided"}</p>
          </div>

          <div className="job-section">
            <h3>Job Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <label>Client</label>
                <span>{job.client_username}</span>
              </div>
              <div className="detail-item">
                <label>Freelancer</label>
                <span>{job.freelancer_username}</span>
              </div>
              <div className="detail-item">
                <label>Total Amount</label>
                <span className="amount">{formatUSD(job.total_amount)}</span>
              </div>
              <div className="detail-item">
                <label>Delivery Time</label>
                <span>{job.delivery_time_days} days</span>
              </div>
              <div className="detail-item">
                <label>Created</label>
                <span>{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
              {job.updated_at && (
                <div className="detail-item">
                  <label>Last Updated</label>
                  <span>{new Date(job.updated_at).toLocaleDateString()}</span>
                </div>
              )}
              {hasReviewPolicy && (
                <>
                  <div className="detail-item">
                    <label>Allowed Reviews</label>
                    <span>{allowedReviews ?? "—"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Reviews Used</label>
                    <span>{reviewsUsed ?? "—"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Reviews Remaining</label>
                    <span>{reviewsRemaining ?? "—"}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {submissions.length > 0 && (
            <div className="job-section submission-section">
              <h3>Submitted Work</h3>
              {submissions.map((submission, submissionIndex) => {
                const files = getSubmissionFileItems(submission)
                const submissionKey = submission?.id || `${submission?.submitted_at || "submission"}-${submissionIndex}`
                return (
                  <div key={submissionKey} style={{ marginTop: submissionIndex === 0 ? 0 : "1rem" }}>
                    {submissions.length > 1 && (
                      <p className="submission-date" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                        Submission {submissions.length - submissionIndex}
                      </p>
                    )}
                    {submission?.submission_text && (
                      <p className="job-description">{submission.submission_text}</p>
                    )}
                    <div className="submission-files">
                      {files.length > 0 ? (
                        files.map((file) => (
                          <a
                            key={`${submissionKey}-${file.key}`}
                            href={file.url}
                            download
                            className="file-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                            <span>{file.name}</span>
                            <svg className="download-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </a>
                        ))
                      ) : (
                        <p className="submission-date" style={{ marginTop: 0, fontStyle: "normal" }}>
                          No attachments found for this submission.
                        </p>
                      )}
                    </div>
                    {submission?.submitted_at && (
                      <p className="submission-date">
                        Submitted on {new Date(submission.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )
              })}
              {shouldShowClientReviewDownloads && (
                <div className="secure-review-downloads">
                  <p className="submission-date" style={{ marginTop: "1rem", marginBottom: "0.5rem", fontStyle: "normal" }}>
                    Client Review Downloads (Secure API)
                  </p>
                  <div className="submission-files">
                    {reviewedAttachmentItems.map((attachment) => {
                      const key = `secure-attachment-${attachment.id}`
                      const isDownloading = downloadingAssetKey === key
                      return (
                        <a
                          key={key}
                          href={`${API_BASE_URL}/api/orders/jobs/${id}/submission/attachments/${attachment.id}/download/`}
                          className="file-link"
                          onClick={(event) => {
                            event.preventDefault()
                            if (isDownloading) return
                            handleSecureDownload({
                              url: `/orders/jobs/${id}/submission/attachments/${attachment.id}/download/`,
                              fallbackName: attachment.name,
                              key,
                            })
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span>{isDownloading ? `Downloading ${attachment.name}...` : attachment.name}</span>
                          <svg className="download-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </a>
                      )
                    })}
                    {legacyReviewConfig
                      .filter((legacy) => hasLegacyFileFromReviewEndpoint(legacy.key))
                      .map((legacy) => {
                        const key = `secure-legacy-${legacy.key}`
                        const isDownloading = downloadingAssetKey === key
                        return (
                          <a
                            key={key}
                            href={`${API_BASE_URL}/api/orders/jobs/${id}/submission/legacy/${legacy.key}/download/`}
                            className="file-link"
                            onClick={(event) => {
                              event.preventDefault()
                              if (isDownloading) return
                              handleSecureDownload({
                                url: `/orders/jobs/${id}/submission/legacy/${legacy.key}/download/`,
                                fallbackName: legacy.label,
                                key,
                              })
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                            <span>{isDownloading ? `Downloading ${legacy.label}...` : legacy.label}</span>
                            <svg className="download-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </a>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="job-sidebar">
          <div className="action-card">
            <h3>Actions</h3>
            <div className="workflow-header">
              <span className="workflow-label">Current Stage</span>
              <strong>{currentStageLabel}</strong>
            </div>
            <div className="action-buttons">
              {showFreelancerSubmitAction && (
                <>
                  <button
                    onClick={() => {
                      if (!canStartWork) return
                      startWorkMutation.mutate()
                    }}
                    className="btn-secondary"
                    disabled={startWorkMutation.isLoading || !canStartWork}
                    title={
                      !isFreelancer
                        ? "Only the assigned freelancer can start this job"
                        : canStartWork
                          ? "Mark job as IN_PROGRESS"
                          : "Start Work is available only when job is PAID or ASSIGNED"
                    }
                  >
                    {startWorkMutation.isLoading ? (
                      <>
                        <div className="spinner"></div>
                        Starting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14"></path>
                          <path d="M12 5l7 7-7 7"></path>
                        </svg>
                        {!isFreelancer
                          ? "1) Start Work (Not assigned to this job)"
                          : canStartWork
                            ? "1) Start Work (Set IN_PROGRESS)"
                            : "1) Start Work (Waiting for PAID/ASSIGNED)"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (!canSubmit) return;
                      setShowSubmissionForm(true);
                    }}
                    className="btn-primary"
                    disabled={!canSubmit}
                    title={
                      !isFreelancer
                        ? "Only the assigned freelancer can submit delivery"
                        : canSubmit
                          ? "Submit completed delivery"
                          : "Submission allowed when IN_PROGRESS or DISPUTE_OPEN (with reviews remaining)"
                    }
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  {!isFreelancer
                    ? "2) Submit Delivery (Not assigned to this job)"
                    : canSubmit
                      ? "2) Submit Delivery (Set DELIVERED)"
                      : "2) Submit Delivery (Waiting for IN_PROGRESS/DISPUTE_OPEN)"}
                </button>
                  {normalizedStatus === "DISPUTE_OPEN" && (
                    <div className="info-message">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                      <p>
                        Dispute revision cycle: this resubmission sets status back to <strong>DELIVERED</strong>.
                        {reviewsRemaining != null ? ` Reviews remaining: ${reviewsRemaining}.` : ""}
                      </p>
                    </div>
                  )}
                  <div className="info-message">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <p>
                      <strong>Freelancer flow:</strong> Start Work (IN_PROGRESS) {"->"} Submit Delivery (DELIVERED).
                      In submit modal: add note, attach files, then send.
                    </p>
                  </div>
                </>
              )}

              {showClientCompleteAction && (
                <button
                  onClick={() => {
                    if (!canComplete) return;
                    if (window.confirm("Are you sure you want to mark this job as complete? This will trigger payment to the freelancer.")) {
                      completeMutation.mutate()
                    }
                  }}
                  disabled={completeMutation.isLoading || !canComplete}
                  className="btn-success"
                  title={canComplete ? "Mark job complete" : "Completion allowed only when job is DELIVERED"}
                >
                  {completeMutation.isLoading ? (
                    <>
                      <div className="spinner"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {canComplete ? "3) Approve Delivery (Set CLIENT_COMPLETED)" : "3) Approve Delivery (Waiting for DELIVERED)"}
                    </>
                  )}
                </button>
              )}

              {showClientReviewChecklist && (
                <div className="info-message">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <p>
                    <strong>Client review checklist:</strong> 1) Open submitted files and reports, 2) verify delivery note, 3) approve completion, 4) rate freelancer.
                  </p>
                </div>
              )}

              {canRateFreelancer && (
                <button
                  type="button"
                  onClick={() => {
                    if (hasExistingRating) {
                      setRatingScore(String(existingRatingScore || 5))
                      setRatingReview(existingRatingReview || "")
                    }
                    setShowRatingForm(true)
                  }}
                  className="btn-primary"
                >
                  {hasExistingRating ? "Update Freelancer Review" : "Rate Freelancer"}
                </button>
              )}

              {canRateFreelancer && hasExistingRating && (
                <div className="info-message success">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>
                    Review submitted: <strong>{existingRatingScore?.toFixed(1)} / 5</strong>
                    {existingRatingReview ? ` - ${existingRatingReview}` : ""}
                  </p>
                </div>
              )}

              {(normalizedStatus === "PAID" || normalizedStatus === "ASSIGNED") && isFreelancer && (
                <div className="info-message">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <p>Payment received. Click <strong>Start Work</strong> to move this job to <strong>IN_PROGRESS</strong>, then use <strong>Submit Work</strong> to deliver.</p>
                </div>
              )}

              {job.status === "DELIVERED" && isClient && (
                <div className="info-message warning">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <p>Please review the submitted work and approve to complete the job.</p>
                </div>
              )}

              {!showFreelancerSubmitAction && !showClientCompleteAction && (isFreelancer || isClient) && (
                <div className="info-message">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <p>
                    No direct action for current status: <strong>{job.status_display || normalizedStatus}</strong>.
                  </p>
                </div>
              )}

              {job.status === "CLIENT_COMPLETED" && (
                <div className="info-message success">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <p>Job completed successfully! {isFreelancer ? "Payment has been processed." : "Thank you for your business!"}</p>
                </div>
              )}
            </div>
          </div>

          <div className="timeline-card dispute-card">
            <h3>Dispute</h3>
            {!hasDispute && !canOpenDispute && (
              <div className="info-message">
                <p>No active dispute for this job.</p>
              </div>
            )}

            {canOpenDispute && (
              <div className="dispute-actions">
                <p className="job-description" style={{ marginBottom: "0.6rem" }}>
                  If delivered work has issues, open a dispute before final acceptance.
                </p>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Optional reason for dispute..."
                  rows={3}
                  style={{ width: "100%", borderRadius: "8px", border: "1px solid #d7d7d7", padding: "0.7rem", marginBottom: "0.6rem" }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => openDisputeMutation.mutate()}
                  disabled={openDisputeMutation.isLoading}
                >
                  {openDisputeMutation.isLoading ? "Submitting..." : dispute?.id ? "Reopen Dispute" : "Open Dispute"}
                </button>
              </div>
            )}

            {hasDispute && (
              <div className="dispute-meta">
                <div className={`dispute-state-pill ${disputeClosedByClientApproval ? "closed" : isDisputeReopened ? "reopened" : "opened"}`}>
                  {disputeClosedByClientApproval
                    ? "Dispute Closed By Client Approval"
                    : isDisputeReopened
                      ? `Dispute Reopened (Cycle ${disputeCycleCount})`
                      : "Dispute Open"}
                </div>
                <p><strong>Status:</strong> {disputeClosedByClientApproval ? "Closed (Client Completed)" : (disputeDisplayStatus || "Open")}</p>
                {dispute?.created_at && <p><strong>Opened:</strong> {new Date(dispute.created_at).toLocaleString()}</p>}
                {dispute?.updated_at && <p><strong>Updated:</strong> {new Date(dispute.updated_at).toLocaleString()}</p>}
                {dispute?.resolved_at && <p><strong>Resolved:</strong> {new Date(dispute.resolved_at).toLocaleString()}</p>}
                {disputeCycleCount > 0 && <p><strong>Revision Cycle:</strong> {disputeCycleCount}</p>}
                {dispute?.resolution && <p><strong>Resolution:</strong> {String(dispute.resolution).replace("_", " ")}</p>}
                {dispute?.reason && <p><strong>Reason:</strong> {dispute.reason}</p>}
                {dispute?.admin_resolution_notes && <p><strong>Admin Notes:</strong> {dispute.admin_resolution_notes}</p>}
              </div>
            )}

            {(canMoveDisputeInReview || canResolveDispute) && (
              <div className="dispute-actions">
                {canMoveDisputeInReview && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => markDisputeInReviewMutation.mutate()}
                    disabled={markDisputeInReviewMutation.isLoading}
                  >
                    {markDisputeInReviewMutation.isLoading ? "Updating..." : "Move to In Review"}
                  </button>
                )}
                {canResolveDispute && (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <select
                      value={adminResolution}
                      onChange={(e) => setAdminResolution(e.target.value)}
                      style={{ borderRadius: "8px", border: "1px solid #d7d7d7", padding: "0.6rem" }}
                    >
                      <option value="pay_freelancer">Resolve: Pay Freelancer</option>
                      <option value="refund_client">Resolve: Refund Client</option>
                    </select>
                    <textarea
                      value={adminResolutionNotes}
                      onChange={(e) => setAdminResolutionNotes(e.target.value)}
                      rows={3}
                      placeholder="Admin resolution notes..."
                      style={{ borderRadius: "8px", border: "1px solid #d7d7d7", padding: "0.6rem", resize: "vertical" }}
                    />
                    <button
                      type="button"
                      className="btn-success"
                      onClick={() => resolveDisputeMutation.mutate()}
                      disabled={resolveDisputeMutation.isLoading}
                    >
                      {resolveDisputeMutation.isLoading ? "Resolving..." : "Resolve Dispute"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="timeline-card">
            <h3>Workflow Timeline</h3>
            <div className="timeline">
              {workflowSteps.map((step) => {
                const stateClass = step.done ? "completed" : step.active ? "active" : "pending"
                return (
                  <div key={step.key} className={`timeline-item ${stateClass} ${step.variant ? `variant-${step.variant}` : ""}`}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <strong>{step.title}</strong>
                      <span>{step.description}</span>
                      <span className="timeline-meta">
                        {step.timestamp
                          ? new Date(step.timestamp).toLocaleString()
                          : step.done
                            ? "Completed"
                            : step.active
                              ? "Current step"
                              : "Pending"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
