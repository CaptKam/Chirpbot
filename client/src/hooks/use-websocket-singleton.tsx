import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  alert?: any;
  timestamp?: string;
  sequenceNumber?: number;
  seq?: number;
  connectionType?: string;
  serverBootId?: string;
}

// Singleton WebSocket connection
let socket: WebSocket | null = null;
let wsBackoffDelay = 1000; // Start with 1s delay
let explicitlyClosed = false;
let isConnecting = false;

// SSE fallback connection
let eventSource: EventSource | null = null;
let sseBackoffDelay = 1000; // Start with 1s delay
let isSSEConnecting = false;
let currentConnectionType: 'websocket' | 'sse' | 'none' = 'none';

// Sequence tracking for delta synchronization
let lastReceivedSequenceNumber: number | null = null;
let lastConnectionTime: string | null = null;

// Connection resilience tracking
let lastDisconnectTime: number | null = null;
let serverBootId: string | null = null;
let isHttpPolling = false;
let httpPollingInterval: NodeJS.Timeout | null = null;
let lastServerRestartTime: number | null = null;
let errorSuppressionUntil: number | null = null;

// Constants for backoff behavior
const MIN_BACKOFF_DELAY = 1000; // 1 second
const MAX_BACKOFF_DELAY = 30000; // 30 seconds max delay
const BACKOFF_MULTIPLIER = 1.5; // More gradual than 2x
const JITTER_RANGE = 0.3; // ±30% jitter
const HTTP_POLLING_THRESHOLD = 30000; // Start HTTP polling after 30s disconnection
const TRANSIENT_ERROR_CODES = [1006, 1001]; // Treat as temporary during development
const ERROR_SUPPRESSION_DURATION = 5000; // Suppress errors for 5s after server restart

// Utility functions for connection resilience
function calculateBackoffDelay(currentDelay: number): number {
  const nextDelay = Math.min(currentDelay * BACKOFF_MULTIPLIER, MAX_BACKOFF_DELAY);
  const jitter = nextDelay * JITTER_RANGE * (Math.random() * 2 - 1); // ±30% jitter
  return Math.max(MIN_BACKOFF_DELAY, nextDelay + jitter);
}

function resetBackoffDelay(): number {
  return MIN_BACKOFF_DELAY;
}

function shouldStartHttpPolling(): boolean {
  if (!lastDisconnectTime) return false;
  return Date.now() - lastDisconnectTime > HTTP_POLLING_THRESHOLD;
}

function startHttpPolling(queryClient: any) {
  if (isHttpPolling || httpPollingInterval) return;
  
  isHttpPolling = true;
  console.log('🔄 Starting HTTP polling fallback due to extended disconnection');
  
  httpPollingInterval = setInterval(async () => {
    try {
      // Only poll if still disconnected
      if (currentConnectionType === 'none') {
        console.log('🔄 HTTP polling: fetching latest alerts');
        await queryClient.refetchQueries({ queryKey: ['/api/alerts'] });
      } else {
        // Connected - stop polling
        stopHttpPolling();
      }
    } catch (error) {
      console.error('🔄 HTTP polling error:', error);
    }
  }, 10000); // Poll every 10 seconds
}

function stopHttpPolling() {
  if (httpPollingInterval) {
    clearInterval(httpPollingInterval);
    httpPollingInterval = null;
  }
  if (isHttpPolling) {
    isHttpPolling = false;
    console.log('🔄 Stopped HTTP polling fallback');
  }
}

function isDevelopmentTransientError(code: number): boolean {
  return TRANSIENT_ERROR_CODES.includes(code);
}

function shouldSuppressErrors(): boolean {
  if (!errorSuppressionUntil) return false;
  return Date.now() < errorSuppressionUntil;
}

function enableErrorSuppression() {
  errorSuppressionUntil = Date.now() + ERROR_SUPPRESSION_DURATION;
  console.log(`🔇 Error suppression enabled for ${ERROR_SUPPRESSION_DURATION}ms due to server restart`);
}

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
      
      // Track server boot ID to detect server restarts
      if (message.serverBootId) {
        const newBootId = message.serverBootId;
        if (serverBootId && serverBootId !== newBootId) {
          console.log(`🔄 Server restart detected: ${serverBootId} → ${newBootId}`);
          lastServerRestartTime = Date.now();
          enableErrorSuppression();
          // Clear error state on server restart - it's expected behavior
          setConnectionError(null);
        }
        serverBootId = newBootId;
      }
      
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
      sseBackoffDelay = resetBackoffDelay(); // Reset delay on successful connection
      isSSEConnecting = false;
      lastDisconnectTime = null; // Clear disconnect time
      stopHttpPolling(); // Stop any HTTP polling
      
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
      
      // Track disconnect time for HTTP polling
      if (!lastDisconnectTime) {
        lastDisconnectTime = Date.now();
      }
      
      if (explicitlyClosed) return;
      
      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoffDelay(sseBackoffDelay);
      sseBackoffDelay = delay;
      
      console.log(`📡 Retrying SSE connection in ${Math.round(delay)}ms (unlimited retries with exponential backoff)`);
      
      // Start HTTP polling if disconnected too long
      if (shouldStartHttpPolling()) {
        startHttpPolling(queryClient);
      }
      
      setTimeout(() => connectSSE(), delay);
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
      wsBackoffDelay = resetBackoffDelay(); // Reset delay on successful connection
      sseBackoffDelay = resetBackoffDelay(); // Reset SSE delay too
      isConnecting = false;
      lastDisconnectTime = null; // Clear disconnect time
      stopHttpPolling(); // Stop any HTTP polling
      
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
      
      // Track disconnect time for HTTP polling
      if (!lastDisconnectTime) {
        lastDisconnectTime = Date.now();
      }
      
      if (explicitlyClosed) return;
      
      // Handle development-friendly errors
      const isTransientError = isDevelopmentTransientError(event.code);
      if (isTransientError) {
        console.log(`🔄 Transient error (${event.code}) - likely dev server restart, will retry with minimal delay`);
        // Use shorter delay for likely development restarts
        const delay = Math.min(2000, wsBackoffDelay);
        setTimeout(() => connect(), delay);
        return;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoffDelay(wsBackoffDelay);
      wsBackoffDelay = delay;
      
      console.log(`🔄 Attempting to reconnect in ${Math.round(delay)}ms (unlimited retries with exponential backoff)`);
      
      // Start HTTP polling if disconnected too long  
      if (shouldStartHttpPolling()) {
        startHttpPolling(queryClient);
      }
      
      // Set error message only if not suppressed
      if (!shouldSuppressErrors()) {
        if (delay > 10000) {
          setConnectionError('Connection lost - retrying with extended delay...');
        } else {
          setConnectionError('Connection lost - reconnecting...');
        }
      } else {
        console.log('🔇 Error message suppressed due to recent server restart');
      }
      
      setTimeout(() => connect(), delay);
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
    
    // Clean up HTTP polling
    stopHttpPolling();
    
    setIsConnected(false);
    setConnectionType('none');
    currentConnectionType = 'none';
    isConnecting = false;
    isSSEConnecting = false;
    
    // Reset backoff delays
    wsBackoffDelay = resetBackoffDelay();
    sseBackoffDelay = resetBackoffDelay();
    lastDisconnectTime = null;
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