import { useEffect, useRef, useState } from 'react';
import type { WebSocketMessage } from '@/types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const connectWithCleanup = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws; // Keep ref for external access
  
        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };
  
        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            setLastMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
  
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            connectWithCleanup();
          }, 3000);
        };
  
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          // Clear any pending reconnect attempts to prevent race conditions
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnected(false);
        // Attempt to reconnect on creation failure
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Retrying WebSocket connection...');
          connectWithCleanup();
        }, 5000);
      }
    };

    connectWithCleanup();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      try { 
        ws?.close(); // Close the instance created in this effect
      } catch {}
    };
  }, []);

  return {
    isConnected,
    lastMessage,
  };
}
