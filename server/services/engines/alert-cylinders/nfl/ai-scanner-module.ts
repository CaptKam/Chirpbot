import { BaseAIScanner } from '../ai-opportunity-scanner';
import { GameState } from '../../base-engine';
import type { CrossSportContext } from '../../../unified-ai-processor';

export default class NFLAIScannerModule extends BaseAIScanner {
  alertType = 'NFL_AI_SCANNER';
  sport = 'NFL';

  private readonly STAR_QBS = [
    'Mahomes', 'Allen', 'Burrow', 'Hurts', 'Stroud', 'Jackson',
    'Herbert', 'Lawrence', 'Tagovailoa', 'Prescott', 'Purdy'
  ];

  checkSmartGate(gameState: GameState): boolean {
    const hasStarQB = this.isStarQBPlaying(gameState);
    if (!hasStarQB) return false;

    const fieldPos = (gameState.fieldPosition as number) || 100;
    const isRedZone = fieldPos <= 20;
    const isFourthDown = (gameState.down as number) === 4;
    const isTwoMinuteWarning = this.isTwoMinuteWarning(gameState);
    const hasCriticalSituation = isRedZone || isFourthDown || isTwoMinuteWarning;
    if (!hasCriticalSituation) return false;

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const isCloseGame = scoreDiff <= 10;

    return isCloseGame;
  }

  buildAIContext(gameState: GameState): CrossSportContext {
    const weather = gameState.weather as { 
      temperature?: number; 
      condition?: string; 
      windSpeed?: number; 
      humidity?: number; 
      impact?: string;
    } | undefined;

    const fieldPos = (gameState.fieldPosition as number) || 100;

    return {
      sport: 'NFL',
      gameId: gameState.gameId,
      alertType: this.alertType,
      priority: 80,
      probability: 80,
      homeTeam: this.getTeamName(gameState.homeTeam),
      awayTeam: this.getTeamName(gameState.awayTeam),
      homeScore: gameState.homeScore || 0,
      awayScore: gameState.awayScore || 0,
      isLive: gameState.isLive,
      quarter: gameState.quarter as number | undefined,
      down: gameState.down as number | undefined,
      yardsToGo: gameState.yardsToGo as number | undefined,
      fieldPosition: gameState.fieldPosition as number | undefined,
      possession: gameState.possession as string | undefined,
      timeRemaining: gameState.timeRemaining as string | undefined,
      redZone: fieldPos <= 20,
      goalLine: fieldPos <= 5,
      weather: weather ? {
        temperature: weather.temperature || 70,
        condition: weather.condition || 'Clear',
        windSpeed: weather.windSpeed,
        humidity: weather.humidity,
        impact: weather.impact
      } : undefined,
      source: 'ai_discovery',
      situationHash: this.generateSituationHash(gameState),
      originalMessage: `AI Discovery: ${this.sport} opportunity detected`,
      originalContext: gameState
    };
  }

  generateSituationHash(gameState: GameState): string {
    const fieldPos = (gameState.fieldPosition as number) || 100;
    const parts = [
      gameState.gameId,
      gameState.quarter,
      gameState.down,
      Math.floor(fieldPos / 10),
      Math.floor((gameState.homeScore || 0) / 7),
      Math.floor((gameState.awayScore || 0) / 7),
      (gameState.possession as string) || 'unknown'
    ].join('|');
    
    return this.hashString(parts);
  }

  private isStarQBPlaying(gameState: GameState): boolean {
    const homeTeam = this.getTeamName(gameState.homeTeam);
    const awayTeam = this.getTeamName(gameState.awayTeam);
    const teams = `${homeTeam} ${awayTeam}`.toLowerCase();
    
    return this.STAR_QBS.some(qb => teams.includes(qb.toLowerCase()));
  }

  private isTwoMinuteWarning(gameState: GameState): boolean {
    const quarter = (gameState.quarter as number) || 0;
    if (quarter !== 2 && quarter !== 4) return false;
    
    const timeStr = (gameState.timeRemaining as string) || '';
    const match = timeStr.match(/(\d+):(\d+)/);
    if (!match) return false;
    
    const minutes = parseInt(match[1], 10);
    return minutes <= 2;
  }
}
