/**
 * Enhanced error message utilities for providing specific, actionable error messages
 * throughout the settings page and application.
 */

export interface ParsedError {
  title: string;
  message: string;
  action?: string;
  retryable: boolean;
  statusCode?: number;
  errorType: 'network' | 'auth' | 'permission' | 'validation' | 'server' | 'rate_limit' | 'not_found' | 'unknown';
}

/**
 * Parse API errors and return specific, user-friendly error messages
 */
export function parseApiError(error: any, context?: string): ParsedError {
  // Handle network/connection errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      title: "Connection Problem",
      message: "Unable to connect to server. Check your internet connection.",
      action: "Please check your internet connection and try again.",
      retryable: true,
      errorType: 'network'
    };
  }

  // Parse status code from error message (format: "401: Error message")
  const statusMatch = error.message?.match(/^(\d{3}):\s*(.*)/);
  const statusCode = statusMatch ? parseInt(statusMatch[1]) : null;
  const errorMessage = statusMatch ? statusMatch[2] : error.message || 'Unknown error';

  if (statusCode) {
    switch (statusCode) {
      case 401:
        return {
          title: "Authentication Required",
          message: "Your session has expired. Please log in again.",
          action: "Please log in to continue.",
          retryable: false,
          statusCode,
          errorType: 'auth'
        };

      case 403:
        return {
          title: "Permission Denied",
          message: getPermissionErrorMessage(context),
          action: "Contact your administrator if you believe you should have access.",
          retryable: false,
          statusCode,
          errorType: 'permission'
        };

      case 404:
        return {
          title: "Resource Not Found",
          message: getNotFoundErrorMessage(context),
          action: "Please refresh the page or contact support if the issue persists.",
          retryable: true,
          statusCode,
          errorType: 'not_found'
        };

      case 408:
        return {
          title: "Request Timeout",
          message: "The request took too long to complete.",
          action: "Please try again. If the problem persists, check your connection.",
          retryable: true,
          statusCode,
          errorType: 'network'
        };

      case 422:
        return {
          title: "Validation Error",
          message: getValidationErrorMessage(errorMessage, context),
          action: "Please check your input and try again.",
          retryable: false,
          statusCode,
          errorType: 'validation'
        };

      case 429:
        return {
          title: "Rate Limit Exceeded",
          message: "Too many requests. Please wait before trying again.",
          action: "Wait a moment and try again.",
          retryable: true,
          statusCode,
          errorType: 'rate_limit'
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          title: "Server Error",
          message: getServerErrorMessage(statusCode, context),
          action: "Please try again in a moment. If the issue persists, contact support.",
          retryable: true,
          statusCode,
          errorType: 'server'
        };

      default:
        if (statusCode >= 400 && statusCode < 500) {
          return {
            title: "Request Error",
            message: errorMessage || `Request failed with status ${statusCode}`,
            action: "Please check your input and try again.",
            retryable: false,
            statusCode,
            errorType: 'validation'
          };
        }
        break;
    }
  }

  // Handle specific error patterns
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('connection')) {
    return {
      title: "Network Error",
      message: "Connection failed. Check your internet connection.",
      action: "Please check your network connection and try again.",
      retryable: true,
      errorType: 'network'
    };
  }

  if (errorMessage.toLowerCase().includes('timeout')) {
    return {
      title: "Request Timeout",
      message: "The request took too long to complete.",
      action: "Please try again. If the problem persists, check your connection.",
      retryable: true,
      errorType: 'network'
    };
  }

  if (errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('not authenticated')) {
    return {
      title: "Authentication Required",
      message: "Your session has expired. Please log in again.",
      action: "Please log in to continue.",
      retryable: false,
      errorType: 'auth'
    };
  }

  // Default unknown error
  return {
    title: "Unexpected Error",
    message: errorMessage || "An unexpected error occurred.",
    action: "Please try again or contact support if the issue persists.",
    retryable: true,
    errorType: 'unknown'
  };
}

/**
 * Get context-specific permission error messages
 */
function getPermissionErrorMessage(context?: string): string {
  switch (context) {
    case 'global-settings':
      return "You don't have permission to view admin settings.";
    case 'alert-preferences':
      return "You don't have permission to modify alert preferences.";
    case 'telegram-settings':
      return "You don't have permission to configure Telegram settings.";
    case 'gambling-insights':
      return "You don't have permission to access gambling insights.";
    case 'odds-api':
      return "You don't have permission to configure odds API settings.";
    default:
      return "You don't have permission to perform this action.";
  }
}

/**
 * Get context-specific not found error messages
 */
function getNotFoundErrorMessage(context?: string): string {
  switch (context) {
    case 'alert-preferences':
      return "Alert preferences not found. They may need to be initialized.";
    case 'telegram-settings':
      return "Telegram settings not found. Configuration may need to be set up.";
    case 'gambling-insights':
      return "Gambling insights settings not found.";
    case 'odds-api':
      return "Odds API configuration not found.";
    case 'global-settings':
      return "Global settings not found for this sport.";
    default:
      return "The requested resource was not found.";
  }
}

/**
 * Get context-specific validation error messages
 */
function getValidationErrorMessage(errorMessage: string, context?: string): string {
  // Common validation patterns
  if (errorMessage.toLowerCase().includes('token')) {
    if (context === 'telegram-settings') {
      return "Invalid Telegram bot token. Please check the token format and try again.";
    }
    if (context === 'odds-api') {
      return "Invalid odds API key. Please verify your API key and try again.";
    }
    return "Invalid token provided.";
  }

  if (errorMessage.toLowerCase().includes('chat id') || errorMessage.toLowerCase().includes('chatid')) {
    return "Invalid Telegram chat ID. Please verify the chat ID format.";
  }

  if (errorMessage.toLowerCase().includes('email')) {
    return "Please enter a valid email address.";
  }

  if (errorMessage.toLowerCase().includes('required')) {
    return "Required fields are missing. Please fill in all required information.";
  }

  // Return the original message if no specific pattern matches
  return errorMessage || "Please check your input and try again.";
}

/**
 * Get context-specific server error messages
 */
function getServerErrorMessage(statusCode: number, context?: string): string {
  const baseMessage = statusCode === 500 ? "Internal server error" :
                     statusCode === 502 ? "Bad gateway" :
                     statusCode === 503 ? "Service temporarily unavailable" :
                     statusCode === 504 ? "Gateway timeout" :
                     "Server error";

  switch (context) {
    case 'alert-preferences':
      return `${baseMessage}. Unable to load or save alert preferences.`;
    case 'telegram-settings':
      return `${baseMessage}. Unable to configure Telegram settings.`;
    case 'gambling-insights':
      return `${baseMessage}. Gambling insights service is temporarily unavailable.`;
    case 'odds-api':
      return `${baseMessage}. Odds API service is temporarily unavailable.`;
    case 'global-settings':
      return `${baseMessage}. Unable to load global settings.`;
    default:
      return `${baseMessage}. Please try again in a moment.`;
  }
}

/**
 * Get context-specific retry suggestions
 */
export function getRetryAction(error: ParsedError, context?: string): string {
  if (!error.retryable) {
    if (error.errorType === 'auth') {
      return "Please log in to continue.";
    }
    if (error.errorType === 'permission') {
      return "Contact your administrator for access.";
    }
    if (error.errorType === 'validation') {
      return "Please check your input and try again.";
    }
    return "This error cannot be resolved by retrying.";
  }

  switch (error.errorType) {
    case 'network':
      return "Check your internet connection and try again.";
    case 'server':
      return "Wait a moment and try again.";
    case 'rate_limit':
      return "Wait before making another request.";
    default:
      return "Try again or refresh the page.";
  }
}

/**
 * Telegram-specific error parsing
 */
export function parseTelegramError(error: any): ParsedError {
  const errorMessage = error.message || '';
  
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
    return {
      title: "Invalid Bot Token",
      message: "Invalid Telegram bot token. Please check the token and try again.",
      action: "Verify your bot token with @BotFather on Telegram.",
      retryable: false,
      errorType: 'validation'
    };
  }

  if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
    if (errorMessage.toLowerCase().includes('chat')) {
      return {
        title: "Invalid Chat ID",
        message: "Invalid Telegram chat ID. Please verify the chat ID.",
        action: "Check your chat ID and ensure it's correct.",
        retryable: false,
        errorType: 'validation'
      };
    }
    return {
      title: "Invalid Request",
      message: "Invalid Telegram configuration. Please check your settings.",
      action: "Verify your bot token and chat ID.",
      retryable: false,
      errorType: 'validation'
    };
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      title: "Connection Failed",
      message: "Unable to connect to Telegram. Check your internet connection.",
      action: "Check your network connection and try again.",
      retryable: true,
      errorType: 'network'
    };
  }

  return parseApiError(error, 'telegram-settings');
}