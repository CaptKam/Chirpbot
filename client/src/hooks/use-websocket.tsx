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
    // WebSocket disabled - do not connect
    console.log('🚫 WebSocket client disabled');
    setIsConnected(false);
    return;

      // WebSocket disabled - no event handlers needed
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