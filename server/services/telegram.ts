import { fetchJson } from './http';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

// Escape Telegram MarkdownV2 special characters
function escapeMd(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
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
    
    if (!botToken || !chatId || botToken === "default_key") {
      console.log("Telegram credentials not configured, skipping notification");
      return false;
    }

    // Build rich notification message with escaped markdown
    let message = `🚨 *${escapeMd(alert.type.toUpperCase())} ALERT*\n\n*${escapeMd(alert.title)}*\n\n${escapeMd(alert.description)}\n\n`;
    
    // Game situation section
    message += `🎮 *GAME SITUATION*\n`;
    message += `${alert.gameInfo.awayTeam} ${alert.gameInfo.score?.away || 0} @ ${alert.gameInfo.homeTeam} ${alert.gameInfo.score?.home || 0}\n`;
    
    if (alert.gameInfo.inning && alert.gameInfo.inningState) {
      message += `📍 ${alert.gameInfo.inningState.charAt(0).toUpperCase() + alert.gameInfo.inningState.slice(1)} ${alert.gameInfo.inning}th`;
      
      if (alert.gameInfo.outs !== undefined) {
        message += ` • ${alert.gameInfo.outs} out${alert.gameInfo.outs !== 1 ? 's' : ''}`;
      }
      
      if (alert.gameInfo.balls !== undefined && alert.gameInfo.strikes !== undefined) {
        message += ` • ${alert.gameInfo.balls}-${alert.gameInfo.strikes} count`;
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
    
    // Team planning section - current matchup
    if (alert.gameInfo.currentBatter || alert.gameInfo.currentPitcher || alert.gameInfo.onDeckBatter) {
      message += `\n🎯 *MATCHUP DETAILS*\n`;
      
      if (alert.gameInfo.currentBatter) {
        const batter = alert.gameInfo.currentBatter;
        const handedness = batter.batSide === 'L' ? 'LH' : batter.batSide === 'R' ? 'RH' : 'SH';
        message += `🏏 *Current Batter:* ${escapeMd(batter.name)} (${handedness})\n`;
        message += `   📊 ${batter.stats.avg?.toFixed(3) || 'N/A'} AVG • ${batter.stats.hr || 0} HR • ${batter.stats.rbi || 0} RBI • ${batter.stats.ops?.toFixed(3) || 'N/A'} OPS\n`;
        
        // Power indicator
        if (batter.stats.hr && batter.stats.atBats && batter.stats.hr > 15) {
          const hrRate = ((batter.stats.hr / batter.stats.atBats) * 100).toFixed(1);
          message += `   ⚡ Power Threat: ${hrRate}% HR rate\n`;
        }
      }
      
      if (alert.gameInfo.onDeckBatter) {
        const onDeck = alert.gameInfo.onDeckBatter;
        const handedness = onDeck.batSide === 'L' ? 'LH' : onDeck.batSide === 'R' ? 'RH' : 'SH';
        message += `🔄 *On Deck:* ${escapeMd(onDeck.name)} (${handedness})\n`;
        message += `   📊 ${onDeck.stats.avg?.toFixed(3) || 'N/A'} AVG • ${onDeck.stats.hr || 0} HR • ${onDeck.stats.rbi || 0} RBI\n`;
      }
      
      if (alert.gameInfo.currentPitcher) {
        const pitcher = alert.gameInfo.currentPitcher;
        const handedness = pitcher.throwHand === 'L' ? 'LHP' : 'RHP';
        message += `⚾ *Current Pitcher:* ${escapeMd(pitcher.name)} (${handedness})\n`;
        message += `   📊 ${pitcher.stats.era?.toFixed(2) || 'N/A'} ERA • ${pitcher.stats.whip?.toFixed(2) || 'N/A'} WHIP • ${pitcher.stats.strikeOuts || 0} K • ${pitcher.stats.wins || 0}\\-${pitcher.stats.losses || 0} W\\-L\n`;
        
        // Effectiveness indicator
        if (pitcher.stats.era !== undefined) {
          if (pitcher.stats.era < 3.00) {
            message += `   🔥 Elite Pitcher: Sub-3.00 ERA\n`;
          } else if (pitcher.stats.era > 5.00) {
            message += `   🎯 Hittable: High ERA\n`;
          }
        }
      }
    }
    
    if (alert.aiContext) {
      message += `\n🤖 *AI ANALYSIS:*\n${alert.aiContext}\n`;
    }
    
    // Add clickable link to view alert details
    const appUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : 'https://chirpbot.replit.app';
    message += `\n🔗 [View Full Details](${appUrl}/alerts${alert.id ? `#${alert.id}` : ''})`;
    
    message += `\n\n#ChirpBot #${alert.type.replace(/\s+/g, '')}`;

    try {
      const result = await fetchJson<any>(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
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
          timeoutMs: 8000
        }
      );

      return result.ok === true;
    } catch (fetchError: any) {
      // Handle rate limiting
      if (fetchError.message?.includes('429')) {
        console.warn('Telegram rate limit hit, dropping alert');
      } else {
        console.error('Telegram send error:', fetchError.message);
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
