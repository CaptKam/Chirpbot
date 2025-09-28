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

// Enhanced error boundary wrapper with better error handling
const ErrorFallback = ({ error }: { error: Error }) => {
  const isDevelopment = import.meta.env.DEV;
  
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center', 
      backgroundColor: '#0B1220', 
      color: 'white', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ marginBottom: '16px', fontSize: '24px' }}>ChirpBot Loading Error</h1>
      <p style={{ marginBottom: '20px', fontSize: '16px', opacity: 0.9 }}>
        Something went wrong loading the app. This might be a temporary issue.
      </p>
      
      {isDevelopment && (
        <details style={{ 
          marginBottom: '20px', 
          textAlign: 'left', 
          backgroundColor: '#1a1a1a',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #333',
          maxWidth: '600px',
          width: '100%'
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Error Details (Development Mode)
          </summary>
          <pre style={{ 
            fontSize: '12px', 
            overflow: 'auto',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {error.message}
            {error.stack && `\n\nStack Trace:\n${error.stack}`}
          </pre>
        </details>
      )}
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#2387F4', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Reload App
        </button>
        
        <button 
          onClick={() => {
            // Clear local storage and session storage
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
          }} 
          style={{ 
            padding: '12px 24px', 
            backgroundColor: '#666', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Clear Data & Reload
        </button>
      </div>
      
      <p style={{ 
        marginTop: '20px', 
        fontSize: '12px', 
        opacity: 0.7,
        maxWidth: '400px',
        lineHeight: 1.4
      }}>
        If this error persists, try clearing your browser cache or refreshing the page. 
        The app should recover automatically.
      </p>
    </div>
  );
};

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error('Critical app initialization error:', error);
  createRoot(document.getElementById("root")!).render(
    <ErrorFallback error={error as Error} />
  );
}
