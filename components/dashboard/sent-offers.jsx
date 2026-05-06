"use client"

// import React, { useMemo, useState } from "react"
// import { useRouter } from "next/navigation"
import Link from "next/link"
// import { usePendingOffersSent } from "../../hooks/useChatHooks"
// import OfferCard from "../../components/OfferCard"
// import EmptyState from "../../components/EmptyState"
// import LoadingState from "../../components/LoadingState"
// import ErrorBoundary from "../../components/ErrorBoundary"
// import "./sent-offers.scss"

// // Use USD formatting function
// const formatCurrency = (amount) => {
//   const num = Number(amount) || 0
//   return new Intl.NumberFormat("en-US", {
//     style: "currency",
//     currency: "USD",
//     maximumFractionDigits: 0,
//   }).format(num)
// }

// const SentOffers = () => {
//   const router = useRouter()
//   const { sentOffers, isLoading, error, refetch } = usePendingOffersSent()

//   const [filterStatus, setFilterStatus] = useState("all")
//   const [sortBy, setSortBy] = useState("newest")

//   const normalizedOffers = useMemo(() => {
//     return (sentOffers || []).map(o => ({
//       ...o,
//       _price: Number(o.offer_price) || 0,
//       _date: new Date(o.created_at || 0).getTime(),
//     }))
//   }, [sentOffers])

//   const sortedAndFilteredOffers = useMemo(() => {
//     let data = [...normalizedOffers]

//     if (filterStatus !== "all") {
//       data = data.filter(o => o.offer_status === filterStatus)
//     }

//     data.sort((a, b) => {
//       switch (sortBy) {
//         case "newest":
//           return b._date - a._date
//         case "oldest":
//           return a._date - b._date
//         case "price_high":
//           return b._price - a._price
//         case "price_low":
//           return a._price - b._price
//         default:
//           return 0
//       }
//     })

//     return data
//   }, [normalizedOffers, filterStatus, sortBy])

//   const stats = useMemo(() => {
//     return normalizedOffers.reduce(
//       (acc, o) => {
//         acc.total++
//         if (o.offer_status === "pending") {
//           acc.pending++
//           acc.totalValue += o._price
//         } else if (o.offer_status === "accepted") {
//           acc.accepted++
//         } else if (o.offer_status === "rejected") {
//           acc.rejected++
//         }
//         return acc
//       },
//       { total: 0, pending: 0, accepted: 0, rejected: 0, totalValue: 0 }
//     )
//   }, [normalizedOffers])

//   if (isLoading) {
//     return <LoadingState message="Loading sent offers..." />
//   }

//   if (error) {
//     return (
//       <div className="sent-offers-page">
//         <EmptyState
//           icon="error"
//           title="Failed to Load Offers"
//           message={
//             error?.response?.data?.error ||
//             error?.message ||
//             "A network error occurred while loading your sent offers."
//           }
//         />
//         <div className="error-actions">
//           <button onClick={refetch} className="retry-btn">
//             Retry Loading
//           </button>
//         </div>
//       </div>
//     )
//   }

//   const hasOffers = normalizedOffers.length > 0

//   return (
//     <ErrorBoundary
//       fallbackMessage="An unexpected error occurred. Please try refreshing."
//       onReset={() => window.location.reload()}
//     >
//       <div className="sent-offers-page">
//         <header className="sent-offers-header">
//           <div className="header-content">
//             <button
//               onClick={() => router.push(-1)}
//               className="back-btn"
//               aria-label="Go back"
//             >
//               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
//               </svg>
//               Back to Dashboard
//             </button>
//             <div className="header-text">
//               <h1 className="page-title">Offers Sent</h1>
//               <p className="page-subtitle">
//                 Track the status of project offers you have sent to freelancers.
//               </p>
//             </div>
//           </div>
//         </header>

//         {hasOffers && (
//           <section className="stats-section">
//             <div className="stats-grid">
//               <div className="stat-card">
//                 <span className="stat-label">Total Sent</span>
//                 <span className="stat-value">{stats.total}</span>
//               </div>
//               <div className="stat-card pending">
//                 <span className="stat-label">Pending</span>
//                 <span className="stat-value">{stats.pending}</span>
//               </div>
//               <div className="stat-card accepted">
//                 <span className="stat-label">Accepted</span>
//                 <span className="stat-value">{stats.accepted}</span>
//               </div>
//               <div className="stat-card rejected">
//                 <span className="stat-label">Rejected</span>
//                 <span className="stat-value">{stats.rejected}</span>
//               </div>
//               <div className="stat-card value">
//                 <span className="stat-label">Pending Value</span>
//                 <span className="stat-value">
//                   {formatCurrency(stats.totalValue)}
//                 </span>
//               </div>
//             </div>
//           </section>
//         )}

//         {hasOffers && (
//           <section className="controls-section">
//             <div className="filter-group">
//               <label className="filter-label">Status:</label>
//               <select
//                 value={filterStatus}
//                 onChange={(e) => setFilterStatus(e.target.value)}
//                 className="filter-select"
//               >
//                 <option value="all">All Offers</option>
//                 <option value="pending">Pending</option>
//                 <option value="accepted">Accepted</option>
//                 <option value="rejected">Rejected</option>
//               </select>
//             </div>

//             <div className="filter-group">
//               <label className="filter-label">Sort:</label>
//               <select
//                 value={sortBy}
//                 onChange={(e) => setSortBy(e.target.value)}
//                 className="filter-select"
//               >
//                 <option value="newest">Newest First</option>
//                 <option value="oldest">Oldest First</option>
//                 <option value="price_high">Highest Price</option>
//                 <option value="price_low">Lowest Price</option>
//               </select>
//             </div>
//           </section>
//         )}

//         <section className="offers-section">
//           {!hasOffers ? (
//             <EmptyState
//               icon="offer"
//               title="No Offers Sent Yet"
//               message="You haven't sent any project offers. Start a conversation with a freelancer to send them an offer!"
//               actionLabel="Find Freelancers"
//               actionLink="/categories"
//             />
//           ) : sortedAndFilteredOffers.length === 0 ? (
//             <EmptyState
//               icon="search"
//               title="No offers match your filters"
//               message="Try changing your filter settings to see more offers."
//             />
//           ) : (
//             <div className="offers-list">
//               {sortedAndFilteredOffers.map((offer) => (
//                 <div key={offer.id} className="offer-item">
//                   <div className="offer-header">
//                     <div className="recipient-info">
//                       <span className="recipient-label">To:</span>
//                       <strong className="recipient-name">
//                         {offer.thread_info?.other_party_name ||
//                           offer.thread_info?.recipient_username ||
//                           "Unknown Freelancer"}
//                       </strong>
//                       {offer.created_at && (
//                         <span className="offer-date">
//                           {new Date(offer.created_at).toLocaleDateString("en-US", {
//                             month: "short",
//                             day: "numeric",
//                             year: "numeric",
//                             hour: "2-digit",
//                             minute: "2-digit",
//                           })}
//                         </span>
//                       )}
//                     </div>

//                     {offer.thread_info?.id && (
//                       <Link
//                         href={`/messages/${offer.thread_info.id}`}
//                         className="view-thread-btn"
//                       >
//                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
//                           <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
//                         </svg>
//                         View Conversation
//                       </Link>
//                     )}
//                   </div>

//                   <OfferCard
//                     offer={{
//                       id: offer.id,
//                       title: offer.offer_title,
//                       price: offer.offer_price,
//                       timeline: offer.offer_timeline,
//                       description: offer.offer_description,
//                       status: offer.offer_status,
//                       attachments: offer.attachments || offer.offer?.attachments || [],
//                       created_job: offer.created_job || offer.offer?.created_job,
//                     }}
//                     canRespond={false}
//                     isPending={offer.offer_status === "pending"}
//                     isCreator={true}
//                   />

//                   {offer.offer_status === "pending" && (
//                     <div className="offer-status-info pending-info">
//                       <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         width="18" height="18"
//                         fill="none"
//                         viewBox="0 0 24 24"
//                         stroke="currentColor"
//                         strokeWidth={2}
//                       >
//                         <path
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                           d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
//                         />
//                       </svg>
//                       <span>Awaiting freelancer's response.</span>
//                     </div>
//                   )}

//                   {offer.offer_status === "accepted" && (
//                     <div className="offer-status-info accepted-info">
//                       <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         width="18" height="18"
//                         fill="none"
//                         viewBox="0 0 24 24"
//                         stroke="currentColor"
//                         strokeWidth={2}
//                       >
//                         <path
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                           d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
//                         />
//                       </svg>
//                       <span>Accepted! Please complete payment to start the job.</span>
//                     </div>
//                   )}

//                   {offer.offer_status === "rejected" && (
//                     <div className="offer-status-info rejected-info">
//                       <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         width="18" height="18"
//                         fill="none"
//                         viewBox="0 0 24 24"
//                         stroke="currentColor"
//                         strokeWidth={2}
//                       >
//                         <path
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                           d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
//                         />
//                       </svg>
//                       <span>The freelancer rejected this offer.</span>
//                     </div>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}
//         </section>
//       </div>
//     </ErrorBoundary>
//   )
// }

// export default SentOffers

const SentOffers = () => {
  return (
    <div style={{ minHeight: "60vh", padding: "2rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Sent Offers</h1>
      <p style={{ color: "#64748b", marginBottom: "1rem" }}>
        Sent offers view is being refreshed. Use messages to track and manage offer status.
      </p>
      <Link
        href="/messages"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.6rem 1rem",
          borderRadius: "0.5rem",
          background: "#0f172a",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Open Messages
      </Link>
    </div>
  )
}

export default SentOffers
