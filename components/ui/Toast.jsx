"use client"

import React, { useState, useEffect, createContext, useContext } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import './Toast.scss';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = ({ type = 'info', message, title, duration = 5000 }) => {
    const id = Date.now() + Math.random();
    const toast = { id, type, message, title, duration };
    setToasts((prev) => [...prev, toast]);
    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const toast = {
    success: (message, title = 'Success', duration) =>
      addToast({ type: 'success', message, title, duration }),
    error: (message, title = 'Error', duration) =>
      addToast({ type: 'error', message, title, duration }),
    warning: (message, title = 'Warning', duration) =>
      addToast({ type: 'warning', message, title, duration }),
    info: (message, title = 'Info', duration) =>
      addToast({ type: 'info', message, title, duration }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="toast__icon" />;
      case 'error':
        return <XCircle className="toast__icon" />;
      case 'warning':
        return <AlertCircle className="toast__icon" />;
      case 'info':
      default:
        return <Info className="toast__icon" />;
    }
  };

  return (
    <div
      className={`toast toast--${toast.type} ${isExiting ? 'toast--exit' : ''}`}
      role="alert"
    >
      <div className="toast__icon-wrapper">{getIcon()}</div>
      <div className="toast__content">
        {toast.title && <div className="toast__title">{toast.title}</div>}
        <div className="toast__message">{toast.message}</div>
      </div>
      <button
        className="toast__close"
        onClick={handleRemove}
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
      {toast.duration && (
        <div
          className="toast__progress"
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      )}
    </div>
  );
};

export default ToastProvider;
