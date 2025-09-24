
import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type TrackedState = { status: 'scheduled' | 'live' | 'final' | 'other'; hasTriggered: boolean };

export default class GameStartModule extends BaseAlertModule {
  alertType = 'WNBA_GAME_START';
  sport = 'WNBA';

  // Track game states to detect transitions (gameId -> last known state)
  private gameStates: Map<string, TrackedState> = new Map();

  private normalizeStatus(raw?: string): TrackedState['status'] {
    const s = (raw || '').toLowerCase().trim();
    if (s === 'live' || s === 'inprogress' || s === 'in progress') return 'live';
    if (s === 'final' || s === 'completed') return 'final';
    if (s === 'scheduled' || s === 'pre' || s === 'pregame') return 'scheduled';
    return 'other';
  }

  private parseTimeToSeconds(timeString?: string): number {
    if (!timeString || timeString === '0:00') return 0;
    try {
      const clean = timeString.trim().split(' ')[0]; // drop extra tokens like "Q1 9:58"
      if (clean.includes(':')) {
        const [m, s] = clean.split(':').map(n => parseInt(n, 10) || 0);
        return m * 60 + s;
      }
      return parseInt(clean, 10) || 0;
    } catch {
      return 0;
    }
  }

  private isOpeningTipWindow(gameState: GameState): boolean {
    // If we have a clock, treat "start" as within first 60 real seconds of Q1.
    // If we do NOT have a clock, fall back to "first seen live in Q1".
    if (gameState.quarter !== 1) return false;
    const secs = this.parseTimeToSeconds(gameState.timeRemaining);
    // Many feeds count down from 10:00 (or 12:00 in some leagues). If unknown, allow.
    // If timeRemaining is present and near period start (>= 9:00 left), we treat as start window.
    // 9:00 remaining = within first minute of a 10:00 quarter.
    return !gameState.timeRemaining || secs >= 9 * 60;
  }

  isTriggered(gameState: GameState): boolean {
    const gameId = gameState.gameId;
    if (!gameId) return false;

    const prev = this.gameStates.get(gameId);
    const status = this.normalizeStatus(gameState.status);

    // Clean up / mark finals so we don't trigger again
    if (status === 'final') {
      this.gameStates.set(gameId, { status: 'final', hasTriggered: prev?.hasTriggered ?? false });
      return false;
    }

    // First time we ever see this game: record but don't trigger unless it's clearly at opening tip.
    if (!prev) {
      const shouldTrigger = status === 'live' && this.isOpeningTipWindow(gameState);
      this.gameStates.set(gameId, { status, hasTriggered: shouldTrigger });
      return !!shouldTrigger;
    }

    // Already triggered once for this game? Never trigger again.
    if (prev.hasTriggered) {
      // Keep status fresh
      if (prev.status !== status) this.gameStates.set(gameId, { ...prev, status });
      return false;
    }

    // Transition logic: scheduled/other -> live at opening tip window
    const becameLive = prev.status !== 'live' && status === 'live';
    const shouldTrigger = becameLive && this.isOpeningTipWindow(gameState);

    // Update tracked state
    this.gameStates.set(gameId, { status, hasTriggered: shouldTrigger || prev.hasTriggered });

    return shouldTrigger;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    // isTriggered() already ran in the engine pipeline
    return {
      alertKey: `${gameState.gameId}_game_start`,
      type: this.alertType,
      message: `🏀 WNBA Game Started: ${gameState.awayTeam} @ ${gameState.homeTeam}`,
      context: {
        gameId: gameState.gameId,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        quarter: gameState.quarter,
        timeRemaining: gameState.timeRemaining,
      },
      priority: 75,
    };
  }

  calculateProbability(gameState: GameState): number {
    // PURE: estimate likelihood without mutating state.
    // If it's Q1 and status looks live (or about to be), confidence is high.
    const status = this.normalizeStatus(gameState.status);
    if (status === 'live' && gameState.quarter === 1) return 100;
    if (status === 'scheduled' && gameState.quarter === 1) return 60;
    return 0;
  }
}
