"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import httpClient from "../../api/httpClient"
import chatApi from "../../api/chatApi"
import { useAuth, useNotification } from "../../contexts/AppContexts"
import guestSessionService from "../../services/guestSessionService"
import OfferCard from "../../components/OfferCard"
import JobSubmissionForm from "../../components/JobSubmissionForm"
import "./Thread.scss"
import OfferForm from "../../components/OfferForm"
import { savePendingClientEmailForJob } from "../../utils/clientOnboarding"
import { useChatWebSocket } from "../../hooks/useChatWebSocket"
import { useCallback } from "react"
import { emitPlatformRealtimeEvent } from "../../utils/realtime"
import { getGuestSessionThrottleMessage, shouldShowGuestSessionThrottleNotice } from "../../services/guestSessionService"

const MAX_PENDING_ATTACHMENTS = 5;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_TRACKING_KEY = "pendingPaymentJobId"
const MIN_PASSWORD_LENGTH = 8
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ""
const PAYMENT_INIT_RETRY_DELAYS_MS = [400, 900]

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
      attachment?.file_url ||
      attachment?.url ||
      attachment?.file ||
      attachment?.file_path ||
      attachment?.path ||
      attachment?.file?.url ||
      ""
    )

const AttachmentDisplay = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-opacity-20 border-current space-y-1">
      {attachments.map((attachment) => {
        const resolvedUrl = resolveAttachmentUrl(attachment)
        if (!resolvedUrl) return null
        const displayName =
          (typeof attachment === "string" ? attachment.split("/").pop() : "") ||
          attachment?.name ||
          attachment?.filename ||
          attachment?.file_name ||
          "Attachment"
        const sizeMb = Number(
          attachment?.size_mb ??
          (attachment?.size_kb != null ? Number(attachment.size_kb) / 1024 : 0)
        )
        return (
          <a
            key={attachment?.id || `${displayName}-${resolvedUrl}`}
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-xs hover:underline transition duration-150 ease-in-out"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a2 2 0 102.828 2.828l6.586-6.586" />
            </svg>
            <span className="truncate">{displayName}</span>
            <span className="opacity-60">({Number.isFinite(sizeMb) ? sizeMb.toFixed(1) : "0.0"} MB)</span>
          </a>
        )
      })}
    </div>
  )
}

const MessageBubble = ({
  m,
  onAcceptOffer,
  onRejectOffer,
  currentUser,
  isAuthenticated,
  sessionKey,
  guestLabel,
}) => {
  const normalizedSessionKey = String(sessionKey || "").trim()
  const senderGuestCandidates = [
    m?.sender_guest_key,
    m?.guest_session_key,
    m?.sender_session_key,
    m?.session_key,
    m?.sender?.guest_session_key,
    m?.sender?.session_key,
  ].map((value) => String(value || "").trim()).filter(Boolean)
  const senderNameNormalized = String(m?.sender_name || "").trim().toLowerCase()
  const senderUsernameNormalized = String(m?.sender_username || "").trim().toLowerCase()
  const currentUserId =
    currentUser?.id ||
    currentUser?.user_id ||
    currentUser?.pk ||
    currentUser?.user?.id ||
    currentUser?.user?.user_id ||
    currentUser?.user?.pk ||
    null
  const currentUsername = String(currentUser?.username || "").trim().toLowerCase()
  const currentRole = String(currentUser?.role || currentUser?.user?.role || "").trim().toUpperCase()

  const isMine = typeof m.is_mine === "boolean"
    ? m.is_mine
    : isAuthenticated
      ? !!(currentUsername && (senderUsernameNormalized === currentUsername || senderNameNormalized === currentUsername))
      : !!(
        normalizedSessionKey && senderGuestCandidates.includes(normalizedSessionKey)
      )
  const bubbleClasses = isMine ? "chat-bubble chat-bubble--mine" : "chat-bubble chat-bubble--theirs"
  const containerClasses = isMine ? "thread-message-row thread-message-row--mine" : "thread-message-row thread-message-row--theirs"
  const contentClasses = isMine ? "thread-message-content thread-message-content--mine" : "thread-message-content thread-message-content--theirs"

  if (m.offer) {
    const createdJob = m.offer?.created_job || {}
    const freelancerOfferId =
      createdJob?.freelancer_id ||
      createdJob?.freelancer?.id ||
      createdJob?.freelancer?.pk ||
      m.offer?.freelancer_id ||
      m.offer?.freelancer?.id ||
      m.offer?.freelancer?.pk ||
      null
    const freelancerOfferUsername = String(
      createdJob?.freelancer_username ||
      createdJob?.freelancer?.username ||
      m.offer?.freelancer_username ||
      m.offer?.freelancer?.username ||
      senderUsernameNormalized ||
      senderNameNormalized ||
      ""
    ).trim().toLowerCase()
    const isFreelancerOfferCreator =
      (currentUserId != null && freelancerOfferId != null && String(currentUserId) === String(freelancerOfferId)) ||
      (!!currentUsername && !!freelancerOfferUsername && currentUsername === freelancerOfferUsername)
    const isOfferCreator = currentRole === "FREELANCER" || currentRole === "ADMIN"
      ? isFreelancerOfferCreator
      : isMine

    return (
      <div className={containerClasses}>
        <div className={contentClasses}>
          <OfferCard
            offer={m.offer}
            offerId={m.id}
            onAccept={onAcceptOffer}
            onReject={onRejectOffer}
            canRespond={!isOfferCreator}
            isPending={m.offer.status === 'pending'}
            isCreator={isOfferCreator}
          />
          <div className="text-[11px] text-gray-500 mt-1 text-right">
            {m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      <div className={`${contentClasses} px-4 py-3 ${bubbleClasses}`}>
        {m.message && (
          <div className="text-[15px] leading-snug break-words mb-1">{m.message}</div>
        )}

        <AttachmentDisplay attachments={m.attachments} />

        <div className="text-[11px] opacity-80 mt-1 text-right">
          {m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '...'}
        </div>
      </div>
    </div>
  )
}

export default function Thread() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [hasHydrated, setHasHydrated] = useState(false)
  const [text, setText] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState([])
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [showSubmissionForm, setShowSubmissionForm] = useState(false)
  const [showRatingForm, setShowRatingForm] = useState(false)
  const [ratingScore, setRatingScore] = useState("5")
  const [ratingReview, setRatingReview] = useState("")
  const [latestThreadRating, setLatestThreadRating] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const recoveryAttemptedRef = useRef(false)
  const guestRedirectAttemptedRef = useRef(false)

  const { isAuthenticated, currentUser } = useAuth()
  const { showSuccess, showError, showInfo } = useNotification()

  const formatUSD = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
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

  const [sessionKey, setSessionKey] = useState(() => {
    if (isAuthenticated) return null
    const threadSpecific = guestSessionService.getThreadSessionKey(id)
    return threadSpecific || guestSessionService.getSessionKey()
  })
  const [guestLabel, setGuestLabel] = useState(
    () => (!isAuthenticated ? guestSessionService.getGuestLabel() : null)
  )
  const [sessionReady, setSessionReady] = useState(
    () => isAuthenticated || !!guestSessionService.getSessionKey()
  )
  const [recoveryMessage, setRecoveryMessage] = useState("")
  const urlSessionKey = searchParams?.get("session_key") || null
  const storedThreadSessionKey = !isAuthenticated ? guestSessionService.getThreadSessionKey(id) : null
  const sessionAvailable = isAuthenticated || !!sessionKey
  const isSessionExpired = !isAuthenticated && sessionAvailable && guestSessionService.isSessionExpired()
  const isGuestViewer = !isAuthenticated && !currentUser?.id && !!sessionKey

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    recoveryAttemptedRef.current = false
    guestRedirectAttemptedRef.current = false
  }, [id, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      setSessionReady(true)
      return
    }

    let isMounted = true

    const ensureSession = async () => {
      const threadSpecificKey = guestSessionService.getThreadSessionKey(id)
      if (threadSpecificKey) {
        guestSessionService.setSessionKey(threadSpecificKey)
        if (isMounted) {
          setSessionKey(threadSpecificKey)
          setGuestLabel(guestSessionService.getGuestLabel())
          setSessionReady(true)
        }
        return
      }

      const existingKey = guestSessionService.getSessionKey()
      if (existingKey) {
        if (isMounted) {
          setSessionKey(existingKey)
          setGuestLabel(guestSessionService.getGuestLabel())
          setSessionReady(true)
        }
        return
      }

      try {
        const initialized = await guestSessionService.initializeSession({ suppressThrottleError: true })
        if (isMounted) {
          if (initialized?.throttled && shouldShowGuestSessionThrottleNotice(initialized.retryAt)) {
            showInfo(getGuestSessionThrottleMessage(initialized.retryAt))
          }
          setSessionKey(initialized?.sessionKey || null)
          setGuestLabel(initialized?.guestLabel || null)
          setSessionReady(true)
        }
      } catch (err) {
        console.error("Failed to initialize guest session before loading thread:", err)
        if (isMounted) {
          setSessionReady(true)
        }
      }
    }

    ensureSession()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, id])

  useEffect(() => {
    if (isAuthenticated || !id || !urlSessionKey) return
    guestSessionService.setThreadSessionKey(id, urlSessionKey)
    guestSessionService.setSessionKey(urlSessionKey)
    setSessionKey(urlSessionKey)
  }, [isAuthenticated, id, urlSessionKey])

  useEffect(() => {
    if (isAuthenticated) {
      setSessionKey(null)
      setRecoveryMessage("")
      return
    }

    const threadSpecificKey = guestSessionService.getThreadSessionKey(id)
    const fallbackKey = guestSessionService.getSessionKey()
    const desiredKey = threadSpecificKey || fallbackKey

    if (desiredKey && desiredKey !== sessionKey) {
      setSessionKey(desiredKey)
    }
  }, [id, isAuthenticated, sessionKey])

  const readyAttachmentIds = pendingAttachments
    .filter(a => a.status === 'success' && a.server_id)
    .map(a => a.server_id)

  const isWaitingForSession = !sessionAvailable && !sessionReady
  const sessionInitFailed = !sessionAvailable && sessionReady

  const {
    data: guestThreadsData,
    isLoading: isGuestThreadsLoading,
  } = useQuery({
    queryKey: ["guestThreads", sessionKey],
    queryFn: () => chatApi.getGuestThreads(),
    enabled: !isAuthenticated && !!sessionKey,
    retry: false,
    staleTime: 30 * 1000,
  })

  const guestThreads = guestThreadsData?.results || guestThreadsData || []
  const currentGuestThread = !isAuthenticated
    ? guestThreads.find((thread) => String(thread?.id) === String(id))
    : null
  const canLoadGuestThreadMessages = isAuthenticated || (!!sessionKey && !!currentGuestThread)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["messages", id, sessionKey],
    queryFn: () => httpClient.get(`/chat/threads/${id}/messages/`, {
      skipAuthHeader: !isAuthenticated,
    }).then((r) => r.data),
    enabled: !!id && canLoadGuestThreadMessages,
    retry: (failureCount, queryError) => {
      const status = queryError?.response?.status
      if (status === 401 || status === 404) {
        return false
      }
      return failureCount < 2
    },
  })

  const hasRecoverableGuestError = !isAuthenticated && (error?.response?.status === 401 || error?.response?.status === 404)
  const hasLoadedThreadMessages = !!data && !isLoading && !error
  const shouldConnectWebSocket =
    !!id &&
    (isAuthenticated || !!sessionKey) &&
    hasLoadedThreadMessages &&
    !hasRecoverableGuestError

  useEffect(() => {
    if (
      isAuthenticated ||
      !id ||
      !sessionKey ||
      isGuestThreadsLoading ||
      guestRedirectAttemptedRef.current
    ) {
      return
    }

    if (currentGuestThread) {
      return
    }

    guestRedirectAttemptedRef.current = true
    setRecoveryMessage("Recovering your guest chat session...")
    guestSessionService.clearThreadSessionKey(id)

    const fallbackThread = guestThreads[0]
    if (fallbackThread?.id) {
      guestSessionService.setThreadSessionKey(fallbackThread.id, sessionKey)
      router.replace(`/threads/${fallbackThread.id}`)
      return
    }

    setRecoveryMessage("We started a fresh guest session. Choose a freelancer to continue chatting.")
    router.replace("/categories?fresh_session=1")
  }, [
    currentGuestThread,
    guestThreads,
    id,
    isAuthenticated,
    isGuestThreadsLoading,
    router,
    sessionKey,
  ])

  useEffect(() => {
    if (isAuthenticated) {
      recoveryAttemptedRef.current = false
      return
    }

    const errorStatus = error?.response?.status
    const isRecoverableGuestError = errorStatus === 401 || errorStatus === 404

    if (!id || !error || !isRecoverableGuestError || recoveryAttemptedRef.current) {
      return
    }

    recoveryAttemptedRef.current = true
    let cancelled = false

    const recoverGuestThread = async () => {
      setRecoveryMessage("Recovering your guest chat session...")

      try {
        const activeSessionKey = sessionKey || guestSessionService.getSessionKey()
        const guestThreadsResponse = activeSessionKey
          ? await chatApi.getGuestThreads()
          : { results: [] }
        const guestThreads = guestThreadsResponse?.results || guestThreadsResponse || []
        const fallbackThread = guestThreads.find((thread) => String(thread?.id) !== String(id)) || guestThreads[0]

        if (!cancelled && fallbackThread?.id) {
          if (activeSessionKey) {
            guestSessionService.setThreadSessionKey(fallbackThread.id, activeSessionKey)
          }
          router.replace(`/threads/${fallbackThread.id}`)
          return
        }

        guestSessionService.clearThreadSessionKey(id)
        guestSessionService.clearSession()

        const initialized = await guestSessionService.initializeSession()
        if (cancelled) return

        setSessionKey(initialized?.sessionKey || null)
        setGuestLabel(initialized?.guestLabel || null)
        setSessionReady(true)
        setRecoveryMessage("We couldn't restore that guest chat in this browser session. Choose a freelancer to continue chatting.")
        router.replace("/categories?fresh_session=1")
      } catch (recoveryError) {
        if (cancelled) return
        console.error("Failed to recover guest chat thread:", recoveryError)
        setRecoveryMessage("We couldn't recover this guest thread automatically. Please start a new chat from Categories.")
      }
    }

    recoverGuestThread()

    return () => {
      cancelled = true
    }
  }, [error, id, isAuthenticated, router, sessionKey])

  const { sendMessage: wsSendMessage, sendTyping } = useChatWebSocket({
    threadId: id,
    sessionKey,
    enabled: shouldConnectWebSocket,
    allowGuestSessionFallback: !isAuthenticated,
    onMessage: (data) => {
      const isOtherPerson = data.sender_id !== currentUserId &&
        data.sender_username !== currentUsername &&
        data.sender_name !== guestLabel;

      if (data.type === 'chat_message' || data.message) {
        const newMessage = data.message || data;
        queryClient.setQueryData(["messages", id, sessionKey], (oldData) => {
          if (!oldData || !oldData.messages) return { messages: [newMessage] };
          const exists = oldData.messages.some(m => m.id === newMessage.id);
          if (exists) return oldData;
          return { ...oldData, messages: [...oldData.messages, newMessage] };
        });

        broadcastRealtimeUpdate({
          type: "message",
          message: newMessage,
          isIncoming: isOtherPerson,
          playSound: isOtherPerson,
          sound: "message",
          source: "thread-websocket",
        })
      }

      if (['offer_update', 'job_update', 'status_change'].includes(data.type)) {
        queryClient.invalidateQueries({ queryKey: ["threadJob"] });
        queryClient.invalidateQueries({ queryKey: ["threadDetail"] });

        broadcastRealtimeUpdate({
          type: "action",
          actionType: data.type,
          payload: data,
          playSound: true,
          sound: "notification",
          source: "thread-websocket",
        })
      }
    }
  });

  const { data: threadData } = useQuery({
    queryKey: ["threadDetail", id, sessionKey],
    queryFn: () => chatApi.getThread(id, sessionKey),
    enabled: !!id && sessionAvailable && isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const relatedJobId = useMemo(() => {
    const fromThread =
      threadData?.job_id ||
      threadData?.job?.id ||
      threadData?.order_id ||
      threadData?.order?.id ||
      threadData?.created_job?.id ||
      null

    if (fromThread) return fromThread

    if (!Array.isArray(data?.messages)) return null
    const reversed = [...data.messages].reverse()
    for (const msg of reversed) {
      const idFromOffer = msg?.offer?.created_job?.id
      if (idFromOffer) return idFromOffer
    }
    return null
  }, [threadData, data?.messages])

  const broadcastRealtimeUpdate = useCallback((detail = {}) => {
    emitPlatformRealtimeEvent({
      threadId: id,
      relatedJobId,
      ...detail,
    })
  }, [id, relatedJobId])

  const getApiErrorMessage = (error, fallback) => {
    const responseData = error?.response?.data
    if (typeof responseData === "string" && responseData.trim()) return responseData
    if (responseData?.detail) return responseData.detail
    if (Array.isArray(responseData?.non_field_errors) && responseData.non_field_errors.length > 0) {
      return responseData.non_field_errors[0]
    }
    if (responseData && typeof responseData === "object") {
      const firstKey = Object.keys(responseData)[0]
      const firstValue = responseData[firstKey]
      if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0])
      if (typeof firstValue === "string") return firstValue
    }
    return fallback
  }

  const { data: jobDetail } = useQuery({
    queryKey: ["threadJob", relatedJobId],
    queryFn: async () => {
      try {
        const response = await httpClient.get(`/orders/jobs/${relatedJobId}/`, {
          suppressConsoleError: true,
        })
        return response.data
      } catch (error) {
        const status = error?.response?.status
        if (status === 403 || status === 404 || status >= 500) {
          return null
        }
        throw error
      }
    },
    enabled: isAuthenticated && !!relatedJobId,
    retry: false,
    staleTime: 60_000,
  })

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
  const participantName = useMemo(() => {
    const displayCandidates = [
      threadData?.other_party_name,
      threadData?.other_user?.username,
      threadData?.other_user_username,
      threadData?.freelancer?.username,
      threadData?.freelancer_username,
      threadData?.client?.username,
      threadData?.client_username,
    ]

    const normalizedCurrentUsername = currentUsername

    for (const candidate of displayCandidates) {
      const trimmedCandidate = String(candidate || "").trim()
      if (!trimmedCandidate) continue
      if (normalizedCurrentUsername && trimmedCandidate.toLowerCase() === normalizedCurrentUsername) {
        continue
      }
      return trimmedCandidate
    }

    return null
  }, [
    currentUsername,
    threadData?.client?.username,
    threadData?.client_username,
    threadData?.freelancer?.username,
    threadData?.freelancer_username,
    threadData?.other_party_name,
    threadData?.other_user?.username,
    threadData?.other_user_username,
  ])
  const currentRole = String(
    currentUser?.role ||
    currentUser?.user?.role ||
    ""
  ).toUpperCase()
  const jobStatus = String(jobDetail?.status || "").toUpperCase()
  const freelancerJobId = jobDetail?.freelancer_id || jobDetail?.freelancer?.id || jobDetail?.freelancer?.pk || null
  const clientJobId = jobDetail?.client_id || jobDetail?.client?.id || jobDetail?.client?.pk || null
  const freelancerUsername = String(jobDetail?.freelancer_username || jobDetail?.freelancer?.username || "").trim().toLowerCase()
  const clientUsername = String(jobDetail?.client_username || jobDetail?.client?.username || "").trim().toLowerCase()

  const isFreelancerOnJob =
    (currentUserId != null && freelancerJobId != null && String(currentUserId) === String(freelancerJobId)) ||
    (!!currentUsername && !!freelancerUsername && currentUsername === freelancerUsername)
  const isClientOnJob =
    (currentUserId != null && clientJobId != null && String(currentUserId) === String(clientJobId)) ||
    (!!currentUsername && !!clientUsername && currentUsername === clientUsername)
  const isFreelancerRole = currentRole === "FREELANCER"

  const canStartWork = isFreelancerOnJob && ["PAID", "ASSIGNED"].includes(jobStatus)
  const canSubmitDelivery = isFreelancerOnJob && ["IN_PROGRESS", "DISPUTE_OPEN"].includes(jobStatus)
  const canApproveDelivery = isClientOnJob && jobStatus === "DELIVERED"
  const canRateFreelancer = isClientOnJob && ["DELIVERED", "CLIENT_COMPLETED"].includes(jobStatus)
  const showFreelancerActions = isFreelancerOnJob || isFreelancerRole
  const showClientActions = isClientOnJob
  const existingThreadRating =
    latestThreadRating ||
    jobDetail?.rating ||
    jobDetail?.freelancer_rating ||
    jobDetail?.client_rating ||
    jobDetail?.review_rating ||
    null
  const hasExistingThreadRating =
    existingThreadRating != null &&
    (typeof existingThreadRating === "object"
      ? Number.isFinite(Number(existingThreadRating?.score))
      : Number.isFinite(Number(existingThreadRating)))
  const existingThreadRatingScore = hasExistingThreadRating
    ? Number(typeof existingThreadRating === "object" ? existingThreadRating?.score : existingThreadRating)
    : null
  const existingThreadRatingReview =
    typeof existingThreadRating === "object"
      ? existingThreadRating?.review || ""
      : ""

  const startWorkMutation = useMutation({
    mutationFn: async () => {
      if (!relatedJobId) throw new Error("No related job found for this thread.")
      if (!isFreelancerOnJob) throw new Error("Only the assigned freelancer can start this job.")
      if (!["PAID", "ASSIGNED"].includes(jobStatus)) {
        throw new Error("Job must be PAID or ASSIGNED before starting work.")
      }

      const candidates = [
        { method: "post", url: `/orders/jobs/${relatedJobId}/start/`, data: {} },
        { method: "post", url: `/orders/jobs/${relatedJobId}/start-work/`, data: {} },
        { method: "post", url: `/orders/jobs/${relatedJobId}/mark-in-progress/`, data: {} },
        { method: "post", url: `/orders/jobs/${relatedJobId}/in-progress/`, data: {} },
        { method: "post", url: `/orders/jobs/${relatedJobId}/status/`, data: { status: "IN_PROGRESS" } },
        { method: "patch", url: `/orders/jobs/${relatedJobId}/`, data: { status: "IN_PROGRESS" } },
      ]

      let lastError = null
      for (const candidate of candidates) {
        try {
          return await httpClient.request(candidate)
        } catch (error) {
          const status = error?.response?.status
          lastError = error
          if (status === 404 || status === 405) continue
          throw error
        }
      }
      throw lastError || new Error("No API endpoint found to set job IN_PROGRESS.")
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threadJob", relatedJobId] })
      queryClient.invalidateQueries({ queryKey: ["messages", id] })
      broadcastRealtimeUpdate({ type: "action", actionType: "job_started", source: "thread-mutation" })
      showSuccess("Job is now IN_PROGRESS. You can submit delivery from chat.")
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, error?.message || "Failed to start work."))
    },
  })

  const submitDeliveryMutation = useMutation({
    mutationFn: (formData) => {
      if (!relatedJobId) throw new Error("No related job found for this thread.")
      if (!isFreelancerOnJob) throw new Error("Only the assigned freelancer can submit delivery.")
      if (!["IN_PROGRESS", "DISPUTE_OPEN"].includes(jobStatus)) {
        throw new Error("Job must be IN_PROGRESS or DISPUTE_OPEN before submission.")
      }
      return httpClient.post(`/orders/jobs/${relatedJobId}/submit/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    },
    onSuccess: () => {
      setShowSubmissionForm(false)
      queryClient.invalidateQueries({ queryKey: ["threadJob", relatedJobId] })
      queryClient.invalidateQueries({ queryKey: ["messages", id] })
      broadcastRealtimeUpdate({ type: "action", actionType: "delivery_submitted", source: "thread-mutation" })
      showSuccess("Delivery submitted. Job status is now DELIVERED.")
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, error?.message || "Failed to submit delivery."))
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!relatedJobId) throw new Error("No related job found for this thread.")
      if (!isClientOnJob) throw new Error("Only the client can approve completion.")
      if (jobStatus !== "DELIVERED") throw new Error("Job must be DELIVERED before approval.")
      return httpClient.post(`/orders/jobs/${relatedJobId}/complete/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threadJob", relatedJobId] })
      queryClient.invalidateQueries({ queryKey: ["messages", id] })
      broadcastRealtimeUpdate({ type: "action", actionType: "job_completed", source: "thread-mutation" })
      const earnedAmount = resolveFreelancerEarnings(jobDetail)
      showSuccess(`Job accepted and completed. Freelancer earnings: ${formatUSD(earnedAmount)}.`)
      if (isClientOnJob) {
        showInfo("Freelancer has been notified. Any open dispute was auto-resolved as RESOLVED_PAID.")
      }
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, error?.message || "Failed to approve completion."))
    },
  })

  const rateFreelancerMutation = useMutation({
    mutationFn: () => {
      if (!relatedJobId) throw new Error("No related job found for this thread.")
      if (!isClientOnJob) throw new Error("Only the client can rate the freelancer.")
      if (!["DELIVERED", "CLIENT_COMPLETED"].includes(jobStatus)) {
        throw new Error("Rate freelancer is available when job is DELIVERED or CLIENT_COMPLETED.")
      }

      const parsedScore = Number(ratingScore)
      if (!Number.isFinite(parsedScore) || parsedScore < 1 || parsedScore > 5) {
        throw new Error("Score must be between 1 and 5.")
      }

      return httpClient.post(`/orders/jobs/${relatedJobId}/rate-freelancer/`, {
        score: parsedScore,
        review: ratingReview.trim(),
      })
    },
    onSuccess: (response) => {
      setLatestThreadRating(response?.data?.rating || null)
      setShowRatingForm(false)
      queryClient.invalidateQueries({ queryKey: ["threadJob", relatedJobId] })
      broadcastRealtimeUpdate({ type: "action", actionType: "freelancer_rated", source: "thread-mutation" })
      if (jobStatus === "DELIVERED") {
        showSuccess(
          response?.data?.created
            ? "Review submitted. Job moved to CLIENT_COMPLETED and open dispute auto-resolved (RESOLVED_PAID)."
            : "Review updated. Job moved to CLIENT_COMPLETED and open dispute auto-resolved (RESOLVED_PAID)."
        )
      } else {
        showSuccess(response?.data?.created ? "Freelancer review submitted." : "Freelancer review updated.")
      }
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, error?.message || "Failed to submit freelancer review."))
    },
  })

  useEffect(() => {
    if (!jobDetail?.id || !isFreelancerOnJob || jobStatus !== "CLIENT_COMPLETED") return
    const storageKey = `thread_job_completion_notified_${jobDetail.id}`
    if (typeof window === "undefined" || localStorage.getItem(storageKey)) return

    const earnedAmount = resolveFreelancerEarnings(jobDetail)
    showSuccess(`Job accepted by client. You earned ${formatUSD(earnedAmount)}.`)
    showInfo("Project status updated to CLIENT_COMPLETED.")
    localStorage.setItem(storageKey, "1")
  }, [jobDetail, isFreelancerOnJob, jobStatus, showInfo, showSuccess])

  useEffect(() => {
    if (isAuthenticated || !id) return

    const candidateKey =
      threadData?.guest_session_key || threadData?.guestSessionKey || threadData?.thread?.guest_session_key
    if (candidateKey && candidateKey !== sessionKey) {
      guestSessionService.setThreadSessionKey(id, candidateKey)
      guestSessionService.setSessionKey(candidateKey)
      setSessionKey(candidateKey)
    }
  }, [threadData, sessionKey, isAuthenticated, id])

  const uploadMutation = useMutation({
    mutationFn: async ({ file, clientId }) => {
      try {
        const uploaded = await chatApi.uploadFile(file, null, id)
        const uploadedId = uploaded?.id || uploaded?.pk
        if (!uploadedId) {
          throw new Error("Upload did not return an attachment id.")
        }

        setPendingAttachments(prev => prev.map(a =>
          a.id === clientId
            ? {
              ...a,
              status: 'success',
              server_id: uploadedId,
              size_mb: uploaded?.size_mb || (uploaded?.size_kb ? uploaded.size_kb / 1024 : a.size_mb),
            }
            : a
        ))
        return uploaded
      } catch (err) {
        const uploadError =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          err?.message ||
          "Upload failed."
        console.error(`File upload failed for ${file.name}:`, uploadError)
        setPendingAttachments(prev => prev.map(a =>
          a.id === clientId
            ? { ...a, status: 'error' }
            : a
        ))
        throw err
      }
    },
  })

  const sendMutation = useMutation({
    mutationFn: (payload) => httpClient.post(`/chat/threads/${id}/messages/`, payload),

    onSuccess: () => {
      setText("")
      setPendingAttachments([])
      queryClient.invalidateQueries({ queryKey: ["messages", id, sessionKey] })
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      broadcastRealtimeUpdate({ type: "message:sent", source: "thread-mutation" })
    },
    onError: (err) => {
      console.error("Message send failed:", err)
      alert(`Failed to send message: ${err.response?.data?.message || err.message}. Attachments were NOT cleared.`)
    }
  })

  const sendOfferMutation = useMutation({
    mutationFn: (offer) => chatApi.sendOffer(id, offer, isAuthenticated ? null : sessionKey),
    onSuccess: () => {
      setShowOfferForm(false)
      queryClient.invalidateQueries({ queryKey: ["messages", id] })
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      broadcastRealtimeUpdate({ type: "action", actionType: "offer_sent", source: "thread-mutation" })
    },
  })

  const updateOfferMutation = useMutation({
    mutationFn: ({ offerId, decision }) =>
      chatApi.updateOfferStatus(id, offerId, decision, isAuthenticated ? null : sessionKey),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", id] })
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      broadcastRealtimeUpdate({
        type: "action",
        actionType: typeof variables?.decision === "string" ? variables.decision : "offer_updated",
        payload: data,
        source: "thread-mutation",
      })

      if (data.job_created) {
        const acceptedEmail =
          typeof variables?.decision === "object" ? variables.decision?.clientEmail : ""
        if (data.job_created.id && acceptedEmail) {
          savePendingClientEmailForJob(data.job_created.id, acceptedEmail)
        }

        alert(`Job "${data.job_created.title}" created successfully! Status: ${data.job_created.status_display}`)

        if (data.job_created.payment_required && data.job_created.id) {
          try {
            const paymentOptions = {}
            if (!isAuthenticated) {
              const acceptedEmail =
                typeof variables?.decision === "object" ? variables.decision?.clientEmail : ""
              const email = (acceptedEmail || "").trim()
              if (!email || !EMAIL_REGEX.test(email)) {
                alert("Please provide a valid email before proceeding")
                return
              }

              const password = window.prompt(
                "Create a password for your new client account (minimum 8 characters):",
                ""
              )
              if (password === null) {
                alert("Payment setup canceled. Use Pay Now on this offer when ready.")
                return
              }

              const confirmPassword = window.prompt("Confirm your password:", "")
              if (confirmPassword === null) {
                alert("Payment setup canceled. Use Pay Now on this offer when ready.")
                return
              }

              if (password.length < MIN_PASSWORD_LENGTH) {
                alert("Password must be at least 8 characters.")
                return
              }

              paymentOptions.client_email = email
              paymentOptions.client_password = password
              paymentOptions.client_password_confirm = confirmPassword
            }

            if (paymentOptions.client_email) {
              savePendingClientEmailForJob(data.job_created.id, paymentOptions.client_email)
            }

            let paymentData = null
            let paymentInitError = null

            for (const delay of [0, ...PAYMENT_INIT_RETRY_DELAYS_MS]) {
              if (delay > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, delay))
              }

              try {
                paymentData = await chatApi.initializeJobPayment(
                  data.job_created.id,
                  paymentOptions
                )
                paymentInitError = null
                break
              } catch (error) {
                paymentInitError = error
                if (error?.response?.status !== 500) {
                  throw error
                }
              }
            }

            if (paymentInitError) {
              throw paymentInitError
            }

            const redirectUrl = paymentData?.authorization_url || paymentData?.authorizationUrl
            if (redirectUrl) {
              localStorage.setItem(PAYMENT_TRACKING_KEY, String(data.job_created.id))
              window.location.href = redirectUrl
              return
            }
          } catch (error) {
            console.error("Payment initialization failed:", error)
            const data = error.response?.data || {}
            alert(
              data.client_password_confirm ||
              data.client_password ||
              data.client_email ||
              data.detail ||
              "Failed to initialize payment. Retry Payment."
            )
          }
        }
      }
    },
  })

  const handleSend = (e) => {
    e.preventDefault()
    if (!text.trim() && readyAttachmentIds.length === 0) return

    // Update guest session activity
    if (!isAuthenticated) {
      guestSessionService.updateActivity()
    }

    sendMutation.mutate({
      message: text,
      attachment_ids: readyAttachmentIds,
    })
  }

  const handleAttachmentSelect = async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_PENDING_ATTACHMENTS - pendingAttachments.length)
    if (files.length === 0) return


    const uploads = files.map(file => {
      const clientId =
        Date.now().toString() + Math.random().toString(36).substring(2, 9)

      return {
        id: clientId,
        name: file.name,
        status: "pending",
        server_id: null,
        size_mb: file.size / (1024 * 1024),
        file,
      }
    })
    setPendingAttachments(prev => [...prev, ...uploads])

    const uploadPromises = uploads.map((item) =>
      uploadMutation.mutateAsync({
        file: item.file,
        clientId: item.id,
      })
    )

    try {
      await Promise.allSettled(uploadPromises)
    } finally {
      e.target.value = null
    }
  }

  const handleRemoveAttachment = (clientId) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== clientId))
  }

  const handleSendOffer = (offer) => {
    // Update guest session activity
    if (!isAuthenticated) {
      guestSessionService.updateActivity()
    }

    sendOfferMutation.mutate(offer)
  }

  const handleAcceptOffer = (offerId) => {
    if (isAuthenticated) {
      updateOfferMutation.mutate({ offerId, decision: "accepted" })
      return
    }

    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("currentUser") || "null")
      } catch {
        return null
      }
    })()
    const initialEmail = storedUser?.email || ""
    const inputEmail = window.prompt(
      "Enter your email to finalize account setup and receive confirmation:",
      initialEmail
    )

    if (inputEmail === null) return

    const trimmedEmail = inputEmail.trim()
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      alert("Please enter a valid email address to accept this offer.")
      return
    }

    updateOfferMutation.mutate({
      offerId,
      decision: { decision: "accepted", clientEmail: trimmedEmail },
    })
  }

  const handleRejectOffer = (offerId) => {
    updateOfferMutation.mutate({ offerId, decision: 'rejected' })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data])

  if (!hasHydrated || isWaitingForSession) return (
    <div className="thread-shell">
      <div className="thread-state">
        <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Initializing guest session...</p>
      </div>
    </div>
  )

  if (sessionInitFailed) return (
    <div className="thread-shell">
      <div className="thread-state p-8">
        <div className="w-16 h-16 border border-red-400 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Unable to start chat</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          We couldn't initialize your guest session. Please refresh the page or sign up to continue the conversation.
        </p>
      </div>
    </div>
  )

  if (isLoading) return (
    <div className="thread-shell">
      <div className="thread-state">
        <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">Loading conversation...</p>
      </div>
    </div>
  )
  if (error) return (
    <div className="thread-shell">
      <div className="thread-state p-8">
        <div className="w-16 h-16 border border-red-400 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Could not load chat thread</h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          {recoveryMessage && `${recoveryMessage} `}
          {error.response?.status === 404 && !isAuthenticated && "This thread belongs to a different guest session. Use the original session link, or sign in to continue."}
          {error.response?.status === 401 && isAuthenticated && "If you recently logged in, the thread may not be linked yet. Try refreshing."}
          {error.response?.status === 401 && !isAuthenticated && "This guest link is no longer valid for your current session. Redirecting you to recover or start a new chat."}
          {error.message || "Something went wrong. Please try again later."}
        </p>
      </div>
    </div>
  )

  const isUploading = uploadMutation.isPending || pendingAttachments.some(a => a.status === 'pending');
  const isSending = sendMutation.isPending;

  return (
    <div className="thread-shell">
      <div className="thread-modern">
        {showSubmissionForm && (
          <div className="thread-job-modal-overlay" onClick={() => setShowSubmissionForm(false)}>
            <div className="thread-job-modal-content" onClick={(e) => e.stopPropagation()}>
              <JobSubmissionForm
                jobId={relatedJobId}
                onSubmit={(formData) => submitDeliveryMutation.mutate(formData)}
                onCancel={() => setShowSubmissionForm(false)}
                isSubmitting={submitDeliveryMutation.isPending}
              />
            </div>
          </div>
        )}
        {showRatingForm && (
          <div className="thread-job-modal-overlay" onClick={() => setShowRatingForm(false)}>
            <div className="thread-job-modal-content thread-rating-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Rate Freelancer</h3>
              <p>Share quality of delivery and communication.</p>
              <label htmlFor="thread-rating-score">Score (1-5)</label>
              <input
                id="thread-rating-score"
                type="number"
                min="1"
                max="5"
                step="0.5"
                value={ratingScore}
                onChange={(e) => setRatingScore(e.target.value)}
              />
              <label htmlFor="thread-rating-review">Review</label>
              <textarea
                id="thread-rating-review"
                rows={4}
                placeholder="Great delivery and communication."
                value={ratingReview}
                onChange={(e) => setRatingReview(e.target.value)}
              />
              <div className="thread-rating-modal__actions">
                <button type="button" className="thread-job-btn" onClick={() => setShowRatingForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="thread-job-btn thread-job-btn--approve"
                  onClick={() => rateFreelancerMutation.mutate()}
                  disabled={rateFreelancerMutation.isPending}
                >
                  {rateFreelancerMutation.isPending ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="thread-modern__header">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <div className="thread-modern__header-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-lg text-slate-900">
                  {participantName ? `Chat with ${participantName}` : "Chat Conversation"}
                </h2>
              </div>
            </div>
            {!isAuthenticated && (
              <Link
                href="/messages"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Inbox
              </Link>
            )}
          </div>
        </div>

        {isAuthenticated && relatedJobId && jobDetail && (
          <div className="thread-job-panel">
            <div className="thread-job-panel__meta">
              <p className="thread-job-panel__title">
                Linked Job: <strong>{jobDetail.title || `#${relatedJobId}`}</strong>
              </p>
              <p className="thread-job-panel__status">
                Status: <strong>{jobDetail.status_display || jobStatus}</strong>
              </p>
            </div>
            <div className="thread-job-panel__actions">
              {showFreelancerActions && (
                <>
                  <button
                    type="button"
                    className="thread-job-btn thread-job-btn--start"
                    onClick={() => startWorkMutation.mutate()}
                    disabled={startWorkMutation.isPending || !canStartWork}
                    title={
                      !isFreelancerOnJob
                        ? "Only assigned freelancer can start work"
                        : canStartWork
                          ? "Move job to IN_PROGRESS"
                          : "Available when status is PAID or ASSIGNED"
                    }
                  >
                    {canStartWork ? "1) Start Work (IN_PROGRESS)" : "1) Start Work"}
                  </button>
                  <button
                    type="button"
                    className="thread-job-btn thread-job-btn--submit"
                    onClick={() => setShowSubmissionForm(true)}
                    disabled={!canSubmitDelivery}
                    title={
                      !isFreelancerOnJob
                        ? "Only assigned freelancer can submit delivery"
                        : canSubmitDelivery
                          ? "Submit delivery and set DELIVERED"
                          : "Available when status is IN_PROGRESS or DISPUTE_OPEN"
                    }
                  >
                    {canSubmitDelivery ? "2) Submit Delivery (DELIVERED)" : "2) Submit Delivery"}
                  </button>
                </>
              )}
              {showClientActions && (
                <>
                  <button
                    type="button"
                    className="thread-job-btn thread-job-btn--approve"
                    onClick={() => {
                      if (!canApproveDelivery) return
                      if (window.confirm("Approve delivery and mark this job complete?")) {
                        approveMutation.mutate()
                      }
                    }}
                    disabled={approveMutation.isPending || !canApproveDelivery}
                    title={canApproveDelivery ? "Mark job CLIENT_COMPLETED" : "Available when status is DELIVERED"}
                  >
                    {canApproveDelivery ? "3) Approve Delivery (CLIENT_COMPLETED)" : "3) Approve Delivery"}
                  </button>
                  {jobStatus === "DELIVERED" && (
                    <div className="thread-job-panel__hint">
                      Review submission files on the full job page before approval.
                    </div>
                  )}
                  {jobStatus === "CLIENT_COMPLETED" && (
                    <>
                      <div className="thread-job-panel__hint">
                        Job completed. Leave a freelancer rating here or on full job page.
                      </div>
                      {hasExistingThreadRating && (
                        <div className="thread-job-panel__hint">
                          Current review: {existingThreadRatingScore?.toFixed(1)} / 5
                          {existingThreadRatingReview ? ` - ${existingThreadRatingReview}` : ""}
                        </div>
                      )}
                      <button
                        type="button"
                        className="thread-job-btn thread-job-btn--submit"
                        onClick={() => {
                          if (hasExistingThreadRating) {
                            setRatingScore(String(existingThreadRatingScore || 5))
                            setRatingReview(existingThreadRatingReview || "")
                          } else {
                            setRatingScore("5")
                            setRatingReview("")
                          }
                          setShowRatingForm(true)
                        }}
                        disabled={!canRateFreelancer}
                      >
                        {hasExistingThreadRating ? "Update Freelancer Review" : "Rate Freelancer"}
                      </button>
                    </>
                  )}
                </>
              )}
              <a href={`/job/${relatedJobId}`} className="thread-job-link">
                Open Full Job Page
              </a>
            </div>
          </div>
        )}

        {/* Session expired warning */}
        {isGuestViewer && isSessionExpired && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2 text-sm">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-red-800 font-medium">Your guest session has expired. Please sign up to continue chatting.</span>
          </div>
        )}

        {showOfferForm && (
          <div className="thread-offer-form-panel">
            <OfferForm
              onSend={handleSendOffer}
              onCancel={() => setShowOfferForm(false)}
              isSending={sendOfferMutation.isPending}
            />
          </div>
        )}

        <div className="thread-modern__messages">

          {data?.messages?.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              onAcceptOffer={handleAcceptOffer}
              onRejectOffer={handleRejectOffer}
              currentUser={currentUser}
              isAuthenticated={isAuthenticated}
              sessionKey={sessionKey}
              guestLabel={guestLabel}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {pendingAttachments.length > 0 && (
          <div className="thread-modern__attachments">
            <div className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a2 2 0 102.828 2.828l6.586-6.586" />
              </svg>
              Files ready to send:
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map(a => (
                <span
                  key={a.id}
                  className={`inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium border
                  ${a.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                      a.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse' :
                        'bg-red-50 text-red-700 border-red-200'}`
                  }
                >
                  {a.name} ({a.status === 'error' ? 'Failed' : `${(a.size_mb).toFixed(1)} MB`})

                  {a.status === 'pending' && <span className="ml-2 h-3 w-3 block rounded-full border-2 border-r-transparent border-yellow-700 animate-spin"></span>}

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(a.id)}
                    className={`ml-2 text-current hover:opacity-75 focus:outline-none ${a.status === 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Remove"
                    disabled={a.status === 'pending'}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <form className="thread-modern__composer" onSubmit={handleSend}>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAttachmentSelect}
            style={{ display: 'none' }}
            multiple
            disabled={isUploading || isSending}
          />

          {/* Only render the Send Offer button if the user is authenticated */}
          {isAuthenticated && currentRole !== "CLIENT" && (
            <button
              type="button"
              onClick={() => setShowOfferForm(!showOfferForm)}
              className="px-4 py-3 text-gray-600 border border-gray-300 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors duration-200 rounded-xl flex items-center gap-2"
              title={showOfferForm ? "Hide Offer Form" : "Send Offer"}
              disabled={isUploading || isSending}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="hidden sm:inline">{showOfferForm ? "Close Offer" : "Send Offer"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className={`p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 rounded-xl ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isUploading ? "Uploading..." : "Upload Attachment"}
            disabled={isUploading || isSending}
          >
            {isUploading ? (
              <svg className="animate-spin h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.586a2 2 0 102.828 2.828l6.586-6.586" />
              </svg>
            )}
          </button>

          <input
            className="flex-1 px-5 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-red-500 transition-colors duration-200 text-base placeholder-gray-400"
            placeholder="Type your message here..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping(); // This comes from the WebSocket hook we added earlier
            }}
            disabled={isSending || isUploading}
          />
          <button
            className="thread-send-cta"
            disabled={isSending || isUploading || (!text.trim() && readyAttachmentIds.length === 0)}
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                Send
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
