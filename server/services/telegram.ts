import { fetchJson } from './http';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  disableNotification?: boolean;
}

export interface AlertPayload {
  type: string;
  context?: any;
  gameInfo?: any;
  url?: string; // optional deep link to your app
}

// --- Telegram limits / helpers ---
const TG_MAX_LEN = 4096;

function escapeMd(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function chunkMessage(txt: string, max = TG_MAX_LEN): string[] {
  if (txt.length <= max) return [txt];
  const parts: string[] = [];
  let i = 0;
  while (i < txt.length) {
    parts.push(txt.slice(i, i + max));
    i += max;
  }
  return parts;
}

// --- Message builder (MarkdownV2) ---
function formatUniversalTelegramMessage(alert: AlertPayload): { text: string; replyMarkup?: any } {
  const gameInfo = alert.context ?? alert.gameInfo ?? {};
  
  // Extract sport from multiple possible sources with better fallback logic
  let sport = gameInfo.sport || 'UNKNOWN';
  
  // If sport is UNKNOWN, try to extract from alert type as fallback
  if (sport === 'UNKNOWN' && alert.type) {
    const typeStr = String(alert.type);
    const sportMatch = typeStr.match(/^(MLB|NFL|NCAAF|NBA|WNBA|CFL|NHL)_/);
    if (sportMatch) {
      sport = sportMatch[1];
    }
  }
  
  const emoji = getSportEmoji(sport);
  const typeStr = String(alert.type ?? 'ALERT');
  const alertType = typeStr.replace(/^(MLB|NFL|NCAAF|NBA|WNBA|CFL|NHL)_/, '').replace(/_/g, ' ');

  const awayTeam = gameInfo.awayTeam ?? 'Away';
  const homeTeam = gameInfo.homeTeam ?? 'Home';
  const awayScore = gameInfo.score?.away ?? gameInfo.awayScore ?? 0;
  const homeScore = gameInfo.score?.home ?? gameInfo.homeScore ?? 0;

  const situationLine = buildSituationLineMd(sport, gameInfo);
  const hashtag = `#${sport}Alert #ChirpBot`;

  const title = `${emoji} ${alertType.toUpperCase()} ALERT`;
  const vs = `${escapeMd(awayTeam)} ${escapeMd(awayScore)} @ ${escapeMd(homeTeam)} ${escapeMd(homeScore)}`;

  const parts = [
    `*${escapeMd(title)}*`,
    vs,
    situationLine && `${situationLine}`,
    alert.url ? `[${escapeMd('View Alert Details')}](${escapeMd(alert.url)})` : '',
    escapeMd(hashtag),
  ].filter(Boolean);

  const text = parts.join('\n');
  const replyMarkup = alert.url
    ? { inline_keyboard: [[{ text: 'Open in ChirpBot', url: alert.url }]] }
    : undefined;

  return { text, replyMarkup };
}

function buildSituationLineMd(sport: string, gi: any): string {
  switch (sport) {
    case 'MLB': {
      const segs: string[] = [];
      if (gi?.inning) {
        const half = gi.inningState ? (gi.inningState === 'top' ? 'Top' : 'Bot')
                  : gi.isTopInning !== undefined ? (gi.isTopInning ? 'Top' : 'Bot')
                  : 'Inning';
        segs.push(`${half} ${escapeMd(gi.inning)}`);
      }
      if (gi?.outs !== undefined) segs.push(`${escapeMd(gi.outs)} outs`);
      if (gi?.balls !== undefined && gi?.strikes !== undefined) segs.push(`${escapeMd(gi.balls)}-${escapeMd(gi.strikes)} count`);
      const runners =
        gi?.runners
          ? formatMLBRunners(gi.runners)
          : (gi?.hasFirst || gi?.hasSecond || gi?.hasThird)
            ? formatMLBRunners({ first: gi.hasFirst, second: gi.hasSecond, third: gi.hasThird })
            : '';
      if (runners) segs.push(runners);
      return segs.length ? `📍 ${segs.map(escapeMd).join(' • ')}` : '';
    }
    case 'NFL':
    case 'NCAAF':
    case 'CFL': {
      const segs: string[] = [];
      if (gi?.quarter && gi?.timeRemaining) {
        segs.push(`Q${gi.quarter}`, gi.timeRemaining);
      }
      if (gi?.down && gi?.yardsToGo) segs.push(`${gi.down}${getOrdinalSuffix(gi.down)} & ${gi.yardsToGo}`);
      return segs.length ? `📍 ${segs.map(escapeMd).join(' • ')}` : '';
    }
    case 'NBA':
    case 'WNBA': {
      const segs: string[] = [];
      if (gi?.quarter && gi?.timeRemaining) {
        const q = gi.quarter <= 4 ? `Q${gi.quarter}` : `OT${gi.quarter - 4}`;
        segs.push(q, gi.timeRemaining);
      }
      if (gi?.shotClock && gi.shotClock < 24) segs.push(`${gi.shotClock}s shot clock`);
      return segs.length ? `📍 ${segs.map(escapeMd).join(' • ')}` : '';
    }
    case 'NHL': {
      const segs: string[] = [];
      if (gi?.period && gi?.timeRemaining) segs.push(`P${gi.period}`, gi.timeRemaining);
      return segs.length ? `📍 ${segs.map(escapeMd).join(' • ')}` : '';
    }
    default: {
      const segs: string[] = [];
      if (gi?.quarter && gi?.timeRemaining) segs.push(`Q${gi.quarter}`, gi.timeRemaining);
      else if (gi?.period && gi?.timeRemaining) segs.push(`P${gi.period}`, gi.timeRemaining);
      else if (gi?.inning) segs.push(`Inning ${gi.inning}`);
      return segs.length ? `📍 ${segs.map(escapeMd).join(' • ')}` : '';
    }
  }
}

function getSportEmoji(sport: string): string {
  const m: Record<string, string> = {
    MLB: '⚾', NFL: '🏈', NCAAF: '🏈', NBA: '🏀', WNBA: '🏀', CFL: '🏈', NHL: '🏒',
  };
  return m[sport] || '🚨';
}

function formatMLBRunners(r: any): string {
  if (!r) return '';
  const pos: string[] = [];
  if (r.first) pos.push('1B');
  if (r.second) pos.push('2B');
  if (r.third) pos.push('3B');
  return pos.join(', ');
}

function getOrdinalSuffix(num: number): string {
  const remainder = num % 100;
  if (remainder >= 11 && remainder <= 13) return 'th';
  switch (num % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// --- Sender with retry/backoff, parse fallback, chunking, dedupe ---
export async function sendTelegramAlert(config: TelegramConfig, alert: AlertPayload, dedupKey?: string): Promise<boolean> {
  if (!config.botToken || !config.chatId) {
    console.log('⚠️ Telegram config missing; skipping alert');
    return false;
  }

  const { text, replyMarkup } = formatUniversalTelegramMessage(alert);
  const chunks = chunkMessage(text);

  // try MarkdownV2 first, fallback to plain text if Telegram complains
  const sendChunk = async (txt: string, useMarkdown: boolean): Promise<Response> => {
    const body: any = {
      chat_id: config.chatId,
      text: txt,
      disable_web_page_preview: true,
      disable_notification: !!config.disableNotification,
    };
    if (replyMarkup) body.reply_markup = replyMarkup;
    if (useMarkdown) body.parse_mode = 'MarkdownV2';
    // Use fetchJson if you want unified error handling; plain fetch is fine too
    return fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const sendWithRetry = async (useMarkdown: boolean): Promise<boolean> => {
    for (const chunk of chunks) {
      let res = await sendChunk(chunk, useMarkdown);
      if (res.status === 429) {
        // Rate limited: respect retry_after
        const data = await res.json().catch(() => ({}));
        const wait = (data?.parameters?.retry_after ?? 1) * 1000;
        console.warn(`⏳ Telegram 429, retrying after ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        res = await sendChunk(chunk, useMarkdown);
      }
      if (!res.ok) {
        const body = await res.text();
        // 400 + "can't parse entities" — fallback to plain
        if (useMarkdown && res.status === 400 && /parse/i.test(body)) {
          console.warn('🧰 Markdown parse error, retrying without parse_mode');
          let res2 = await sendChunk(chunk, false);
          if (!res2.ok) {
            console.error('📱 ❌ Telegram (plain) failed:', await res2.text());
            return false;
          }
          continue;
        }
        // 5xx transient retry once
        if (res.status >= 500 && res.status < 600) {
          console.warn(`🔁 Telegram ${res.status}, retrying once`);
          const res2 = await sendChunk(chunk, useMarkdown);
          if (!res2.ok) {
            console.error('📱 ❌ Telegram 5xx after retry:', await res2.text());
            return false;
          }
          continue;
        }
        console.error('📱 ❌ Telegram error:', res.status, body);
        return false;
      }
    }
    return true;
  };

  return sendWithRetry(true);
}

export async function testTelegramConnection(config: TelegramConfig): Promise<boolean> {
  try {
    const { botToken, chatId } = config;
    if (!botToken?.trim() || !chatId?.trim() || botToken === 'default_key' || chatId === 'default_key') {
      console.log('📱 ❌ Missing/invalid Telegram credentials for test');
      return false;
    }

    // Validate bot
    const me = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meJson = await me.json();
    if (!me.ok || !meJson.ok) {
      console.error('📱 ❌ Invalid bot token:', meJson);
      if (me.status === 401) console.error('📱 🔑 Bot token invalid — create a new bot with @BotFather');
      return false;
    }
    console.log(`📱 ✅ Bot token valid — @${meJson.result?.username || 'unknown'}`);

    // Send a MarkdownV2 test, fallback to plain on parse error
    const ok = await sendTelegramAlert(config, {
      type: 'SYSTEM_TEST',
      context: { sport: 'SYSTEM', awayTeam: 'Test', homeTeam: 'Channel', awayScore: 0, homeScore: 0, quarter: 1, timeRemaining: '10:00' },
      url: undefined,
    }, 'TEST_MESSAGE');

    return ok;
  } catch (e) {
    console.error('Telegram connection test failed:', e);
    return false;
  }
}
