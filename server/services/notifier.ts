import type { AlertCandidate } from '../models/contracts';
import { buildAlertKey } from '../models/alert-key';

export async function pushAlert(a: AlertCandidate) {
  const key = buildAlertKey(a);
  
  try {
    // Format alert for human consumption
    const message = formatAlertMessage(a);
    
    // Send to Telegram if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await sendTelegramAlert(message);
    }
    
    // Broadcast to WebSocket clients
    await broadcastWebSocket(a);
    
    // Mark as delivered in DB
    await markAlertDelivered(key);
    
    console.log(`Alert delivered: ${key} - ${message}`);
  } catch (error) {
    console.error('Failed to push alert:', error);
  }
}

function formatAlertMessage(a: AlertCandidate): string {
  const sport = a.sport;
  const type = a.type;
  const score = a.score;
  
  let message = `🚨 ${sport} Alert (${score}%)\n`;
  message += `Type: ${type}\n`;
  message += `Game: ${a.gameId}\n`;
  message += `Phase: ${a.phase}\n`;
  
  if (a.context) {
    if (sport === 'MLB' && a.context.runners) {
      message += `Situation: RISP with runners on ${a.context.runners}, ${a.context.outs} outs\n`;
    } else if (sport === 'NCAAF' && a.context.yardline) {
      message += `Situation: Red Zone at ${a.context.yardline} yard line\n`;
    }
    
    if (a.context.scoreline) {
      const score = a.context.scoreline as any;
      message += `Score: ${score.away} - ${score.home}\n`;
    }
  }
  
  if (a.weatherBucket && a.weatherBucket !== 'CALM') {
    message += `Weather: ${a.weatherBucket}\n`;
  }
  
  return message.trim();
}

async function sendTelegramAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) return;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send Telegram alert:', error);
  }
}

async function broadcastWebSocket(alert: AlertCandidate): Promise<void> {
  // WebSocket broadcasting would be implemented here
  // For now, just log the alert
  console.log('WebSocket broadcast:', {
    key: buildAlertKey(alert),
    sport: alert.sport,
    type: alert.type,
    score: alert.score
  });
}

async function markAlertDelivered(alertKey: string): Promise<void> {
  // Update alert state to DELIVERED in database
  // Implementation would use the database service
  console.log(`Marked alert as delivered: ${alertKey}`);
}