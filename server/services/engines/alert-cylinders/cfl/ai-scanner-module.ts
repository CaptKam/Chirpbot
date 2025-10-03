import { BaseAIScanner } from '../ai-opportunity-scanner';
import { GameState } from '../../base-engine';
import type { CrossSportContext } from '../../../unified-ai-processor';

export default class CFLAIScannerModule extends BaseAIScanner {
  alertType = 'CFL_AI_SCANNER';
  sport = 'CFL';

  checkSmartGate(gameState: GameState): boolean {
    const isThirdDown = (gameState.down as number) === 3;
    const hasRougeOpportunity = this.hasRougeOpportunity(gameState);
    const isLateGame = this.isLateGame(gameState);
    const hasCriticalSituation = isThirdDown || hasRougeOpportunity || isLateGame;
    if (!hasCriticalSituation) return false;

    const scoreDiff = Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0));
    const isCloseGame = scoreDiff <= 9;

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

    const fieldPos = (gameState.fieldPosition as number) || 110;

    return {
      sport: 'CFL',
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
    const fieldPos = (gameState.fieldPosition as number) || 110;
    const parts = [
      gameState.gameId,
      gameState.quarter,
      gameState.down,
      Math.floor(fieldPos / 10),
      Math.floor((gameState.homeScore || 0) / 5),
      Math.floor((gameState.awayScore || 0) / 5),
      (gameState.possession as string) || 'unknown'
    ].join('|');
    
    return this.hashString(parts);
  }

  private hasRougeOpportunity(gameState: GameState): boolean {
    const fieldPos = (gameState.fieldPosition as number) || 110;
    return fieldPos >= 35 && fieldPos <= 55;
  }

  private isLateGame(gameState: GameState): boolean {
    const quarter = (gameState.quarter as number) || 0;
    if (quarter !== 4) return false;
    
    const timeStr = (gameState.timeRemaining as string) || '';
    const match = timeStr.match(/(\d+):(\d+)/);
    if (!match) return false;
    
    const minutes = parseInt(match[1], 10);
    return minutes <= 3;
  }
}
