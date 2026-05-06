"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const AdminRoute = ({ children }) => {
  const router = useRouter()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null")

    // If user is not admin/employer (usertype !== 1), redirect to login
    if (!user || user.usertype !== 1) {
      router.push("/login")
    }
  }, [router])

  // Check if user is admin before rendering
  const user = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "null") : null

  if (user && user.usertype === 1) {
    return children
  }

  // Return null while redirecting
  return null
}

export default AdminRoute
