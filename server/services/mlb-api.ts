import { getPacificDate } from '../utils/timezone';
import { mlbApiCircuit, protectedFetch } from '../middleware/circuit-breaker';
import { BaseSportApi, type BaseGameData } from './base-sport-api';
import { getPacificDate } from '../utils/timezone';
import { mlbApiCircuit, protectedFetch } from '../middleware/circuit-breaker';
import { BaseSportApi, type BaseGameData } from './base-sport-api';

type BatterStrength = 'elite' | 'strong' | 'average' | 'weak';

interface EnhancedLiveData {
  runners: { first: boolean; second: boolean; third: boolean };
  balls: number;
  strikes: number;
  outs: number;
  inning: number;
  inningState: 'Top' | 'Bottom' | 'Middle' | 'End' | null;
  isTopInning: boolean;
  homeScore: number;
  awayScore: number;
  gameState?: any;
  lineupData: {
    battingTeam: 'home' | 'away';
    currentBatterOrder: number;
    nextBatterOrder: number;
    onDeckBatterOrder: number;
    currentBatterStrength: BatterStrength;
    nextBatterStrength: BatterStrength;
    onDeckBatterStrength: BatterStrength;
  };
  currentBatter: string | null;
  currentBatterId: number | null;
  currentPitcher: string | null;
  currentPitcherId: number | null;
  onDeckBatter: string | null;
  lastPlay: {
    description: string | null;
    event: string | null;
    rbi: number;
    homeScore: number | null;
    awayScore: number | null;
  } | null;
  lastPitch: {
    pitchType: string | null;
    startSpeed: number | null;
    endSpeed: number | null;
    call: string | null;
    isStrike: boolean;
    isBall: boolean;
  } | null;
  pitchCount: number;
  lastUpdated: string;
}

export class MLBApiService extends BaseSportApi {
  // Optional lightweight ETag cache to reduce payloads on /feed/live
  private etags = new Map<string, string>();

  constructor() {
    super({
      baseUrl: 'https://statsapi.mlb.com/api',
      circuit: mlbApiCircuit,
      sportTag: 'MLB',
      rateLimits: {
        live: 200,        // 200ms for live games (high priority)
        scheduled: 4000,  // 4s for scheduled games (aligns with 5s polling cadence)
        final: 30000,     // 30s for final games
        delayed: 3000,    // 3s for delayed games
        default: 250
      },
      cacheTtl: {
        live: 500,         // 500ms for live game data
        scheduled: 15000,  // 15s for scheduled games
        final: 120000,     // 2min for finals
        delayed: 5000,     // 5s for delayed games
        batch: 8000,       // 8s for batch requests
        default: 1000
      }
    });
  }

  // ---- BaseSportApi required methods ---------------------------------------

  protected buildTodaysGamesUrl(targetDate: string): string {
    // Use /v1 for schedule lookups (lightweight)
    return `${this.config.baseUrl}/v1/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
  }

  protected parseGamesResponse(data: any): BaseGameData[] {
    if (!data?.dates?.length) return [];

    const games = data.dates[0].games ?? [];
    return games.map((game: any) => {
      const homeScore = coerceInt(game?.linescore?.teams?.home?.runs, game?.teams?.home?.score, 0);
      const awayScore = coerceInt(game?.linescore?.teams?.away?.runs, game?.teams?.away?.score, 0);

      const gameId = String(game?.gamePk ?? '');
      const statusDetail: string = game?.status?.detailedState ?? '';
      const status = this.mapGameStatus(statusDetail);

      // Do not override official status with isLive; keep both
      const isLive = status === 'live';

      return {
        id: gameId,
        gameId,
        sport: 'MLB',
        homeTeam: {
          id: String(game?.teams?.home?.team?.id ?? ''),
          name: game?.teams?.home?.team?.name ?? 'Home',
          abbreviation: game?.teams?.home?.team?.abbreviation ?? '',
          score: homeScore
        },
        awayTeam: {
          id: String(game?.teams?.away?.team?.id ?? ''),
          name: game?.teams?.away?.team?.name ?? 'Away',
          abbreviation: game?.teams?.away?.team?.abbreviation ?? '',
          score: awayScore
        },
        status,
        startTime: game?.gameDate ?? null,
        venue: game?.venue?.name ?? null,
        isLive,
        // MLB-specific
        inning: coerceInt(game?.linescore?.currentInning, null),
        inningState: normalizeInningState(game?.linescore?.inningState)
      } as BaseGameData;
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    // Use /v1.1 feed/live for richer live data (plays, pitch events, etc.)
    return `${this.config.baseUrl}/v1.1/game/${gameId}/feed/live`;
  }

  protected async parseEnhancedGameResponse(data: any, gameId: string): Promise<EnhancedLiveData> {
    const liveData = data?.liveData ?? {};
    const gameData = data?.gameData ?? {};
    const linescore = liveData?.linescore ?? {};
    const currentPlay = liveData?.plays?.currentPlay;

    const runners = extractRunners(currentPlay, linescore);

    const count = currentPlay?.count ?? {};
    const balls = coerceInt(count?.balls, 0);
    const strikes = coerceInt(count?.strikes, 0);
    const outs = coerceInt(linescore?.outs, 0);

    const inning = coerceInt(linescore?.currentInning, 1);
    const inningState = normalizeInningState(linescore?.inningState);
    const isTopInning = inningState === 'Top';

    const homeScore = coerceInt(linescore?.teams?.home?.runs, 0);
    const awayScore = coerceInt(linescore?.teams?.away?.runs, 0);

    const lineupData = this.extractLineupData(liveData, gameData, isTopInning);
    const playerData = this.extractPlayerData(liveData, gameData, isTopInning);

    const lastPlay = this.extractLastPlay(liveData);
    const lastPitch = this.extractLastPitch(liveData);
    const pitchEvents = (currentPlay?.playEvents ?? []).filter((e: any) => e?.isPitch || e?.details?.isPitch);
    const pitchCount = pitchEvents.length;

    if (process.env.NODE_ENV !== 'production') {
      // Keep noise down in prod
      console.debug?.(`MLB live ${gameId}`, {
        inning, inningState, outs, balls, strikes, runners, homeScore, awayScore,
        batter: playerData.currentBatter, pitcher: playerData.currentPitcher
      });
    }

    return {
      runners,
      balls,
      strikes,
      outs,
      inning,
      inningState,
      isTopInning,
      homeScore,
      awayScore,
      gameState: liveData.gameState,
      lineupData,
      currentBatter: playerData.currentBatter,
      currentBatterId: playerData.currentBatterId,
      currentPitcher: playerData.currentPitcher,
      currentPitcherId: playerData.currentPitcherId,
      onDeckBatter: playerData.onDeckBatter,
      lastPlay,
      lastPitch,
      pitchCount,
      lastUpdated: new Date().toISOString()
    };
  }

  // ---- Convenience helpers exposed in your class ---------------------------

  // Uses ETag if available to reduce payload/latency. Falls back if not supported.
  async getLiveFeed(gameId: string): Promise<any> {
    const url = this.buildEnhancedGameUrl(gameId);

    const headers: Record<string, string> = {};
    const etag = this.etags.get(gameId);
    if (etag) headers['If-None-Match'] = etag;

    try {
      const response = await protectedFetch(mlbApiCircuit, url, { headers });
      if (response.status === 304) {
        // Not modified; upstream cache should already hold last JSON if you store it.
        // Return null here and let caller decide to reuse previous snapshot.
        return null;
      }
      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }
      const newEtag = response.headers.get('ETag');
      if (newEtag) this.etags.set(gameId, newEtag);

      return await response.json();
    } catch (error) {
      console.error('Error fetching live feed:', error);
      return null;
    }
  }

  protected getFallbackGameData(): EnhancedLiveData {
    return {
      runners: { first: false, second: false, third: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      inningState: 'Top',
      isTopInning: true,
      lineupData: {
        battingTeam: 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      },
      currentBatter: null,
      currentBatterId: null,
      currentPitcher: null,
      currentPitcherId: null,
      onDeckBatter: null,
      homeScore: 0,
      awayScore: 0,
      lastPlay: null,
      lastPitch: null,
      pitchCount: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  protected mapGameStatus(detailedState: string): 'scheduled' | 'live' | 'final' | 'delayed' {
    const s = (detailedState ?? '').toLowerCase();

    // Live variants from MLB API
    if (s.includes('progress') || s.includes('live') || s.includes('inning') || s.includes('in progress')) {
      return 'live';
    }
    // Completed/final
    if (s.includes('final') || s.includes('completed') || s.includes('game over')) {
      return 'final';
    }
    // Weather/administrative delays
    if (s.includes('delayed') || s.includes('postponed') || s.includes('suspended') || s.includes('warmup') || s.includes('manager challenge') || s.includes('review')) {
      return 'delayed';
    }
    // Preview, pre-game, scheduled
    return 'scheduled';
  }

  // ---- Private helpers -----------------------------------------------------

  private extractLineupData(liveData: any, gameData: any, isTopInning: boolean) {
    try {
      const battingTeam: 'home' | 'away' = isTopInning ? 'away' : 'home';
      const offense = liveData?.linescore?.offense ?? {};

      // MLB API often returns battingOrder as string like "101", "202" etc. Normalize to 1..9.
      const rawOrder = offense?.battingOrder;
      const orderNum = normalizeBattingOrder(rawOrder);

      const current = clamp(orderNum, 1, 9);
      const next = ((current) % 9) + 1;
      const onDeck = ((current + 1) % 9) + 1;

      return {
        battingTeam,
        currentBatterOrder: current,
        nextBatterOrder: next,
        onDeckBatterOrder: onDeck,
        currentBatterStrength: this.getBatterStrengthByPosition(current),
        nextBatterStrength: this.getBatterStrengthByPosition(next),
        onDeckBatterStrength: this.getBatterStrengthByPosition(onDeck)
      };
    } catch (err) {
      console.warn('Lineup data fallback:', (err as Error).message);
      return {
        battingTeam: isTopInning ? 'away' : 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average' as BatterStrength,
        nextBatterStrength: 'average' as BatterStrength,
        onDeckBatterStrength: 'average' as BatterStrength
      };
    }
  }

  private getBatterStrengthByPosition(position: number): BatterStrength {
    if (position >= 1 && position <= 2) return 'elite';   // table-setters / OBP
    if (position >= 3 && position <= 5) return 'strong';  // power core
    if (position >= 6 && position <= 7) return 'average';
    return 'weak'; // 8–9
  }

  private extractPlayerData(liveData: any, gameData: any, isTopInning: boolean) {
    try {
      const currentPlay = liveData?.plays?.currentPlay;
      const offense = liveData?.linescore?.offense;
      const boxscore = liveData?.boxscore;
      const battingTeamKey: 'home' | 'away' = isTopInning ? 'away' : 'home';
      const pitchingTeamKey: 'home' | 'away' = isTopInning ? 'home' : 'away';

      let currentBatter: string | null = null;
      let currentBatterId: number | null = null;
      let currentPitcher: string | null = null;
      let currentPitcherId: number | null = null;
      let onDeckBatter: string | null = null;

      // Strategy 1: currentPlay matchup
      if (currentPlay?.matchup) {
        currentBatter = currentPlay?.batter?.fullName ?? currentPlay?.matchup?.batter?.fullName ?? null;
        currentBatterId = coerceInt(currentPlay?.batter?.id ?? currentPlay?.matchup?.batter?.id, null);
        currentPitcher = currentPlay?.pitcher?.fullName ?? currentPlay?.matchup?.pitcher?.fullName ?? null;
        currentPitcherId = coerceInt(currentPlay?.pitcher?.id ?? currentPlay?.matchup?.pitcher?.id, null);
      }

      // Strategy 2: linescore offense (if present)
      if ((!currentBatter || !currentPitcher) && offense) {
        currentBatter = currentBatter ?? offense?.batter?.fullName ?? null;
        currentBatterId = currentBatterId ?? coerceInt(offense?.batter?.id, null);
        currentPitcher = currentPitcher ?? offense?.pitcher?.fullName ?? null;
        currentPitcherId = currentPitcherId ?? coerceInt(offense?.pitcher?.id, null);
        onDeckBatter = onDeckBatter ?? offense?.onDeck?.fullName ?? null;
      }

      // Strategy 3: boxscore lineup inference
      if (boxscore && (!currentBatter || !onDeckBatter)) {
        const teamBox = boxscore?.teams?.[battingTeamKey];
        const battingOrder = normalizeBattingOrder(liveData?.linescore?.offense?.battingOrder);
        const batters: number[] = Array.isArray(teamBox?.batters) ? teamBox!.batters : [];

        if (batters.length > 0) {
          const curIdx = ((battingOrder - 1) % batters.length + batters.length) % batters.length;
          const onDeckIdx = ((battingOrder) % batters.length + batters.length) % batters.length;

          if (!currentBatter) {
            const batterId = batters[curIdx];
            const batterInfo = teamBox?.players?.[`ID${batterId}`];
            currentBatter = batterInfo?.person?.fullName ?? currentBatter ?? null;
            currentBatterId = currentBatterId ?? coerceInt(batterInfo?.person?.id, null);
          }

          if (!onDeckBatter) {
            const onDeckId = batters[onDeckIdx];
            const onDeckInfo = teamBox?.players?.[`ID${onDeckId}`];
            onDeckBatter = onDeckInfo?.person?.fullName ?? onDeckBatter ?? null;
          }
        }

        // Pitcher inference
        if (!currentPitcher) {
          const pitchingBox = boxscore?.teams?.[pitchingTeamKey];
          const pitcherIds: number[] = Array.isArray(pitchingBox?.pitchers) ? pitchingBox!.pitchers : [];
          // Heuristic: pick last pitcher with non-zero IP, else last id
          let chosenId: number | null = null;
          for (let i = pitcherIds.length - 1; i >= 0; i--) {
            const pid = pitcherIds[i];
            const info = pitchingBox?.players?.[`ID${pid}`];
            const ip = info?.stats?.pitching?.inningsPitched;
            if (ip && ip !== '0.0') { chosenId = pid; break; }
          }
          if (chosenId == null && pitcherIds.length) chosenId = pitcherIds[pitcherIds.length - 1];

          if (chosenId != null) {
            const info = pitchingBox?.players?.[`ID${chosenId}`];
            currentPitcher = info?.person?.fullName ?? currentPitcher ?? null;
            currentPitcherId = currentPitcherId ?? coerceInt(info?.person?.id, null);
          }
        }
      }

      // Strategy 4: fallback labels
      if (!currentBatter || !currentPitcher || !onDeckBatter) {
        const fallback = this.generateFallbackPlayerData(gameData, isTopInning);
        currentBatter = currentBatter ?? fallback.currentBatter;
        currentPitcher = currentPitcher ?? fallback.currentPitcher;
        onDeckBatter = onDeckBatter ?? fallback.onDeckBatter;
      }

      return {
        currentBatter,
        currentBatterId,
        currentPitcher,
        currentPitcherId,
        onDeckBatter
      };
    } catch (error) {
      console.error('Error extracting player data:', error);
      return {
        ...this.generateFallbackPlayerData(gameData, isTopInning),
        currentBatterId: null,
        currentPitcherId: null
      };
    }
  }

  private extractLastPlay(liveData: any) {
    const cp = liveData?.plays?.currentPlay;
    if (!cp) return null;
    return {
      description: cp?.result?.description ?? null,
      event: cp?.result?.event ?? null,
      rbi: coerceInt(cp?.result?.rbi, 0),
      homeScore: coerceInt(cp?.result?.homeScore, null),
      awayScore: coerceInt(cp?.result?.awayScore, null)
    };
  }

  private extractLastPitch(liveData: any) {
    const events = liveData?.plays?.currentPlay?.playEvents ?? [];
    const pitch = [...events].reverse().find((e: any) => e?.isPitch || e?.details?.isPitch);
    if (!pitch) return null;

    const callCode = pitch?.details?.call?.code;
    return {
      pitchType: pitch?.details?.type?.description ?? pitch?.details?.type?.code ?? null,
      startSpeed: coerceFloat(pitch?.pitchData?.startSpeed, null),
      endSpeed: coerceFloat(pitch?.pitchData?.endSpeed, null),
      call: pitch?.details?.call?.description ?? null,
      isStrike: callCode === 'S' || callCode === 'C' || callCode === 'K',
      isBall: callCode === 'B'
    };
  }

  private generateFallbackPlayerData(gameData: any, isTopInning: boolean) {
    const battingTeam = isTopInning ? gameData?.teams?.away : gameData?.teams?.home;
    const pitchingTeam = isTopInning ? gameData?.teams?.home : gameData?.teams?.away;
    const teamName = battingTeam?.teamName || 'Batting';
    const pitchingTeamName = pitchingTeam?.teamName || 'Pitching';

    return {
      currentBatter: `${teamName} Batter`,
      currentPitcher: `${pitchingTeamName} Pitcher`,
      onDeckBatter: `${teamName} On-Deck`
    };
  }
}

// Export a singleton instance
export const mlbApiService = new MLBApiService();

// ---- local helpers ---------------------------------------------------------

function coerceInt(...values: any[]): number {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function coerceFloat(v: any, fallback: number | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeInningState(v: any): 'Top' | 'Bottom' | 'Middle' | 'End' | null {
  const s = String(v ?? '').toLowerCase();
  if (!s) return null;
  if (s.startsWith('top')) return 'Top';
  if (s.startsWith('bot')) return 'Bottom';
  if (s.startsWith('mid')) return 'Middle';
  if (s.startsWith('end')) return 'End';
  return null;
}

// MLB battingOrder sometimes appears as strings like "101", "502". Reduce to 1..9.
function normalizeBattingOrder(raw: any): number {
  if (raw == null) return 1;
  const s = String(raw).trim();
  // Use last digit if formatted like "503"
  const lastDigit = Number(s.slice(-1));
  if (Number.isFinite(lastDigit) && lastDigit >= 1 && lastDigit <= 9) return lastDigit;
  const n = Number(s);
  if (Number.isFinite(n)) return ((n - 1) % 9) + 1;
  return 1;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extractRunners(currentPlay: any, linescore: any) {
  const runners = { first: false, second: false, third: false };

  // Prefer linescore.offense if present (fewer transient misreads between plays)
  const offense = linescore?.offense;
  if (offense) {
    if (offense.first) runners.first = true;
    if (offense.second) runners.second = true;
    if (offense.third) runners.third = true;
  }

  // Fallback / reconcile with currentPlay (covers some feeds where offense isn't populated yet)
  const cpRunners = currentPlay?.runners ?? [];
  for (const r of cpRunners) {
    const end = r?.movement?.end;
    if (end === '1B') runners.first = true;
    if (end === '2B') runners.second = true;
    if (end === '3B') runners.third = true;
  }

  return runners;
}

export class MLBApiService extends BaseSportApi {
  constructor() {
    super({
      baseUrl: 'https://statsapi.mlb.com/api/v1',
      circuit: mlbApiCircuit,
      sportTag: 'MLB',
      rateLimits: {
        live: 200,        // 200ms for live games (high priority)
        scheduled: 4000,  // 4s for scheduled games (fixed: was 8s, conflicted with 5s polling)
        final: 30000,     // 30s for final games
        delayed: 3000,    // 3s for delayed games (increased from 2s)
        default: 250      // Default fallback
      },
      cacheTtl: {
        live: 500,         // 500ms for live game data
        scheduled: 15000,  // 15s for scheduled games
        final: 120000,     // 2min for final games
        delayed: 5000,     // 5s for delayed games
        batch: 8000,       // 8s for batch requests
        default: 1000      // Default fallback
      }
    });
  }

  // Abstract method implementations for BaseSportApi
  protected buildTodaysGamesUrl(targetDate: string): string {
    return `${this.config.baseUrl}/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
  }

  protected parseGamesResponse(data: any): BaseGameData[] {
    if (!data.dates || data.dates.length === 0) {
      return [];
    }

    const games = data.dates[0].games || [];
    return games.map((game: any) => {
      // Extract live scores from linescore data for live games, fallback to team score for others
      const homeScore = game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0;
      const awayScore = game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0;
      
      // Use standardized live detection logic from BaseSportApi
      const isLive = this.isGameLive(game, 'mlb');
      
      // Use ONLY the mapped status from official API state - DO NOT override with isLive
      const finalStatus = this.mapGameStatus(game.status.detailedState);
      
      const gameId = game.gamePk.toString();
      
      return {
        id: gameId,
        gameId: gameId, // Ensure gameId is explicitly set
        sport: 'MLB',
        homeTeam: { id: game.teams.home.team.id.toString(), name: game.teams.home.team.name, abbreviation: game.teams.home.team.abbreviation, score: homeScore },
        awayTeam: { id: game.teams.away.team.id.toString(), name: game.teams.away.team.name, abbreviation: game.teams.away.team.abbreviation, score: awayScore },
        status: finalStatus,
        startTime: game.gameDate,
        venue: game.venue.name,
        isLive: isLive,
        // MLB-specific fields
        inning: game.linescore?.currentInning || null,
        inningState: game.linescore?.inningState || null
      };
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`;
  }

  protected async parseEnhancedGameResponse(data: any, gameId: string): Promise<any> {
    const liveData = data.liveData || {};
    const gameData = data.gameData || {};
    const linescore = liveData.linescore || {};
    const currentPlay = liveData.plays?.currentPlay;

    // Extract base runner information from current play or linescore
    const runners = { first: false, second: false, third: false };

    // First try current play runners
    if (currentPlay?.runners) {
      currentPlay.runners.forEach((runner: any) => {
        if (runner.movement?.end === '1B') runners.first = true;
        if (runner.movement?.end === '2B') runners.second = true;
        if (runner.movement?.end === '3B') runners.third = true;
      });
    }

    // Also check offense data for runners
    const offense = linescore.offense;
    if (offense) {
      if (offense.first) runners.first = true;
      if (offense.second) runners.second = true;
      if (offense.third) runners.third = true;
    }

    // Get count and outs
    const count = currentPlay?.count || {};
    const balls = count.balls || 0;
    const strikes = count.strikes || 0;
    const outs = linescore.outs || 0;

    // Get inning information
    const inning = linescore.currentInning || 1;
    const isTopInning = linescore.inningState === 'Top';

    // Extract live scores from the feed/live endpoint
    const homeScore = linescore?.teams?.home?.runs ?? 0;
    const awayScore = linescore?.teams?.away?.runs ?? 0;

    // Extract lineup and batter information for predictive analysis
    const lineupData = this.extractLineupData(liveData, gameData, isTopInning);
    
    // Enhanced player data extraction with multiple fallback strategies
    const playerData = this.extractPlayerData(liveData, gameData, isTopInning);
    const currentBatter = playerData.currentBatter;
    const currentBatterId = playerData.currentBatterId;
    const currentPitcher = playerData.currentPitcher;
    const currentPitcherId = playerData.currentPitcherId;
    const onDeckBatter = playerData.onDeckBatter;
    
    // Extract play-by-play data
    const lastPlay = this.extractLastPlay(liveData);
    const lastPitch = this.extractLastPitch(liveData);
    const pitchCount = (currentPlay?.playEvents || []).filter((e: any) => e?.isPitch || e?.details?.isPitch).length;

    console.log(`🔍 Live data for game ${gameId}:`, {
      runners, balls, strikes, outs, inning, isTopInning, homeScore, awayScore, currentBatter, currentPitcher
    });

    return {
      runners,
      balls,
      strikes,
      outs,
      inning,
      isTopInning,
      homeScore,
      awayScore,
      gameState: liveData.gameState,
      lineupData,
      currentBatter,
      currentBatterId,
      currentPitcher,
      currentPitcherId,
      onDeckBatter,
      lastPlay,
      lastPitch,
      pitchCount,
      lastUpdated: new Date().toISOString()
    };
  }

  // Use inherited getTodaysGames method from BaseSportApi

  async getLiveFeed(gameId: string): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/game/${gameId}/feed/live`;
      const response = await protectedFetch(mlbApiCircuit, url);
      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching live feed:', error);
      return null;
    }
  }

  // Use inherited getEnhancedGameData method from BaseSportApi

  private extractLineupData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      // Extract lineup information for the batting team
      const battingTeam = isTopInning ? 'away' : 'home';
      const probablePitchers = gameData.probablePitchers || {};
      const teams = gameData.teams || {};
      const offense = liveData.linescore?.offense || {};
      
      // Get current batting order position
      const battingOrder = offense.battingOrder || 1;
      
      // In a real implementation, this would extract full lineup data
      // For now, we'll provide deterministic batting order progression
      const lineupPosition = battingOrder;
      const nextBatterPosition = (battingOrder % 9) + 1;
      const onDeckPosition = ((battingOrder + 1) % 9) + 1;
      
      return {
        battingTeam,
        currentBatterOrder: lineupPosition,
        nextBatterOrder: nextBatterPosition,
        onDeckBatterOrder: onDeckPosition,
        // Deterministic lineup strength based on batting order position
        currentBatterStrength: this.getBatterStrengthByPosition(lineupPosition),
        nextBatterStrength: this.getBatterStrengthByPosition(nextBatterPosition),
        onDeckBatterStrength: this.getBatterStrengthByPosition(onDeckPosition)
      };
    } catch (error) {
      console.error('Error extracting lineup data:', error);
      return {
        battingTeam: isTopInning ? 'away' : 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      };
    }
  }

  private getBatterStrengthByPosition(position: number): 'elite' | 'strong' | 'average' | 'weak' {
    // Standard MLB batting order strength patterns (deterministic)
    if (position >= 1 && position <= 2) return 'elite';   // 1-2: Best contact/speed hitters
    if (position >= 3 && position <= 5) return 'strong';  // 3-5: Best power hitters
    if (position >= 6 && position <= 7) return 'average'; // 6-7: Average hitters
    return 'weak'; // 8-9: Weakest hitters (including pitcher in NL)
  }

  private extractPlayerData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      const currentPlay = liveData.plays?.currentPlay;
      const offense = liveData.linescore?.offense;
      const boxscore = liveData.boxscore;
      const teams = gameData.teams;
      
      let currentBatter = null;
      let currentBatterId = null;
      let currentPitcher = null;
      let currentPitcherId = null;
      let onDeckBatter = null;
      
      // Strategy 1: Extract from current play data
      if (currentPlay) {
        currentBatter = currentPlay.batter?.fullName || currentPlay.matchup?.batter?.fullName;
        currentBatterId = currentPlay.batter?.id || currentPlay.matchup?.batter?.id;
        currentPitcher = currentPlay.pitcher?.fullName || currentPlay.matchup?.pitcher?.fullName;
        currentPitcherId = currentPlay.pitcher?.id || currentPlay.matchup?.pitcher?.id;
      }
      
      // Strategy 2: Extract from offense data (linescore)
      if (!currentBatter && offense) {
        currentBatter = offense.batter?.fullName;
        currentBatterId = offense.batter?.id;
        currentPitcher = offense.pitcher?.fullName;
        currentPitcherId = offense.pitcher?.id;
        onDeckBatter = offense.onDeck?.fullName;
      }
      
      // Strategy 3: Extract from boxscore lineup data
      if (boxscore && (!currentBatter || !onDeckBatter)) {
        const battingTeam = isTopInning ? 'away' : 'home';
        const teamBox = boxscore.teams?.[battingTeam];
        
        if (teamBox?.batters) {
          const batters = teamBox.batters;
          const battingOrder = offense?.battingOrder || 1;
          
          // Find current batter in lineup
          if (!currentBatter && batters.length > 0) {
            const currentBatterIndex = (battingOrder - 1) % batters.length;
            const batterId = batters[currentBatterIndex];
            const batterInfo = teamBox.players?.[`ID${batterId}`];
            currentBatter = batterInfo?.person?.fullName;
          }
          
          // Find on-deck batter
          if (!onDeckBatter && batters.length > 0) {
            const onDeckIndex = battingOrder % batters.length;
            const onDeckId = batters[onDeckIndex];
            const onDeckInfo = teamBox.players?.[`ID${onDeckId}`];
            onDeckBatter = onDeckInfo?.person?.fullName;
          }
        }
        
        // Extract pitching information
        if (!currentPitcher && teamBox) {
          const pitchingTeam = isTopInning ? 'home' : 'away';
          const pitchingBox = boxscore.teams?.[pitchingTeam];
          if (pitchingBox?.pitchers && pitchingBox.pitchers.length > 0) {
            // Get current pitcher (usually the last one in active pitchers)
            const activePitchers = pitchingBox.pitchers.filter((id: any) => {
              const pitcher = pitchingBox.players?.[`ID${id}`];
              return pitcher?.stats?.pitching?.inningsPitched !== "0.0";
            });
            
            if (activePitchers.length > 0) {
              const currentPitcherId = activePitchers[activePitchers.length - 1];
              const pitcherInfo = pitchingBox.players?.[`ID${currentPitcherId}`];
              currentPitcher = pitcherInfo?.person?.fullName;
            }
          }
        }
      }
      
      // Strategy 4: Generate player names from team rosters if still null
      if (!currentBatter || !currentPitcher || !onDeckBatter) {
        const fallbackData = this.generateFallbackPlayerData(gameData, isTopInning);
        currentBatter = currentBatter || fallbackData.currentBatter;
        currentPitcher = currentPitcher || fallbackData.currentPitcher;
        onDeckBatter = onDeckBatter || fallbackData.onDeckBatter;
      }
      
      return {
        currentBatter,
        currentBatterId: null,
        currentPitcher,
        currentPitcherId: null,
        onDeckBatter
      };
    } catch (error) {
      console.error('Error extracting player data:', error);
      return this.generateFallbackPlayerData(gameData, isTopInning);
    }
  }

  private extractLastPlay(liveData: any): any {
    const cp = liveData?.plays?.currentPlay;
    if (!cp) return null;
    return {
      description: cp.result?.description ?? null,
      event: cp.result?.event ?? null,
      rbi: cp.result?.rbi ?? 0,
      homeScore: cp.result?.homeScore ?? null,
      awayScore: cp.result?.awayScore ?? null
    };
  }

  private extractLastPitch(liveData: any): any {
    const events = liveData?.plays?.currentPlay?.playEvents ?? [];
    const pitch = [...events].reverse().find(e => e?.isPitch || e?.details?.isPitch);
    if (!pitch) return null;
    return {
      pitchType: pitch.details?.type?.description ?? pitch.details?.type?.code ?? null,
      startSpeed: pitch.pitchData?.startSpeed ?? null,
      endSpeed: pitch.pitchData?.endSpeed ?? null,
      call: pitch.details?.call?.description ?? null,
      isStrike: pitch.details?.call?.code === 'S',
      isBall: pitch.details?.call?.code === 'B'
    };
  }

  private generateFallbackPlayerData(gameData: any, isTopInning: boolean): any {
    try {
      // Generate realistic player names from team data
      const battingTeam = isTopInning ? gameData.teams?.away : gameData.teams?.home;
      const pitchingTeam = isTopInning ? gameData.teams?.home : gameData.teams?.away;
      
      const teamName = battingTeam?.teamName || 'Team';
      const pitchingTeamName = pitchingTeam?.teamName || 'Team';
      
      // Generate realistic but generic player names based on team
      const currentBatter = `${teamName} Batter`;
      const currentPitcher = `${pitchingTeamName} Pitcher`;
      const onDeckBatter = `${teamName} On-Deck`;
      
      return {
        currentBatter,
        currentBatterId: null,
        currentPitcher,
        currentPitcherId: null,
        onDeckBatter
      };
    } catch (error) {
      return {
        currentBatter: 'Current Batter',
        currentPitcher: 'Current Pitcher', 
        onDeckBatter: 'On-Deck Batter'
      };
    }
  }

  protected getFallbackGameData() {
    return {
      runners: { first: false, second: false, third: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      isTopInning: true,
      lineupData: {
        battingTeam: 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      },
      currentBatter: null,
      currentPitcher: null,
      error: 'Failed to fetch live data'
    };
  }

  protected mapGameStatus(detailedState: string): string {
    const lowerState = detailedState.toLowerCase();

    if (lowerState.includes('progress') || lowerState.includes('live') || lowerState.includes('inning')) {
      return 'live';
    }
    if (lowerState.includes('final') || lowerState.includes('completed')) {
      return 'final';
    }
    if (lowerState.includes('delayed') || lowerState.includes('postponed')) {
      return 'delayed';
    }

    return 'scheduled';
  }
}

// Export a singleton instance
export const mlbApiService = new MLBApiService();