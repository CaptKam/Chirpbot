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

export async function sendTelegramAlert(config: TelegramConfig, alert: any): Promise<boolean> {
  if (!config.botToken || !config.chatId) {
    console.log('⚠️ Telegram configuration incomplete - skipping alert delivery');
    return false;
  }

  try {
    const message = formatUniversalTelegramMessage(alert);

    const telegramUrl = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const payload = {
      chat_id: config.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const sport = alert.context?.sport || alert.gameInfo?.sport || 'UNKNOWN';
      console.log(`📱 ✅ Telegram alert sent successfully for ${sport}`);
      return true;
    } else {
      const errorData = await response.text();
      console.error('📱 ❌ Telegram API error:', errorData);
      return false;
    }
  } catch (error) {
    console.error('📱 ❌ Telegram send error:', error);
    return false;
  }
}

/**
 * Universal Telegram message formatter for all sports
 * Follows V3 Law #7: Consistent Alert Structure & 3-Second Readability
 */
function formatUniversalTelegramMessage(alert: any): string {
  // Null-safe gameInfo extraction - check both context and gameInfo for compatibility
  const gameInfo = alert?.context ?? alert?.gameInfo ?? {};
  const sport = gameInfo?.sport || 'UNKNOWN';
  const emoji = getSportEmoji(sport);

  // Clean alert type - remove sport prefix and format (null-safe)
  const typeStr = String(alert?.type ?? 'ALERT');
  const alertType = typeStr
    .replace(/^(MLB|NFL|NCAAF|NBA|WNBA|CFL|NHL)_/, '')
    .replace(/_/g, ' ');

  // Team names and scores (null-safe)
  const awayTeam = gameInfo?.awayTeam ?? 'Away';
  const homeTeam = gameInfo?.homeTeam ?? 'Home';
  const awayScore = gameInfo?.score?.away ?? gameInfo?.awayScore ?? 0;
  const homeScore = gameInfo?.score?.home ?? gameInfo?.homeScore ?? 0;

  // Build situation line based on sport
  const situationLine = buildSituationLine(sport, gameInfo);

  // Generate hashtag
  const hashtag = `#${sport}Alert #ChirpBot`;

  // Assemble message with consistent structure
  const messageParts = [
    `${emoji} ${alertType.toUpperCase()} ALERT`,
    `${awayTeam} ${awayScore} @ ${homeTeam} ${homeScore}`,
    situationLine,
    `🔗 View Alert Details`,
    hashtag
  ].filter(Boolean);

  return messageParts.join('\n');
}

/**
 * Build sport-specific situation line
 */
function buildSituationLine(sport: string, gameInfo: any): string {
  if (!gameInfo) return '';

  switch (sport) {
    case 'MLB':
      return buildMLBSituation(gameInfo);
    case 'NFL':
    case 'NCAAF':
    case 'CFL':
      return buildFootballSituation(gameInfo);
    case 'NBA':
    case 'WNBA':
      return buildBasketballSituation(gameInfo);
    case 'NHL':
      return buildHockeySituation(gameInfo);
    default:
      return buildGenericSituation(gameInfo);
  }
}

/**
 * MLB situation formatting
 */
function buildMLBSituation(gameInfo: any): string {
  const parts = [];

  // Inning and half (null-safe) - handle both isTopInning boolean and inningState string
  if (gameInfo?.inning) {
    let inningDisplay = '';
    if (gameInfo?.inningState) {
      // Legacy string format
      inningDisplay = gameInfo.inningState === 'top' ? `Top ${gameInfo.inning}` : `Bot ${gameInfo.inning}`;
    } else if (gameInfo?.isTopInning !== undefined) {
      // Current boolean format
      inningDisplay = gameInfo.isTopInning ? `Top ${gameInfo.inning}` : `Bot ${gameInfo.inning}`;
    } else {
      inningDisplay = `Inning ${gameInfo.inning}`;
    }
    parts.push(inningDisplay);
  }

  // Outs (null-safe)
  if (gameInfo?.outs !== undefined) {
    parts.push(`${gameInfo.outs} outs`);
  }

  // Count (null-safe)
  if (gameInfo?.balls !== undefined && gameInfo?.strikes !== undefined) {
    parts.push(`${gameInfo.balls}-${gameInfo.strikes} count`);
  }

  // Runners (null-safe) - handle both runners object and individual hasFirst/hasSecond/hasThird
  let runnersDisplay = '';
  if (gameInfo?.runners) {
    runnersDisplay = formatMLBRunners(gameInfo.runners);
  } else if (gameInfo?.hasFirst || gameInfo?.hasSecond || gameInfo?.hasThird) {
    // Convert hasFirst/hasSecond/hasThird to runners format
    const runners = {
      first: gameInfo.hasFirst || false,
      second: gameInfo.hasSecond || false,
      third: gameInfo.hasThird || false
    };
    runnersDisplay = formatMLBRunners(runners);
  }
  if (runnersDisplay) {
    parts.push(runnersDisplay);
  }

  return parts.length > 0 ? `📍 ${parts.join(' • ')}` : '';
}

/**
 * Football situation formatting (NFL, NCAAF, CFL)
 */
function buildFootballSituation(gameInfo: any): string {
  const parts = [];

  // Quarter and time (null-safe)
  if (gameInfo?.quarter && gameInfo?.timeRemaining) {
    parts.push(`Q${gameInfo.quarter}`);
    parts.push(gameInfo.timeRemaining);
  }

  // Down and distance (null-safe)
  if (gameInfo?.down && gameInfo?.yardsToGo) {
    parts.push(`${gameInfo.down}${getOrdinalSuffix(gameInfo.down)} & ${gameInfo.yardsToGo}`);
  }

  return parts.length > 0 ? `📍 ${parts.join(' • ')}` : '';
}

/**
 * Basketball situation formatting (NBA, WNBA)
 */
function buildBasketballSituation(gameInfo: any): string {
  const parts = [];

  // Quarter/Period and time (null-safe)
  if (gameInfo?.quarter && gameInfo?.timeRemaining) {
    const quarterDisplay = gameInfo.quarter <= 4 ? `Q${gameInfo.quarter}` : `OT${gameInfo.quarter - 4}`;
    parts.push(quarterDisplay);
    parts.push(gameInfo.timeRemaining);
  }

  // Shot clock (if relevant) (null-safe)
  if (gameInfo?.shotClock && gameInfo.shotClock < 24) {
    parts.push(`${gameInfo.shotClock}s shot clock`);
  }

  return parts.length > 0 ? `📍 ${parts.join(' • ')}` : '';
}

/**
 * Hockey situation formatting
 */
function buildHockeySituation(gameInfo: any): string {
  const parts = [];

  // Period and time (null-safe)
  if (gameInfo?.period && gameInfo?.timeRemaining) {
    parts.push(`P${gameInfo.period}`);
    parts.push(gameInfo.timeRemaining);
  }

  return parts.length > 0 ? `📍 ${parts.join(' • ')}` : '';
}

/**
 * Generic situation formatting
 */
function buildGenericSituation(gameInfo: any): string {
  const parts = [];

  // Null-safe property access
  if (gameInfo?.quarter && gameInfo?.timeRemaining) {
    parts.push(`Q${gameInfo.quarter}`);
    parts.push(gameInfo.timeRemaining);
  } else if (gameInfo?.period && gameInfo?.timeRemaining) {
    parts.push(`P${gameInfo.period}`);
    parts.push(gameInfo.timeRemaining);
  } else if (gameInfo?.inning) {
    parts.push(`Inning ${gameInfo.inning}`);
  }

  return parts.length > 0 ? `📍 ${parts.join(' • ')}` : '';
}

/**
 * Get sport emoji
 */
function getSportEmoji(sport: string): string {
  const sportEmojis: Record<string, string> = {
    'MLB': '⚾',
    'NFL': '🏈',
    'NCAAF': '🏈',
    'NBA': '🏀',
    'WNBA': '🏀',
    'CFL': '🏈',
    'NHL': '🏒'
  };
  return sportEmojis[sport] || '🚨';
}

/**
 * Format MLB runners display
 */
function formatMLBRunners(runners: any): string {
  if (!runners) return '';

  const positions = [];
  if (runners?.first) positions.push('1B');
  if (runners?.second) positions.push('2B');
  if (runners?.third) positions.push('3B');

  return positions.length > 0 ? positions.join(', ') : '';
}

/**
 * Get ordinal suffix for numbers
 */
function getOrdinalSuffix(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = num % 100;
  return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
}

export async function testTelegramConnection(config: TelegramConfig): Promise<boolean> {
  try {
    const { botToken, chatId } = config;

    if (!botToken || !chatId || botToken === "default_key" || chatId === "default_key" || botToken.trim() === '' || chatId.trim() === '') {
      console.log("📱 ❌ Missing or invalid Telegram credentials for test");
      return false;
    }

    console.log(`📱 🧪 Testing bot token validity...`);
    // First check if bot token is valid
    const botResponse = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botResult = await botResponse.json();

    if (!botResponse.ok || !botResult.ok) {
      console.error("📱 ❌ Invalid bot token:", botResult);
      if (botResponse.status === 401) {
        console.error("📱 🔑 Bot token is invalid - create a new bot with @BotFather");
      }
      return false;
    }

    console.log(`📱 ✅ Bot token valid - bot name: ${botResult.result.username}`);

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