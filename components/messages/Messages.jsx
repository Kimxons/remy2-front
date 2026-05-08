"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import moment from "moment"
import httpClient from "../../api/httpClient"
import { subscribeToPlatformRealtime } from "../../utils/realtime"
import { guestSessionService } from "../../services/guestSessionService"
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

    setGuestSessionKey(guestSessionService.getSessionKey())
    setHasAccessToken(Boolean(localStorage.getItem("accessToken") || localStorage.getItem("token")))
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!hasHydrated || hasAccessToken || guestSessionKey) {
      return
    }

    let cancelled = false

    const ensureGuestSession = async () => {
      try {
        const initialized = await guestSessionService.initializeSession()
        if (cancelled) return
        setGuestSessionKey(initialized?.sessionKey || guestSessionService.getSessionKey())
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to initialize guest session for messages:", error)
        }
      }
    }

    ensureGuestSession()

    return () => {
      cancelled = true
    }
  }, [guestSessionKey, hasAccessToken, hasHydrated])

  const currentUserId = currentUser?.id || currentUser?.pk || currentUser?.user_id || null
  const isAuthenticatedUser = Boolean(currentUserId || currentUser?.token || hasAccessToken)
  const isGuestAccess = !isAuthenticatedUser && guestSessionKey

  const { isLoading, error, data, refetch } = useQuery({
    queryKey: ["threads", isGuestAccess, guestSessionKey],
    queryFn: () =>
      isGuestAccess
        ? httpClient
          .get("/chat/guest-threads/")
          .then((res) => res.data.results || res.data.threads || res.data || [])
        : httpClient
          .get("/chat/threads/")
          .then((res) => res.data.results || res.data.threads || []),
    enabled: hasHydrated && (isAuthenticatedUser || !!guestSessionKey),
    refetchInterval: 5000,
    retry: 1,
  })

  useEffect(() => {
    return subscribeToPlatformRealtime((event) => {
      if (event?.threadId && event?.type === "message") {
        queryClient.setQueryData(["threads", isGuestAccess, guestSessionKey], (old) => {
          const list = Array.isArray(old) ? old : []
          return list.map((thread) => {
            if (String(thread?.id) !== String(event.threadId)) {
              return thread
            }

            const nextUnreadCount = event.isIncoming
              ? Number(thread?.unread_count || 0) + 1
              : Number(thread?.unread_count || 0)

            return {
              ...thread,
              unread_count: nextUnreadCount,
              updated_at: event.message?.created_at || event.message?.timestamp || new Date().toISOString(),
              last_message_preview: event.message?.message || thread?.last_message_preview || "",
              last_message: event.message || thread?.last_message,
            }
          })
        })
      }

      refetch()
    })
  }, [guestSessionKey, isGuestAccess, queryClient, refetch])

  const markReadMutation = useMutation({
    mutationFn: ({ id }) => httpClient.put(`/chat/threads/${id}/read/`),
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
    mutationFn: async ({ id }) => {
      const candidates = [
        { method: "put", url: `/chat/threads/${id}/unread/` },
        { method: "post", url: `/chat/threads/${id}/unread/` },
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
          {isGuestAccess && (
            <div className="messages-guest-banner">
              <div>
                <strong>Your inbox is ready</strong>
                <p>
                  Keep freelancer replies, offers, and follow-ups in one place while you decide who to hire.
                </p>
              </div>
              <Link href="/categories" className="messages-guest-banner__cta">
                Find Another Freelancer
              </Link>
            </div>
          )}
          <div className="messages-empty">
            <h2>No conversations yet</h2>
            <p>
              {isAuthenticatedUser
                ? "Start a conversation and your inbox will appear here."
                : "Start a chat from the freelancer list and their reply will show up here."}
            </p>
            {!isAuthenticatedUser ? (
              <Link href="/categories" className="primary-btn">
                Start New Chat
              </Link>
            ) : (
              <Link href="/categories" className="primary-btn">
                Browse Experts
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
        {isGuestAccess && (
          <div className="messages-guest-banner">
            <div>
              <strong>Your inbox is ready</strong>
              <p>
                Keep freelancer replies, offers, and follow-ups in one place while you decide who to hire.
              </p>
            </div>
            <Link href="/categories" className="messages-guest-banner__cta">
              Find Another Freelancer
            </Link>
          </div>
        )}
        <div className="messages-header">
          <div>
            <h1>Messages</h1>
            <p>
              {isGuestAccess
                ? "Review replies, compare offers, and pick the best fit for your project."
                : "Reply quickly to keep conversations moving and close work faster."}
            </p>
          </div>
          <div className="messages-header-stats">
            <span className="stat-pill">{threads.length} Conversations</span>
            <span className="stat-pill stat-pill--unread">{unreadCount} New Replies</span>
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
                href={`/messages/${thread.id}`}
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
