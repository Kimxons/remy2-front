"use client"

import React, { useState, useEffect, useMemo } from "react"
import httpClient from "../../api/httpClient"
import moment from "moment"
import "./Earnings.scss"

const formatKES = (amount, { withDecimals = true } = {}) => {
  const value = Number(amount) || 0
  return `KES ${value.toLocaleString("en-KE", {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  })}`
}

const MIN_WITHDRAWAL_KES = 300

const Earnings = () => {
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem("currentUser")
      return raw ? JSON.parse(raw) : null
    } catch (error) {
      console.error("Failed to parse currentUser from localStorage", error)
      return null
    }
  }, [])
  const [earnings, setEarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterPeriod, setFilterPeriod] = useState('all') // all, week, month, year
  const [withdrawalMethod, setWithdrawalMethod] = useState('mpesa')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawError, setWithdrawError] = useState("")
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false)
  const [recipientName, setRecipientName] = useState("")
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountName, setBankAccountName] = useState("")
  const [bankAccountNumber, setBankAccountNumber] = useState("")
  const [paypalEmail, setPaypalEmail] = useState("")

  useEffect(() => {
    fetchEarnings()
  }, [])

  useEffect(() => {
    if (!showWithdrawModal) return

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        handleCloseWithdrawModal()
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [showWithdrawModal])

  const fetchEarnings = async () => {
    try {
      setLoading(true)
      // This would be the actual earnings endpoint
      const res = await httpClient.get('/orders/jobs/')
      const jobs = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      // Filter for completed jobs where user is freelancer
      const completedJobs = jobs.filter(
        job => job.status === 'CLIENT_COMPLETED' && job.freelancer_id === currentUser?.id
      )
      setEarnings(completedJobs)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const now = moment()
    const weekStart = moment().startOf('week')
    const monthStart = moment().startOf('month')
    const yearStart = moment().startOf('year')

    const totalEarnings = earnings.reduce((sum, job) => sum + Number(job.total_amount), 0)
    const weekEarnings = earnings
      .filter(job => moment(job.client_marked_complete_at).isAfter(weekStart))
      .reduce((sum, job) => sum + Number(job.total_amount), 0)
    const monthEarnings = earnings
      .filter(job => moment(job.client_marked_complete_at).isAfter(monthStart))
      .reduce((sum, job) => sum + Number(job.total_amount), 0)
    const yearEarnings = earnings
      .filter(job => moment(job.client_marked_complete_at).isAfter(yearStart))
      .reduce((sum, job) => sum + Number(job.total_amount), 0)

    // Mock available balance (would come from backend)
    const availableBalance = totalEarnings * 0.85 // 85% after platform fees
    const pendingBalance = totalEarnings * 0.15

    return {
      totalEarnings,
      weekEarnings,
      monthEarnings,
      yearEarnings,
      availableBalance,
      pendingBalance,
      totalJobs: earnings.length,
      averagePerJob: earnings.length > 0 ? totalEarnings / earnings.length : 0
    }
  }, [earnings])

  const filteredEarnings = useMemo(() => {
    if (filterPeriod === 'all') return earnings

    const now = moment()
    let startDate

    if (filterPeriod === 'week') startDate = moment().startOf('week')
    if (filterPeriod === 'month') startDate = moment().startOf('month')
    if (filterPeriod === 'year') startDate = moment().startOf('year')

    return earnings.filter(job =>
      moment(job.client_marked_complete_at).isAfter(startDate)
    )
  }, [earnings, filterPeriod])

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setWithdrawError("")

    const amountNumber = Number(withdrawAmount)
    const normalizedAmount = Number.isFinite(amountNumber) ? amountNumber : 0

    if (!normalizedAmount || normalizedAmount <= 0) {
      setWithdrawError("Enter a valid amount.")
      return
    }

    if (normalizedAmount > stats.availableBalance) {
      setWithdrawError("Insufficient balance for this withdrawal amount.")
      return
    }

    if (normalizedAmount < MIN_WITHDRAWAL_KES) {
      setWithdrawError(`Minimum withdrawal amount is KES ${MIN_WITHDRAWAL_KES}.`)
      return
    }

    if (!recipientName.trim()) {
      setWithdrawError("Recipient full name is required.")
      return
    }

    if (withdrawalMethod === "mpesa") {
      const digitsOnly = mpesaPhone.replace(/\D/g, "")
      if (digitsOnly.length < 10 || digitsOnly.length > 12) {
        setWithdrawError("Enter a valid M-Pesa phone number (10-12 digits).")
        return
      }
    }

    if (withdrawalMethod === "bank") {
      if (!bankName.trim()) {
        setWithdrawError("Bank name is required.")
        return
      }
      if (!bankAccountName.trim()) {
        setWithdrawError("Bank account name is required.")
        return
      }
      const accountDigits = bankAccountNumber.replace(/\D/g, "")
      if (accountDigits.length < 6) {
        setWithdrawError("Enter a valid bank account number.")
        return
      }
    }

    if (withdrawalMethod === "paypal") {
      const email = paypalEmail.trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setWithdrawError("Enter a valid PayPal email address.")
        return
      }
    }

    try {
      setIsSubmittingWithdrawal(true)
      // This would call the withdrawal endpoint
      alert(`Withdrawal request of ${formatKES(normalizedAmount)} via ${withdrawalMethod} submitted successfully!`)
      handleCloseWithdrawModal()
    } catch (err) {
      setWithdrawError(err.response?.data?.detail || "Failed to process withdrawal.")
    } finally {
      setIsSubmittingWithdrawal(false)
    }
  }

  const handleOpenWithdrawModal = () => {
    setWithdrawError("")
    setWithdrawAmount("")
    setWithdrawalMethod("mpesa")
    setRecipientName("")
    setMpesaPhone("")
    setBankName("")
    setBankAccountName("")
    setBankAccountNumber("")
    setPaypalEmail("")
    setShowWithdrawModal(true)
  }

  const handleCloseWithdrawModal = () => {
    setShowWithdrawModal(false)
    setWithdrawError("")
    setWithdrawAmount("")
    setIsSubmittingWithdrawal(false)
    setRecipientName("")
    setMpesaPhone("")
    setBankName("")
    setBankAccountName("")
    setBankAccountNumber("")
    setPaypalEmail("")
  }

  if (loading) {
    return (
      <div className="earnings-page">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading your earnings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="earnings-page">
        <div className="error-container">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Failed to Load Earnings</h3>
          <p className="error-message">{error}</p>
          <button onClick={fetchEarnings} className="btn-retry">Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="earnings-page">
      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={handleCloseWithdrawModal}>
          <div
            className="modal-content withdraw-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="withdraw-modal-title">Cash Out Earnings</h2>
              <button type="button" onClick={handleCloseWithdrawModal} className="btn-close" aria-label="Close cash out modal">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="withdraw-form">
              <p className="modal-note">
                Withdraw your available balance instantly. Minimum cash-out is KES {MIN_WITHDRAWAL_KES}.
              </p>
              {withdrawError && <p className="modal-error">{withdrawError}</p>}
              <div className="balance-info">
                <span className="balance-label">Available Balance</span>
                <span className="balance-value">{formatKES(stats.availableBalance)}</span>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Amount to Withdraw</label>
                <div className="input-with-prefix">
                  <span className="prefix">KES</span>
                  <input
                    type="number"
                    id="amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    min={MIN_WITHDRAWAL_KES}
                    max={stats.availableBalance}
                    required
                  />
                </div>
                <span className="input-hint">Minimum withdrawal: KES {MIN_WITHDRAWAL_KES}</span>
              </div>

              <div className="form-group">
                <label htmlFor="recipientName">Recipient Full Name</label>
                <input
                  type="text"
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="As registered on payout account"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="method">Withdrawal Method</label>
                <select
                  id="method"
                  value={withdrawalMethod}
                  onChange={(e) => setWithdrawalMethod(e.target.value)}
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>

              {withdrawalMethod === "mpesa" && (
                <div className="form-group">
                  <label htmlFor="mpesaPhone">M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    id="mpesaPhone"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder="e.g. 254712345678"
                    required
                  />
                  <span className="input-hint">Use phone linked to your M-Pesa wallet.</span>
                </div>
              )}

              {withdrawalMethod === "bank" && (
                <div className="withdraw-method-grid">
                  <div className="form-group">
                    <label htmlFor="bankName">Bank Name</label>
                    <input
                      type="text"
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. KCB"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bankAccountName">Account Name</label>
                    <input
                      type="text"
                      id="bankAccountName"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Name on bank account"
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="bankAccountNumber">Account Number</label>
                    <input
                      type="text"
                      id="bankAccountNumber"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      placeholder="Bank account number"
                      required
                    />
                  </div>
                </div>
              )}

              {withdrawalMethod === "paypal" && (
                <div className="form-group">
                  <label htmlFor="paypalEmail">PayPal Email</label>
                  <input
                    type="email"
                    id="paypalEmail"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              )}

              <div className="form-actions">
                <button type="button" onClick={handleCloseWithdrawModal} className="btn-cancel">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={isSubmittingWithdrawal || Number(stats.availableBalance) < MIN_WITHDRAWAL_KES}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  {isSubmittingWithdrawal ? "Processing..." : "Withdraw"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="earnings-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            My Earnings
          </h1>
          <p className="hero-subtitle">Track payouts, optimize delivery speed, and cash out with confidence.</p>
          <p className="hero-proof">
            {formatKES(stats.availableBalance)} ready to withdraw
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="balance-cards">
        <div className="balance-card primary-balance">
          <div className="balance-card-header">
            <div className="balance-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
            <span className="balance-label">Available Balance</span>
          </div>
          <div className="balance-amount">
            {formatKES(stats.availableBalance)}
          </div>
          <p className="balance-helper">Available now for withdrawal.</p>
          <button
            type="button"
            onClick={handleOpenWithdrawModal}
            className="btn-withdraw"
            disabled={Number(stats.availableBalance) < MIN_WITHDRAWAL_KES}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {Number(stats.availableBalance) < MIN_WITHDRAWAL_KES ? `Min KES ${MIN_WITHDRAWAL_KES} Required` : "Withdraw Funds"}
          </button>
        </div>

        <div className="balance-card">
          <div className="balance-card-header">
            <div className="balance-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <span className="balance-label">Pending</span>
          </div>
          <div className="balance-amount">
            {formatKES(stats.pendingBalance)}
          </div>
        </div>

        <div className="balance-card">
          <div className="balance-card-header">
            <div className="balance-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <span className="balance-label">Total Earned</span>
          </div>
          <div className="balance-amount">
            {formatKES(stats.totalEarnings)}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">This Week</span>
            <span className="stat-value">{formatKES(stats.weekEarnings, { withDecimals: false })}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">This Month</span>
            <span className="stat-value">{formatKES(stats.monthEarnings, { withDecimals: false })}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Completed Jobs</span>
            <span className="stat-value">{stats.totalJobs}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-label">Average/Job</span>
            <span className="stat-value">{formatKES(stats.averagePerJob, { withDecimals: false })}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="earnings-controls">
        <div className="controls-copy">
          <h2>Earnings History</h2>
          <p>Use quick filters to review recent income and decide your next payout.</p>
        </div>
        <div className="period-filters">
          <button
            className={`period-btn ${filterPeriod === 'all' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('all')}
          >
            All
          </button>
          <button
            className={`period-btn ${filterPeriod === 'week' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('week')}
          >
            7 Days
          </button>
          <button
            className={`period-btn ${filterPeriod === 'month' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('month')}
          >
            30 Days
          </button>
          <button
            className={`period-btn ${filterPeriod === 'year' ? 'active' : ''}`}
            onClick={() => setFilterPeriod('year')}
          >
            12 Months
          </button>
        </div>
      </div>

      {/* Earnings List */}
      {filteredEarnings.length === 0 ? (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <h3>No Earnings Yet</h3>
          <p>Complete jobs to start earning!</p>
        </div>
      ) : (
        <div className="earnings-list">
          {filteredEarnings.map((job) => (
            <div key={job.id} className="earning-item">
              <div className="earning-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <div className="earning-details">
                <h3 className="earning-title">{job.title}</h3>
                <div className="earning-meta">
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    {job.client_username}
                  </span>
                  <span className="meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {moment(job.client_marked_complete_at || job.created_at).format('MMM DD, YYYY')}
                  </span>
                </div>
              </div>

              <div className="earning-amount">
                <span className="amount-value">+{formatKES(job.total_amount, { withDecimals: false })}</span>
                <span className="amount-status">Ready for payout</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Earnings
