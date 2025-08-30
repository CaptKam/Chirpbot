import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

interface NHLGameState {
  gameId: string;
  period: number;
  timeRemaining: string;
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  powerPlay: boolean;
  emptyNet: boolean;
  overtime: boolean;
  finalMinutes: boolean;
}

interface SimpleNHLAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
  type: string;
}

export class NHLEngine {
  private readonly ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  
  onAlert?: (alert: any) => void;

  constructor() {
    console.log('🏒 NHLEngine initialized with ESPN API integration');
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
        console.log('📅 No NHL games found');
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
        gameDate: game.date,
        sport: 'NHL',
        espnData: game // Store full ESPN data for detailed parsing
      }));
    } catch (error) {
      console.error('❌ ESPN NHL API Error:', error);
      return [];
    }
  }

  async processLiveGamesOnly(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => 
        game.status === 'STATUS_IN_PROGRESS' || 
        game.status.toLowerCase().includes('period')
      );
      
      console.log(`🏒 NHL Engine Processing ${liveGames.length} live games`);
      
      for (const game of liveGames) {
        const gameState = this.extractGameState(game.espnData);
        if (gameState) {
          await this.checkGameSituations(gameState);
        }
      }
    } catch (error) {
      console.error('❌ NHL monitoring error:', error);
    }
  }

  async checkGameSituations(gameState: NHLGameState): Promise<void> {
    try {
      const alerts: SimpleNHLAlert[] = [];

      // Power play alerts
      if (gameState.powerPlay) {
        alerts.push({
          priority: 85,
          description: `⚡ POWER PLAY! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['Man advantage opportunity', 'High scoring probability', 'Power play active'],
          probability: 0.9,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'POWER_PLAY'),
          type: 'power_play'
        });
      }

      // Empty net alerts
      if (gameState.emptyNet) {
        alerts.push({
          priority: 95,
          description: `😨 EMPTY NET! ${gameState.awayTeam} vs ${gameState.homeTeam} goalie pulled`,
          reasons: ['Goalie pulled', 'Extra attacker', 'Desperation time'],
          probability: 1.0,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'EMPTY_NET'),
          type: 'empty_net'
        });
      }

      // Close game alerts
      if (Math.abs(gameState.homeScore - gameState.awayScore) <= 1 && gameState.period >= 2) {
        alerts.push({
          priority: 80,
          description: `🏆 ONE-GOAL GAME! ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
          reasons: ['One-goal difference', `${gameState.period}${this.getOrdinalSuffix(gameState.period)} period`, 'Anyone can win'],
          probability: 0.8,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'CLOSE_GAME'),
          type: 'close_game'
        });
      }

      // Overtime alerts
      if (gameState.overtime) {
        alerts.push({
          priority: 90,
          description: `⏰ OVERTIME! ${gameState.awayTeam} vs ${gameState.homeTeam} going to extra time`,
          reasons: ['Overtime period', 'Sudden death', 'High stakes'],
          probability: 1.0,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'OVERTIME'),
          type: 'overtime'
        });
      }

      // Process all generated alerts
      for (const alert of alerts) {
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking NHL game situations:', error);
    }
  }

  // === HELPER METHODS ===

  private generateDeduplicationKey(gameState: NHLGameState, alertType: string): string {
    return `${gameState.gameId}:${alertType}:${gameState.period}:${Math.floor(this.parseTimeRemaining(gameState.timeRemaining) / 300)}`;
  }

  private shouldEmitAlert(alert: SimpleNHLAlert): boolean {
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

  private async processAlert(alert: SimpleNHLAlert, gameState: NHLGameState): Promise<void> {
    try {
      // Generate alert ID for debugging (matching MLB system)
      const alertId = randomUUID();
      console.log(`🆔 NHL: Generating alert with ID: ${alertId} | Type: ${alert.type}`);

      // Build kid-friendly description (Law #6 compliance)
      const kidFriendlyDescription = this.buildKidFriendlyDescription(alert, gameState);
      const kidFriendlyTitle = this.buildKidFriendlyTitle(alert.type, gameState);

      const alertRecord = await storage.createAlert({
        id: alertId,
        debugId: alertId.substring(0, 8), // Short ID for easy debugging
        title: kidFriendlyTitle,
        description: kidFriendlyDescription,
        sport: 'NHL',
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
        } as any,
        createdAt: new Date(),
        seen: false
      });

      // Broadcast to WebSocket clients
      if (this.onAlert) {
        this.onAlert({
          type: 'new_alert',
          data: alertRecord
        });
        console.log(`📡 NHL: Alert broadcasted via WebSocket | ID: ${alertId.substring(0, 8)}`);
      }

      console.log(`✅ NHL Alert generated: ${kidFriendlyDescription} (Priority: ${alert.priority})`);
      console.log(`🆔 NHL: Alert ID: ${alertId} | Debug ID: ${alertId.substring(0, 8)} | Type: ${alert.type}`);
    } catch (error) {
      console.error('❌ Error processing NHL alert:', error);
    }
  }

  // Kid-friendly alert descriptions (Law #6 compliance)
  private buildKidFriendlyDescription(alert: SimpleNHLAlert, gameState: NHLGameState): string {
    const teamVs = `${gameState.awayTeam} vs ${gameState.homeTeam}`;
    const score = `${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`;
    const period = this.getPeriodName(gameState.period);
    
    switch (alert.type) {
      case 'power_play':
        return `⚡ POWER PLAY! One team has extra players on the ice!

Score: ${score}
Time: ${period} (${gameState.timeRemaining} left)
What's happening: One team has a player advantage - great chance to score!

🏒 More players = more chances to score!`;

      case 'empty_net':
        return `😨 EMPTY NET! The goalie is gone!

Score: ${score}
Time: ${period} (${gameState.timeRemaining} left)
What's happening: One team pulled their goalie for an extra player!
Why it matters: Open net = easy goal if the other team gets the puck!

🥅 It's like playing with no goalkeeper!`;

      case 'close_game':
        return `🏆 ONE-GOAL GAME! Super close hockey action!

Score: ${score}
Time: ${period} (${gameState.timeRemaining} left)
Why it's exciting: Just one goal separates these teams!

⚡ Any shot could be the game winner!`;

      case 'overtime':
        return `⏰ OVERTIME! Extra hockey time!

Score: ${score} (TIED!)
What happened: The game was tied - now they play extra time!
How it works: First team to score wins instantly!

🔥 Sudden death hockey - the most exciting kind!`;

      default:
        return `🏒 EXCITING PLAY in ${teamVs}!

Score: ${score}
Time: ${period}
Something big is happening on the ice!`;
    }
  }

  private buildKidFriendlyTitle(alertType: string, gameState: NHLGameState): string {
    const teamVs = `${gameState.awayTeam} vs ${gameState.homeTeam}`;
    
    switch (alertType) {
      case 'power_play':
        return `⚡ POWER PLAY! Extra player advantage!`;
      case 'empty_net':
        return `😨 EMPTY NET! Goalie pulled!`;
      case 'close_game':
        return `🏆 ONE-GOAL GAME! ${teamVs}`;
      case 'overtime':
        return `⏰ OVERTIME! ${teamVs}`;
      default:
        return `🏒 EXCITING PLAY! ${teamVs}`;
    }
  }

  private getPeriodName(period: number): string {
    switch (period) {
      case 1: return '1st Period';
      case 2: return '2nd Period';
      case 3: return '3rd Period';
      default: return period > 3 ? 'Overtime' : `Period ${period}`;
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
  
  
  extractGameState(espnData: any): NHLGameState | null {
    try {
      const competition = espnData.competitions?.[0];
      if (!competition) return null;
      
      const status = competition.status;
      
      return {
        gameId: `nhl-${espnData.id}`,
        period: status.period || 1,
        timeRemaining: status.displayClock || "20:00",
        homeScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
        awayScore: parseInt(competition.competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
        homeTeam: competition.competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || "",
        awayTeam: competition.competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || "",
        powerPlay: false, // Would need detailed NHL API for real power play detection
        emptyNet: false, // Would need detailed NHL API for real empty net detection
        overtime: status.period > 3,
        finalMinutes: status.period === 3 && this.parseTimeRemaining(status.displayClock || "0:00") <= 300 // 5 minutes
      };
    } catch (error) {
      console.error('Error extracting NHL game state:', error);
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

export const nhlEngine = new NHLEngine();