import { BaseAIScanner } from '../ai-opportunity-scanner';
import { GameState } from '../../base-engine';
import type { CrossSportContext } from '../../../unified-ai-processor';

export default class WNBAAIScannerModule extends BaseAIScanner {
  alertType = 'WNBA_AI_SCANNER';
  sport = 'WNBA';

  private readonly STAR_PLAYERS = [
    'Stewart', 'Wilson', 'Reese', 'Clark', 'Boston', 
    'Ionescu', 'Collier', 'Plum', 'Young', 'Griner'
  ];

  checkSmartGate(gameState: GameState): boolean {
    const hasHotPlayer = this.isStarPlayerInGame(gameState);
    if (!hasHotPlayer) return false;

    const period = (gameState.period as number) || 0;
    const timeLeft = (gameState.timeLeft as string) || '';
    const isCrunchTime = this.isCrunchTime(period, timeLeft);
    const hasMomentum = this.hasMomentumShift(gameState);
    const hasCriticalMoment = isCrunchTime || hasMomentum;
    if (!hasCriticalMoment) return false;

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const isCloseGame = scoreDiff <= 8;

    return isCloseGame;
  }

  buildAIContext(gameState: GameState): CrossSportContext {
    return {
      sport: 'WNBA',
      gameId: gameState.gameId,
      alertType: this.alertType,
      priority: 85,
      probability: 85,
      homeTeam: this.getTeamName(gameState.homeTeam),
      awayTeam: this.getTeamName(gameState.awayTeam),
      homeScore: gameState.homeScore || 0,
      awayScore: gameState.awayScore || 0,
      isLive: gameState.isLive,
      period: gameState.period as number | undefined,
      timeLeft: gameState.timeLeft as string | undefined,
      shotClock: gameState.shotClock as number | undefined,
      fouls: {
        home: (gameState.homeFouls as number) || 0,
        away: (gameState.awayFouls as number) || 0
      },
      source: 'ai_discovery',
      situationHash: this.generateSituationHash(gameState),
      originalMessage: `AI Discovery: ${this.sport} opportunity detected`,
      originalContext: gameState
    };
  }

  generateSituationHash(gameState: GameState): string {
    const parts = [
      gameState.gameId,
      gameState.period,
      this.getTimeMinutes(gameState.timeLeft as string | undefined),
      Math.floor((gameState.homeScore || 0) / 10),
      Math.floor((gameState.awayScore || 0) / 10)
    ].join('|');
    
    return this.hashString(parts);
  }

  private isStarPlayerInGame(gameState: GameState): boolean {
    const homeTeam = this.getTeamName(gameState.homeTeam);
    const awayTeam = this.getTeamName(gameState.awayTeam);
    const teams = `${homeTeam} ${awayTeam}`.toLowerCase();
    
    return this.STAR_PLAYERS.some(player => teams.includes(player.toLowerCase()));
  }

  private isCrunchTime(period: number, timeLeft: string): boolean {
    if (period < 4) return false;
    
    const minutes = this.getTimeMinutes(timeLeft);
    return minutes <= 2;
  }

  private getTimeMinutes(timeLeft?: string): number {
    if (!timeLeft) return 10;
    
    const match = timeLeft.match(/(\d+):(\d+)/);
    if (!match) return 10;
    
    return parseInt(match[1], 10);
  }

  private hasMomentumShift(gameState: GameState): boolean {
    const recentScoreDiff = (gameState.recentScoreDiff as number) || 0;
    
    return Math.abs(recentScoreDiff) >= 10;
  }
}
