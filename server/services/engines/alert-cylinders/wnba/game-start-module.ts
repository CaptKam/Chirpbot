// wnba-game-clock-start-module.ts
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type NormStatus = 'scheduled' | 'live' | 'final' | 'other';

export default class WNBAGameClockStartModule extends BaseAlertModule {
  alertType = 'WNBA_GAME_CLOCK_START';
  sport = 'WNBA';

  // Fire once per game
  private triggered = new Set<string>();
  private readonly FULL_Q_SEC = 600; // WNBA = 10:00 per quarter

  private normStatus(raw?: string): NormStatus {
    const s = (raw || '').trim().toLowerCase();
    if (s === 'live' || s === 'in progress' || s === 'inprogress') return 'live';
    if (s === 'final' || s === 'completed') return 'final';
    if (s === 'scheduled' || s === 'pregame' || s === 'pre') return 'scheduled';
    return 'other';
  }

  private parseTimeToSeconds(clock?: string): number | null {
    if (!clock) return null;
    const token = clock.trim().split(' ')[0]; // drop extra tokens if present
    const [m, s] = token.split(':').map(v => parseInt(v, 10));
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    return m * 60 + s;
  }

  private clockHasStartedMoving(gs: GameState): boolean {
    if (gs.quarter !== 1) return false;
    const sec = this.parseTimeToSeconds(gs.timeRemaining);
    // "Clock moving" means: timeRemaining < full quarter (10:00) and > 0
    return sec !== null && sec < this.FULL_Q_SEC && sec > 0;
  }

  isTriggered(gs: GameState): boolean {
    const id = gs.gameId;
    if (!id) return false;

    if (this.normStatus(gs.status) === 'final') {
      this.triggered.delete(id); // hygiene
      return false;
    }
    if (this.triggered.has(id)) return false;
    if (this.normStatus(gs.status) !== 'live') return false;

    if (this.clockHasStartedMoving(gs)) {
      this.triggered.add(id);
      return true;
    }
    return false;
  }

  generateAlert(gs: GameState): AlertResult | null {
    return {
      alertKey: `${gs.gameId}_q1_clock_started`,
      type: this.alertType,
      message: `🏀 WNBA Tip-Off: ${gs.awayTeam} @ ${gs.homeTeam} — clock is moving`,
      context: {
        gameId: gs.gameId,
        homeTeam: gs.homeTeam,
        awayTeam: gs.awayTeam,
        quarter: gs.quarter,
        timeRemaining: gs.timeRemaining,
      },
      priority: 70,
    };
  }

  // PURE: no state writes here
  calculateProbability(gs: GameState): number {
    const live = this.normStatus(gs.status) === 'live';
    const moving = this.clockHasStartedMoving(gs);
    return live && moving ? 100 : 0;
  }
}

