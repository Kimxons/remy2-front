import { useEffect, useRef, useState, useCallback } from 'react';
import { buildThreadWebSocketUrl } from '../utils/websocket';

const getStoredAccessToken = () => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    return (
      currentUser?.token ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('token') ||
      ''
    );
  } catch {
    return localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
  }
};

export function useChatWebSocket({
  threadId,
  sessionKey = null,
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
  allowGuestSessionFallback = true,
}) {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const shouldReconnect = useRef(true);
  const hasConnectedOnce = useRef(false);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!threadId || !enabled) return;
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    clearReconnectTimeout();

    try {
      const token = getStoredAccessToken();
      const guestSessionKey = sessionKey || (allowGuestSessionFallback ? localStorage.getItem('guestSessionKey') || '' : '');
      const isGuestConnection = !token && !!guestSessionKey;

      if (!token && !guestSessionKey) {
        shouldReconnect.current = false;
        setError('Missing chat credentials');
        return;
      }

      const wsUrl = buildThreadWebSocketUrl({
        threadId,
        sessionKey: guestSessionKey,
        token,
      });

      shouldReconnect.current = true;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        hasConnectedOnce.current = true;
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        onConnectRef.current?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.current.onerror = (event) => {
        if (hasConnectedOnce.current) {
          console.warn('WebSocket connection error', event?.type || 'error');
        }
        setError('Connection error');
      };

      ws.current.onclose = (event) => {
        ws.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        if (event.code === 4005) {
          shouldReconnect.current = false;
          setError('Access denied. Please refresh the page.');
        } else if (!hasConnectedOnce.current) {
          shouldReconnect.current = false;
          setError(
            isGuestConnection
              ? 'Guest chat session is no longer active. Please reopen the conversation.'
              : 'Live chat is unavailable for this conversation.'
          );
        } else if (typeof document !== 'undefined' && document.hidden) {
          shouldReconnect.current = false;
        } else if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current++;

          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setError('Unable to connect. Please refresh the page.');
        }
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to establish connection');
    }
  }, [allowGuestSessionFallback, clearReconnectTimeout, enabled, threadId, sessionKey]);

  const disconnect = useCallback(() => {
    shouldReconnect.current = false;
    clearReconnectTimeout();
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
      ws.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimeout]);

  const sendMessage = useCallback((message) => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify({
        type: 'chat_message',
        message: message,
      }));
      return true;
    }
    return false;
  }, [isConnected]);

  const sendOffer = useCallback((offer) => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify({
        type: 'offer',
        offer: {
          title: offer.title,
          price: offer.price,
          timeline: offer.timeline,
          description: offer.description,
        },
      }));
      return true;
    }
    return false;
  }, [isConnected]);

  const sendTyping = useCallback(() => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, [isConnected]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }
    connect();
    return () => disconnect();
  }, [connect, disconnect, enabled]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        disconnect();
        return;
      }

      shouldReconnect.current = true;
      reconnectAttempts.current = 0;
      connect();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    error,
    sendMessage,
    sendOffer,
    sendTyping,
    reconnect: connect,
    disconnect,
  };
}