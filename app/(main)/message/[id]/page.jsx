"use client"

import Thread from "@/components/message/Thread"
import { useParams } from "next/navigation"


/**
 * Message detail page (legacy route for compatibility)
 * Reuses the canonical Thread UI.
 * @returns {JSX.Element}
 */
export default function MessagePage() {
  const params = useParams()

  return <Thread id={params.id} />
}
