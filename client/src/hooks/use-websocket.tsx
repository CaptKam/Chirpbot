import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  alert?: any;
  timestamp?: string;
}

export function useWebSocket() {
  // Disabled WebSocket - using HTTP polling instead
  const [isConnected, setIsConnected] = useState(true); // Always show as connected for HTTP polling
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

    // Add connection delay to prevent rapid reconnection issues
    const connectDelay = reconnectAttempts.current > 0 ? 1000 : 0;
    
    setTimeout(() => {
      try {
        // Get the protocol and host from the current window location
        const isSecure = window.location.protocol === 'https:';
        const protocol = isSecure ? 'wss:' : 'ws:';

        // For Replit environment, always use the current host
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/realtime-alerts`;

        console.log('WebSocket debug info:', { 'window.location.host': host, wsUrl });

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

        // Handle different close codes
        const shouldReconnect = event.code !== 1000 && // Not normal closure
                               event.code !== 1001 && // Not going away
                               reconnectAttempts.current < maxReconnectAttempts;

        if (shouldReconnect) {
          const baseDelay = 1000;
          const delay = Math.min(baseDelay * Math.pow(1.5, reconnectAttempts.current), 10000);
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

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout - closing');
          wsRef.current.close();
        }
      }, 10000); // 10 second timeout

      // Clear timeout when connection opens
      wsRef.current.addEventListener('open', () => {
        clearTimeout(connectionTimeout);
      }, { once: true });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
    }
    }, connectDelay);
  }, [queryClient, getCachedUserSettings]);

  useEffect(() => {
    // WebSocket disabled - using HTTP polling instead
    console.log('Using HTTP polling for real-time updates');
    setIsConnected(true);
    setConnectionError(null);

    return () => {
      // Cleanup any remaining refs
      userSettingsCache.current = null;
      settingsCacheTimestamp.current = 0;
    };
  }, []);

  return {
    isConnected,
    connectionError,
    reconnect: connect
  };
}