"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import moment from "moment"
import httpClient from "../../api/httpClient"
import "./Messages.scss"

const Messages = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [hasHydrated, setHasHydrated] = useState(false)
  const [currentUser, setCurrentUser] = useState({})
  const [guestSessionKey, setGuestSessionKey] = useState(null)
  const [hasAccessToken, setHasAccessToken] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const userString = localStorage.getItem("currentUser")
      const parsedUser = userString ? JSON.parse(userString) : {}
      setCurrentUser(parsedUser || {})
    } catch {
      setCurrentUser({})
    }

    setGuestSessionKey(localStorage.getItem("guestSessionKey"))
    setHasAccessToken(Boolean(localStorage.getItem("accessToken") || localStorage.getItem("token")))
    setHasHydrated(true)
  }, [])

  const currentUserId = currentUser?.id || currentUser?.pk || currentUser?.user_id || null
  const isAuthenticatedUser = Boolean(currentUserId || currentUser?.token || hasAccessToken)
  const isGuestAccess = !isAuthenticatedUser && guestSessionKey
  const authQuery = isGuestAccess ? `?session_key=${guestSessionKey}` : ""

  const { isLoading, error, data } = useQuery({
    queryKey: ["threads", isGuestAccess, guestSessionKey],
    queryFn: () =>
      httpClient
        .get(`/chat/threads/${authQuery}`)
        .then((res) => res.data.results || res.data.threads || []),
    enabled: hasHydrated && (isAuthenticatedUser || !!guestSessionKey),
    retry: 1,
  })

  const markReadMutation = useMutation({
    mutationFn: ({ id, isGuestThread }) => {
      let url = `/chat/threads/${id}/read/`
      if (isGuestThread && isGuestAccess) {
        url += `?session_key=${guestSessionKey}`
      }
      return httpClient.put(url)
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["threads", isGuestAccess, guestSessionKey] })
      const previousData = queryClient.getQueryData(["threads", isGuestAccess, guestSessionKey])
      queryClient.setQueryData(["threads", isGuestAccess, guestSessionKey], (old) => {
        const list = Array.isArray(old) ? old : []
        return list.map((thread) => (String(thread?.id) === String(id) ? { ...thread, unread_count: 0 } : thread))
      })
      return { previousData }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["threads", isGuestAccess, guestSessionKey], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["threads", isGuestAccess, guestSessionKey] })
    },
  })

  const markUnreadMutation = useMutation({
    mutationFn: async ({ id, isGuestThread }) => {
      const suffix = isGuestThread && isGuestAccess ? `?session_key=${guestSessionKey}` : ""
      const candidates = [
        { method: "put", url: `/chat/threads/${id}/unread/${suffix}` },
        { method: "post", url: `/chat/threads/${id}/unread/${suffix}` },
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
      throw lastError || new Error("Failed to mark conversation unread.")
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["threads", isGuestAccess, guestSessionKey] })
      const previousData = queryClient.getQueryData(["threads", isGuestAccess, guestSessionKey])
      queryClient.setQueryData(["threads", isGuestAccess, guestSessionKey], (old) => {
        const list = Array.isArray(old) ? old : []
        return list.map((thread) =>
          String(thread?.id) === String(id) && Number(thread?.unread_count || 0) === 0
            ? { ...thread, unread_count: 1 }
            : thread
        )
      })
      return { previousData }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["threads", isGuestAccess, guestSessionKey], context.previousData)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["threads", isGuestAccess, guestSessionKey] })
    },
  })

  const threads = useMemo(() => {
    const list = [...(data || [])]

    list.sort((a, b) => {
      const unreadA = a.unread_count > 0 ? 1 : 0
      const unreadB = b.unread_count > 0 ? 1 : 0

      if (unreadA !== unreadB) {
        return unreadB - unreadA
      }

      return new Date(b.updated_at) - new Date(a.updated_at)
    })

    return list
  }, [data])

  const unreadCount = useMemo(() => threads.filter((thread) => thread.unread_count > 0).length, [threads])
  const offerCount = useMemo(() => threads.filter((thread) => !!thread.last_message?.is_offer).length, [threads])

  const filteredThreads = useMemo(() => {
    let list = [...threads]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter((thread) => {
        const otherParty = (thread.other_party_name || "").toLowerCase()
        const preview = (thread.last_message_preview || "").toLowerCase()
        return otherParty.includes(query) || preview.includes(query)
      })
    }

    if (filterType === "unread") {
      list = list.filter((thread) => thread.unread_count > 0)
    }

    if (filterType === "offers") {
      list = list.filter((thread) => !!thread.last_message?.is_offer)
    }

    return list
  }, [threads, searchQuery, filterType])

  if (!hasHydrated || isLoading) {
    return (
      <div className="messages-page">
        <div className="messages-shell">
          <div className="messages-loading">Loading conversations...</div>
        </div>
      </div>
    )
  }

  if (error) {
    const message =
      isGuestAccess && error.response?.status === 401
        ? "Guest session expired or unavailable."
        : error.message

    return (
      <div className="messages-page">
        <div className="messages-shell">
          <div className="messages-error">{message}</div>
        </div>
      </div>
    )
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="messages-page">
        <div className="messages-shell">
          <div className="messages-empty">
            <h2>No conversations yet</h2>
            <p>Start a conversation and your inbox will appear here.</p>
            {!isAuthenticatedUser && (
              <Link href="/register" className="primary-btn">
                Create Free Account
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-page">
      <div className="messages-shell">
        <div className="messages-header">
          <div>
            <h1>Messages</h1>
            <p>Reply quickly to keep conversations moving and close work faster.</p>
          </div>
          <div className="messages-header-stats">
            <span className="stat-pill">{threads.length} Total</span>
            <span className="stat-pill stat-pill--unread">{unreadCount} Unread</span>
            <span className="stat-pill">{offerCount} Offers</span>
          </div>
        </div>

        <div className="messages-toolbar">
          <div className="messages-search">
            <svg
              className="search-icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-5-5m2-4a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name or message"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery("")} aria-label="Clear search">
                x
              </button>
            )}
          </div>

          <div className="messages-filters">
            <button
              className={`filter-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              All
            </button>
            <button
              className={`filter-btn ${filterType === "unread" ? "active" : ""}`}
              onClick={() => setFilterType("unread")}
            >
              Unread
            </button>
            <button
              className={`filter-btn ${filterType === "offers" ? "active" : ""}`}
              onClick={() => setFilterType("offers")}
            >
              Offers
            </button>
          </div>
        </div>

        <div className="messages-list" role="list">
          {filteredThreads.length === 0 && (
            <div className="messages-empty messages-empty--inline">
              <h2>No matching conversations</h2>
              <p>Try another search term or filter.</p>
            </div>
          )}

          {filteredThreads.map((thread) => {
            if (!thread.id) return null

            const otherPartyName = thread.other_party_name || "Conversation"

            return (
              <Link
                key={thread.id}
                href={`/message/${thread.id}`}
                role="listitem"
                className={`message-row ${thread.unread_count > 0 ? "unread" : ""}`}
                onClick={() =>
                  thread.unread_count > 0 &&
                  markReadMutation.mutate({
                    id: thread.id,
                    isGuestThread: thread.is_guest_thread,
                  })
                }
              >
                <div className="message-avatar">{otherPartyName.charAt(0).toUpperCase()}</div>

                <div className="message-body">
                  <div className="message-top">
                    <span className="message-name">
                      {otherPartyName}
                      {thread.unread_count > 0 && <span className="live-dot" aria-hidden="true"></span>}
                      {thread.is_guest_thread && <span className="guest-badge">Guest</span>}
                    </span>
                    <span className="message-time">{moment(thread.updated_at).fromNow()}</span>
                  </div>

                  <div className="message-preview">{thread.last_message_preview || "No messages yet"}</div>
                </div>

                <div className="message-row-actions">
                  {thread.unread_count > 0 && <span className="unread-indicator">{thread.unread_count}</span>}
                  <button
                    type="button"
                    className="thread-read-toggle"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (thread.unread_count > 0) {
                        markReadMutation.mutate({ id: thread.id, isGuestThread: thread.is_guest_thread })
                      } else {
                        markUnreadMutation.mutate({ id: thread.id, isGuestThread: thread.is_guest_thread })
                      }
                    }}
                    disabled={markReadMutation.isPending || markUnreadMutation.isPending}
                  >
                    {thread.unread_count > 0 ? "Mark read" : "Mark unread"}
                  </button>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Messages
