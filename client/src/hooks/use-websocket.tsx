import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  alert?: any;
  timestamp?: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      // Get the protocol and host from the current window location
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';

      // For Replit development environment, use the current host
      // This works for both development and production
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/realtime-alerts`;

      console.log('WebSocket debug info:', {
        'window.location.host': window.location.host,
        wsUrl
      });

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'new_alert' && message.alert) {
            console.log('📋 WebSocket received alert:', message.alert.id, message.alert.type);

            // Check current query state
            const currentData = queryClient.getQueryData(['/api/alerts']);
            console.log('🔍 Query state check:', {
              hasData: !!currentData,
              isLoading: queryClient.getQueryState(['/api/alerts'])?.isFetching,
              dataLength: Array.isArray(currentData) ? currentData.length : 0
            });

            // Only update if query is settled (not loading)
            const queryState = queryClient.getQueryState(['/api/alerts']);
            if (!queryState?.isFetching && currentData) {
              console.log('✅ Query settled, applying immediate WebSocket update');

              queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
                if (!Array.isArray(oldData)) return oldData;

                console.log('📋 Cache update - Old alerts:', oldData.length);

                // Check if alert already exists
                const existingAlert = oldData.find((alert: any) => 
                  alert.id === message.alert.id || alert.alertKey === message.alert.id
                );

                if (existingAlert) {
                  console.log('📋 Cache update - Alert already exists, skipping');
                  return oldData;
                }

                // Transform WebSocket alert to match frontend format
                const transformedAlert = {
                  id: message.alert.id || message.alert.alertKey,
                  alertKey: message.alert.alertKey || message.alert.id,
                  type: message.alert.type || message.alert.alertType,
                  sport: message.alert.sport,
                  gameId: message.alert.gameId,
                  message: message.alert.payload?.message || 'New alert',
                  title: message.alert.payload?.message || 'New alert',
                  description: message.alert.payload?.message || 'New alert',
                  homeTeam: message.alert.payload?.context?.homeTeam || 'Home Team',
                  awayTeam: message.alert.payload?.context?.awayTeam || 'Away Team',
                  homeScore: message.alert.payload?.context?.homeScore || 0,
                  awayScore: message.alert.payload?.context?.awayScore || 0,
                  priority: message.alert.score || 50,
                  confidence: message.alert.score || 50,
                  createdAt: message.alert.createdAt || new Date().toISOString(),
                  timestamp: message.alert.createdAt || new Date().toISOString(),
                  seen: false,
                  sentToTelegram: false,
                  // Include context for alert footer
                  context: message.alert.payload?.context || {},
                  inning: message.alert.payload?.context?.inning,
                  isTopInning: message.alert.payload?.context?.isTopInning,
                  outs: message.alert.payload?.context?.outs,
                  balls: message.alert.payload?.context?.balls,
                  strikes: message.alert.payload?.context?.strikes,
                  hasFirst: message.alert.payload?.context?.hasFirst,
                  hasSecond: message.alert.payload?.context?.hasSecond,
                  hasThird: message.alert.payload?.context?.hasThird,
                  // Include full payload for compatibility
                  payload: message.alert.payload
                };

                const newData = [transformedAlert, ...oldData];

                // Sort by timestamp (newest first) and limit to 100 alerts
                const sortedData = newData
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 100);

                console.log('🔄 Sorted alerts:', sortedData.length);
                return sortedData;
              });
            } else {
              console.log('⏳ Query is loading or no data, WebSocket update queued for next refetch');
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Only attempt reconnection if it wasn't a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setConnectionError('Failed to reconnect to WebSocket after multiple attempts');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connect]);

  return {
    isConnected,
    connectionError,
    reconnect: connect
  };
}