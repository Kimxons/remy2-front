import React from "react"
import "./LoadingState.scss"

/**
 * Loading state component with spinner and optional message
 * Uses brand red color theme
 * @param {Object} props
 * @param {string} props.message - Loading message to display
 * @param {boolean} props.fullScreen - Whether to show as fullscreen overlay
 * @param {'sm'|'md'|'lg'} props.size - Size of the spinner
 * @returns {JSX.Element} Loading spinner component
 */
const LoadingState = ({ message = "Loading...", fullScreen = false, size = "md" }) => {
  const sizeClasses = {
    sm: "loading-spinner--sm",
    md: "loading-spinner--md",
    lg: "loading-spinner--lg"
  }

  const containerClasses = fullScreen
    ? "loading-container loading-container--fullscreen"
    : "loading-container"

  return (
    <div className={containerClasses}>
      <div className="loading-content">
        <div className={`loading-spinner ${sizeClasses[size]}`}>
          <div className="loading-spinner__track"></div>
          <div className="loading-spinner__fill"></div>
        </div>
        {message && (
          <p className="loading-message">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton loader for content placeholders
 * Uses shimmer animation effect
 * @param {Object} props
 * @param {number} props.count - Number of skeleton items
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} Skeleton loader component
 */
export const SkeletonLoader = ({ count = 1, className = "" }) => {
  return (
    <div className={`skeleton-container ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="skeleton-item"
        />
      ))}
    </div>
  )
}

/**
 * Inline loader for buttons and small spaces
 * @param {Object} props
 * @param {'xs'|'sm'|'md'} props.size - Size of the inline loader
 * @returns {JSX.Element} Inline loader component
 */
export const InlineLoader = ({ size = "sm" }) => {
  const sizeClasses = {
    xs: "inline-loader--xs",
    sm: "inline-loader--sm",
    md: "inline-loader--md"
  }

  return (
    <div className={`inline-loader ${sizeClasses[size]}`}>
      <div className="inline-loader__track"></div>
      <div className="inline-loader__fill"></div>
    </div>
  )
}

export default LoadingState
