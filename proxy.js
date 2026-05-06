import { NextResponse } from 'next/server'

/**
 * Protected routes that require authentication
 * Note: /threads is NOT protected to allow guest users with session keys
 */
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/settings',
  '/orders',
  '/earnings',
  '/messages',
  '/post-job',
]

/**
 * Admin-only routes
 */
const adminRoutes = [
  '/admin',
]

/**
 * Authentication routes (should redirect if already logged in)
 */
const authRoutes = [
  '/login',
  '/register',
]

/**
 * Next.js 16 proxy for authentication and route protection
 * @param {Request} request
 * @returns {NextResponse}
 */
export default function proxy(request) {
  const { pathname } = request.nextUrl

  // Get authentication status from cookies or headers
  // Note: In a real app, you'd validate a JWT token here
  const isAuthenticated =
    request.cookies.get('authSession')?.value ||
    request.cookies.get('currentUser')?.value ||
    request.headers.get('authorization')

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  )

  // Check if route is admin-only
  const isAdminRoute = adminRoutes.some(route =>
    pathname.startsWith(route)
  )

  // Check if route is an auth page
  const isAuthRoute = authRoutes.some(route =>
    pathname.startsWith(route)
  )

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Admin route protection
  if (isAdminRoute) {
    // Additional admin check would go here
    // For now, just check authentication
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

/**
 * Proxy configuration
 * Specify which routes should trigger the proxy
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
