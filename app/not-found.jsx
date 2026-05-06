"use client"

import Link from "next/link"

/**
 * Custom 404 Not Found page
 * @returns {JSX.Element}
 */
export default function NotFound() {
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
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--primary)' }}>404</h1>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--primary)',
          color: 'white',
          borderRadius: 'var(--radius-md)',
          textDecoration: 'none',
          transition: 'var(--transition)'
        }}
      >
        Go Home
      </Link>
    </div>
  )
}
