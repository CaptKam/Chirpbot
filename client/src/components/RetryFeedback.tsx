import { useState, useEffect } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Simple Alert component since ui/alert doesn't exist
function Alert({ variant = "default", className = "", children, ...props }: {
  variant?: "default" | "destructive";
  className?: string;
  children: React.ReactNode;
}) {
  const variantClasses = {
    default: "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
    destructive: "border-red-200 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-800 dark:text-red-100"
  };
  
  return (
    <div 
      className={`border rounded-lg p-4 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function AlertDescription({ children, ...props }: { children: React.ReactNode; [key: string]: any }) {
  return <div className="text-sm" {...props}>{children}</div>;
}

interface RetryFeedbackProps {
  isRetrying?: boolean;
  retryAttempt?: number;
  maxAttempts?: number;
  error?: any;
  lastAttemptTime?: number;
  className?: string;
}

export function RetryFeedback({ 
  isRetrying = false, 
  retryAttempt = 0, 
  maxAttempts = 3, 
  error, 
  lastAttemptTime,
  className = ""
}: RetryFeedbackProps) {
  const [showRetryIndicator, setShowRetryIndicator] = useState(false);

  // Show retry indicator when retrying or recently attempted
  useEffect(() => {
    if (isRetrying) {
      setShowRetryIndicator(true);
    } else if (retryAttempt > 0) {
      // Keep showing indicator briefly after retry completes
      const timer = setTimeout(() => setShowRetryIndicator(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowRetryIndicator(false);
    }
  }, [isRetrying, retryAttempt]);

  // Don't render anything if no retry activity
  if (!showRetryIndicator && !error) {
    return null;
  }

  // Calculate next retry delay (exponential backoff)
  const getNextRetryDelay = (attempt: number) => {
    const baseDelay = 1000; // 1 second
    const factor = 2;
    const maxDelay = 10000; // 10 seconds
    return Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
  };

  return (
    <div className={`space-y-2 ${className}`} data-testid="retry-feedback">
      {/* Retry Progress Indicator */}
      {isRetrying && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" data-testid="retry-spinner" />
          <span data-testid="retry-message">
            Retrying request
            {retryAttempt > 0 && (
              <Badge variant="outline" className="ml-2" data-testid="retry-attempt-badge">
                Attempt {retryAttempt}/{maxAttempts}
              </Badge>
            )}
          </span>
        </div>
      )}

      {/* Next Retry Countdown */}
      {isRetrying && retryAttempt > 0 && retryAttempt < maxAttempts && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span data-testid="retry-countdown">
            Next retry in {getNextRetryDelay(retryAttempt - 1) / 1000}s
          </span>
        </div>
      )}

      {/* Successful Retry Indicator */}
      {!isRetrying && retryAttempt > 0 && !error && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <RefreshCw className="w-4 h-4" />
          <span data-testid="retry-success-message">
            Request succeeded after {retryAttempt} attempt{retryAttempt !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Final Error After All Retries Failed */}
      {error && retryAttempt >= maxAttempts && (
        <Alert variant="destructive" data-testid="retry-error-alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription data-testid="retry-error-message">
            Request failed after {maxAttempts} attempts. {error.message || 'Please try again later.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Hook for managing retry state
export function useRetryState() {
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);

  const onRetry = (attempt: number, error: any) => {
    setRetryAttempt(attempt);
    setIsRetrying(true);
    setLastAttemptTime(Date.now());
    console.log(`🔄 Retry attempt ${attempt}:`, error.message);
  };

  const onRetrySuccess = () => {
    setIsRetrying(false);
    setLastAttemptTime(Date.now());
  };

  const onRetryFailure = () => {
    setIsRetrying(false);
    setLastAttemptTime(Date.now());
  };

  const reset = () => {
    setRetryAttempt(0);
    setIsRetrying(false);
    setLastAttemptTime(0);
  };

  return {
    retryAttempt,
    isRetrying,
    lastAttemptTime,
    onRetry,
    onRetrySuccess,
    onRetryFailure,
    reset
  };
}