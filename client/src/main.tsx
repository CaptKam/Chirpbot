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
    'The user aborted a request',
    'Loading chunk',
    'Loading CSS chunk'
  ];
  
  if (ignorableErrors.some(err => reason.includes(err))) {
    console.log('Ignoring network-related error');
    event.preventDefault();
    return;
  }
  
  event.preventDefault(); // Prevent the default browser error handling
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

// Add error boundary wrapper
const ErrorFallback = ({ error }: { error: Error }) => (
  <div style={{ 
    padding: '20px', 
    textAlign: 'center', 
    backgroundColor: '#0B1220', 
    color: 'white', 
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <h1>ChirpBot Loading Error</h1>
    <p>Something went wrong loading the app.</p>
    <details style={{ marginTop: '10px', textAlign: 'left' }}>
      <summary>Error Details</summary>
      <pre style={{ fontSize: '12px', overflow: 'auto' }}>{error.message}</pre>
    </details>
    <button 
      onClick={() => window.location.reload()} 
      style={{ 
        marginTop: '20px', 
        padding: '10px 20px', 
        backgroundColor: '#2387F4', 
        color: 'white', 
        border: 'none', 
        borderRadius: '5px',
        cursor: 'pointer'
      }}
    >
      Reload App
    </button>
  </div>
);

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error('Critical app initialization error:', error);
  createRoot(document.getElementById("root")!).render(
    <ErrorFallback error={error as Error} />
  );
}
