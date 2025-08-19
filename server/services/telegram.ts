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
    const testMessage = `✅ **ChirpBot Test Message**

Your Telegram notifications are working perfectly! 🎉

You'll now receive live sports alerts here.

#ChirpBot #TestConnection`;

    const messageResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'Markdown',
      }),
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
