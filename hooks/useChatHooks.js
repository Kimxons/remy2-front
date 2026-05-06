import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import chatApi from "../api/chatApi";
import { useAuth } from "../contexts/AppContexts";
import guestSessionService from "../services/guestSessionService";

export const formatUSD = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2, 
  }).format(num);
};

export const useGuestSession = () => {
  const { isAuthenticated } = useAuth();
  const [sessionKey, setSessionKey] = useState(() => {
    // Only access localStorage on the client side
    if (typeof window !== "undefined") {
      return localStorage.getItem("guestSessionKey");
    }
    return null;
  });

  const saveSessionKey = useCallback((key) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("guestSessionKey", key);
      setSessionKey(key);
    }
  }, []);

  const clearSessionKey = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("guestSessionKey");
      setSessionKey(null);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setSessionKey(null);
    }
  }, [isAuthenticated]);

  return { sessionKey, saveSessionKey, clearSessionKey };
};

export const useWebSocket = (url, options = {}) => {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (!url || !enabled || isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        shouldReconnectRef.current = true;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (error) {
        }
      };

      ws.onerror = (error) => {
        setConnectionError("Connection error");
        isConnectingRef.current = false;
        onError?.(error);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        isConnectingRef.current = false;
        wsRef.current = null;

        onClose?.(event);

        if (event.code === 4005) {
          shouldReconnectRef.current = false;
          setConnectionError("Access denied");
          return;
        }

        if (shouldReconnectRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError("Connection failed");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      setConnectionError("Failed to connect");
      isConnectingRef.current = false;
    }
  }, [url, enabled, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    isConnectingRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    shouldReconnectRef.current = true;
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  useEffect(() => {
    if (enabled && url) {
      connect();
    }

    return () => {
      shouldReconnectRef.current = false;
      isConnectingRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [url, enabled]);

  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    reconnect,
    disconnect,
  };
};

export const useUnreadCount = (refreshInterval = 30000) => {
  const { isAuthenticated } = useAuth();

  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: async () => {
      const response = await chatApi.getUnreadCount();
      return response.unread_count || 0;
    },
    enabled: isAuthenticated,
    refetchInterval: refreshInterval,
    staleTime: refreshInterval,
  });

  return { unreadCount, refetch };
};

export const useThreadUnreads = () => {
  const { isAuthenticated } = useAuth();

  const { data: threadUnreads = {}, refetch } = useQuery({
    queryKey: ["threadUnreads"],
    queryFn: async () => {
      const response = await chatApi.getThreadUnreads();
      return response.thread_unreads || {};
    },
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  return { threadUnreads, refetch };
};

export const useChatThreads = () => {
  const { isAuthenticated } = useAuth();
  const { sessionKey } = useGuestSession();

  const { data: threads = [], isLoading, error, refetch } = useQuery({
    queryKey: ["chatThreads", isAuthenticated, sessionKey],
    queryFn: async () => {
      if (isAuthenticated) {
        const response = await chatApi.getThreads();
        return response.results || response;
      }
      if (sessionKey) {
        const response = await chatApi.getGuestThreads(sessionKey);
        return response.results || response;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return { threads, isLoading, error, refetch };
};

export const useCreateThread = () => {
  const queryClient = useQueryClient();
  const { saveSessionKey } = useGuestSession();

  const mutation = useMutation({
    mutationFn: async ({ freelancerUsername, sessionKey }) => {
      const response = await chatApi.createThread(freelancerUsername, sessionKey);
      if (response.guest_session_key) {
        saveSessionKey(response.guest_session_key);
        guestSessionService.setSessionKey(response.guest_session_key);
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatThreads"] });
    },
  });

  return mutation;
};

export const useMessages = (threadId, sessionKey = null) => {
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const response = await chatApi.getMessages(threadId, sessionKey);
      return response.messages || response;
    },
    enabled: !!threadId,
    staleTime: 1000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      return await chatApi.sendMessage(threadId, message.message, sessionKey, message.attachment_ids);
    },
    onSuccess: () => {
      setOptimisticMessages((prev) => prev.filter((m) => !m.isOptimistic));
      queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["chatThreads"] });
    },
    onError: () => {
      setOptimisticMessages((prev) => prev.filter((m) => !m.isOptimistic));
    },
  });

  const sendMessage = useCallback(
    (message) => {
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        message: message.message,
        timestamp: new Date().toISOString(),
        isOptimistic: true,
        is_mine: true,
        sender_name: "You",
      };

      setOptimisticMessages((prev) => [...prev, optimisticMessage]);
      sendMessageMutation.mutate(message);
    },
    [sendMessageMutation]
  );

  const handleWebSocketMessage = useCallback(
    (data) => {
      if (data.type === "chat_message" && data.message && data.message.thread === threadId) {
        queryClient.setQueryData(["messages", threadId], (old = []) => {
          const incomingMessage = data.message;
          const exists = old.some((m) => m.id === incomingMessage.id);
          
          if (exists) return old;
          
          return [...old, incomingMessage];
        });
        
        queryClient.invalidateQueries({ queryKey: ["chatThreads"] });
      }
    },
    [queryClient, threadId]
  );

  const allMessages = [...messages, ...optimisticMessages].sort(
    (a, b) =>
      new Date(a.timestamp || a.created_at).getTime() -
      new Date(b.timestamp || b.created_at).getTime()
  );

  return {
    messages: allMessages,
    isLoading,
    error,
    sendMessage,
    isSending: sendMessageMutation.isPending,
    handleWebSocketMessage,
  };
};

export const useFileUpload = () => {
  const mutation = useMutation({
    mutationFn: async ({ file, messageId, threadId }) => {
      return await chatApi.uploadFile(file, messageId, threadId);
    },
  });

  return {
    uploadFile: mutation.mutate,
    uploadFileAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
    uploadError: mutation.error,
  };
};

export const useLinkGuestThreads = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (guestSessionKey) => {
      return await chatApi.linkGuestThreads(guestSessionKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatThreads"] });
      if (typeof window !== "undefined") {
        localStorage.removeItem("guestSessionKey");
      }
    },
  });

  return mutation;
};

export const useDashboardSummary = () => {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: chatApi.getDashboardSummary,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return { data, isLoading, error };
};

export const usePendingOffersReceived = () => {
  const { isAuthenticated } = useAuth();
  
  const { data: pendingOffers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["pendingOffersReceived"],
    queryFn: async () => {
      const response = await chatApi.getPendingOffersReceived();
      return response.pending_offers || [];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return { pendingOffers, isLoading, error, refetch };
};

export const usePendingOffersSent = () => {
  const { isAuthenticated } = useAuth();
  
  const { data: sentOffers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["pendingOffersSent"],
    queryFn: async () => { 
      const response = await chatApi.getPendingOffersSent();
      return response.sent_pending_offers || [];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return { sentOffers, isLoading, error, refetch };
};
