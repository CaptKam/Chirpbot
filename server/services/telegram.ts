export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export async function sendTelegramAlert(
  config: TelegramConfig,
  alert: {
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

    const message = `🚨 *${alert.type.toUpperCase()} ALERT*

*${alert.title}*

${alert.description}

🎮 ${alert.gameInfo.awayTeam} @ ${alert.gameInfo.homeTeam}
📊 ${alert.gameInfo.status}

${alert.aiContext ? `🤖 *AI Analysis:*\n${alert.aiContext}` : ''}

#ChirpBot #${alert.type.replace(/\s+/g, '')}`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Telegram API error:", result);
      return false;
    }

    return result.ok;
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
    return false;
  }
}

export async function testTelegramConnection(config: TelegramConfig): Promise<boolean> {
  try {
    const { botToken } = config;
    
    if (!botToken || botToken === "default_key") {
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const result = await response.json();
    
    return response.ok && result.ok;
  } catch (error) {
    console.error("Telegram connection test failed:", error);
    return false;
  }
}
