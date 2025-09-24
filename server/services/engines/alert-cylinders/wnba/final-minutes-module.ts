import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

export default class FinalMinutesOnceModule extends BaseAlertModule {
  alertType = 'WNBA_FINAL_MINUTES';
  sport = 'WNBA';

  // One-and-done per game
  private firedGameIds = new Set<string>();

  private readonly FINAL_WINDOW_Q4_SEC = 120; // 2:00
  private readonly FINAL_WINDOW_OT_SEC = 60;  // 1:00

  private parseClockToSeconds(clock?: string): number | null {
    if (!clock) return null;
    const token = clock.trim().split(' ')[0];
    const [m, s] = token.split(':').map(v => parseInt(v, 10));
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    return m * 60 + s;
  }

  private inFinalWindow(gs: GameState): boolean {
    const q = gs.quarter ?? 0;
    if (q < 4) return false;
    const sec = this.parseClockToSeconds(gs.timeRemaining);
    if (sec == null) return false;
    return q === 4 ? sec <= this.FINAL_WINDOW_Q4_SEC : sec <= this.FINAL_WINDOW_OT_SEC;
  }

  isTriggered(gs: GameState): boolean {
    if (!gs.gameId) return false;
    if (!gs.isLive && (gs.status || '').toLowerCase() !== 'live') return false;
    if (this.firedGameIds.has(gs.gameId)) return false;

    if (this.inFinalWindow(gs)) {
      this.firedGameIds.add(gs.gameId);
      return true;
    }
    return false;
  }

  generateAlert(gs: GameState): AlertResult | null {
    const diff = Math.abs((gs.homeScore ?? 0) - (gs.awayScore ?? 0));
    const q = gs.quarter ?? 4;
    const sec = this.parseClockToSeconds(gs.timeRemaining);
    const timeTxt = sec != null ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')} left` : '';

    // Stable key → guarantees one message per game
    return {
      alertKey: `${gs.gameId}_final_alert`,
      type: this.alertType,
      message: `⏰ Final stretch: ${gs.awayTeam} ${gs.awayScore} @ ${gs.homeTeam} ${gs.homeScore} ${timeTxt}`,
      context: {
        gameId: gs.gameId,
        sport: this.sport,
        homeTeam: gs.homeTeam,
        awayTeam: gs.awayTeam,
        homeScore: gs.homeScore ?? 0,
        awayScore: gs.awayScore ?? 0,
        quarter: q,
        timeRemaining: gs.timeRemaining,
        scoreDiff: diff,
        isOvertime: q >= 5,
      },
      // Close games float higher
      priority: Math.min(95, 85 + (diff <= 3 ? 8 : diff <= 5 ? 4 : 0) + (q >= 5 ? 2 : 0)),
    };
  }

  // PURE
  calculateProbability(gs: GameState): number {
    if (!gs.isLive && (gs.status || '').toLowerCase() !== 'live') return 0;
    return this.inFinalWindow(gs) ? 95 : 0;
  }
}
