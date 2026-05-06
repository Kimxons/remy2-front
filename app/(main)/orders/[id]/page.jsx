"use client"

import Job from "@/components/job/Job"

/**
 * Order detail page compatibility route.
 * Supports links targeting /orders/:id from dashboard and order lists.
 * @returns {JSX.Element}
 */
export default function OrderDetailPage() {
  return <Job />
}
