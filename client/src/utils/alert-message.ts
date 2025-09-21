/**
 * Unified utility for extracting primary alert messages from various alert formats
 * Ensures consistent display across all alert card components
 */

import { cleanAlertFormatter } from './clean-alert-formatter';

/**
 * Extract the first sentence from a long text for concise display
 * Handles multiple sentence ending patterns (. ! ? :)
 */
export function extractFirstSentence(text: string): string {
  if (!text || typeof text !== 'string') return text;
  
  // Clean up extra whitespace
  const cleaned = text.trim();
  if (!cleaned) return text;
  
  // Find the first sentence ending
  const sentenceEnding = cleaned.match(/^[^.!?:]*[.!?:]/);
  if (sentenceEnding) {
    return sentenceEnding[0].trim();
  }
  
  // If no sentence ending found, try to break at a reasonable length
  if (cleaned.length > 100) {
    const spaceIndex = cleaned.indexOf(' ', 80);
    if (spaceIndex > 0) {
      return cleaned.substring(0, spaceIndex) + '...';
    }
  }
  
  // Return original text if it's already short
  return cleaned;
}

export interface AlertData {
  message?: string;
  title?: string;
  primary?: string;
  ai?: {
    primary?: string;
    enhancedMessage?: string;
    enhancedTitle?: string;
    aiRecommendation?: string;
  };
  context?: {
    aiMessage?: string;
    aiTitle?: string;
    aiRecommendation?: string;
    enhancedMessage?: string;
  };
  payload?: {
    message?: string;
    title?: string;
    primary?: string;
  };
}

/**
 * Get the primary message to display in alert cards
 * Simple approach:
 * 1. Check for pre-formatted displayMessage
 * 2. If not, format using clean formatter
 * 3. Return the clean, formatted result
 */
export function getPrimaryMessage(alert: AlertData): string {
  const alertAny = alert as any;
  
  // First check if alert has a pre-formatted displayMessage
  if (alertAny.displayMessage) {
    return alertAny.displayMessage;
  }
  
  // If not, format it using the clean formatter
  const formatted = cleanAlertFormatter.format(alertAny);
  return formatted.primary;
}

/**
 * Get the secondary/title message for alert cards
 */
export function getSecondaryMessage(alert: AlertData): string {
  // Try AI title fields first
  if (alert.ai?.enhancedTitle) return alert.ai.enhancedTitle;
  if (alert.ai?.aiRecommendation) return alert.ai.aiRecommendation;
  
  // Try context title fields
  if (alert.context?.aiTitle) return alert.context.aiTitle;
  if (alert.context?.aiRecommendation) return alert.context.aiRecommendation;
  
  // Try direct title field
  if (alert.title && alert.title !== alert.message) return alert.title;
  
  // Fallback to empty
  return '';
}

/**
 * Clean up message text by removing objects - preserves gambling insights emojis
 */
export function cleanMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  
  return message
    .replace(/\[object Object\]/g, '')
    .trim();
}

/**
 * Get display content using simplified approach
 */
export function getDisplayContent(alert: any): { content: string; isStructured: boolean } {
  // First check for pre-formatted displayMessage
  if (alert.displayMessage) {
    return {
      content: alert.displayMessage,
      isStructured: false
    };
  }
  
  // Priority 1: Gambling insights structured template (preserves emojis)
  if (alert.gamblingInsights?.structuredTemplate?.trim()) {
    return {
      content: alert.gamblingInsights.structuredTemplate.trim(),
      isStructured: true
    };
  }
  
  // Priority 2: Gambling insights bullets
  if (alert.gamblingInsights?.bullets?.length > 0) {
    return {
      content: alert.gamblingInsights.bullets.join('\n'),
      isStructured: false
    };
  }
  
  // Use clean formatter for consistent, concise display
  const formatted = cleanAlertFormatter.format(alert);
  return {
    content: formatted.primary,
    isStructured: false
  };
}

/**
 * Check if alert has AI-enhanced content
 */
export function hasAIContent(alert: AlertData): boolean {
  return !!(
    alert.ai?.primary ||
    alert.ai?.enhancedMessage ||
    alert.ai?.enhancedTitle ||
    alert.context?.aiMessage ||
    alert.context?.aiTitle ||
    alert.context?.aiRecommendation
  );
}