"use client"

import Job from "@/components/job/Job"
import { useParams } from "next/navigation"


/**
 * Job detail page (dynamic route)
 * @returns {JSX.Element}
 */
export default function JobDetailPage() {
  const params = useParams()

  return <Job id={params.id} />
}
