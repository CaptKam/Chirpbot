import { fetchJson } from './http';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

// Escape Telegram MarkdownV2 special characters properly
function escapeMd(s: string | undefined | null): string {
  if (!s) return '';
  // Convert to string and escape ALL special markdown characters
  const str = String(s);
  // Order matters: escape backslash first, then other chars
  return str
    .replace(/\\/g, '\\\\')
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export async function sendTelegramAlert(
  config: TelegramConfig,
  alert: {
    id?: string;
    type: string;
    title: string;
    description: string;
    aiContext?: string;
    gameInfo: any;
  }
): Promise<boolean> {
  try {
    const { botToken, chatId } = config;

    console.log(`📱 🔍 TELEGRAM DEBUG: Attempting to send ${alert.type} alert`);
    console.log(`📱 🔧 Bot token present: ${!!botToken}, length: ${botToken?.length || 0}`);
    console.log(`📱 🔧 Chat ID: ${chatId}`);
    console.log(`📱 🔧 Is test data: ${botToken === 'default_key' || chatId === 'test-chat-id'}`);

    if (!botToken || !chatId || botToken === "default_key" || chatId === "test-chat-id") {
      console.log("📱 ❌ Telegram credentials not properly configured - using test/default values");
      console.log("📱 💡 Please update your Telegram settings with real bot token and chat ID");
      return false;
    }

    // Check if this is an AI-enhanced alert
    const isAIEnhanced = alert.aiContext && (
      alert.aiContext.aiTitle || 
      alert.aiContext.aiInsights || 
      alert.aiContext.aiBettingAdvice
    );

    let message = '';

    if (isAIEnhanced) {
      // AI-Enhanced Alert Format
      const aiTitle = alert.aiContext.aiTitle || alert.title;
      message += `🤖 *${escapeMd(aiTitle.toUpperCase())}*\n\n`;
      
      // AI-enhanced message
      const aiMessage = alert.aiContext.aiMessage || alert.description;
      message += `${escapeMd(aiMessage)}\n\n`;

      // Game situation with live scores
      message += `🎮 *LIVE GAME*\n`;
      message += `${escapeMd(alert.gameInfo.awayTeam)} ${alert.gameInfo.score?.away || 0} @ ${escapeMd(alert.gameInfo.homeTeam)} ${alert.gameInfo.score?.home || 0}\n`;

      if (alert.gameInfo.inning && alert.gameInfo.inningState) {
        message += `📍 ${alert.gameInfo.inningState.charAt(0).toUpperCase() + alert.gameInfo.inningState.slice(1)} ${alert.gameInfo.inning}th`;
        if (alert.gameInfo.outs !== undefined) {
          message += ` • ${alert.gameInfo.outs} out${alert.gameInfo.outs !== 1 ? 's' : ''}`;
        }
        message += `\n`;
      }

      // AI Insights
      if (alert.aiContext.aiInsights && alert.aiContext.aiInsights.length > 0) {
        message += `\n💡 *AI INSIGHTS*\n`;
        alert.aiContext.aiInsights.slice(0, 3).forEach((insight, index) => {
          message += `${index + 1}\\. ${escapeMd(insight)}\n`;
        });
      }

      // AI Betting Analysis
      if (alert.aiContext.aiBettingAdvice) {
        const betting = alert.aiContext.aiBettingAdvice;
        message += `\n💰 *BETTING ANALYSIS*\n`;
        message += `${escapeMd(betting.confidence)}% Confidence\n`;
        message += `*${escapeMd(betting.recommendation)}*\n`;
        
        if (betting.reasoning && betting.reasoning.length > 0) {
          message += `\n📊 *REASONING*\n`;
          betting.reasoning.slice(0, 2).forEach((reason, index) => {
            message += `• ${escapeMd(reason)}\n`;
          });
        }
      }

      // AI Game Projection
      if (alert.aiContext.aiGameProjection) {
        const projection = alert.aiContext.aiGameProjection;
        message += `\n🎯 *GAME PROJECTION*\n`;
        message += `Final: ${escapeMd(projection.finalScorePrediction)}\n`;
        
        if (projection.winProbability) {
          const homeProb = projection.winProbability.home;
          const awayProb = projection.winProbability.away;
          message += `Win %: ${escapeMd(alert.gameInfo.homeTeam.split(' ').pop())} ${homeProb}% | ${escapeMd(alert.gameInfo.awayTeam.split(' ').pop())} ${awayProb}%\n`;
        }
      }

      // AI Call to Action
      if (alert.aiContext.aiCallToAction) {
        message += `\n⚡ ${escapeMd(alert.aiContext.aiCallToAction)}\n`;
      }

    } else {
      // Standard Alert Format (fallback)
      message += `🚨 *${escapeMd(alert.type.replace(/_/g, ' ').toUpperCase())} ALERT*\n\n`;
      message += `*${escapeMd(alert.title)}*\n\n${escapeMd(alert.description)}\n\n`;

      // Game situation section
      message += `🎮 *GAME SITUATION*\n`;
      message += `${escapeMd(alert.gameInfo.awayTeam)} ${alert.gameInfo.score?.away || 0} @ ${escapeMd(alert.gameInfo.homeTeam)} ${alert.gameInfo.score?.home || 0}\n`;

      if (alert.gameInfo.inning && alert.gameInfo.inningState) {
        message += `📍 ${alert.gameInfo.inningState.charAt(0).toUpperCase() + alert.gameInfo.inningState.slice(1)} ${alert.gameInfo.inning}th`;

        if (alert.gameInfo.outs !== undefined) {
          message += ` • ${alert.gameInfo.outs} out${alert.gameInfo.outs !== 1 ? 's' : ''}`;
        }

        if (alert.gameInfo.balls !== undefined && alert.gameInfo.strikes !== undefined) {
          message += ` • ${alert.gameInfo.balls}\\-${alert.gameInfo.strikes} count`;
        }

        message += `\n`;
      }

      // Runners and scoring probability
      if (alert.gameInfo.runners) {
        const runnersOn = [];
        if (alert.gameInfo.runners.first) runnersOn.push('1st');
        if (alert.gameInfo.runners.second) runnersOn.push('2nd');
        if (alert.gameInfo.runners.third) runnersOn.push('3rd');

        if (runnersOn.length > 0) {
          message += `🏃 Runners: ${runnersOn.join(', ')}`;
          if (alert.gameInfo.scoringProbability) {
            message += ` • ${alert.gameInfo.scoringProbability}% scoring chance`;
          }
          message += `\n`;
        }
      }

      // Basic betting data if available
      if (alert.aiContext && typeof alert.aiContext === 'string') {
        message += `\n🤖 *AI ANALYSIS:*\n${escapeMd(alert.aiContext)}\n`;
      }
    }

    // Add clickable link to view alert details
    const appUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'https://chirpbot.replit.app';
    message += `\n🔗 [View Full Details](${appUrl}/alerts${alert.id ? `\\#${alert.id}` : ''})`;

    message += `\n\n${escapeMd('#ChirpBot')} ${escapeMd('#' + alert.type.replace(/\s+/g, ''))}`;

    console.log(`📱 Sending Telegram message to chat ${chatId}`);
    console.log(`📱 Message preview: ${message.substring(0, 100)}...`);

    try {
      // Try with native fetch first as fallback
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false,
        }),
      });

      const result = await response.json();
      console.log(`📱 Telegram API response:`, result);
      
      if (response.ok && result.ok === true) {
        console.log(`📱 ✅ Successfully sent Telegram message`);
        return true;
      } else {
        console.error(`📱 ❌ Telegram API error:`, result);
        
        // Try with plain text if MarkdownV2 failed
        if (result.description?.includes('parse') || result.description?.includes('markdown')) {
          console.log(`📱 🔄 Retrying with plain text...`);
          const plainResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: message.replace(/[\\*_`\[\]()~>#+=|{}.!-]/g, ''), // Strip markdown
              disable_web_page_preview: false,
            }),
          });
          
          const plainResult = await plainResponse.json();
          if (plainResponse.ok && plainResult.ok === true) {
            console.log(`📱 ✅ Successfully sent plain text Telegram message`);
            return true;
          }
        }
        
        return false;
      }
    } catch (fetchError: any) {
      console.error(`📱 ❌ Telegram network error:`, fetchError);
      
      // Handle rate limiting
      if (fetchError.message?.includes('429')) {
        console.warn('📱 ⚠️ Telegram rate limit hit, dropping alert');
      } else if (fetchError.message?.includes('404')) {
        // Invalid bot token - disable future attempts
        console.warn('📱 ⚠️ Invalid Telegram bot token detected. Please update TELEGRAM_BOT_TOKEN in environment settings.');
      } else {
        console.error('📱 ❌ Telegram send error:', fetchError.message);
      }
      return false;
    }
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
    return false;
  }
}

export async function testTelegramConnection(config: TelegramConfig): Promise<boolean> {
  try {
    const { botToken, chatId } = config;

    if (!botToken || !chatId || botToken === "default_key" || chatId === "default_key") {
      console.log("Missing Telegram credentials for test");
      return false;
    }

    // First check if bot token is valid
    const botResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botResult = await botResponse.json();

    if (!botResponse.ok || !botResult.ok) {
      console.error("Invalid bot token:", botResult);
      return false;
    }

    // Then send actual test message
    console.log(`Sending test message to Chat ID: ${chatId}`);
    const testMessage = `✅ ChirpBot Test Message

Your Telegram notifications are working perfectly! 🎉

You'll now receive live sports alerts here.

#ChirpBot #TestConnection`;

    const requestBody = {
      chat_id: chatId,
      text: testMessage,
    };

    console.log('Sending Telegram request:', JSON.stringify(requestBody, null, 2));

    const messageResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const messageResult = await messageResponse.json();

    if (!messageResponse.ok) {
      console.error("Failed to send test message:", messageResult);
      return false;
    }

    console.log("Test message sent successfully to Telegram");
    return messageResult.ok;
  } catch (error) {
    console.error("Telegram connection test failed:", error);
    return false;
  }
}