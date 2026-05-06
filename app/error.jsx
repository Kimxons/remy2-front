"use client"

import { useEffect } from "react"

/**
 * Custom error page for handling runtime errors
 * @param {Object} props
 * @param {Error} props.error - The error object
 * @param {Function} props.reset - Function to reset the error boundary
 * @returns {JSX.Element}
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught:', error)
    }
  }, [error])

  return (
    <div className="error-page" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--error)' }}>
        Oops! Something went wrong
      </h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)', maxWidth: '600px' }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'var(--transition)'
        }}
      >
        Try Again
      </button>
    </div>
  )
}
