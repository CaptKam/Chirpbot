import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebSocketMessage, Alert } from '@/types';
import { queryClient } from '@/lib/queryClient';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5; // Set a limit for reconnection attempts

  const connectWithCleanup = useCallback(() => {
    // Prevent further connections if max attempts are reached
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log('Max WebSocket reconnection attempts reached.');
      setIsConnected(false);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      // Close existing connection if it exists and is not already closing/closed
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          // Handle 'new_alert' specifically with enhanced error handling
          if (message.type === 'new_alert') {
            try {
              const data = message.data;
              if (data && typeof data === 'object' && 'type' in data && 'sport' in data && 'title' in data && 'id' in data) {
                const newAlert = data as unknown as Alert; // Assuming Alert type is correctly defined elsewhere

                // Update the alerts list in the query cache
                queryClient.setQueryData<Alert[]>(["/api/alerts"], (oldAlerts) => {
                  try {
                    // Add default properties for WebSocket alert data
                    const alertWithDefaults = { ...newAlert, seen: false, sentToTelegram: false };

                    if (!oldAlerts) return [alertWithDefaults];

                    // Check if alert already exists to prevent duplicates (check by ID and timestamp)
                    const exists = oldAlerts.some(alert =>
                      alert.id === alertWithDefaults.id ||
                      (alert.title === alertWithDefaults.title &&
                       alert.timestamp === alertWithDefaults.timestamp)
                    );
                    if (exists) return oldAlerts;

                    // Add new alert at the beginning of the list
                    return [alertWithDefaults, ...oldAlerts];
                  } catch (error) {
                    console.error('Error updating alerts cache:', error);
                    return oldAlerts || [];
                  }
                });

                // Refresh both queries to ensure consistency
                queryClient.invalidateQueries({ queryKey: ["/api/alerts"] }).catch(error => {
                  console.error('Error invalidating alerts queries:', error);
                });
                queryClient.invalidateQueries({ queryKey: ["/api/alerts/unseen/count"] }).catch(error => {
                  console.error('Error invalidating unseen count query:', error);
                });
              }
            } catch (error) {
              console.error('Error processing new_alert message:', error);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        // Only log abnormal disconnections (not normal closures)
        if (event.code !== 1000 && event.code !== 1001) {
          console.log(`WebSocket disconnected: Code=${event.code}`);
        }
        setIsConnected(false);
        wsRef.current = null; // Clear the ref

        // Clear any existing reconnect timeout to avoid duplicates
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Attempt to reconnect only if it was not a clean closure (code 1000 or 1001)
        // and if we haven't reached the max reconnect attempts
        if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff, max 10s
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting WebSocket... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            setReconnectAttempts(prev => prev + 1);
            connectWithCleanup();
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts && event.code !== 1000 && event.code !== 1001) {
          console.log('Max reconnection attempts reached.');
        }
      };

      ws.onerror = () => {
        // Don't log the error event itself as it doesn't contain useful information
        // The actual error details will be in the onclose event
        // Don't trigger reconnection here as onclose will always be called after onerror
        setIsConnected(false);
        // Clear any existing timeout to avoid duplicates
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Attempt to reconnect on creation failure
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Retrying WebSocket connection... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setReconnectAttempts(prev => prev + 1);
          connectWithCleanup();
        }, delay);
      }
    }
  }, [reconnectAttempts]); // Depend on reconnectAttempts to manage retry logic

  useEffect(() => {
    connectWithCleanup();

    return () => {
      // Clear any pending reconnect timeouts when the component unmounts or effect re-runs
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Close the WebSocket connection if it's open or connecting
      if (wsRef.current) {
        try {
          // Use a flag or check readyState to avoid closing an already closing/closed socket
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close();
          }
        } catch (error) {
          console.error("Error closing WebSocket connection:", error);
        } finally {
          wsRef.current = null; // Ensure ref is cleared on cleanup
        }
      }
    };
  }, [connectWithCleanup]); // Effect depends on connectWithCleanup which captures reconnectAttempts

  return {
    isConnected,
    lastMessage,
  };
}