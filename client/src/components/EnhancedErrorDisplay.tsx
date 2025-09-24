/**
 * Enhanced error display component that provides specific, actionable error messages
 * with context-aware retry suggestions and helpful user guidance.
 */

import { AlertTriangle, RefreshCw, WifiOff, Lock, Shield, Clock, Server, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseApiError, parseTelegramError, getRetryAction, type ParsedError } from "@/utils/error-messages";

interface EnhancedErrorDisplayProps {
  error: any;
  context?: string;
  onRetry?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showRetryButton?: boolean;
  isRetrying?: boolean;
  retryAttempt?: number;
  maxRetries?: number;
}

export function EnhancedErrorDisplay({
  error,
  context,
  onRetry,
  className = "",
  size = 'md',
  showRetryButton = true,
  isRetrying = false,
  retryAttempt = 0,
  maxRetries = 3
}: EnhancedErrorDisplayProps) {
  // Parse the error to get specific, actionable messages
  const parsedError: ParsedError = context === 'telegram-test' 
    ? parseTelegramError(error)
    : parseApiError(error, context);

  // Get appropriate icon based on error type
  const getErrorIcon = () => {
    const iconClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
    
    switch (parsedError.errorType) {
      case 'network':
        return <WifiOff className={`${iconClass} text-orange-400`} data-testid="error-icon-network" />;
      case 'auth':
        return <Lock className={`${iconClass} text-yellow-400`} data-testid="error-icon-auth" />;
      case 'permission':
        return <Shield className={`${iconClass} text-red-400`} data-testid="error-icon-permission" />;
      case 'rate_limit':
        return <Clock className={`${iconClass} text-blue-400`} data-testid="error-icon-rate-limit" />;
      case 'server':
        return <Server className={`${iconClass} text-purple-400`} data-testid="error-icon-server" />;
      case 'validation':
        return <AlertCircle className={`${iconClass} text-amber-400`} data-testid="error-icon-validation" />;
      case 'not_found':
        return <HelpCircle className={`${iconClass} text-gray-400`} data-testid="error-icon-not-found" />;
      default:
        return <AlertTriangle className={`${iconClass} text-red-400`} data-testid="error-icon-unknown" />;
    }
  };

  // Get error type badge
  const getErrorTypeBadge = () => {
    const typeLabels = {
      network: 'Connection',
      auth: 'Authentication',
      permission: 'Permission',
      rate_limit: 'Rate Limit',
      server: 'Server',
      validation: 'Validation',
      not_found: 'Not Found',
      unknown: 'Error'
    };

    const typeColors = {
      network: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      auth: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      permission: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      rate_limit: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      server: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      validation: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      not_found: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
      unknown: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };

    return (
      <Badge 
        variant="outline" 
        className={`${typeColors[parsedError.errorType]} border-0 text-xs`}
        data-testid={`error-type-badge-${parsedError.errorType}`}
      >
        {typeLabels[parsedError.errorType]}
        {parsedError.statusCode && ` (${parsedError.statusCode})`}
      </Badge>
    );
  };

  const containerClass = size === 'sm' ? 'py-4' : size === 'lg' ? 'py-12' : 'py-8';
  const titleClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base';
  const messageClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-sm';

  return (
    <div 
      className={`flex flex-col items-center justify-center space-y-4 ${containerClass} ${className}`}
      data-testid="enhanced-error-display"
      data-error-type={parsedError.errorType}
      data-error-context={context}
    >
      {/* Error Icon */}
      <div className="flex flex-col items-center space-y-2">
        {getErrorIcon()}
        {getErrorTypeBadge()}
      </div>

      {/* Error Message */}
      <div className="text-center max-w-md">
        <h3 className={`font-medium text-slate-200 ${titleClass}`} data-testid="error-title">
          {parsedError.title}
        </h3>
        <p className={`text-slate-400 mt-1 ${messageClass}`} data-testid="error-message">
          {parsedError.message}
        </p>
        {parsedError.action && (
          <p className={`text-slate-500 mt-2 ${messageClass}`} data-testid="error-action">
            {parsedError.action}
          </p>
        )}
      </div>

      {/* Retry Status */}
      {(isRetrying || retryAttempt > 0) && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {isRetrying && <RefreshCw className="w-4 h-4 animate-spin" data-testid="retry-spinner" />}
          <span data-testid="retry-status">
            {isRetrying ? 'Retrying...' : `Attempted ${retryAttempt}/${maxRetries} times`}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {showRetryButton && onRetry && (
        <div className="flex flex-col items-center space-y-2">
          <Button
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            onClick={onRetry}
            disabled={isRetrying || (!parsedError.retryable && parsedError.errorType !== 'unknown')}
            className={getRetryButtonStyles(parsedError.errorType)}
            data-testid="error-retry-button"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {parsedError.retryable ? 'Try Again' : 'Refresh'}
              </>
            )}
          </Button>
          
          {!parsedError.retryable && parsedError.errorType !== 'unknown' && (
            <p className="text-xs text-slate-500 text-center" data-testid="error-no-retry-hint">
              {getRetryAction(parsedError, context)}
            </p>
          )}
        </div>
      )}

      {/* Context-specific help text */}
      {getContextualHelp()}
    </div>
  );

  function getRetryButtonStyles(errorType: string): string {
    const baseStyles = "transition-all duration-300";
    
    switch (errorType) {
      case 'network':
        return `${baseStyles} border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400`;
      case 'auth':
        return `${baseStyles} border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400`;
      case 'permission':
        return `${baseStyles} border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400`;
      case 'rate_limit':
        return `${baseStyles} border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400`;
      case 'server':
        return `${baseStyles} border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400`;
      case 'validation':
        return `${baseStyles} border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400`;
      default:
        return `${baseStyles} border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400`;
    }
  }

  function getContextualHelp() {
    if (!context) return null;

    let helpText = '';
    
    switch (context) {
      case 'alert-preferences':
        if (parsedError.errorType === 'auth') {
          helpText = 'Your session may have expired. Please log in again to save your alert preferences.';
        } else if (parsedError.errorType === 'network') {
          helpText = 'Check your internet connection. Your preferences will be saved once reconnected.';
        }
        break;
        
      case 'telegram-settings':
        if (parsedError.errorType === 'validation') {
          helpText = 'Get your bot token from @BotFather on Telegram and find your chat ID by messaging your bot.';
        } else if (parsedError.errorType === 'network') {
          helpText = 'Check your internet connection and verify Telegram is accessible.';
        }
        break;
        
      case 'telegram-test':
        if (parsedError.errorType === 'validation') {
          helpText = 'Verify your bot token and chat ID are correct. The bot must be started in the chat.';
        }
        break;
        
      case 'global-settings':
        if (parsedError.errorType === 'permission') {
          helpText = 'Only administrators can access global settings. Contact your admin for assistance.';
        }
        break;
    }

    if (helpText) {
      return (
        <div className="text-xs text-slate-500 text-center max-w-sm bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50" data-testid="error-contextual-help">
          💡 {helpText}
        </div>
      );
    }

    return null;
  }
}

/**
 * Simplified error display for inline usage
 */
export function InlineErrorDisplay({ 
  error, 
  context, 
  onRetry,
  className = "" 
}: Pick<EnhancedErrorDisplayProps, 'error' | 'context' | 'onRetry' | 'className'>) {
  return (
    <EnhancedErrorDisplay
      error={error}
      context={context}
      onRetry={onRetry}
      className={className}
      size="sm"
      showRetryButton={!!onRetry}
    />
  );
}

/**
 * Error boundary wrapper for settings sections
 */
export function SettingsErrorBoundary({
  error,
  context,
  onRetry,
  children,
  isLoading = false,
  isRetrying = false
}: {
  error?: any;
  context: string;
  onRetry: () => void;
  children: React.ReactNode;
  isLoading?: boolean;
  isRetrying?: boolean;
}) {
  if (error && !isRetrying) {
    return (
      <EnhancedErrorDisplay
        error={error}
        context={context}
        onRetry={onRetry}
        isRetrying={isRetrying}
        size="md"
      />
    );
  }

  if (isLoading || isRetrying) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="settings-loading">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
}