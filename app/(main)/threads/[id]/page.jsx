"use client"

import Thread from "@/components/message/Thread"
import { useParams } from "next/navigation"


/**
 * Thread detail page (dynamic route)
 * @returns {JSX.Element}
 */
export default function ThreadDetailPage() {
  const params = useParams()

  return <Thread id={params.id} />
}
