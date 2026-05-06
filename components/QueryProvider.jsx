'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Global QueryClient instance configured with optimized defaults
 * Created once at module level to ensure singleton pattern
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      cacheTime: 10 * 60 * 1000, // 10 minutes - cache persists
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: false, // Don't refetch on window focus to reduce API calls
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: 1, // Retry mutations once
      retryDelay: 1000, // Wait 1 second before retry
    },
  },
})

/**
 * QueryProvider wrapper component that provides TanStack Query context to the app
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} The query client provider
 */
export default function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}