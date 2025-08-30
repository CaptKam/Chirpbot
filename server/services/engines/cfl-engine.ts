import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

interface CFLGameState {
  gameId: string;
  quarter: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  redZone: boolean;
  overtime: boolean;
  finalMinutes: boolean;
  down: number;
  yardsToGo: number;
}

interface SimpleCFLAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  type: string;
}

export class CFLEngine {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/cfl';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏈 CFLEngine initialized with ESPN API integration');
  }

  // === ESPN API INTEGRATION ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const url = `${this.ESPN_API_BASE}/scoreboard`;
      
      const data: any = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data?.events || !Array.isArray(data.events)) {
        console.log('📅 No CFL games found');
        return [];
      }

      return data.events.map((game: any) => ({
        id: game.id,
        gameId: game.id,
        homeTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || '',
        awayTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || '',
        homeScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        status: game.status.type.name,
        gameDate: game.date, // ESPN returns ISO date string
        sport: 'CFL',
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN CFL API Error:', error);
      return [];
    }
  }

  async processLiveGamesOnly(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => 
        game.status === 'STATUS_IN_PROGRESS' || 
        game.status.toLowerCase().includes('quarter')
      );
      
      console.log(`🏈 CFL Engine Processing ${liveGames.length} live games`);
      
      for (const game of liveGames) {
        const gameState = this.extractGameState(game.espnData);
        if (gameState) {
          await this.checkGameSituations(gameState);
        }
      }
    } catch (error) {
      console.error('❌ CFL monitoring error:', error);
    }
  }

  async checkGameSituations(gameState: CFLGameState): Promise<void> {
    try {
      const alerts: SimpleCFLAlert[] = [];

      // Red zone alerts (within 20 yards of goal line)
      if (gameState.redZone) {
        alerts.push({
          priority: 85,
          description: `🚨 RED ZONE! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['Red zone opportunity', 'High scoring probability', 'Within 20 yards of goal'],
          probability: 0.8,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'RED_ZONE'),
          type: 'red_zone'
        });
      }

      // Close game alerts (within 3 points in 4th quarter)
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 3 && gameState.quarter >= 4) {
        alerts.push({
          priority: 90,
          description: `🏆 CLOSE GAME! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['Close game', `${gameState.quarter}${this.getOrdinalSuffix(gameState.quarter)} quarter`, 'Either team can win'],
          probability: 0.9,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'CLOSE_GAME'),
          type: 'close_game'
        });
      }

      // Overtime alerts
      if (gameState.overtime) {
        alerts.push({
          priority: 95,
          description: `⏰ OVERTIME! ${gameState.awayTeam} vs ${gameState.homeTeam} going to extra time`,
          reasons: ['Overtime period', 'Sudden death', 'High stakes CFL action'],
          probability: 1.0,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'OVERTIME'),
          type: 'overtime'
        });
      }

      // Final minutes alerts (under 2 minutes in 4th quarter)
      if (gameState.finalMinutes && gameState.quarter === 4) {
        alerts.push({
          priority: 88,
          description: `⏰ FINAL MINUTES! ${gameState.awayTeam} vs ${gameState.homeTeam} - ${gameState.timeRemaining} left`,
          reasons: ['Final 2 minutes', 'Crunch time', 'Game-deciding moments'],
          probability: 0.85,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'FINAL_MINUTES'),
          type: 'final_minutes'
        });
      }

      // Process all generated alerts
      for (const alert of alerts) {
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking CFL game situations:', error);
    }
  }

  // === HELPER METHODS ===

  private generateDeduplicationKey(gameState: CFLGameState, alertType: string): string {
    return `${gameState.gameId}:${alertType}:${gameState.quarter}:${Math.floor(this.parseTimeRemaining(gameState.timeRemaining) / 300)}`;
  }

  private shouldEmitAlert(alert: SimpleCFLAlert): boolean {
    const now = Date.now();
    const existing = this.deduplicationCache.get(alert.deduplicationKey);
    
    if (existing && now - existing.timestamp < 120000) { // 2-minute cooldown
      return false;
    }
    
    this.deduplicationCache.set(alert.deduplicationKey, {
      timestamp: now,
      priority: alert.priority
    });
    
    return true;
  }

  private async processAlert(alert: SimpleCFLAlert, gameState: CFLGameState): Promise<void> {
    try {
      const alertRecord = await storage.createAlert({
        title: `CFL ${alert.type.replace('_', ' ').toUpperCase()}`,
        description: alert.description,
        sport: 'CFL',
        type: alert.type,
        priority: alert.priority,
        gameInfo: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: {
            home: gameState.homeScore,
            away: gameState.awayScore
          },
          quarter: gameState.quarter.toString(),
          status: 'live'
        } as any
      });

      // Broadcast to WebSocket clients
      if (this.onAlert) {
        this.onAlert({
          type: 'alert',
          data: alertRecord
        });
      }

      console.log(`🏈 CFL Alert Generated: ${alert.description}`);
    } catch (error) {
      console.error('❌ Error processing CFL alert:', error);
    }
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j == 1 && k != 11) return 'st';
    if (j == 2 && k != 12) return 'nd';
    if (j == 3 && k != 13) return 'rd';
    return 'th';
  }

  extractGameState(espnData: any): CFLGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const status = competition.status;
      
      return {
        gameId: `cfl-${espnData.id}`,
        quarter: status.period || 1,
        timeRemaining: status.displayClock || "15:00",
        homeScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        redZone: false, // Would need detailed field position data
        overtime: status.period > 4,
        finalMinutes: status.period === 4 && this.parseTimeRemaining(status.displayClock || "0:00") <= 120, // 2 minutes
        down: 1, // Would need detailed play data
        yardsToGo: 10 // Would need detailed play data
      };
    } catch (error) {
      console.error('Error extracting CFL game state:', error);
      return null;
    }
  }
  
  private parseTimeRemaining(timeString: string): number {
    try {
      const parts = timeString.split(':');
      if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
      return 0;
    } catch {
      return 0;
    }
  }
}

export const cflEngine = new CFLEngine();