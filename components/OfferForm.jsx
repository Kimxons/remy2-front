"use client"

import { useState } from "react"
import "./OfferForm.scss"

/**
 * Updated Formatter: Uses US locale and USD currency
 */
const formatUSD = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)

const OfferForm = ({ onSend, onCancel, isSending }) => {
  const [offer, setOffer] = useState({
    title: "",
    price: "",
    timeline: "",
    description: "",
  })

  const [errors, setErrors] = useState({})
  const isSubmitDisabled =
    isSending || Object.keys(errors).some(key => errors[key] && key !== 'attachments')

  const priceValue = parseFloat(offer.price)
  const timelineValue = parseInt(offer.timeline)

  const validate = () => {
    const newErrors = {}

    if (!offer.title.trim()) {
      newErrors.title = "Project title is required."
    }

    const price = parseFloat(offer.price)
    if (!offer.price || isNaN(price) || price <= 0) {
      newErrors.price = "Price must be a valid amount greater than $0."
    }

    const timeline = parseInt(offer.timeline)
    if (!offer.timeline || isNaN(timeline) || timeline < 1) {
      newErrors.timeline = "Delivery timeline must be at least 1 day."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validate()) return

    onSend({
      title: offer.title.trim(),
      price: parseFloat(offer.price),
      timeline: parseInt(offer.timeline),
      description: offer.description.trim(),
    })
  }

  const handleChange = (field, value) => {
    setOffer({ ...offer, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: null })
    }
  }

  return (
    <div className="offer-form-container">
      <div className="offer-form-header">
        <div className="header-title">
          <div className="title-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <div>
            <h3>Send Project Offer</h3>
            <p className="header-subtitle">Share a clear proposal the client can accept instantly.</p>
          </div>
        </div>
        <button onClick={onCancel} className="btn-close" type="button" disabled={isSending}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="offer-form">
        <div className="offer-preview-bar">
          <div className="preview-item">
            <span className="preview-label">Offer value</span>
            <strong className="preview-value">
              {Number.isFinite(priceValue) && priceValue > 0
                ? formatUSD(priceValue)
                : "Set price"}
            </strong>
          </div>

          <div className="preview-divider" />

          <div className="preview-item">
            <span className="preview-label">Delivery</span>
            <strong className="preview-value">
              {Number.isFinite(timelineValue) && timelineValue > 0
                ? `${timelineValue} day${timelineValue > 1 ? "s" : ""}`
                : "Set timeline"}
            </strong>
          </div>
        </div>

        <div className="form-group">
          <label>
            Project Title <span className="required">*</span>
          </label>
          <input
            type="text"
            value={offer.title}
            onChange={(e) => handleChange("title", e.target.value)}
            className={`form-input ${errors.title ? "error" : ""}`}
            disabled={isSending}
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Price (USD) <span className="required">*</span>
            </label>
            <input
              type="number"
              value={offer.price}
              onChange={(e) => handleChange("price", e.target.value)}
              className={`form-input ${errors.price ? "error" : ""}`}
              disabled={isSending}
            />
            {errors.price && <span className="error-message">{errors.price}</span>}
          </div>

          <div className="form-group">
            <label>
              Delivery Time <span className="required">*</span>
            </label>
            <input
              type="number"
              value={offer.timeline}
              onChange={(e) => handleChange("timeline", e.target.value)}
              className={`form-input ${errors.timeline ? "error" : ""}`}
              disabled={isSending}
            />
            {errors.timeline && <span className="error-message">{errors.timeline}</span>}
          </div>
        </div>

        <div className="form-group">
          <label>
            Project Description <span className="optional">(Optional)</span>
          </label>
          <textarea
            value={offer.description}
            onChange={(e) => handleChange("description", e.target.value)}
            className="form-textarea"
            rows={4}
            disabled={isSending}
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={isSubmitDisabled} className="btn-submit">
            {isSending ? "Sending Offer..." : "Send Offer to Client"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="btn-cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default OfferForm