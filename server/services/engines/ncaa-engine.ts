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
  sport: string; // 'football'
  conference: string;
  redZone: boolean;
  overtime: boolean;
  finalMinutes: boolean;
  down?: number;
  yardsToGo?: number;
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
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏈 NCAAF Engine initialized with ESPN API integration (College Football)');
  }

  // === ESPN API INTEGRATION ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const footballGames = await this.getCollegeFootballGames();
      console.log(`🏈 NCAAF: Found ${footballGames.length} games for today`);
      
      // Log game details for debugging
      footballGames.forEach(game => {
        console.log(`🏈 Game: ${game.awayTeam} @ ${game.homeTeam} - Status: ${game.status} - Date: ${game.gameDate}`);
      });
      
      return footballGames;
    } catch (error) {
      console.error('❌ ESPN NCAAF API Error:', error);
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
        sport: 'NCAAF',
        subSport: 'Football',
        startTime: game.date, // Add startTime for calendar compatibility
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN College Football API Error:', error);
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
        game.status === 'STATUS_OVERTIME' ||
        game.status === 'STATUS_FIRST_HALF' ||
        game.status === 'STATUS_SECOND_HALF' ||
        game.status.includes('QUARTER') ||
        game.status.includes('PERIOD')
      );

      // Also log games that are about to start or in pre-game
      const upcomingGames = games.filter(game => 
        game.status === 'STATUS_SCHEDULED' || 
        game.status === 'STATUS_PREGAME' ||
        game.status.includes('PREGAME')
      );

      if (upcomingGames.length > 0) {
        console.log(`🏈 NCAAF: ${upcomingGames.length} upcoming games:`);
        upcomingGames.forEach(game => {
          const gameTime = new Date(game.gameDate);
          const now = new Date();
          const timeUntilGame = Math.round((gameTime.getTime() - now.getTime()) / (1000 * 60));
          console.log(`🏈 ${game.awayTeam} @ ${game.homeTeam} - ${timeUntilGame} minutes until kickoff`);
        });
      }

      console.log(`🎯 NCAAF Engine Processing ${liveGames.length} live college football games`);

      for (const game of liveGames) {
        await this.processGameForAlerts(game);
      }

      this.cleanupOldDedupEntries();
    } catch (error) {
      console.error('❌ NCAAF Alert Processing Error:', error);
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

      return {
        gameId: game.gameId,
        period,
        timeRemaining,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        sport: 'football',
        conference: competition.conference?.name || 'Unknown',
        redZone: this.isRedZone(espnData),
        overtime: period > 4,
        finalMinutes: this.isFinalMinutes(timeRemaining, period),
        down: this.getDown(espnData),
        yardsToGo: this.getYardsToGo(espnData)
      };
    } catch (error) {
      console.error('❌ Error parsing NCAAF game state:', error);
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

  private isFinalMinutes(timeRemaining: string, period: number): boolean {
    if (!timeRemaining) return false;
    
    if (period < 4) return false; // Must be 4th quarter or later
    
    try {
      const [minutes] = timeRemaining.split(':').map(Number);
      return minutes <= 2;
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

    // Red Zone Alert
    if (gameState.redZone) {
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

    // Touchdown Alert (check for scoring plays)
    const isScoring = this.checkForTouchdown(gameState);
    if (isScoring) {
      alerts.push({
        type: 'touchdownAlert',
        priority: 92,
        description: `TOUCHDOWN! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
        reasons: ['Touchdown scored'],
        probability: 100,
        deduplicationKey: `${gameState.gameId}:touchdown:${gameState.period}:${gameState.homeScore + gameState.awayScore}`
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
        title: `NCAAF Alert`,
        description: alert.description,
        priority: alert.priority,
        sport: 'NCAAF',
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

      console.log(`📢 NCAAF Alert Sent: ${alert.type} - ${alert.description}`);
    } catch (error) {
      console.error('❌ Error sending NCAAF alert:', error);
    }
  }

  private checkForTouchdown(gameState: NCAAGameState): boolean {
    // Simple touchdown detection - would need more sophisticated logic with game state tracking
    // For now, just detect high-scoring situations that might indicate recent touchdowns
    const totalScore = gameState.homeScore + gameState.awayScore;
    return totalScore % 6 === 0 && totalScore > 0; // Basic touchdown detection
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

  // Add method for specific game processing (needed by engine manager)
  async processSpecificGame(gameId: string): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const targetGame = games.find(game => game.gameId === gameId);
      
      if (!targetGame) {
        console.log(`🏈 NCAAF: Game ${gameId} not found in today's games`);
        return;
      }

      await this.processGameForAlerts(targetGame);
    } catch (error) {
      console.error(`❌ NCAAF: Error processing specific game ${gameId}:`, error);
    }
  }

  // === PUBLIC METHODS ===

  async start(): Promise<void> {
    console.log('🚀 NCAAF Engine started');
  }

  async stop(): Promise<void> {
    console.log('🛑 NCAAF Engine stopped');
  }
}