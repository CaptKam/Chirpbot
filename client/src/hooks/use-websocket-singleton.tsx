import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  alert?: any;
  timestamp?: string;
  sequenceNumber?: number;
  seq?: number;
  connectionType?: string;
}

// Singleton WebSocket connection
let socket: WebSocket | null = null;
let attempts = 0;
let explicitlyClosed = false;
let isConnecting = false;

// SSE fallback connection
let eventSource: EventSource | null = null;
let sseAttempts = 0;
let isSSEConnecting = false;
let currentConnectionType: 'websocket' | 'sse' | 'none' = 'none';

// Sequence tracking for delta synchronization
let lastReceivedSequenceNumber: number | null = null;
let lastConnectionTime: string | null = null;

const MAX_WS_RETRIES = 5;
const MAX_SSE_RETRIES = 3;

export function useWebSocketSingleton() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<'websocket' | 'sse' | 'none'>('none');
  const queryClient = useQueryClient();
  const callbacksRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  // Fetch missed alerts on reconnection
  const fetchMissedAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      
      if (lastReceivedSequenceNumber !== null) {
        params.set('seq', lastReceivedSequenceNumber.toString());
        console.log(`🔄 Fetching alerts since sequence number: ${lastReceivedSequenceNumber}`);
      } else if (lastConnectionTime) {
        params.set('since', lastConnectionTime);
        console.log(`🔄 Fetching alerts since timestamp: ${lastConnectionTime}`);
      } else {
        console.log('🔄 No previous state - skipping delta sync');
        return;
      }

      const response = await fetch(`/api/alerts/snapshot?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Snapshot fetch failed: ${response.status}`);
      }

      const missedAlerts = await response.json();
      console.log(`🔄 Retrieved ${missedAlerts.length} missed alerts`);

      if (missedAlerts.length > 0) {
        // Update cache with missed alerts
        queryClient.setQueryData(['/api/alerts'], (oldData: any) => {
          if (!Array.isArray(oldData)) return missedAlerts;

          // Merge missed alerts with existing data, avoiding duplicates
          const existingIds = new Set(oldData.map((alert: any) => alert.id || alert.alertKey));
          const newAlerts = missedAlerts.filter((alert: any) => 
            !existingIds.has(alert.id || alert.alertKey)
          );

          if (newAlerts.length === 0) {
            console.log('🔄 No new missed alerts to add');
            return oldData;
          }

          const merged = [...newAlerts, ...oldData];
          
          // Sort by sequence number first, then timestamp
          const sorted = merged.sort((a: any, b: any) => {
            if (a.sequenceNumber && b.sequenceNumber) {
              return b.sequenceNumber - a.sequenceNumber;
            }
            return new Date(b.createdAt || b.timestamp).getTime() - 
                   new Date(a.createdAt || a.timestamp).getTime();
          }).slice(0, 100);

          console.log(`🔄 Merged ${newAlerts.length} missed alerts, total: ${sorted.length}`);
          return sorted;
        });

        // Update sequence tracking from latest alert
        const latestAlert = missedAlerts.reduce((latest: any, alert: any) => {
          if (alert.sequenceNumber && (!latest || alert.sequenceNumber > latest.sequenceNumber)) {
            return alert;
          }
          return latest;
        }, null);

        if (latestAlert?.sequenceNumber) {
          lastReceivedSequenceNumber = latestAlert.sequenceNumber;
          console.log(`🔄 Updated last sequence number to: ${lastReceivedSequenceNumber}`);
        }
      }
    } catch (error) {
      console.error('🔄 Failed to fetch missed alerts:', error);
      // Don't throw - reconnection should still succeed
    }
  }, [queryClient]);

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

  const connectSSE = useCallback(() => {
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      setIsConnected(true);
      setConnectionType('sse');
      currentConnectionType = 'sse';
      return eventSource;
    }
    if (isSSEConnecting) return eventSource;

    isSSEConnecting = true;
    explicitlyClosed = false;

    console.log('📡 Attempting SSE fallback connection...');
    const url = `/realtime-alerts-sse`;
    
    eventSource = new EventSource(url);

    eventSource.addEventListener('open', () => {
      console.log('📡 SSE fallback connected successfully');
      setIsConnected(true);
      setConnectionType('sse');
      setConnectionError(null);
      currentConnectionType = 'sse';
      sseAttempts = 0;
      isSSEConnecting = false;
      
      // Fetch missed alerts on successful reconnection
      if (lastReceivedSequenceNumber !== null || lastConnectionTime !== null) {
        fetchMissedAlerts().catch(console.error);
      }
      
      // Update connection time for future reconnects
      lastConnectionTime = new Date().toISOString();
    });

    eventSource.addEventListener('message', (event) => {
      handleMessage(event.data);
    });

    eventSource.addEventListener('error', (error) => {
      console.error('📡 SSE error:', error);
      setIsConnected(false);
      setConnectionType('none');
      currentConnectionType = 'none';
      isSSEConnecting = false;
      
      if (explicitlyClosed) return;
      
      // Retry SSE connection with exponential backoff
      const delay = Math.min(10_000, 1000 * 2 ** sseAttempts) + Math.random() * 500;
      sseAttempts++;
      
      if (sseAttempts <= MAX_SSE_RETRIES) {
        console.log(`📡 Retrying SSE connection in ${Math.round(delay)}ms (attempt ${sseAttempts}/${MAX_SSE_RETRIES})`);
        setTimeout(() => connectSSE(), delay);
      } else {
        setConnectionError('Both WebSocket and SSE connections failed after multiple attempts');
        console.error('📡 All connection methods exhausted - no real-time alerts available');
      }
    });

    return eventSource;
  }, [handleMessage]);

  const connect = useCallback(() => {
    // Check if we already have an active connection
    if (socket && socket.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      setConnectionType('websocket');
      currentConnectionType = 'websocket';
      return socket;
    }
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      setIsConnected(true);
      setConnectionType('sse');
      currentConnectionType = 'sse';
      return eventSource;
    }
    if (isConnecting || isSSEConnecting) return socket || eventSource;

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
      setConnectionType('websocket');
      setConnectionError(null);
      currentConnectionType = 'websocket';
      attempts = 0;
      sseAttempts = 0; // Reset SSE attempts when WebSocket succeeds
      isConnecting = false;
      
      // Fetch missed alerts on successful reconnection
      if (lastReceivedSequenceNumber !== null || lastConnectionTime !== null) {
        fetchMissedAlerts().catch(console.error);
      }
      
      // Update connection time for future reconnects
      lastConnectionTime = new Date().toISOString();
    });

    socket.addEventListener("message", (ev) => {
      handleMessage(ev.data);
    });

    socket.addEventListener("close", (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
      setConnectionType('none');
      currentConnectionType = 'none';
      isConnecting = false;
      
      if (explicitlyClosed) return;
      
      // Exponential backoff with jitter
      const delay = Math.min(10_000, 500 * 2 ** attempts) + Math.random() * 500;
      attempts++;
      
      if (attempts <= MAX_WS_RETRIES) {
        console.log(`Attempting to reconnect in ${Math.round(delay)}ms (attempt ${attempts}/${MAX_WS_RETRIES})`);
        setTimeout(() => connect(), delay);
      } else {
        console.log('📡 WebSocket retries exhausted, falling back to SSE...');
        setConnectionError('WebSocket failed, trying SSE fallback...');
        // Fall back to SSE after WebSocket retries are exhausted
        setTimeout(() => connectSSE(), 1000);
      }
    });

    socket.addEventListener("error", (error) => {
      console.error('WebSocket error:', error);
      setConnectionError('WebSocket connection error');
      socket?.close();
    });

    return socket;
  }, [handleMessage, connectSSE]);

  const disconnect = useCallback(() => {
    explicitlyClosed = true;
    
    // Close WebSocket connection
    if (socket) {
      socket.close(1000, 'User disconnect');
      socket = null;
    }
    
    // Close SSE connection
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    
    setIsConnected(false);
    setConnectionType('none');
    currentConnectionType = 'none';
    isConnecting = false;
    isSSEConnecting = false;
    attempts = 0;
    sseAttempts = 0;
  }, []);

  // Register message callback for this hook instance
  useEffect(() => {
    const messageCallback = async (message: WebSocketMessage) => {
      // Track sequence numbers from any message (not just alerts)
      if (message.sequenceNumber) {
        lastReceivedSequenceNumber = Math.max(
          lastReceivedSequenceNumber || 0, 
          message.sequenceNumber
        );
        console.log(`🔢 Updated sequence number: ${lastReceivedSequenceNumber}`);
      }

      if (message.type === 'new_alert' && message.alert) {
        const alertData = message.alert;
        console.log('📋 WebSocket received alert:', alertData.id || alertData.alertKey, alertData.type || alertData.alertType);

        // Track sequence number from alert data as well
        if (alertData.sequenceNumber) {
          lastReceivedSequenceNumber = Math.max(
            lastReceivedSequenceNumber || 0, 
            alertData.sequenceNumber
          );
          console.log(`🔢 Updated sequence from alert: ${lastReceivedSequenceNumber}`);
        }

        // Check current query state
        const currentData = queryClient.getQueryData(['/api/alerts']);
        const queryState = queryClient.getQueryState(['/api/alerts']);

        console.log('🔍 Query state check:', {
          hasData: !!currentData,
          dataLength: Array.isArray(currentData) ? currentData.length : 0
        });

        // Only update if query is settled (not fetching)
        if (queryState?.status !== 'pending' && currentData) {
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
              sequenceNumber: alertData.sequenceNumber || message.sequenceNumber,
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

            // Sort by sequence number first, then timestamp
            const sortedData = newData
              .sort((a: any, b: any) => {
                if (a.sequenceNumber && b.sequenceNumber) {
                  return b.sequenceNumber - a.sequenceNumber;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
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
    connectionType,
    reconnect: connect,
    disconnect
  };
}