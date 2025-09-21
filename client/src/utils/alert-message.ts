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
 * 1. Alert Composer enhanced content (V3 format)
 * 2. AI-enhanced content
 * 3. Direct message fields  
 * 4. Fallback to basic text
 */
export function getPrimaryMessage(alert: AlertData): string {
  // Try Alert Composer V3 format first (highest priority)
  const alertAny = alert as any;
  if (alertAny.headline) return alertAny.headline;
  if (alertAny.displayText) return alertAny.displayText;
  if (alertAny.mobileText) return alertAny.mobileText;
  if (alertAny.timing?.whyNow) return alertAny.timing.whyNow;
  if (alertAny.action?.primaryAction) return alertAny.action.primaryAction;
  
  // Try AI-enhanced content
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
  
  // Try payload fields with better parsing
  if (alert.payload) {
    let payload = alert.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return String(payload); // If it's a string that's not JSON, use it directly
      }
    }
    
    if (typeof payload === 'object' && payload !== null) {
      const payloadObj = payload as any;
      if (payloadObj.headline) return payloadObj.headline;
      if (payloadObj.displayText) return payloadObj.displayText;
      if (payloadObj.primary) return payloadObj.primary;
      if (payloadObj.message) return payloadObj.message;
      if (payloadObj.title) return payloadObj.title;
    }
  }
  
  // Final fallback - construct from alert type
  const type = alertAny.type || 'GAME_ALERT';
  const sport = alertAny.sport || 'GAME';
  return `${sport} ${type.replace(/_/g, ' ')} Alert`;
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
 * Get display content prioritizing gambling insights structured template
 */
export function getDisplayContent(alert: any): { content: string; isStructured: boolean } {
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
  
  // Priority 3: Clean primary message (line-clamped)
  const primaryMessage = getPrimaryMessage(alert);
  return {
    content: cleanMessage(primaryMessage),
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