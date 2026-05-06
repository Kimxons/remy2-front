"use client"

import { useState } from "react"
import "./JobSubmissionForm.scss"

const JobSubmissionForm = ({ jobId, onSubmit, onCancel, isSubmitting }) => {
  const [submissionText, setSubmissionText] = useState("")
  const [attachments, setAttachments] = useState([])
  const [files, setFiles] = useState({
    assignment: null,
    plag_report: null,
    ai_report: null,
  })

  const [errors, setErrors] = useState({})
  const [dragActive, setDragActive] = useState({})

  const validate = () => {
    const newErrors = {}
    const hasSubmissionText = submissionText.trim().length > 0
    const hasAttachments = attachments.length > 0
    const hasLegacyFiles = !!(files.assignment || files.plag_report || files.ai_report)

    if (!hasSubmissionText && !hasAttachments && !hasLegacyFiles) {
      newErrors.form = "Add submission text, attachment(s), or at least one legacy file."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const formData = new FormData()
    if (submissionText.trim()) {
      formData.append("submission_text", submissionText.trim())
    }
    attachments.forEach((file) => {
      formData.append("attachments", file)
    })
    if (files.assignment) formData.append("assignment", files.assignment)
    if (files.plag_report) formData.append("plag_report", files.plag_report)
    if (files.ai_report) formData.append("ai_report", files.ai_report)

    onSubmit(formData)
  }

  const handleFileChange = (field, file) => {
    setFiles({ ...files, [field]: file })
    if (errors[field] || errors.form) {
      setErrors((prev) => ({ ...prev, [field]: null, form: null }))
    }
  }

  const handleAttachmentsChange = (incomingFiles) => {
    const next = Array.from(incomingFiles || [])
    setAttachments((prev) => [...prev, ...next])
    if (errors.form) {
      setErrors((prev) => ({ ...prev, form: null }))
    }
  }

  const removeAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  const handleDrag = (field, e) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive({ ...dragActive, [field]: true })
    } else if (e.type === "dragleave") {
      setDragActive({ ...dragActive, [field]: false })
    }
  }

  const handleDrop = (field, e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive({ ...dragActive, [field]: false })

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(field, e.dataTransfer.files[0])
    }
  }

  const getFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const renderFileInput = (field, label, accept = "*/*") => (
    <div className="form-group">
      <label htmlFor={`submission-${field}`}>{label}</label>
      <div
        className={`file-upload-area ${dragActive[field] ? "drag-active" : ""} ${
          errors[field] ? "error" : ""
        } ${files[field] ? "has-file" : ""}`}
        onDragEnter={(e) => handleDrag(field, e)}
        onDragLeave={(e) => handleDrag(field, e)}
        onDragOver={(e) => handleDrag(field, e)}
        onDrop={(e) => handleDrop(field, e)}
      >
        <input
          id={`submission-${field}`}
          type="file"
          accept={accept}
          onChange={(e) => handleFileChange(field, e.target.files[0])}
          className="file-input"
          disabled={isSubmitting}
        />
        <label htmlFor={`submission-${field}`} className="file-upload-label">
          {files[field] ? (
            <div className="file-selected">
              <div className="file-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div className="file-info">
                <span className="file-name">{files[field].name}</span>
                <span className="file-size">{getFileSize(files[field].size)}</span>
              </div>
              <button
                type="button"
                className="btn-remove"
                onClick={(e) => {
                  e.preventDefault()
                  handleFileChange(field, null)
                }}
                disabled={isSubmitting}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ) : (
            <div className="file-upload-prompt">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span className="upload-text">
                <strong>Click to upload</strong> or drag and drop
              </span>
              <span className="upload-hint">PDF, DOC, DOCX (max. 50MB)</span>
            </div>
          )}
        </label>
      </div>
      {errors[field] && <span className="error-message">{errors[field]}</span>}
    </div>
  )

  return (
    <div className="submission-form-container">
      <div className="submission-form-header">
        <div className="header-title">
          <div className="title-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3>Submit Completed Work</h3>
        </div>
        <button onClick={onCancel} className="btn-close" type="button" disabled={isSubmitting}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="submission-form">
        <div className="form-intro">
          <p>
            Submit delivery in 4 steps: add a note, attach delivery files, optionally include legacy reports,
            then click <strong>Submit Work</strong>. At least one item is required.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="submission-text">Submission Note</label>
          <textarea
            id="submission-text"
            rows={4}
            value={submissionText}
            onChange={(e) => {
              setSubmissionText(e.target.value)
              if (errors.form) setErrors((prev) => ({ ...prev, form: null }))
            }}
            placeholder="Project delivered. Please review."
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="submission-attachments">Delivery Attachments</label>
          <input
            id="submission-attachments"
            type="file"
            multiple
            onChange={(e) => handleAttachmentsChange(e.target.files)}
            className="file-input"
            disabled={isSubmitting}
          />
          {attachments.length > 0 && (
            <div className="file-upload-area has-file">
              {attachments.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-selected">
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{getFileSize(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={() => removeAttachment(index)}
                    disabled={isSubmitting}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderFileInput("assignment", "Assignment File (Legacy, optional)", ".pdf,.doc,.docx")}
        {renderFileInput("plag_report", "Plagiarism Report (Legacy, optional)", ".pdf,.doc,.docx")}
        {renderFileInput("ai_report", "AI Detection Report (Legacy, optional)", ".pdf,.doc,.docx")}
        {errors.form ? <span className="error-message">{errors.form}</span> : null}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-submit"
          >
            {isSubmitting ? (
              <>
                <div className="spinner"></div>
                Submitting Work...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Submit Work
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-cancel"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default JobSubmissionForm
