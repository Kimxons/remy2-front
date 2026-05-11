import React from "react"
import PropTypes from "prop-types"

const DashboardStats = ({ stats, userRole }) => {
  const isClient = userRole === "CLIENT"
  const isFreelancer = userRole === "FREELANCER" || userRole === "ADMIN"
  const formatUSD = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0))

  const statCards = [
    {
      key: "activeOrders",
      label: "Active Orders",
      value: stats.activeOrders || 0,
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      ),
      show: true
    },
    {
      key: "completed",
      label: "Completed",
      value: stats.completed || 0,
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      show: true
    },
    {
      key: "earnings",
      label: isClient ? "Total Spent" : "Total Earnings",
      value: formatUSD(stats.earnings),
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      show: true
    },
    {
      key: "rating",
      label: "Rating",
      value: `${(stats.rating || 0).toFixed(1)} ⭐`,
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      ),
      show: true
    },
    {
      key: "avgResponseTime",
      label: "Avg. Response",
      value: stats.avgResponseTime || "N/A",
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      ),
      show: isFreelancer
    },
    {
      key: "unreadMessages",
      label: "Unread Messages",
      value: stats.unreadMessages || 0,
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      ),
      show: isFreelancer || isClient
    }
  ]

  return (
    <div className="stats-grid">
      {statCards.filter(stat => stat.show).map((stat) => (
        <div key={stat.key} className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {stat.icon}
              </svg>
            </div>
          </div>
          <div className="stat-content">
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

DashboardStats.propTypes = {
  stats: PropTypes.shape({
    activeOrders: PropTypes.number,
    completed: PropTypes.number,
    earnings: PropTypes.number,
    rating: PropTypes.number,
    avgResponseTime: PropTypes.string,
    unreadMessages: PropTypes.number
  }).isRequired,
  userRole: PropTypes.oneOf(["CLIENT", "FREELANCER", "ADMIN", "GUEST"]).isRequired
}

export default DashboardStats
