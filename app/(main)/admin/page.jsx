"use client"

import AdminDashboard from "@/components/admin/AdminDashboard"
import AdminRoute from "@/components/routes/AdminRoute"


/**
 * Admin dashboard page (protected route)
 * @returns {JSX.Element}
 */
export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminDashboard />
    </AdminRoute>
  )
}
