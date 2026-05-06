import React, { useState, useMemo } from "react"
import PropTypes from "prop-types"
import Link from "next/link"
import OfferCard from "./OfferCard"
import EmptyState from "./EmptyState"
import LoadingState from "./LoadingState"
import "./OfferManagement.scss" 

const OfferManagement = ({
  offers,
  isLoading,
  onAccept,
  onReject,
  isProcessing = false
}) => {
  const [filterStatus, setFilterStatus] = useState("pending") 
  const [sortBy, setSortBy] = useState("newest") 

  /**
   * Updated Formatter: Uses US locale and USD currency
   */
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const sortedAndFilteredOffers = useMemo(() => {
    if (!offers || offers.length === 0) return []

    let filtered = [...offers]

    // 1. Filtering
    if (filterStatus !== "all") {
      filtered = filtered.filter(offer => offer.offer_status === filterStatus)
    }

    // 2. Sorting
    filtered.sort((a, b) => {
      const aPrice = parseFloat(a.offer_price || 0)
      const bPrice = parseFloat(b.offer_price || 0)
      const aDate = new Date(a.created_at || 0)
      const bDate = new Date(b.created_at || 0)

      switch (sortBy) {
        case "newest":
          return bDate - aDate
        case "oldest":
          return aDate - bDate
        case "price_high":
          return bPrice - aPrice
        case "price_low":
          return aPrice - bPrice
        default:
          return 0
      }
    })

    return filtered
  }, [offers, filterStatus, sortBy])

  const stats = useMemo(() => {
    const pending = offers?.filter(o => o.offer_status === "pending").length || 0
    const totalValue = offers
      ?.filter(o => o.offer_status === "pending")
      .reduce((sum, o) => sum + parseFloat(o.offer_price || 0), 0) || 0

    return { 
        pending, 
        totalValue,
        accepted: offers?.filter(o => o.offer_status === "accepted").length || 0,
        rejected: offers?.filter(o => o.offer_status === "rejected").length || 0,
    }
  }, [offers])

  if (isLoading) {
    return <LoadingState message="Loading offers..." />
  }

  if (!offers || offers.length === 0) {
    return (
      <EmptyState
        icon="offer"
        title="No Offers Received Yet"
        message="When clients send you project offers, they'll appear here. Keep your profile updated!"
      />
    )
  }

  return (
    <div className="offer-management">
      <div className="offer-management-header">
        <div className="offer-stats-bar">
          <div className="offer-stat offer-stat--pending">
            <span className="offer-stat-label">Pending Offers</span>
            <span className="offer-stat-value">{stats.pending}</span>
          </div>
          <div className="offer-stat offer-stat--value">
            <span className="offer-stat-label">Total Pending Value</span>
            <span className="offer-stat-value">
              {formatCurrency(stats.totalValue)}
            </span>
          </div>
          <div className="offer-stat offer-stat--accepted">
            <span className="offer-stat-label">Accepted</span>
            <span className="offer-stat-value">{stats.accepted}</span>
          </div>
          <div className="offer-stat offer-stat--rejected">
            <span className="offer-stat-label">Rejected</span>
            <span className="offer-stat-value">{stats.rejected}</span>
          </div>
        </div>

        <div className="offer-controls">
          <div className="offer-filter-group">
            <label className="filter-label">Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="pending">Pending Only</option>
              <option value="accepted">Accepted Only</option>
              <option value="rejected">Rejected Only</option>
              <option value="all">All Offers</option>
            </select>
          </div>

          <div className="offer-filter-group">
            <label className="filter-label">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price_high">Highest Price</option>
              <option value="price_low">Lowest Price</option>
            </select>
          </div>
        </div>
      </div>

      <div className="offer-list">
        {sortedAndFilteredOffers.length === 0 ? (
          <EmptyState
            icon="search"
            title="No offers match current filters"
            message="Try adjusting the status filter or sorting options."
          />
        ) : (
          sortedAndFilteredOffers.map((offer) => (
            <div key={offer.id} className="offer-wrapper">
              <div className="offer-meta">
                <div className="offer-sender-info">
                  <span className="sender-label">From:</span>
                  <strong className="sender-name">
                    {offer.thread_info?.sender_username || 'Unknown Client'}
                  </strong>
                  {offer.created_at && (
                    <span className="offer-date">
                      {new Date(offer.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
                {offer.thread_info?.id && (
                  <Link
                    href={`/messages/${offer.thread_info.id}`}
                    className="view-thread-link"
                  >
                    <svg
                      className="link-icon"
                      xmlns="http://www.w3.org/2000/svg"
                      width="18" height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    View Thread
                  </Link>
                )}
              </div>

              <OfferCard
                offer={{
                  id: offer.id,
                  title: offer.offer_title,
                  price: offer.offer_price,
                  timeline: offer.offer_timeline,
                  description: offer.offer_description,
                  status: offer.offer_status,
                }}
                onAccept={(offerId) => onAccept(offerId, offer.thread_info?.id)}
                onReject={(offerId) => onReject(offerId, offer.thread_info?.id)}
                canRespond={true}
                isPending={offer.offer_status === "pending"}
                isCreator={false}
              />

              {offer.offer_status === "pending" && (
                <div className="offer-urgency">
                  <svg
                    className="urgency-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="18" height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Awaiting your response</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isProcessing && (
        <div className="offer-processing-overlay">
          <LoadingState message="Processing offer..." />
        </div>
      )}
    </div>
  )
}

OfferManagement.propTypes = {
  offers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    offer_title: PropTypes.string,
    offer_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    offer_timeline: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    offer_description: PropTypes.string,
    offer_status: PropTypes.string,
    created_at: PropTypes.string,
    thread_info: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      sender_username: PropTypes.string
    })
  })),
  isLoading: PropTypes.bool,
  onAccept: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool
}

export default OfferManagement