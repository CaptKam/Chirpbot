/**
 * Unified utility for extracting primary alert messages from various alert formats
 * Ensures consistent display across all alert card components
 */

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
 * Priority order:
 * 1. AI-enhanced content (highest priority)
 * 2. Direct message fields  
 * 3. Fallback to basic text
 */
export function getPrimaryMessage(alert: AlertData): string {
  // Try AI-enhanced content first (highest priority)
  if (alert.ai?.primary) return alert.ai.primary;
  if (alert.ai?.enhancedMessage) return alert.ai.enhancedMessage;
  if (alert.ai?.enhancedTitle) return alert.ai.enhancedTitle;
  if (alert.ai?.aiRecommendation) return alert.ai.aiRecommendation;
  
  // Try context AI fields
  if (alert.context?.aiMessage) return alert.context.aiMessage;
  if (alert.context?.aiTitle) return alert.context.aiTitle;
  if (alert.context?.aiRecommendation) return alert.context.aiRecommendation;
  if (alert.context?.enhancedMessage) return alert.context.enhancedMessage;
  
  // Try direct message fields (normalized by backend)
  if (alert.primary) return alert.primary;
  if (alert.message) return alert.message;
  if (alert.title) return alert.title;
  
  // Try payload fields
  if (alert.payload?.primary) return alert.payload.primary;
  if (alert.payload?.message) return alert.payload.message;
  if (alert.payload?.title) return alert.payload.title;
  
  // Final fallback
  return 'Alert notification';
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
 * Clean up message text by removing emojis and objects
 */
export function cleanMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  
  return message
    .replace(/🔥|💎|⚾|💪|⚡|🏠|🎆|⏰|🏈|🏀|🏒/g, '')
    .replace(/\[object Object\]/g, '')
    .trim();
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