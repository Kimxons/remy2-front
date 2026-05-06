"use client"

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useMessages, useWebSocket, useGuestSession, useFileUpload } from "../../hooks/useChatHooks"
import { useAuth } from "../../contexts/AppContexts"
import { buildThreadWebSocketUrl } from "../../utils/websocket"
import "./MessageDetail.scss"
import { Send, Plus, ChevronLeft, Wifi, User, Loader2, Paperclip } from 'lucide-react'
import { motion } from 'framer-motion'

const MessageItem = ({ message, currentUser }) => {
  const mine = message.sender_name === currentUser.username || message.is_mine;

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25, duration: 0.5 } }
  };

  return (
    <motion.div
      className={`msg-item ${mine ? "mine" : "theirs"}`}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      layout
    >
      {!mine && <div className="msg-sender">{message.sender_name}</div>}

      {message.attachments?.length > 0 && (
        <div className="msg-files">
          {message.attachments.map((a, i) => (
            <a key={i} href={a.url || a.file_url} target="_blank" rel="noreferrer">
              <Paperclip size={14} style={{ marginRight: 4 }} />Attachment ({a.name})
            </a>
          ))}
        </div>
      )}
      <div className="msg-bubble">{message.message}</div>
      <div className="msg-status">
        {message.isOptimistic ? "Sending..." : new Date(message.timestamp || message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </motion.div>
  );
};


// --- Main MessageDetail Component ---
export default function MessageDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { isAuthenticated, isFreelancer } = useAuth()
  const { sessionKey } = useGuestSession()
  const effectiveSessionKey = isAuthenticated ? null : sessionKey

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), [])

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const [text, setText] = useState("")
  const [files, setFiles] = useState([])

  const { messages, isLoading, error, sendMessage, handleWebSocketMessage, isSending } =
    useMessages(id, effectiveSessionKey)

  const { uploadFileAsync, isUploading } = useFileUpload()

  const wsUrl = buildThreadWebSocketUrl({ threadId: id, sessionKey: effectiveSessionKey })
  const { isConnected } = useWebSocket(wsUrl, { onMessage: handleWebSocketMessage })

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = '0px'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    autoResizeTextarea()
  }, [messages, text, autoResizeTextarea])

  const handleTextChange = (e) => {
    setText(e.target.value)
  }

  const handleFileChange = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)])
    e.target.value = null
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, x) => x !== index))
  }

  const send = useCallback(async () => {
    const hasContent = text.trim() || files.length > 0
    if (!hasContent || isSending || isUploading) return

    const uploadedFiles = await Promise.all(
      files.map(async f => {
        try {
          const r = await uploadFileAsync({ file: f, threadId: id })
          return r.id
        }
        catch (e) {
          return null
        }
      })
    )

    const attachmentIds = uploadedFiles.filter(Boolean)

    sendMessage({ message: text.trim(), attachment_ids: attachmentIds })

    setText("")
    setFiles([])
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px'
    }
  }, [text, files, uploadFileAsync, sendMessage, id, isSending, isUploading])

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      send()
    }
  }

  if (isLoading) return <div className="chat-shell chat-center">
    <Loader2 className="animate-spin text-gray-500" size={32} />
  </div>

  if (error) return (
    <div className="chat-shell chat-center">
      <div className="chat-error">
        Error: Unable to load chat history. Please refresh.
      </div>
    </div>
  )

  const recipientName = messages.find(m => m.sender_name !== currentUser.username)?.sender_name || "Conversation"
  const isInputDisabled = isSending || isUploading
  const isSendButtonDisabled = isInputDisabled || (!text.trim() && files.length === 0)

  return (
    <div className="chat-shell">
      <div className="chat-container">

        <header className="chat-header">
          <button className="nav-btn" onClick={() => router.back()} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>

          <div className="chat-meta">
            <User size={18} />
            <span>{recipientName}</span>
            {!isAuthenticated && effectiveSessionKey && <span className="guest">GUEST</span>}
            {isAuthenticated && isFreelancer && <span className="guest">FREELANCER</span>}
          </div>

          <div className={`conn ${isConnected ? "on" : "off"}`}>
            <Wifi size={14} style={{ marginRight: 4 }} />
            {isConnected ? "LIVE" : "OFFLINE"}
          </div>
        </header>

        <section className="chat-stream">
          {messages.map((m, index) => (
            <MessageItem key={m.id || index} message={m} currentUser={currentUser} />
          ))}
          <div ref={bottomRef} />
        </section>

        <footer className="chat-compose">

          {files.length > 0 && (
            <motion.div
              className="compose-files"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {files.map((f, i) => (
                <span key={i}>
                  {f.name}
                  <button onClick={() => removeFile(i)} aria-label="Remove file">×</button>
                </span>
              ))}
              {isUploading && <span>Uploading...</span>}
            </motion.div>
          )}

          <div className="compose-input-bar">

            <div className="input-controls">
              <motion.label
                className="icon-btn attachment-btn"
                title="Attach file"
                aria-disabled={isInputDisabled}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={isInputDisabled}
                  style={{ display: 'none' }}
                />
                <Plus size={22} />
              </motion.label>
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              placeholder="Type a message (Ctrl/Cmd + Enter)..."
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              disabled={isInputDisabled}
            />

            <div className="input-controls">
              <motion.button
                className="icon-btn send-btn"
                disabled={isSendButtonDisabled}
                onClick={send}
                title={isSendButtonDisabled ? 'Cannot send empty message' : 'Send message (Ctrl/Cmd + Enter)'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </motion.button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
