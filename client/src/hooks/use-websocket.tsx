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

              // Handle new alerts with user preference filtering
              wsRef.current.onmessage = async (event) => {
                try {
                  const data = JSON.parse(event.data);
                  console.log('📋 WebSocket received alert:', data.id, data.type);

                  if (data.type && data.id) {
                    // Check if user has this alert type enabled
                    const userResponse = await fetch('/api/auth/user', { credentials: 'include' });
                    if (userResponse.ok) {
                      const user = await userResponse.json();
                      if (user?.id) {
                        // Get user preferences
                        const prefsResponse = await fetch(`/api/user-settings/${user.id}`, { credentials: 'include' });
                        if (prefsResponse.ok) {
                          const userSettings = await prefsResponse.json();
                          const alertTypeEnabled = userSettings.some((setting: any) => 
                            setting.alertType === data.type && setting.enabled
                          );

                          if (!alertTypeEnabled) {
                            console.log(`🚫 Alert type ${data.type} disabled for user - skipping`);
                            return;
                          }
                        }
                      }
                    }

                    queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
                      if (!Array.isArray(oldData)) return oldData;

                      console.log('📋 Cache update - Old alerts:', oldData.length);

                      // Check if alert already exists
                      const existingAlert = oldData.find((alert: any) => 
                        alert.id === data.id || alert.alertKey === data.id
                      );

                      if (existingAlert) {
                        console.log('📋 Cache update - Alert already exists, skipping');
                        return oldData;
                      }

                      // Transform WebSocket alert to match frontend format
                      const transformedAlert = {
                        id: data.id || data.alertKey,
                        alertKey: data.alertKey || data.id,
                        type: data.type || data.alertType,
                        sport: data.sport,
                        gameId: data.gameId,
                        message: data.payload?.message || 'New alert',
                        title: data.payload?.message || 'New alert',
                        description: data.payload?.message || 'New alert',
                        homeTeam: data.payload?.context?.homeTeam || 'Home Team',
                        awayTeam: data.payload?.context?.awayTeam || 'Away Team',
                        homeScore: data.payload?.context?.homeScore || 0,
                        awayScore: data.payload?.context?.awayScore || 0,
                        priority: data.score || 50,
                        confidence: data.score || 50,
                        createdAt: data.createdAt || new Date().toISOString(),
                        timestamp: data.createdAt || new Date().toISOString(),
                        seen: false,
                        sentToTelegram: false,
                        // Include context for alert footer
                        context: data.payload?.context || {},
                        inning: data.payload?.context?.inning,
                        isTopInning: data.payload?.context?.isTopInning,
                        outs: data.payload?.context?.outs,
                        balls: data.payload?.context?.balls,
                        strikes: data.payload?.context?.strikes,
                        hasFirst: data.payload?.context?.hasFirst,
                        hasSecond: data.payload?.context?.hasSecond,
                        hasThird: data.payload?.context?.hasThird,
                        // Include full payload for compatibility
                        payload: data.payload
                      };

                      const newData = [transformedAlert, ...oldData];

                      // Sort by timestamp (newest first) and limit to 100 alerts
                      const sortedData = newData
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 100);

                      console.log('🔄 Sorted alerts:', sortedData.length);
                      return sortedData;
                    });
                  }
                } catch (error) {
                  console.error('Error parsing WebSocket message:', error);
                }
              };
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