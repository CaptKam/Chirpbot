import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handlers to prevent unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Log more details if available
  if (event.reason instanceof Error) {
    console.error('Stack trace:', event.reason.stack);
  }
  
  // Check if it's a network error that we can safely ignore
  const reason = String(event.reason);
  const ignorableErrors = [
    'NetworkError',
    'Failed to fetch',
    'AbortError',
    'The user aborted a request'
  ];
  
  if (ignorableErrors.some(err => reason.includes(err))) {
    console.log('Ignoring network-related error');
    event.preventDefault();
    return;
  }
  
  // Don't prevent default browser error handling - let it crash gracefully
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
  
  // Don't prevent default behavior - allow proper error handling
});

createRoot(document.getElementById("root")!).render(<App />);
