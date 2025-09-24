import { BaseAlertModule, GameState, AlertResult } from '../../base-engine';

type NormStatus = 'scheduled' | 'live' | 'final' | 'other';

export default class GameStartModule extends BaseAlertModule {
  alertType = 'MLB_GAME_START';
  sport = 'MLB';

  // One-and-done per game
  private triggeredGames = new Set<string>();

  private normStatus(raw?: string): NormStatus {
    const s = (raw || '').trim().toLowerCase();
    if (s === 'live' || s === 'in progress' || s === 'inprogress') return 'live';
    if (s === 'final' || s === 'completed') return 'final';
    if (s === 'scheduled' || s === 'pregame' || s === 'pre') return 'scheduled';
    return 'other';
  }

  private isTopFirstNow(gs: GameState): boolean {
    return gs.isLive === true && gs.inning === 1 && gs.isTopInning === true;
  }

  isTriggered(gameState: GameState): boolean {
    const id = gameState.gameId;
    if (!id) return false;

    // If feed marks final, ensure we won't fire again (hygiene)
    if (this.normStatus(gameState.status) === 'final') {
      this.triggeredGames.delete(id);
      return false;
    }

    // Already fired for this game?
    if (this.triggeredGames.has(id)) return false;

    // Fire exactly when we see Top 1st in a live game
    if (this.isTopFirstNow(gameState)) {
      this.triggeredGames.add(id);
      return true;
    }
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    const alert = {
      alertKey: `mlb_game_start_${gameState.gameId}`,
      type: this.alertType,
      message: `${gameState.awayTeam} @ ${gameState.homeTeam} | Top 1st — First pitch`,
      context: {
        gameId: gameState.gameId,
        sport: this.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        inning: gameState.inning,
        isTopInning: gameState.isTopInning,
        outs: gameState.outs,
        isLive: gameState.isLive,
      },
      // Low–mid priority so it shows, but doesn’t drown later high-leverage alerts
      priority: 50,
    };

    return alert;
  }

  // PURE: no state writes here
  calculateProbability(gameState: GameState): number {
    return this.isTopFirstNow(gameState) ? 100 : 0;
  }
}
