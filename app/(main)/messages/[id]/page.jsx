"use client"

import Thread from "@/components/message/Thread"
import { useParams } from "next/navigation"


/**
 * Message thread detail page (dynamic route)
 * Reuses the canonical Thread UI.
 * @returns {JSX.Element}
 */
export default function MessageDetailPage() {
  const params = useParams()

  return <Thread id={params.id} />
}
