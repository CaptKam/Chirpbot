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
  const userSettingsCache = useRef<any>(null);
  const settingsCacheTimestamp = useRef<number>(0);
  const CACHE_TTL = 60000; // 1 minute cache for user settings

  // Cache user settings to avoid fetching on every message
  const getCachedUserSettings = useCallback(async () => {
    const now = Date.now();

    // Return cached settings if still valid
    if (userSettingsCache.current && (now - settingsCacheTimestamp.current) < CACHE_TTL) {
      return userSettingsCache.current;
    }

    // Fetch fresh settings
    try {
      const userResponse = await fetch('/api/auth/user', { credentials: 'include' });
      if (userResponse.ok) {
        const user = await userResponse.json();
        if (user?.id) {
          const prefsResponse = await fetch(`/api/user-settings/${user.id}`, { credentials: 'include' });
          if (prefsResponse.ok) {
            const settings = await prefsResponse.json();
            userSettingsCache.current = settings;
            settingsCacheTimestamp.current = now;
            return settings;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    }

    return null;
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection before creating new one
    if (wsRef.current) {
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    try {
      // Get the protocol and host from the current window location
      const isSecure = window.location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';

      // For Replit development environment, use the current host
      // This works for both development and production
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/realtime-alerts`;

      console.log('WebSocket connecting to:', wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      // FIXED: Single stable onmessage handler without reassignment
      wsRef.current.onmessage = async (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'new_alert' && message.alert) {
            const alertData = message.alert;
            console.log('📋 WebSocket received alert:', alertData.id || alertData.alertKey, alertData.type || alertData.alertType);

            // Check if user has this alert type enabled (using cached settings)
            const userSettings = await getCachedUserSettings();

            if (userSettings) {
              const alertType = alertData.type || alertData.alertType;
              const alertTypeEnabled = userSettings.some((setting: any) => 
                setting.alertType === alertType && setting.enabled
              );

              if (!alertTypeEnabled) {
                console.log(`🚫 Alert type ${alertType} disabled for user - skipping`);
                return;
              }
            }

            // Check current query state
            const currentData = queryClient.getQueryData(['/api/alerts']);
            const queryState = queryClient.getQueryState(['/api/alerts']);

            // Only update if query is settled (not fetching)
            if (!queryState?.isFetching && currentData) {
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
                  // Include context for alert footer
                  context: alertData.payload?.context || {},
                  inning: alertData.payload?.context?.inning,
                  isTopInning: alertData.payload?.context?.isTopInning,
                  outs: alertData.payload?.context?.outs,
                  balls: alertData.payload?.context?.balls,
                  strikes: alertData.payload?.context?.strikes,
                  hasFirst: alertData.payload?.context?.hasFirst,
                  hasSecond: alertData.payload?.context?.hasSecond,
                  hasThird: alertData.payload?.context?.hasThird,
                  // Include full payload for compatibility
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
              // REMOVED: No longer block WebSocket updates based on query state
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
  }, [queryClient, getCachedUserSettings]);

  useEffect(() => {
    connect();

    // Proper cleanup on unmount
    return () => {
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket connection properly
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }

      // Clear settings cache
      userSettingsCache.current = null;
      settingsCacheTimestamp.current = 0;
    };
  }, [connect]);

  return {
    isConnected,
    connectionError,
    reconnect: connect
  };
}