import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

interface NFLGameState {
  gameId: string;
  quarter: number;
  timeRemaining: string;
  possession: string;
  down: number;
  yardsToGo: number;
  yardLine: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  redZone: boolean;
  twoMinuteWarning: boolean;
}

interface SimpleNFLAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  type: string;
}

export class NFLEngine {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏈 NFLEngine initialized with ESPN API integration');
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
        console.log('📅 No NFL games found');
        return [];
      }

      return (data.events as any[]).map((game: any) => ({
        id: game.id,
        gameId: game.id,
        homeTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || '',
        awayTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || '',
        homeScore: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || 0,
        awayScore: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || 0,
        status: game.status.type.name,
        gameDate: game.date,
        sport: 'NFL',
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN NFL API Error:', error);
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
      
      console.log(`🏈 NFL Engine Processing ${liveGames.length} live games`);
      
      for (const game of liveGames) {
        const gameState = this.extractGameState(game.espnData);
        if (gameState) {
          await this.checkGameSituations(gameState);
        }
      }
    } catch (error) {
      console.error('❌ NFL monitoring error:', error);
    }
  }

  async checkGameSituations(gameState: NFLGameState): Promise<void> {
    try {
      const alerts: SimpleNFLAlert[] = [];

      // Close game alerts
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 7 && gameState.quarter >= 3) {
        alerts.push({
          priority: 85,
          description: `🏈 ONE SCORE GAME! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['One score difference', `Quarter ${gameState.quarter}`, 'High leverage situation'],
          probability: 0.85,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'CLOSE_GAME'),
          type: 'close_game'
        });
      }

      // Red zone alerts
      if (gameState.redZone && gameState.quarter >= 2) {
        alerts.push({
          priority: 90,
          description: `🚨 RED ZONE ALERT! ${gameState.possession} in scoring position`,
          reasons: ['Red zone possession', 'High scoring probability', `${gameState.down} down and ${gameState.yardsToGo}`],
          probability: 0.9,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'RED_ZONE'),
          type: 'red_zone'
        });
      }

      // Fourth down situations
      if (gameState.down === 4 && gameState.quarter >= 3 && gameState.yardsToGo <= 3) {
        alerts.push({
          priority: 95,
          description: `🎯 4TH DOWN! ${gameState.possession} ${gameState.yardsToGo} yards to go`,
          reasons: ['4th down decision', 'Short distance', 'Critical game moment'],
          probability: 0.9,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'FOURTH_DOWN'),
          type: 'fourth_down'
        });
      }

      // Two minute warning
      if (gameState.twoMinuteWarning && Math.abs(gameState.homeScore - gameState.awayScore) <= 10) {
        alerts.push({
          priority: 100,
          description: `⏰ TWO MINUTE WARNING! Crunch time in close game`,
          reasons: ['Two minute warning', 'Close score', 'Game on the line'],
          probability: 1.0,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'TWO_MINUTE'),
          type: 'two_minute_warning'
        });
      }

      // Process all generated alerts
      for (const alert of alerts) {
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking NFL game situations:', error);
    }
  }
  private generateDeduplicationKey(gameState: NFLGameState, alertType: string): string {
    return `${gameState.gameId}:${alertType}:${gameState.quarter}:${gameState.down}:${gameState.possession}`;
  }

  private shouldEmitAlert(alert: SimpleNFLAlert): boolean {
    const now = Date.now();
    const cached = this.deduplicationCache.get(alert.deduplicationKey);
    
    if (cached && (now - cached.timestamp) < 120000) { // 2 minute cooldown for NFL
      return false;
    }
    
    return true;
  }

  private recordAlertEmission(alert: SimpleNFLAlert): void {
    this.deduplicationCache.set(alert.deduplicationKey, {
      timestamp: Date.now(),
      priority: alert.priority
    });
    
    // Cleanup old entries
    if (this.deduplicationCache.size > 1000) {
      const now = Date.now();
      const entries = Array.from(this.deduplicationCache.entries());
      for (const [key, value] of entries) {
        if (now - value.timestamp > 3600000) { // 1 hour cleanup
          this.deduplicationCache.delete(key);
        }
      }
    }
  }

  private buildKidFriendlyTitle(alertType: string, gameState: NFLGameState): string {
    switch (alertType) {
      case 'red_zone':
        return '🚨 RED ZONE! Team is close to scoring!';
      case 'close_game':
        return '🔥 SUPER CLOSE! Only one touchdown apart!';
      case 'fourth_down':
        return '💥 4TH DOWN! Big decision time!';
      case 'two_minute_warning':
        return '⏰ FINAL 2 MINUTES! Crunch time!';
      default:
        return '🏈 NFL ACTION! Something exciting is happening!';
    }
  }

  private async processAlert(alert: SimpleNFLAlert, gameState: NFLGameState): Promise<void> {
    try {
      this.recordAlertEmission(alert);

      // Use kid-friendly title
      const kidFriendlyTitle = this.buildKidFriendlyTitle(alert.type, gameState);

      const alertRecord = await storage.createAlert({
        title: kidFriendlyTitle,
        description: alert.description,
        sport: 'NFL',
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
          type: 'new_alert',
          alert: alertRecord
        });
      }

      console.log(`✅ NFL Alert generated: ${alert.description}`);
    } catch (error) {
      console.error('❌ Error processing NFL alert:', error);
    }
  }
  
  extractGameState(espnData: any): NFLGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const situation = competition.situation || {};
      const status = competition.status || {};
      const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');
      
      const possessionTeam = situation.possession ? 
        homeTeam?.id === situation.possession ? homeTeam.team.displayName : awayTeam?.team.displayName 
        : "";
      
      return {
        gameId: `nfl-${espnData.id}`,
        quarter: status.period || 1,
        timeRemaining: status.displayClock || "15:00",
        possession: possessionTeam || "",
        down: situation.down || 1,
        yardsToGo: situation.distance || 10,
        yardLine: situation.yardLine?.toString() || "50",
        homeScore: parseInt(homeTeam?.score) || 0,
        awayScore: parseInt(awayTeam?.score) || 0,
        homeTeam: homeTeam?.team.displayName || "",
        awayTeam: awayTeam?.team.displayName || "",
        redZone: (situation.yardLine || 100) <= 20,
        twoMinuteWarning: status.displayClock === "2:00" && status.period >= 2
      };
    } catch (error) {
      console.error('Error extracting NFL game state:', error);
      return null;
    }
  }

  // === SPECIFIC GAME PROCESSING ===

  async processSpecificGame(gameId: string): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const targetGame = games.find(game => game.gameId === gameId || game.id === gameId);
      
      if (!targetGame) {
        console.log(`🏈 NFL: Game ${gameId} not found in today's games`);
        return;
      }

      const gameState = this.extractGameState(targetGame.espnData);
      if (gameState) {
        await this.checkGameSituations(gameState);
      }
    } catch (error) {
      console.error(`❌ NFL: Error processing specific game ${gameId}:`, error);
    }
  }

  // === MONITORING METHODS ===

  async startMonitoring(): Promise<void> {
    console.log('🏈 Starting NFL monitoring with ESPN API...');
    
    setInterval(async () => {
      await this.processLiveGamesOnly();
    }, 30000); // 30 second interval for NFL
  }
}

export const nflEngine = new NFLEngine();