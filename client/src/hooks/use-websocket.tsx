import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketMessage, Alert } from '@/types';
import { queryClient } from '@/lib/queryClient';

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => void;
  reconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    isConnectingRef.current = true;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === 'new_alert') {
            const alertData = (message as any).alert || (message as any).data;
            if (alertData && typeof alertData === 'object') {
              const transformedAlert: any = {
                id: alertData.id || alertData.alertKey,
                type: alertData.alertType || alertData.type,
                sport: alertData.sport,
                gameId: alertData.gameId,
                message: alertData.payload?.message || 'New alert',
                title: alertData.payload?.message || 'New alert',
                description: alertData.payload?.message || 'New alert',
                homeTeam: alertData.payload?.context?.homeTeam,
                awayTeam: alertData.payload?.context?.awayTeam,
                homeScore: alertData.payload?.context?.homeScore,
                awayScore: alertData.payload?.context?.awayScore,
                priority: alertData.score || 50,
                confidence: alertData.score || 50,
                createdAt: alertData.createdAt,
                timestamp: alertData.createdAt,
                seen: false,
                sentToTelegram: false,
                context: alertData.payload?.context || {}
              };

              queryClient.setQueryData<any[]>(["/api/alerts"], (oldAlerts) => {
                if (!oldAlerts) return [transformedAlert];
                const exists = oldAlerts.some(alert => alert.id === transformedAlert.id);
                if (exists) return oldAlerts;
                return [transformedAlert, ...oldAlerts];
              });

              queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
              queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] });
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        isConnectingRef.current = false;
        wsRef.current = null;

        // Only reconnect on abnormal closures
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        isConnectingRef.current = false;
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, [reconnectAttempts]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  }, []);

  const reconnect = useCallback(() => {
    console.log('Manual WebSocket reconnection...');
    setReconnectAttempts(0);
    isConnectingRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect,
  };
}