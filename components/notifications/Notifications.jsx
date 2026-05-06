"use client"

import React, { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import httpClient from "../../api/httpClient"
import "./Notifications.scss"

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.results)) return value.results
  return []
}

const normalizeNotifications = (payload) => {
  const direct = [
    ...toArray(payload?.notifications),
    ...toArray(payload?.recent_notifications),
    ...toArray(payload?.results),
  ]
  if (direct.length > 0) return direct
  return toArray(payload)
}

const fetchNotifications = async () => {
  const endpointCandidates = [
    "/users/dashboard/notifications/",
    "/users/notifications/",
    "/notifications/",
  ]

  for (const endpoint of endpointCandidates) {
    try {
      const response = await httpClient.get(endpoint)
      const normalized = normalizeNotifications(response?.data)
      if (normalized.length > 0) return normalized
    } catch (error) {
      const status = error?.response?.status
      if (status === 404 || status === 405) {
        continue
      }
      throw error
    }
  }

  return []
}

const EVENT_LABELS = {
  MESSAGE: "New Message",
  JOB_CREATED: "Job Created",
  JOB_UPDATED: "Job Updated",
  JOB_CANCELLED: "Job Cancelled",
  JOB_COMPLETED: "Job Completed",
  OFFER_RECEIVED: "Offer Received",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_SENT: "Payment Sent",
  PAYMENT_FAILED: "Payment Failed",
  PAYOUT_PROCESSED: "Payout Processed",
  REVIEW_RECEIVED: "Review Received",
  ACCOUNT_VERIFIED: "Account Verified",
  ACCOUNT_SUSPENDED: "Account Suspended",
  SYSTEM_ANNOUNCEMENT: "Announcement",
  SYSTEM_MAINTENANCE: "Maintenance",
}

const normalizeLink = (note) => {
  const raw = note?.link
  if (raw && typeof raw === "string") return raw
  if (note?.thread_id) return `/messages/${note.thread_id}`
  if (note?.metadata?.job_id) return `/job/${note.metadata.job_id}`
  return null
}

export default function Notifications() {
  const queryClient = useQueryClient()
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["notifications-page"],
    queryFn: fetchNotifications,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  })

  const updateNotificationReadMutation = useMutation({
    mutationFn: async ({ noteId, markRead }) => {
      const id = String(noteId)
      const endpointCandidates = markRead
        ? [
            { method: "put", url: `/users/dashboard/notifications/${id}/read/` },
            { method: "post", url: `/users/dashboard/notifications/${id}/read/` },
            { method: "patch", url: `/users/dashboard/notifications/${id}/`, data: { is_read: true } },
            { method: "put", url: `/notifications/${id}/read/` },
            { method: "post", url: `/notifications/${id}/read/` },
            { method: "patch", url: `/notifications/${id}/`, data: { is_read: true } },
          ]
        : [
            { method: "put", url: `/users/dashboard/notifications/${id}/unread/` },
            { method: "post", url: `/users/dashboard/notifications/${id}/unread/` },
            { method: "patch", url: `/users/dashboard/notifications/${id}/`, data: { is_read: false } },
            { method: "put", url: `/notifications/${id}/unread/` },
            { method: "post", url: `/notifications/${id}/unread/` },
            { method: "patch", url: `/notifications/${id}/`, data: { is_read: false } },
          ]

      for (const candidate of endpointCandidates) {
        try {
          await httpClient.request(candidate)
          return { noteId, markRead }
        } catch (requestError) {
          const status = requestError?.response?.status
          if (status === 404 || status === 405) continue
          throw requestError
        }
      }

      return { noteId, markRead }
    },
    onMutate: async ({ noteId, markRead }) => {
      await queryClient.cancelQueries({ queryKey: ["notifications-page"] })
      const previousData = queryClient.getQueryData(["notifications-page"])
      queryClient.setQueryData(["notifications-page"], (old) => {
        const list = Array.isArray(old) ? old : []
        return list.map((item) =>
          String(item?.id) === String(noteId)
            ? { ...item, is_read: Boolean(markRead) }
            : item
        )
      })
      return { previousData }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notifications-page"], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] })
    },
  })

  const notifications = useMemo(() => {
    return [...data].map((note) => {
      const typeKey = String(note?.notification_type || note?.event_type || note?.type || "").toUpperCase()
      const isMessageType = typeKey === "MESSAGE" || String(note?.type || "").toLowerCase() === "message"

      return {
        ...note,
        _label: EVENT_LABELS[typeKey] || (isMessageType ? "New Message" : "Notification"),
        _link: normalizeLink(note),
      }
    }).sort((a, b) => {
      const aTime = new Date(a?.created_at || a?.timestamp || 0).getTime()
      const bTime = new Date(b?.created_at || b?.timestamp || 0).getTime()
      return bTime - aTime
    })
  }, [data])

  const pendingNoteId = updateNotificationReadMutation.variables?.noteId

  if (isLoading) {
    return (
      <div className="notifications-page">
        <div className="notifications-state">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="notifications-page">
        <div className="notifications-state">
          <h2>Could not load notifications</h2>
          <p>{error?.response?.data?.detail || "Please try again."}</p>
          <button onClick={() => refetch()} className="btn-retry">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <Link href="/dashboard" className="back-link">Back to Dashboard</Link>
      </div>

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <h3>No notifications yet</h3>
          <p>Updates about messages, offers, and order milestones will appear here.</p>
        </div>
      ) : (
        <ul className="notifications-list">
          {notifications.map((note, index) => (
            <li key={note?.id || `note-${index}`} className={`notification-item ${note?.is_read ? "" : "unread"}`}>
              {note?._link ? (
                <Link
                  href={note._link}
                  className="notification-link"
                  onClick={() => {
                    if (!note?.is_read && note?.id != null) {
                      updateNotificationReadMutation.mutate({ noteId: note.id, markRead: true })
                    }
                  }}
                >
                  <div className="notification-main">
                    <span className="notification-type">{note._label}</span>
                    <span className="notification-text">{note?.text || note?.message || "Notification"}</span>
                    {note?.metadata?.job_id ? (
                      <span className="notification-meta">Job: {note.metadata.job_id}</span>
                    ) : null}
                    {note?.unread_count ? (
                      <span className="notification-meta">Unread in thread: {note.unread_count}</span>
                    ) : null}
                  </div>
                  <span className="notification-time">
                    {new Date(note?.created_at || note?.timestamp || Date.now()).toLocaleString()}
                  </span>
                </Link>
              ) : (
                <div className="notification-link">
                  <div className="notification-main">
                    <span className="notification-type">{note._label}</span>
                    <span className="notification-text">{note?.text || note?.message || "Notification"}</span>
                  </div>
                  <span className="notification-time">
                    {new Date(note?.created_at || note?.timestamp || Date.now()).toLocaleString()}
                  </span>
                </div>
              )}
              {note?.id != null && (
                <div className="notification-actions">
                  <button
                    type="button"
                    className="notification-action-btn"
                    disabled={updateNotificationReadMutation.isPending && String(pendingNoteId) === String(note.id)}
                    onClick={() =>
                      updateNotificationReadMutation.mutate({
                        noteId: note.id,
                        markRead: !note?.is_read,
                      })
                    }
                  >
                    {updateNotificationReadMutation.isPending && String(pendingNoteId) === String(note.id)
                      ? "Updating..."
                      : note?.is_read
                        ? "Mark as unread"
                        : "Mark as read"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
