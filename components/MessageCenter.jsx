import React, { useState, useMemo } from "react"
import PropTypes from "prop-types"
import Link from "next/link"
import EmptyState from "./EmptyState"
import LoadingState from "./LoadingState"

const MessageCenter = ({ threads, isLoading, currentUsername, maxDisplay = 10 }) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all") 

  const filteredThreads = useMemo(() => {
    if (!threads || threads.length === 0) return []

    let filtered = [...threads]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(thread => {
        const otherUsername = thread.freelancer_username === currentUsername
          ? (thread.client_username || thread.other_party_name || '')
          : thread.freelancer_username || ''
        const lastMessage = thread.last_message?.message || ''
        const offerTitle = thread.last_message?.offer_title || ''

        return (
          otherUsername.toLowerCase().includes(query) ||
          lastMessage.toLowerCase().includes(query) ||
          offerTitle.toLowerCase().includes(query)
        )
      })
    }

    if (filterType === "unread") {
      filtered = filtered.filter(thread => thread.unread_count > 0)
    } else if (filterType === "offers") {
      filtered = filtered.filter(thread => thread.last_message?.is_offer)
    }

    filtered.sort((a, b) => {
      const unreadA = a.unread_count > 0 ? 1 : 0
      const unreadB = b.unread_count > 0 ? 1 : 0

      if (unreadA !== unreadB) {
        return unreadB - unreadA
      }

      const dateA = new Date(a.last_message?.created_at || a.updated_at)
      const dateB = new Date(b.last_message?.created_at || b.updated_at)
      return dateB - dateA
    })

    return filtered.slice(0, maxDisplay)
  }, [threads, searchQuery, filterType, currentUsername, maxDisplay])

  const unreadCount = useMemo(() => {
    return threads?.filter(t => t.unread_count > 0).length || 0
  }, [threads])

  const offerCount = useMemo(() => {
    return threads?.filter(t => t.last_message?.is_offer).length || 0
  }, [threads])

  if (isLoading) {
    return <LoadingState message="Loading messages..." />
  }

  if (!threads || threads.length === 0) {
    return (
      <EmptyState
        icon="message"
        title="No messages yet"
        message="Start a conversation to see messages here"
        actionLabel="Browse Freelancers"
        actionLink="/jobs"
      />
    )
  }

  return (
    <div className="message-center" aria-label="Recent messages">
      <div className="message-center-header">
        <div className="message-summary-row">
          <p className="message-summary-text">
            Stay responsive to improve acceptance and close rates.
          </p>
          <span className="message-summary-count">{threads.length} threads</span>
        </div>
        <div className="message-search">
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="clear-search"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="message-filters">
          <button
            onClick={() => setFilterType("all")}
            className={`filter-btn ${filterType === "all" ? "active" : ""}`}
          >
            All ({threads.length})
          </button>
          <button
            onClick={() => setFilterType("unread")}
            className={`filter-btn ${filterType === "unread" ? "active" : ""}`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="filter-badge">{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setFilterType("offers")}
            className={`filter-btn ${filterType === "offers" ? "active" : ""}`}
          >
            Offers
            {offerCount > 0 && (
              <span className="filter-badge">{offerCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="message-list" role="list">
        {filteredThreads.length === 0 ? (
          <EmptyState
            icon="search"
            title="No results found"
            message="Try adjusting your search or filters"
          />
        ) : (
          filteredThreads.map((thread) => {
            const isUserFreelancer = thread.freelancer_username === currentUsername
            const otherUsername = isUserFreelancer
              ? (thread.client_username || thread.other_party_name || 'Guest')
              : thread.freelancer_username

            const lastMessage = thread.last_message || {}
            const isSent = lastMessage.sender_username === currentUsername
            const timestamp = lastMessage.created_at
              ? new Date(lastMessage.created_at)
              : new Date(thread.updated_at)

            // Format timestamp
            const now = new Date()
            const isToday = timestamp.toDateString() === now.toDateString()
            const isYesterday = new Date(now - 86400000).toDateString() === timestamp.toDateString()

            let timeDisplay
            if (isToday) {
              timeDisplay = timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })
            } else if (isYesterday) {
              timeDisplay = "Yesterday"
            } else {
              timeDisplay = timestamp.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })
            }

            return thread.id ? (
              <Link
                key={thread.id}
                href={`/message/${thread.id}`}
                className={`message-item ${thread.unread_count > 0 ? 'unread' : ''}`}
                role="listitem"
              >
                <div className="message-item-avatar">
                  {otherUsername.charAt(0).toUpperCase()}
                </div>
                <div className="message-item-content">
                  <div className="message-item-header">
                    <span className="message-username">
                      {otherUsername}
                      {thread.unread_count > 0 && <span className="message-unread-dot" aria-hidden="true"></span>}
                    </span>
                    <span className="message-time">{timeDisplay}</span>
                  </div>
                  <div className="message-preview">
                    {lastMessage.is_offer && <span className="message-type-tag">Offer</span>}
                    {isSent && <span className="message-sent-indicator">You: </span>}
                    <span className="message-text">
                      {lastMessage.is_offer
                        ? (lastMessage.offer_title || "Project offer")
                        : (lastMessage.message || "Start a conversation...")}
                    </span>
                  </div>
                </div>
                {thread.unread_count > 0 && (
                  <span className="message-unread-badge">
                    {thread.unread_count}
                  </span>
                )}
              </Link>
            ) : null
          })
        )}
      </div>

      {filteredThreads.length > 0 && threads.length > maxDisplay && (
        <div className="message-center-footer">
          <Link href="/messages" className="view-all-link">
            View All Messages →
          </Link>
        </div>
      )}
    </div>
  )
}

MessageCenter.propTypes = {
  threads: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    freelancer_username: PropTypes.string,
    client_username: PropTypes.string,
    other_party_name: PropTypes.string,
    unread_count: PropTypes.number,
    updated_at: PropTypes.string,
    last_message: PropTypes.shape({
      message: PropTypes.string,
      created_at: PropTypes.string,
      sender_username: PropTypes.string,
      is_offer: PropTypes.bool,
      offer_title: PropTypes.string
    })
  })),
  isLoading: PropTypes.bool,
  currentUsername: PropTypes.string.isRequired,
  maxDisplay: PropTypes.number
}

export default MessageCenter
