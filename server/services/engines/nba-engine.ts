import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

interface NBAGameState {
  gameId: string;
  period: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  clutchTime: boolean;
  overtime: boolean;
}

interface SimpleNBAAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  type: string;
}

export class NBAEngine {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏀 NBAEngine initialized with ESPN API integration');
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
        console.log('📅 No NBA games found');
        return [];
      }

      return data.events.map((game: any) => ({
        id: game.id,
        gameId: game.id,
        homeTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || '',
        awayTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || '',
        homeScore: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
        awayScore: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
        status: game.status.type.name,
        gameDate: game.date,
        sport: 'NBA',
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN NBA API Error:', error);
      return [];
    }
  }

  async processLiveGamesOnly(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => 
        game.status === 'STATUS_IN_PROGRESS' || 
        game.status.toLowerCase().includes('period') ||
        game.status.toLowerCase().includes('quarter')
      );
      
      console.log(`🏀 NBA Engine Processing ${liveGames.length} live games`);
      
      for (const game of liveGames) {
        const gameState = this.extractGameState(game.espnData);
        if (gameState) {
          await this.checkGameSituations(gameState);
        }
      }
    } catch (error) {
      console.error('❌ NBA monitoring error:', error);
    }
  }

  async checkGameSituations(gameState: NBAGameState): Promise<void> {
    try {
      const alerts: SimpleNBAAlert[] = [];

      // Clutch time alerts (under 5 minutes in close game)
      if (gameState.clutchTime && Math.abs(gameState.homeScore - gameState.awayScore) <= 5) {
        alerts.push({
          priority: 90,
          description: `🏀 CLUTCH TIME! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['Under 5 minutes remaining', 'Close game (≤5 point spread)', 'High leverage situation'],
          probability: 0.9,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'CLUTCH_TIME'),
          type: 'clutch_time'
        });
      }

      // Overtime alerts
      if (gameState.overtime) {
        alerts.push({
          priority: 95,
          description: `⚡ OVERTIME! ${gameState.awayTeam} vs ${gameState.homeTeam} going to extra time`,
          reasons: ['Overtime period', 'Extended game action', 'Betting implications'],
          probability: 1.0,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'OVERTIME'),
          type: 'overtime'
        });
      }

      // Close game alerts
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 3 && gameState.period >= 2) {
        alerts.push({
          priority: 85,
          description: `🔥 TIGHT CONTEST! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['3-point game or less', `${gameState.period}${this.getOrdinalSuffix(gameState.period)} period`, 'Anyone can win'],
          probability: 0.85,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'CLOSE_GAME'),
          type: 'close_game'
        });
      }

      // Process all generated alerts
      for (const alert of alerts) {
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking NBA game situations:', error);
    }
  }

  // === HELPER METHODS ===

  private generateDeduplicationKey(gameState: NBAGameState, alertType: string): string {
    return `${gameState.gameId}:${alertType}:${gameState.period}:${Math.floor(this.parseTimeRemaining(gameState.timeRemaining) / 300)}`;
  }

  private shouldEmitAlert(alert: SimpleNBAAlert): boolean {
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

  private buildKidFriendlyTitle(alertType: string, gameState: NBAGameState): string {
    switch (alertType) {
      case 'clutch_time':
        return '🔥 CLUTCH TIME! Final minutes of close game!';
      case 'overtime':
        return '⚡ OVERTIME! Extra basketball action!';
      case 'close_game':
        return '🏀 NAIL-BITER! Super close game!';
      default:
        return '🏀 NBA ACTION! Something exciting is happening!';
    }
  }

  private async processAlert(alert: SimpleNBAAlert, gameState: NBAGameState): Promise<void> {
    try {
      // Use kid-friendly title
      const kidFriendlyTitle = this.buildKidFriendlyTitle(alert.type, gameState);

      const alertRecord = await storage.createAlert({
        title: kidFriendlyTitle,
        description: alert.description,
        sport: 'NBA',
        type: alert.type,
        priority: alert.priority,
        gameInfo: {
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: {
            home: gameState.homeScore,
            away: gameState.awayScore
          },
          period: gameState.period.toString(),
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

      console.log(`🏀 NBA Alert Generated: ${alert.description}`);
    } catch (error) {
      console.error('❌ Error processing NBA alert:', error);
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
  
  
  extractGameState(espnData: any): NBAGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const status = competition.status;
      
      return {
        gameId: `nba-${espnData.id}`,
        period: status.period || 1,
        timeRemaining: status.displayClock || "12:00",
        homeScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        clutchTime: status.period === 4 && this.parseTimeRemaining(status.displayClock || "0:00") <= 300, // 5 minutes
        overtime: status.period > 4
      };
    } catch (error) {
      console.error('Error extracting NBA game state:', error);
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

export const nbaEngine = new NBAEngine();