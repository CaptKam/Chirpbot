import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  alert?: any;
  timestamp?: string;
  seq?: number;
}

// Singleton WebSocket connection
let socket: WebSocket | null = null;
let attempts = 0;
let explicitlyClosed = false;
let isConnecting = false;

export function useWebSocketSingleton() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const callbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  const handleMessage = useCallback((data: string) => {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Call all registered callbacks
      callbacksRef.current.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in WebSocket message callback:', error);
        }
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, []);

  const connect = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      return socket;
    }
    if (isConnecting) return socket;

    isConnecting = true;
    explicitlyClosed = false;

    // Use correct protocol and path
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${location.host}/realtime-alerts`;

    console.log('WebSocket debug info:', { 
      'window.location.host': location.host, 
      wsUrl: url 
    });

    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      attempts = 0;
      isConnecting = false;
    });

    socket.addEventListener("message", (ev) => {
      handleMessage(ev.data);
    });

    socket.addEventListener("close", (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      isConnecting = false;
      
      if (explicitlyClosed) return;
      
      // Exponential backoff with jitter
      const delay = Math.min(10_000, 500 * 2 ** attempts) + Math.random() * 500;
      attempts++;
      
      if (attempts <= 5) {
        console.log(`Attempting to reconnect in ${Math.round(delay)}ms (attempt ${attempts}/5)`);
        setTimeout(() => connect(), delay);
      } else {
        setConnectionError('Failed to reconnect after multiple attempts');
      }
    });

    socket.addEventListener("error", (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('WebSocket connection error');
      socket?.close();
    });

    return socket;
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    explicitlyClosed = true;
    if (socket) {
      socket.close(1000, 'User disconnect');
      socket = null;
    }
    setIsConnected(false);
    isConnecting = false;
  }, []);

  // Register message callback for this hook instance
  useEffect(() => {
    const messageCallback = async (message: WebSocketMessage) => {
      if (message.type === 'new_alert' && message.alert) {
        const alertData = message.alert;
        console.log('📋 WebSocket received alert:', alertData.id || alertData.alertKey, alertData.type || alertData.alertType);

        // Check current query state
        const currentData = queryClient.getQueryData(['/api/alerts']);
        const queryState = queryClient.getQueryState(['/api/alerts']);

        console.log('🔍 Query state check:', {
          hasData: !!currentData,
          dataLength: Array.isArray(currentData) ? currentData.length : 0
        });

        // Only update if query is settled (not fetching)
        if (!queryState?.isLoading && currentData) {
          console.log('✅ Updating alerts cache with new WebSocket alert');

          queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
            if (!Array.isArray(oldData)) return oldData;

            // Check if alert already exists
            const alertId = alertData.id || alertData.alertKey;
            const existingAlert = oldData.find((alert: any) => 
              alert.id === alertId || alert.alertKey === alertId
            );

            if (existingAlert) {
              console.log('📋 Alert already exists in cache, skipping');
              return oldData;
            }

            // Transform WebSocket alert to match frontend format
            const transformedAlert = {
              id: alertData.id || alertData.alertKey,
              alertKey: alertData.alertKey || alertData.id,
              type: alertData.type || alertData.alertType,
              sport: alertData.sport,
              gameId: alertData.gameId,
              message: alertData.payload?.message || 'New alert',
              title: alertData.payload?.message || 'New alert',
              description: alertData.payload?.message || 'New alert',
              homeTeam: alertData.payload?.context?.homeTeam || 'Home Team',
              awayTeam: alertData.payload?.context?.awayTeam || 'Away Team',
              homeScore: alertData.payload?.context?.homeScore || 0,
              awayScore: alertData.payload?.context?.awayScore || 0,
              priority: alertData.score || 50,
              confidence: alertData.score || 50,
              createdAt: alertData.createdAt || new Date().toISOString(),
              timestamp: alertData.createdAt || new Date().toISOString(),
              seen: false,
              sentToTelegram: false,
              context: alertData.payload?.context || {},
              inning: alertData.payload?.context?.inning,
              isTopInning: alertData.payload?.context?.isTopInning,
              outs: alertData.payload?.context?.outs,
              balls: alertData.payload?.context?.balls,
              strikes: alertData.payload?.context?.strikes,
              hasFirst: alertData.payload?.context?.hasFirst,
              hasSecond: alertData.payload?.context?.hasSecond,
              hasThird: alertData.payload?.context?.hasThird,
              payload: alertData.payload
            };

            const newData = [transformedAlert, ...oldData];

            // Sort by timestamp (newest first) and limit to 100 alerts
            const sortedData = newData
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 100);

            console.log('📋 Updated alerts cache, total alerts:', sortedData.length);
            return sortedData;
          });
        } else {
          console.log('⏳ Query is loading or no data, WebSocket update queued for next refetch');
        }
      }
    };

    callbacksRef.current.add(messageCallback);

    return () => {
      callbacksRef.current.delete(messageCallback);
    };
  }, [queryClient]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket) {
        connect();
      }
    };

    // Handle online/offline events
    const handleOnline = () => connect();
    const handleOffline = () => disconnect();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionError,
    reconnect: connect,
    disconnect
  };
}