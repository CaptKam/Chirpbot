import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason);
  
  // Check if it's a network error that we can safely ignore
  const ignorableErrors = [
    'NetworkError',
    'Failed to fetch',
    'AbortError',
    'The user aborted a request',
    'WebSocket',
    'connection',
    'ECONNREFUSED'
  ];
  
  if (ignorableErrors.some(err => reason.includes(err))) {
    console.log('Ignoring network-related error:', reason);
    event.preventDefault();
    return;
  }
  
  console.warn('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

createRoot(document.getElementById("root")!).render(<App />);
