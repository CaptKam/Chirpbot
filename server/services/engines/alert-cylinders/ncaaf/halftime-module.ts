import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';


type NormStatus = 'scheduled' | 'live' | 'halftime' | 'final' | 'other';

export default class HalftimeModule extends BaseAlertModule {
  alertType = 'NCAAF_HALFTIME';
  sport = 'NCAAF';

  // NCAA quarters are 15:00 -> 900s
  private readonly Q_SECONDS = 900;

  // Track which games have triggered halftime alert
  private halftimeTriggered: Set<string> = new Set();

  private normStatus(raw?: string): NormStatus {
    const s = (raw || '').trim().toLowerCase();
    if (s.includes('half') && !s.includes('second')) return 'halftime'; // "halftime", "half time"
    if (s === 'live' || s === 'in progress' || s === 'inprogress') return 'live';
    if (s === 'final' || s === 'completed') return 'final';
    if (s === 'scheduled' || s === 'pregame' || s === 'pre') return 'scheduled';
    return 'other';
  }

  private parseClockToSeconds(clock?: string): number {
    if (!clock) return NaN;
    const token = clock.trim().split(' ')[0]; // drop "Q3 15:00" style if present
    const parts = token.split(':');
    if (parts.length < 2) return NaN;
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (Number.isNaN(m) || Number.isNaN(s)) return NaN;
    return m * 60 + s;
  }

  private isHalftimeNow(gs: GameState): boolean {
    const status = this.normStatus(gs.status);
    const q = gs.quarter ?? 0;
    const sec = this.parseClockToSeconds(gs.timeRemaining || '');

    // Direct status from feed
    if (status === 'halftime') return true;

    // End of Q2: clock at/near 0
    if (q === 2 && (sec === 0 || (Number.isFinite(sec) && sec <= 2))) return true;

    // Start of Q3: clock at/near full quarter (allow small jitter)
    if (q === 3 && (sec === this.Q_SECONDS || (Number.isFinite(sec) && sec >= this.Q_SECONDS - 5))) {
      return true;
    }

    return false;
  }

  isTriggered(gameState: GameState): boolean {
    const gameId = gameState.gameId;
    if (!gameId) return false;

    // Don’t ever trigger after final
    if (this.normStatus(gameState.status) === 'final') return false;

    // Already sent for this game?
    if (this.halftimeTriggered.has(gameId)) return false;

    // Only between Q2 end and Q3 start; never in OT
    const q = gameState.quarter ?? 0;
    if (q >= 5) return false;

    const atHalftime = this.isHalftimeNow(gameState);
    if (!atHalftime) return false;

    this.halftimeTriggered.add(gameId);
    return true;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const homeScore = gameState.homeScore ?? 0;
    const awayScore = gameState.awayScore ?? 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const isClose = scoreDiff <= 14; // 2-possession+ window in CFB can be wide; 14 is a good “close-ish” cut

    // Slightly boost priority if close
    const priority = Math.min(95, 70 + (isClose ? 12 : 0) + Math.max(0, 8 - Math.min(scoreDiff, 8)));

    return {
      alertKey: `${gameState.gameId}_halftime`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | HALFTIME`,
      displayMessage: `🏈 NCAAF HALFTIME | Q${gameState.quarter}`,

      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore,
        awayScore,
        scoreDifference: scoreDiff,
        isCloseGame: isClose,
      },
      priority,
    };
  }

  // PURE: do not mutate halftimeTriggered here
  calculateProbability(gameState: GameState): number {
    // If it visually looks like halftime, call it certain; else zero.
    return this.isHalftimeNow(gameState) ? 100 : 0;
  }
}
