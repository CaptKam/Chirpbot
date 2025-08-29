import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

interface NCAAGameState {
  gameId: string;
  period: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  sport: string; // 'football' or 'basketball'
  conference: string;
  redZone: boolean;
  overtime: boolean;
  finalMinutes: boolean;
  clutchTime: boolean;
  down?: number; // Football only
  yardsToGo?: number; // Football only
}

interface SimpleNCAAAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  type: string;
}

export class NCAAEngine {
  private readonly ESPN_FOOTBALL_API = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
  private readonly ESPN_BASKETBALL_API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏈🏀 NCAAEngine initialized with ESPN API integration (Football & Basketball)');
  }

  // === ESPN API INTEGRATION ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const [footballGames, basketballGames] = await Promise.all([
        this.getCollegeFootballGames(),
        this.getCollegeBasketballGames()
      ]);

      return [...footballGames, ...basketballGames];
    } catch (error) {
      console.error('❌ ESPN NCAA API Error:', error);
      return [];
    }
  }

  private async getCollegeFootballGames(): Promise<any[]> {
    try {
      const url = `${this.ESPN_FOOTBALL_API}/scoreboard`;
      
      const data: any = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data?.events || !Array.isArray(data.events)) {
        console.log('📅 No NCAA Football games found');
        return [];
      }

      return data.events.map((game: any) => ({
        id: `cfb-${game.id}`,
        gameId: `cfb-${game.id}`,
        homeTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || '',
        awayTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || '',
        homeScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        status: game.status.type.name,
        gameDate: game.date, // ESPN returns ISO date string
        sport: 'NCAA',
        subSport: 'Football',
        startTime: game.date, // Add startTime for calendar compatibility
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN College Football API Error:', error);
      return [];
    }
  }

  private async getCollegeBasketballGames(): Promise<any[]> {
    try {
      const url = `${this.ESPN_BASKETBALL_API}/scoreboard`;
      
      const data: any = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data?.events || !Array.isArray(data.events)) {
        console.log('📅 No NCAA Basketball games found');
        return [];
      }

      return data.events.map((game: any) => ({
        id: `cbb-${game.id}`,
        gameId: `cbb-${game.id}`,
        homeTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || '',
        awayTeam: game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || '',
        homeScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        status: game.status.type.name,
        gameDate: game.date, // ESPN returns ISO date string
        sport: 'NCAA',
        subSport: 'Basketball',
        startTime: game.date, // Add startTime for calendar compatibility
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN College Basketball API Error:', error);
      return [];
    }
  }

  // === ALERT GENERATION ===

  async processGameAlerts(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => 
        game.status === 'STATUS_IN_PROGRESS' || 
        game.status === 'STATUS_HALFTIME' ||
        game.status === 'STATUS_OVERTIME'
      );

      console.log(`🎯 NCAA Engine Processing ${liveGames.length} live games`);

      for (const game of liveGames) {
        await this.processGameForAlerts(game);
      }

      this.cleanupOldDedupEntries();
    } catch (error) {
      console.error('❌ NCAA Alert Processing Error:', error);
    }
  }

  private async processGameForAlerts(game: any): Promise<void> {
    try {
      const gameState = this.parseGameState(game);
      if (!gameState) return;

      const alerts = this.generateAlertsForGame(gameState);
      
      for (const alert of alerts) {
        if (this.shouldSendAlert(alert)) {
          await this.sendAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing alerts for game ${game.id}:`, error);
    }
  }

  private parseGameState(game: any): NCAAGameState | null {
    try {
      const espnData = game.espnData;
      const competition = espnData.competitions[0];
      const status = espnData.status;

      // Extract period/quarter info
      let period = 0;
      let timeRemaining = '';
      
      if (status.period) {
        period = status.period;
      }
      
      if (status.displayClock) {
        timeRemaining = status.displayClock;
      }

      // Determine sport type and specific conditions
      const isFootball = game.subSport === 'Football';
      const isBasketball = game.subSport === 'Basketball';

      return {
        gameId: game.gameId,
        period,
        timeRemaining,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        sport: isFootball ? 'football' : 'basketball',
        conference: competition.conference?.name || 'Unknown',
        redZone: isFootball && this.isRedZone(espnData),
        overtime: period > (isFootball ? 4 : 2),
        finalMinutes: this.isFinalMinutes(timeRemaining, period, isFootball),
        clutchTime: isBasketball && this.isClutchTime(timeRemaining, period, game.homeScore, game.awayScore),
        down: isFootball ? this.getDown(espnData) : undefined,
        yardsToGo: isFootball ? this.getYardsToGo(espnData) : undefined
      };
    } catch (error) {
      console.error('❌ Error parsing NCAA game state:', error);
      return null;
    }
  }

  private isRedZone(espnData: any): boolean {
    try {
      const situation = espnData.competitions[0]?.situation;
      if (!situation) return false;
      
      const yardLine = situation.yardLine;
      const isRedZone = situation.isRedZone;
      
      return isRedZone || (yardLine && yardLine <= 20);
    } catch {
      return false;
    }
  }

  private isFinalMinutes(timeRemaining: string, period: number, isFootball: boolean): boolean {
    if (!timeRemaining) return false;
    
    const maxPeriod = isFootball ? 4 : 2;
    if (period < maxPeriod) return false;
    
    try {
      const [minutes] = timeRemaining.split(':').map(Number);
      return minutes <= 2;
    } catch {
      return false;
    }
  }

  private isClutchTime(timeRemaining: string, period: number, homeScore: number, awayScore: number): boolean {
    if (period < 2) return false; // Must be 2nd half
    
    const scoreDiff = Math.abs(homeScore - awayScore);
    if (scoreDiff > 5) return false; // Must be close game
    
    try {
      const [minutes] = timeRemaining.split(':').map(Number);
      return minutes <= 5; // Final 5 minutes
    } catch {
      return false;
    }
  }

  private getDown(espnData: any): number {
    try {
      return espnData.competitions[0]?.situation?.down || 0;
    } catch {
      return 0;
    }
  }

  private getYardsToGo(espnData: any): number {
    try {
      return espnData.competitions[0]?.situation?.distance || 0;
    } catch {
      return 0;
    }
  }

  private generateAlertsForGame(gameState: NCAAGameState): SimpleNCAAAlert[] {
    const alerts: SimpleNCAAAlert[] = [];

    // Red Zone Alert (Football)
    if (gameState.sport === 'football' && gameState.redZone) {
      alerts.push({
        type: 'redZone',
        priority: 85,
        description: `${gameState.awayTeam} in the red zone vs ${gameState.homeTeam}`,
        reasons: ['Team driving inside the 20-yard line'],
        probability: 75,
        deduplicationKey: `${gameState.gameId}:redZone:${gameState.period}`
      });
    }

    // Close Game Alert
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    if (scoreDiff <= 3 && gameState.finalMinutes) {
      alerts.push({
        type: 'closeGame',
        priority: 90,
        description: `Close game! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
        reasons: [`${scoreDiff}-point game in final minutes`],
        probability: 85,
        deduplicationKey: `${gameState.gameId}:closeGame:${gameState.period}`
      });
    }

    // Overtime Alert
    if (gameState.overtime) {
      alerts.push({
        type: 'overtime',
        priority: 95,
        description: `OVERTIME: ${gameState.awayTeam} vs ${gameState.homeTeam}`,
        reasons: ['Game has gone to overtime'],
        probability: 100,
        deduplicationKey: `${gameState.gameId}:overtime:${gameState.period}`
      });
    }

    // Clutch Time Alert (Basketball)
    if (gameState.sport === 'basketball' && gameState.clutchTime) {
      alerts.push({
        type: 'clutchTime',
        priority: 88,
        description: `Clutch time! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
        reasons: ['Close game in final minutes'],
        probability: 80,
        deduplicationKey: `${gameState.gameId}:clutchTime:${gameState.period}`
      });
    }

    // Final Minutes Alert
    if (gameState.finalMinutes) {
      alerts.push({
        type: 'finalMinutes',
        priority: 80,
        description: `Final minutes: ${gameState.awayTeam} vs ${gameState.homeTeam}`,
        reasons: ['Game in final minutes'],
        probability: 70,
        deduplicationKey: `${gameState.gameId}:finalMinutes:${gameState.period}`
      });
    }

    return alerts;
  }

  private shouldSendAlert(alert: SimpleNCAAAlert): boolean {
    const existing = this.deduplicationCache.get(alert.deduplicationKey);
    const now = Date.now();
    
    if (!existing) {
      this.deduplicationCache.set(alert.deduplicationKey, { timestamp: now, priority: alert.priority });
      return true;
    }
    
    const timeDiff = now - existing.timestamp;
    const isHigherPriority = alert.priority > existing.priority;
    
    // Send if higher priority or enough time has passed
    if (isHigherPriority || timeDiff > 180000) { // 3 minutes
      this.deduplicationCache.set(alert.deduplicationKey, { timestamp: now, priority: alert.priority });
      return true;
    }
    
    return false;
  }

  private async sendAlert(alert: SimpleNCAAAlert, gameState: NCAAGameState): Promise<void> {
    try {
      const alertData = {
        id: randomUUID(),
        type: alert.type,
        title: `NCAA ${gameState.sport.toUpperCase()} Alert`,
        description: alert.description,
        priority: alert.priority,
        sport: 'NCAA',
        gameInfo: {
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: {
            home: gameState.homeScore,
            away: gameState.awayScore
          },
          period: gameState.period,
          timeRemaining: gameState.timeRemaining,
          conference: gameState.conference
        },
        timestamp: new Date(),
        confidence: alert.probability,
        reasons: alert.reasons,
        seen: false
      };

      // Store alert in database
      await storage.createAlert(alertData);

      // Send Telegram notification
      await sendTelegramAlert(alertData);

      // Call alert callback if available
      if (this.onAlert) {
        this.onAlert(alertData);
      }

      console.log(`📢 NCAA Alert Sent: ${alert.type} - ${alert.description}`);
    } catch (error) {
      console.error('❌ Error sending NCAA alert:', error);
    }
  }

  private cleanupOldDedupEntries(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, entry] of this.deduplicationCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  // === PUBLIC METHODS ===

  async start(): Promise<void> {
    console.log('🚀 NCAA Engine started');
  }

  async stop(): Promise<void> {
    console.log('🛑 NCAA Engine stopped');
  }
}