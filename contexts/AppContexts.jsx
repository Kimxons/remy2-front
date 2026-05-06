"use client"

/**
 * Application-level context providers for authentication, chat, and notifications
 * @module AppContexts
 */

import {createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import httpClient from "../api/httpClient";
import guestSessionService from "../services/guestSessionService";
import { setAuthSessionCookie, clearAuthSessionCookie } from "../utils/cookies";

const USER_TYPE = {
  CLIENT: 0,
  FREELANCER: 1,
  ADMIN: 2,
};


const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const isAuthenticated = !!currentUser;

  useEffect(() => {
    try {
      const userString = localStorage.getItem("currentUser");
      if (userString) {
        const user = JSON.parse(userString);
        setCurrentUser(user);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for storage changes (including when token refresh fails)
  useEffect(() => {
    const handleStorageChange = () => {
      const userString = localStorage.getItem("currentUser");
      if (!userString && currentUser) {
        // User was logged out (e.g., token refresh failed)
        setCurrentUser(null);
      } else if (userString) {
        try {
          const user = JSON.parse(userString);
          setCurrentUser(user);
        } catch (err) {
          console.error("Failed to parse user from storage:", err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined" || isAuthenticated) return;

    const existingKey = guestSessionService.getSessionKey();
    const sessionExpired = guestSessionService.isSessionExpired();
    const csrfToken = guestSessionService.getCsrfToken();
    if (existingKey && !sessionExpired && csrfToken) {
      return;
    }

    let isActive = true;

    const bootstrapGuestSession = async () => {
      try {
        await guestSessionService.initializeSession();
      } catch (error) {
        if (isActive) {
          console.error("Failed to bootstrap guest session:", error);
        }
      }
    };

    bootstrapGuestSession();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  const login = useCallback(async (credentials) => {
    try {
      const endpoint =
        credentials.usertype === USER_TYPE.FREELANCER || credentials.usertype === USER_TYPE.ADMIN
          ? "/users/token/freelancer/"
          : "/users/token/client/";

      const response = await httpClient.post(endpoint, credentials);
      const userData = response.data;

      // Extract tokens from response if they exist
      // Backend might return: { access, refresh, user: {...} } or { token, refreshToken, ...user }
      let token = userData.access || userData.token;
      let refreshToken = userData.refresh || userData.refreshToken;

      // Ensure tokens are stored in the user object
      const userToStore = {
        ...userData,
        token: token,
        refreshToken: refreshToken,
      };

      // Also store tokens separately for easier access
      if (token) {
        localStorage.setItem("accessToken", token);
      }
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }
      setAuthSessionCookie(7);

      localStorage.setItem("currentUser", JSON.stringify(userToStore));
      window.dispatchEvent(new Event("auth:changed"));
      setCurrentUser(userToStore);

      const guestSessionKey = localStorage.getItem("guestSessionKey");
      if (guestSessionKey) {
        try {
          await httpClient.post("/users/chat/threads/link-guest-threads/", {
            guest_session_key: guestSessionKey,
          });
          localStorage.removeItem("guestSessionKey");
        } catch (err) {
          console.error("Failed to link guest threads:", err);
        }
      }

      return userToStore;
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    clearAuthSessionCookie();
    window.dispatchEvent(new Event("auth:changed"));
    setCurrentUser(null);
    queryClient.clear();
    window.location.href = "/";
  }, [queryClient]);

  const updateUser = useCallback((updates) => {
    setCurrentUser((prev) => {
      const updated = { ...(prev || {}), ...updates };
      localStorage.setItem("currentUser", JSON.stringify(updated));
      window.dispatchEvent(new Event("auth:changed"));
      return updated;
    });
  }, []);

  const isFreelancer =
    currentUser?.usertype === USER_TYPE.FREELANCER || currentUser?.usertype === USER_TYPE.ADMIN;
  const isClient = currentUser?.usertype === USER_TYPE.CLIENT;
  const isAdmin = currentUser?.usertype === USER_TYPE.ADMIN;
  const isGuest = !isAuthenticated;

  const value = useMemo(() => ({
    currentUser,
    isLoading,
    isAuthenticated,
    isFreelancer,
    isClient,
    isAdmin,
    isGuest,
    login,
    logout,
    updateUser,
  }), [
    currentUser,
    isLoading,
    isAuthenticated,
    isFreelancer,
    isClient,
    isAdmin,
    isGuest,
    login,
    logout,
    updateUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [threadUnreads, setThreadUnreads] = useState({});

  const openChatModal = useCallback((freelancer = null) => {
    setSelectedFreelancer(freelancer);
    setIsChatModalOpen(true);
  }, []);

  const closeChatModal = useCallback(() => {
    setIsChatModalOpen(false);
    setSelectedFreelancer(null);
  }, []);

  const selectThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
  }, []);

  const updateUnreadCount = useCallback((count) => {
    setUnreadCount(count);
  }, []);

  const updateThreadUnreads = useCallback((unreads) => {
    setThreadUnreads(unreads);
  }, []);

  const value = useMemo(() => ({
    activeThreadId,
    isChatModalOpen,
    selectedFreelancer,
    unreadCount,
    threadUnreads,
    openChatModal,
    closeChatModal,
    selectThread,
    updateUnreadCount,
    updateThreadUnreads,
  }), [
    activeThreadId,
    isChatModalOpen,
    selectedFreelancer,
    unreadCount,
    threadUnreads,
    openChatModal,
    closeChatModal,
    selectThread,
    updateUnreadCount,
    updateThreadUnreads,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
};

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now().toString();
    const newNotification = {
      id,
      type: "info",
      message: "",
      duration: 5000,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback(
    (message, duration) => addNotification({ type: "success", message, duration }),
    [addNotification]
  );

  const showError = useCallback(
    (message, duration) => addNotification({ type: "error", message, duration }),
    [addNotification]
  );

  const showInfo = useCallback(
    (message, duration) => addNotification({ type: "info", message, duration }),
    [addNotification]
  );

  const showWarning = useCallback(
    (message, duration) => addNotification({ type: "warning", message, duration }),
    [addNotification]
  );

  const value = useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  }), [
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within NotificationProvider");
  return context;
};

export const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>{children}</ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default {
  AuthProvider,
  useAuth,
  ChatProvider,
  useChat,
  NotificationProvider,
  useNotification,
  AppProviders,
};
