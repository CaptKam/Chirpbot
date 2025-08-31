import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

// Import OpenAI and Betbook engines for alert processing
import { OpenAiEngine } from './OpenAiEngine';
import { getBetbookData } from './betbook-engine';

// Import NCAAF Alert Model (CommonJS module)
import ncaafAlertModel from './NCAAFAlertModel.cjs';

// Import AlertFormatValidator and SimpleAlert types from the new structure
import { NCAAFGameStateV3, SimpleAlert } from './index';
import { AlertFormatValidator } from './AlertFormatValidator';


// Type declaration for NCAAFAlertModelType
interface NCAAFAlertModelType {
  checkNCAAFAlerts(gameState: any): any;
  ncaafL1Alert(gameState: any): any;
  ncaafL2Alert(gameState: any): any;
  ncaafL3Alert(gameState: any): any;
}

let ncaafAlertModelInstance: NCAAFAlertModelType | null = null;


export class NCAAFEngine {
  private readonly ESPN_FOOTBALL_API = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  private static alertContentCache: Map<string, number> = new Map(); // Track alert content by hash

  onAlert?: (alert: any) => void;

  // OpenAI engine instance for alert description generation (conditional)
  private readonly openAiEngine: OpenAiEngine | null;

  // Game state cache for tracking changes
  private gameStateCache = new Map<string, NCAAGameState>();
  
  // New state for the refactored engine
  private gameStates = new Map<string, NCAAFGameStateV3>();
  private lastAlerts = new Map<string, string>();


  constructor() {
    console.log('🏈 NCAAF Engine initialized with ESPN API integration (College Football)');
    // Do NOT initialize OpenAI engine - completely disabled
    this.openAiEngine = null;
    console.log('🚫 AI completely disabled in NCAAF engine');
    // Load the NCAAF Alert Model
    this.loadNCAAFAlertModel();
  }

  private async loadNCAAFAlertModel() {
    try {
      if (!ncaafAlertModelInstance) {
        ncaafAlertModelInstance = ncaafAlertModel as any as NCAAFAlertModelType;
      }
    } catch (error) {
      console.error('Failed to load NCAAF Alert Model:', error);
    }
  }

  private createContentHash(content: string): string {
    // Simple hash function for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getCooldownTime(alertType: string): number {
    // Cooldown times in milliseconds
    switch (alertType) {
      case 'ncaafGameLive': return 2 * 60 * 1000; // 2 minutes for basic live alerts
      case 'ncaafRedZone': return 5 * 60 * 1000;   // 5 minutes for red zone (reduced frequency)
      case 'ncaafFourthDown': return 30 * 1000; // 30 seconds for 4th down
      case 'ncaafCloseGame': return 1 * 60 * 1000;  // 1 minute for close games
      default: return 2 * 60 * 1000; // 2 minutes default
    }
  }

  private formatPeriod(period: number): string {
    switch (period) {
      case 1: return '1st Quarter';
      case 2: return '2nd Quarter';
      case 3: return '3rd Quarter';
      case 4: return '4th Quarter';
      default: return period > 4 ? 'OT' : 'Pre-Game';
    }
  }

  // === ESPN API INTEGRATION ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const footballGames = await this.getCollegeFootballGames(targetDate);
      console.log(`🏈 NCAAF: Found ${footballGames.length} games for ${targetDate}`);

      // Log game details for debugging and check for military academies
      footballGames.forEach(game => {
        const isMilitaryGame = /army|navy|air force|coast guard|military/i.test(`${game.awayTeam} ${game.homeTeam}`);
        if (isMilitaryGame) {
          console.log(`⚔️ MILITARY ACADEMY GAME: ${game.awayTeam} @ ${game.homeTeam} - Status: ${game.status} - Date: ${game.gameDate}`);
        } else {
          console.log(`🏈 Game: ${game.awayTeam} @ ${game.homeTeam} - Status: ${game.status} - Date: ${game.gameDate}`);
        }
      });

      return footballGames;
    } catch (error) {
      console.error('❌ ESPN NCAAF API Error:', error);
      return [];
    }
  }

  private async getCollegeFootballGames(date?: string): Promise<any[]> {
    try {
      // Format date for ESPN API (YYYYMMDD)
      const todayESPN = date ? date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
      const url = `${this.ESPN_FOOTBALL_API}/scoreboard?dates=${todayESPN}`;

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

      return data.events.map((game: any) => {
        const homeTeam = game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName || 
                        game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.name || 
                        game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.shortDisplayName || '';
        const awayTeam = game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName || 
                        game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.name || 
                        game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.shortDisplayName || '';

        // Enhanced status detection - check multiple indicators for live games
        const espnStatus = game.status.type.name;
        const period = game.status.period || 0;
        const clock = game.status.displayClock;
        const gameTime = new Date(game.date);
        const now = new Date();
        const gameStarted = now.getTime() > gameTime.getTime();

        // Determine actual game status based on multiple factors
        let actualStatus = espnStatus;

        // If ESPN already shows it as live/in-progress, use that
        if (espnStatus.includes('IN_PROGRESS') || espnStatus.includes('LIVE') || 
            espnStatus.includes('HALFTIME') || espnStatus.includes('OVERTIME')) {
          actualStatus = 'STATUS_IN_PROGRESS';
        }
        // If period > 0 or clock shows active time, definitely live
        else if (period > 0 || (clock && clock !== "0:00" && clock !== "00:00")) {
          actualStatus = 'STATUS_IN_PROGRESS';
          console.log(`🏈 ENHANCED DETECTION: ${game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName} @ ${game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName} - Period: ${period}, Clock: ${clock}`);
        }
        // If game time has passed and no explicit final status, it might be live
        else if (gameStarted && !espnStatus.includes('FINAL') && !espnStatus.includes('POSTPONED') && !espnStatus.includes('CANCELED')) {
          const minutesSinceStart = Math.floor((now.getTime() - gameTime.getTime()) / (1000 * 60));
          if (minutesSinceStart >= 0 && minutesSinceStart <= 240) { // Within 4 hours of start time
            actualStatus = 'STATUS_IN_PROGRESS';
            console.log(`🕐 LIVE BY TIME: ${game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team.displayName} @ ${game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team.displayName} - ${minutesSinceStart} minutes since start (ESPN slow to update)`);
          }
        }

        return {
          id: `cfb-${game.id}`,
          gameId: `cfb-${game.id}`,
          homeTeam,
          awayTeam,
          homeScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.score || '0'),
          awayScore: parseInt(game.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.score || '0'),
          status: actualStatus,
          gameDate: game.date, // ESPN returns ISO date string
          sport: 'NCAAF',
          subSport: 'Football',
          startTime: game.date, // Add startTime for calendar compatibility
          espnData: game, // Store full ESPN data for detailed parsing
          period: period,
          clock: clock
        };
      });
    } catch (error) {
      console.error('❌ ESPN College Football API Error:', error);
      return [];
    }
  }


  // === ALERT GENERATION ===

  async processGameAlerts(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => {
        // STRICT: Only process games that are actually live/in-progress
        const isLive = game.status === 'STATUS_IN_PROGRESS' || 
                      game.status === 'STATUS_HALFTIME' ||
                      game.status === 'STATUS_OVERTIME' ||
                      game.status === 'STATUS_FIRST_HALF' ||
                      game.status === 'STATUS_SECOND_HALF' ||
                      game.status.includes('QUARTER') ||
                      game.status.includes('PERIOD');
        
        // Also check if period > 0 (game has started)
        const hasStarted = game.period > 0;
        
        // BLOCK scheduled/pregame games completely
        const isScheduled = game.status === 'STATUS_SCHEDULED' || 
                           game.status === 'STATUS_PREGAME' ||
                           game.status.includes('PREGAME') ||
                           game.status.includes('SCHEDULED');
        
        if (isScheduled) {
          console.log(`🚫 NCAAF: Blocking scheduled game ${game.awayTeam} @ ${game.homeTeam} - Status: ${game.status}`);
          return false;
        }
        
        return isLive && hasStarted;
      });

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

      console.log(`🎯 NCAAF Engine Processing ${liveGames.length} college football games`);

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
      // FIRST: Validate game is actually live before any processing
      const isScheduled = game.status === 'STATUS_SCHEDULED' || 
                         game.status === 'STATUS_PREGAME' ||
                         game.status.includes('PREGAME') ||
                         game.status.includes('SCHEDULED');

      if (isScheduled) {
        console.log(`🚫 NCAAF: Blocking alert processing for scheduled game ${game.awayTeam} @ ${game.homeTeam}`);
        return;
      }

      const gameState = this.parseGameState(game);

      // ALWAYS use the NCAAF Alert Model for proper situation analysis
      if (gameState) {
        console.log(`🏈 NCAAF: Processing detailed game state for ${gameState.gameId} - Quarter: ${gameState.quarter}, Score: ${gameState.score?.home || 0}-${gameState.score?.away || 0}`);

        // Track game state changes for analysis
        const previousState = this.gameStateCache.get(gameState.gameId);
        await this.trackGameEvents(previousState || null, gameState);

        // Store comprehensive game state snapshot
        await this.storeGameStateSnapshot(gameState);

        // Update cache
        this.gameStateCache.set(gameState.gameId, gameState);

        // Use NCAAF Alert Model for situation-specific alerts
        await this.checkGameSituations(gameState);
      } else {
        console.log(`🏈 NCAAF: No detailed game state parsed for ${game.gameId}, using basic live detection...`);

        // Create minimal game state for basic alert
        const basicGameState: NCAAGameState = {
          gameId: game.gameId,
          period: 1,
          quarter: 1,
          timeRemaining: 900, // 15 minutes default
          homeScore: game.homeScore || 0,
          awayScore: game.awayScore || 0,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          sport: 'football',
          conference: 'Unknown',
          score: { home: game.homeScore || 0, away: game.awayScore || 0 },
          down: 1,
          distance: 10,
          yardsToGoal: 50,
          redZone: false,
          overtime: false,
          finalMinutes: false
        };

        // Use the NCAAF Alert Model even for basic states
        await this.checkGameSituations(basicGameState);
      }
    } catch (error) {
      console.error(`❌ Error processing alerts for game ${game.id}:`, error);
    }
  }

  // Store periodic game state snapshots for analysis
  private async storeGameStateSnapshot(gameState: NCAAGameState): Promise<void> {
    try {
      // Create kid-friendly title and description per Law #6
      const quarter = this.getQuarterName(Number(gameState.quarter) || 1);
      const timeLeft = this.formatTimeRemaining(gameState.timeRemaining);
      const scoreText = `${gameState.awayTeam} ${gameState.score.away} - ${gameState.homeTeam} ${gameState.score.home}`;

      const kidFriendlyTitle = this.createFriendlyTitle('gameStateSnapshot', gameState);
      const kidFriendlyDescription = `🏈 COLLEGE FOOTBALL UPDATE!

Teams Playing: ${gameState.awayTeam} @ ${gameState.homeTeam}
Score: ${scoreText}
Time: ${quarter} ${timeLeft}
Down & Distance: ${this.getDownText(gameState.down || 1)} down, need ${gameState.distance || 10} yards
Field Position: ${gameState.yardsToGoal || 50} yards from the end zone

📊 Game tracking data saved for analysis!`;

      const snapshot = {
        id: randomUUID(),
        type: 'gameStateSnapshot',
        sport: 'NCAAF',
        title: kidFriendlyTitle,
        description: kidFriendlyDescription,
        gameInfo: {
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          quarter: gameState.quarter,
          score: gameState.score,
          status: 'STATUS_IN_PROGRESS'
        },

        // Store complete game state for analysis
        snapshotData: {
          timestamp: new Date(),
          gameState: gameState,
          situationalContext: {
            scoringOpportunity: gameState.redZone || (gameState.yardsToGoal && gameState.yardsToGoal <= 30),
            criticalDown: gameState.down && gameState.down >= 3,
            closeGame: Math.abs(gameState.homeScore - gameState.awayScore) <= 7,
            lateGame: gameState.period >= 4,
            weatherImpact: gameState.weather?.precipitation || (gameState.weather?.windMph && gameState.weather.windMph > 15)
          }
        },

        timestamp: new Date(),
        seen: false,
        priority: 50 // Low priority for snapshots
      };

      // Store every 5th snapshot to avoid database bloat
      const shouldStore = Math.random() < 0.2; // 20% of snapshots
      if (shouldStore) {
        await storage.createAlert(snapshot);
        console.log(`📊 Game State Snapshot Stored: ${gameState.awayTeam} @ ${gameState.homeTeam}`);
      }

    } catch (error) {
      console.error('Error storing game state snapshot:', error);
    }
  }

  private parseGameState(game: any): NCAAGameState | null {
    try {
      const espnData = game.espnData;
      const competition = espnData.competitions[0];
      const status = espnData.status;
      const situation = competition.situation || {};

      // Extract period/quarter info
      let period = 0;
      let timeRemaining = '';

      if (status.period) {
        period = status.period;
      }

      if (status.displayClock) {
        timeRemaining = status.displayClock;
      }

      // Extract detailed game state for analysis
      const gameState: NCAAGameState = {
        gameId: game.gameId,
        period,
        quarter: period,
        timeRemaining: this.parseTimeToSeconds(timeRemaining),
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        sport: 'football',
        conference: competition.conference?.name || 'Unknown',

        // Situational data
        down: situation.down || 0,
        distance: situation.distance || 0,
        yardsToGoal: situation.yardLine || 0,
        offense: situation.possessionTeam?.team?.name || '',
        defense: situation.possessionTeam?.team?.name === game.homeTeam ? game.awayTeam : game.homeTeam,

        // Score object for compatibility
        score: { 
          home: game.homeScore, 
          away: game.awayScore 
        },

        // Weather conditions (if available)
        weather: this.extractWeatherData(espnData),

        // Momentum factors
        momentumFactor: this.calculateMomentumFactor(game.homeScore, game.awayScore, period),
        topAdvantage: 0, // Would need more data to calculate time of possession

        // Additional situational flags
        redZone: this.isRedZone(espnData),
        overtime: period > 4,
        finalMinutes: this.isFinalMinutes(timeRemaining, period),
        fieldPosition: situation.yardLine || 50,
        timeoutsRemaining: {
          home: situation.homeTimeouts || 3,
          away: situation.awayTimeouts || 3
        },
        playType: situation.lastPlay?.type?.text || '',
        lastPlayResult: situation.lastPlay?.text || '',
        drives: this.extractDriveData(espnData),
        teamStats: this.extractTeamStats(espnData),
        keyPlayers: this.extractKeyPlayers(espnData)
      };

      return gameState;
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

  private parseTimeToSeconds(timeString: string): number {
    if (!timeString || timeString === '0:00') return 0;

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

  private extractWeatherData(espnData: any): any {
    try {
      const weather = espnData.weather || {};
      return {
        windMph: weather.windSpeed || 0,
        precipitation: weather.conditionId === 'rain' || weather.condition?.toLowerCase().includes('rain'),
        dome: espnData.competitions[0]?.venue?.indoor || false,
        temperature: weather.temperature || 70,
        condition: weather.condition || 'Clear'
      };
    } catch {
      return {
        windMph: 0,
        precipitation: false,
        dome: false,
        temperature: 70,
        condition: 'Clear'
      };
    }
  }

  private calculateMomentumFactor(homeScore: number, awayScore: number, period: number): number {
    // Simple momentum calculation based on recent scoring and game flow
    const scoreDiff = Math.abs(homeScore - awayScore);
    let momentum = 1.0;

    // Close games have higher momentum swings
    if (scoreDiff <= 7) momentum += 0.2;

    // Late game momentum matters more
    if (period >= 4) momentum += 0.3;

    return momentum;
  }

  private extractDriveData(espnData: any): any {
    try {
      const drives = espnData.competitions[0]?.drives || [];
      return {
        currentDrive: {
          plays: drives.current?.plays || 0,
          yards: drives.current?.yards || 0,
          timeElapsed: drives.current?.timeElapsed || '0:00'
        },
        previousDrive: {
          result: drives.previous?.result || '',
          yards: drives.previous?.yards || 0,
          plays: drives.previous?.plays || 0
        }
      };
    } catch {
      return {
        currentDrive: { plays: 0, yards: 0, timeElapsed: '0:00' },
        previousDrive: { result: '', yards: 0, plays: 0 }
      };
    }
  }

  private extractTeamStats(espnData: any): any {
    try {
      const statistics = espnData.competitions[0]?.statistics || [];
      const homeStats = statistics.find((s: any) => s.name === 'home') || {};
      const awayStats = statistics.find((s: any) => s.name === 'away') || {};

      return {
        home: {
          totalYards: homeStats.totalYards || 0,
          passingYards: homeStats.passingYards || 0,
          rushingYards: homeStats.rushingYards || 0,
          turnovers: homeStats.turnovers || 0,
          penalties: homeStats.penalties || 0,
          timeOfPossession: homeStats.possessionTime || '0:00'
        },
        away: {
          totalYards: awayStats.totalYards || 0,
          passingYards: awayStats.passingYards || 0,
          rushingYards: awayStats.rushingYards || 0,
          turnovers: awayStats.turnovers || 0,
          penalties: awayStats.penalties || 0,
          timeOfPossession: awayStats.possessionTime || '0:00'
        }
      };
    } catch {
      return {
        home: { totalYards: 0, passingYards: 0, rushingYards: 0, turnovers: 0, penalties: 0, timeOfPossession: '0:00' },
        away: { totalYards: 0, passingYards: 0, rushingYards: 0, turnovers: 0, penalties: 0, timeOfPossession: '0:00' }
      };
    }
  }

  private extractKeyPlayers(espnData: any): any {
    try {
      const roster = espnData.competitions[0]?.roster || {};
      return {
        quarterbacks: this.getPlayersByPosition(roster, 'QB'),
        runningBacks: this.getPlayersByPosition(roster, 'RB'),
        receivers: this.getPlayersByPosition(roster, 'WR'),
        kickers: this.getPlayersByPosition(roster, 'K')
      };
    } catch {
      return {
        quarterbacks: [],
        runningBacks: [],
        receivers: [],
        kickers: []
      };
    }
  }

  private getPlayersByPosition(roster: any, position: string): any[] {
    try {
      const players = [];
      for (const team of Object.values(roster)) {
        const teamPlayers = (team as any).athletes || [];
        const positionPlayers = teamPlayers.filter((p: any) => p.position === position);
        players.push(...positionPlayers.slice(0, 3)); // Top 3 per position
      }
      return players;
    } catch {
      return [];
    }
  }

  private generateAlertsForGame(gameState: NCAAGameState): SimpleNCAAAlert[] {
    const alerts: SimpleNCAAAlert[] = [];

    // Red Zone Alert
    if (gameState.fieldPosition && gameState.fieldPosition <= 20) {
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
    const isFinalMinutes = this.isFinalMinutes(String(gameState.timeRemaining), gameState.period);
    if (scoreDiff <= 3 && isFinalMinutes) {
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
    if (gameState.period > 4) {
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
          status: 'STATUS_IN_PROGRESS',
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
      await this.sendTelegramIfEnabled(alertData);

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

    for (const [key, entry] of Array.from(this.deduplicationCache.entries())) {
      if (now - entry.timestamp > maxAge) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  // Add method for specific game processing (needed by engine manager)
  async processSpecificGame(gameId: string): Promise<void> {
    try {
      console.log(`🏈 NCAAF: Processing specific game ${gameId} for alerts...`);

      // Try to get game data and check if it's actually live
      const games = await this.getTodaysGames();
      const targetGame = games.find(game => game.gameId === gameId);

      if (!targetGame) {
        console.log(`🏈 NCAAF: Game ${gameId} not found in today's games - skipping alert generation`);
        return;
      }

      // STRICT: Check if game is actually live before processing
      const isScheduled = targetGame.status === 'STATUS_SCHEDULED' || 
                         targetGame.status === 'STATUS_PREGAME' ||
                         targetGame.status.includes('PREGAME') ||
                         targetGame.status.includes('SCHEDULED');

      if (isScheduled) {
        console.log(`🚫 NCAAF: Game ${gameId} (${targetGame.awayTeam} @ ${targetGame.homeTeam}) is scheduled/pregame - NO ALERTS GENERATED`);
        console.log(`📅 NCAAF: Game status: ${targetGame.status}, scheduled for future kickoff`);
        return;
      }

      const isLive = targetGame.status === 'STATUS_IN_PROGRESS' || 
                    targetGame.status === 'STATUS_HALFTIME' ||
                    targetGame.status === 'STATUS_OVERTIME' ||
                    (targetGame.period > 0);

      if (!isLive) {
        console.log(`🚫 NCAAF: Game ${gameId} is not live (Status: ${targetGame.status}, Period: ${targetGame.period}) - NO ALERTS`);
        return;
      }

      console.log(`✅ NCAAF: Game ${gameId} is confirmed LIVE - processing alerts...`);
      await this.processGameForAlerts(targetGame);
    } catch (error) {
      console.error(`❌ NCAAF: Error processing specific game ${gameId}:`, error);
    }
  }

  /**
   * Get full ESPN game data for AI analysis
   */
  private async getFullGameData(gameId: string): Promise<any | null> {
    try {
      const games = await this.getCollegeFootballGames();
      console.log(`🔍 NCAAF: Looking for gameId "${gameId}" in ${games.length} games`);

      // Try multiple lookup strategies
      let foundGame = games.find((game: any) => game.gameId === gameId);

      if (!foundGame) {
        // Try ESPN ID match
        foundGame = games.find((game: any) => game.espnData?.id === gameId);
      }

      if (!foundGame) {
        // Try partial ID match (remove cfb- prefix)
        const cleanGameId = gameId.replace('cfb-', '');
        foundGame = games.find((game: any) => 
          game.gameId.includes(cleanGameId) || 
          game.espnData?.id?.toString() === cleanGameId
        );
      }

      if (foundGame) {
        console.log(`✅ NCAAF: Found ESPN data for game ${gameId}`);
        return foundGame;
      } else {
        console.log(`❌ NCAAF: No ESPN data found for gameId "${gameId}"`);
        console.log(`🔍 NCAAF: Available game IDs:`, games.map(g => ({ gameId: g.gameId, espnId: g.espnData?.id })).slice(0, 3));
        return null;
      }
    } catch (error) {
      console.error('❌ NCAAF: Error fetching full game data:', error);
      return null;
    }
  }

  // Generate a basic "Game Live" alert ONLY for verified live games
  private async generateBasicLiveAlert(gameId: string): Promise<void> {
    try {
      console.log(`🏈 NCAAF: Checking if game ${gameId} is actually live before generating alert...`);

      // CRITICAL: First verify the game is actually live from ESPN API
      const todaysGames = await this.getTodaysGames();
      const actualGame = todaysGames.find(game => 
        game.gameId === gameId || 
        game.espnData?.id?.toString() === gameId.replace('cfb-', '')
      );

      if (!actualGame) {
        console.log(`🚫 NCAAF: Game ${gameId} not found in today's games - NO FAKE ALERT`);
        return;
      }

      // STRICT: Only generate alerts for genuinely live games
      const isActuallyLive = actualGame.status === 'STATUS_IN_PROGRESS' || 
                             actualGame.status === 'STATUS_HALFTIME' ||
                             actualGame.status === 'STATUS_OVERTIME' ||
                             actualGame.status === 'STATUS_FIRST_HALF' ||
                             actualGame.status === 'STATUS_SECOND_HALF';

      if (!isActuallyLive) {
        console.log(`🚫 NCAAF: Game ${gameId} is not live (Status: ${actualGame.status}) - NO FAKE ALERT`);
        return;
      }

      console.log(`✅ NCAAF: Game ${gameId} is verified live (Status: ${actualGame.status}) - proceeding with alert`);

      // Get monitored games to find team names
      const monitoredGames = await storage.getAllMonitoredGames();
      const gameInfo = monitoredGames.find(g => g.gameId === gameId);

      if (!gameInfo) {
        console.log(`🏈 NCAAF: No monitored game info found for ${gameId}`);
        return;
      }

      // Check if user has any NCAAF alerts enabled - STRICT validation
      const userSettings = await this.getUserNCAAFSettings();
      console.log(`🔍 NCAAF: Debug - userSettings:`, JSON.stringify(userSettings, null, 2));
      const alertTypes = userSettings?.alertTypes || {};
      console.log(`🔍 NCAAF: Debug - alertTypes:`, JSON.stringify(alertTypes, null, 2));

      // Check ALL relevant NCAAF toggles - if ALL are disabled, block alert
      const ncaafToggles = [
        'ncaafGameLive', 'ncaafRedZone', 'ncaafFourthDown', 
        'ncaafCloseGame', 'ncaafTwoMinuteWarning', 'ncaafOvertime',
        'ncaafGoalLineStand', 'ncaafBigPlayPotential'
      ];

      const hasAnyEnabled = ncaafToggles.some(toggle => alertTypes[toggle] === true);
      console.log(`🔍 NCAAF: Debug - hasAnyEnabled:`, hasAnyEnabled);

      if (!hasAnyEnabled) {
        console.log(`🔕 NCAAF: ALL NCAAF alerts disabled in user settings - blocking all alerts`);
        return;
      }

      // STRICT: For basic live alerts, check if 'ncaafGameLive' toggle is specifically enabled
      const hasBasicLiveEnabled = alertTypes.ncaafGameLive === true;

      if (!hasBasicLiveEnabled) {
        console.log(`🔕 NCAAF: Basic live alerts (ncaafGameLive) specifically disabled - blocking alert`);
        return;
      }
      console.log(`✅ NCAAF: Basic live alerts specifically enabled, proceeding...`);

      console.log(`✅ NCAAF: User has alerts enabled, generating live game alert...`);

      // Removed old AI analysis - now happens AFTER deduplication check for cost optimization

      // Set initial alert content (will be enhanced after deduplication)
      let enhancedTitle = `📢 ${gameInfo.awayTeamName} @ ${gameInfo.homeTeamName} (0-0)`;
      let enhancedDescription = `${gameInfo.awayTeamName} @ ${gameInfo.homeTeamName} is now live!`;
      let aiConfidence = 0.75;

      // Stage 3: Betbook Analysis - Get betting insights even for basic alerts
      let betbookData = null;
      try {
        betbookData = await getBetbookData({
          sport: 'NCAAF',
          gameId: gameId,
          homeTeam: gameInfo.homeTeamName,
          awayTeam: gameInfo.awayTeamName,
          homeScore: 0,
          awayScore: 0,
          probability: 0.8
        });
        console.log(`💰 NCAAF: Betbook data integrated for basic alert`);
      } catch (error) {
        console.error('💰 NCAAF: Betbook data failed for basic alert:', error);
      }

      // Stage 2: Check deduplication BEFORE expensive AI analysis to save costs
      let preliminaryDescription = `💥 ONE-SCORE GAME! Every play matters now!

⚡️ Advanced AI: 35% scoring probability
🎯 Key Factor: Field goal could change the lead
💪 Strategy: Establish rhythm; control clock`;

      console.log(`🛡️ NCAAF: Checking deduplication BEFORE AI analysis to save costs...`);
      // Create temporary alert object for deduplication check
      const tempAlert = {
        type: 'ncaafGameLive',
        priority: 75,
        description: preliminaryDescription,
        reasons: ['Game is live'],
        probability: 0.8,
        deduplicationKey: `${gameId}:ncaafGameLive:0`
      };
      if (!this.shouldSendAlert(tempAlert)) {
        console.log(`💰 NCAAF: Alert blocked by deduplication - saved AI analysis cost!`);
        return; // Skip this alert and save the AI analysis cost
      }

      console.log(`✅ NCAAF: Alert passed deduplication - proceeding with basic alert (AI disabled)...`);

      // Stage 3.5: VALIDATE SPECIFIC TOGGLE - Don't send basic live alerts unless specifically enabled
      const isBasicLiveEnabled = this.isAlertTypeEnabled('ncaafGameLive', userSettings);
      if (!isBasicLiveEnabled) {
        console.log(`🔕 NCAAF: Basic live alerts (ncaafGameLive) disabled - alert blocked`);
        return;
      }
      console.log(`✅ NCAAF: Basic live alert toggle validated - proceeding...`);

      // Use real ESPN game data - no fake alerts
      const score = actualGame.score || { away: 0, home: 0 };
      const realTitle = `🏈 LIVE: ${actualGame.awayTeam} @ ${actualGame.homeTeam} (${score.away}-${score.home})`;
      const realDescription = `${actualGame.awayTeam} @ ${actualGame.homeTeam} is live\nStatus: ${actualGame.status}`;

      const alert = {
        id: randomUUID(),
        debugId: randomUUID().substring(0, 8),
        type: 'ncaafGameLive', 
        sport: 'NCAAF',
        priority: 70,
        title: realTitle,
        description: realDescription,
        gameInfo: {
          sport: 'NCAAF',
          gameId: gameId,
          homeTeam: actualGame.homeTeam,
          awayTeam: actualGame.awayTeam,
          status: actualGame.status, // Use REAL status from ESPN
          score: score
        },
        probability: 0.8,
        confidence: 0.75,
        timestamp: new Date(),
        seen: false
      };

      // Store and broadcast the real alert
      await storage.createAlert(alert);
      console.log(`📢 NCAAF: REAL live alert sent for ${actualGame.awayTeam} @ ${actualGame.homeTeam}`);
      console.log(`🆔 NCAAF: Alert ID: ${alert.id}`);

      if (this.onAlert) {
        this.onAlert(alert);
      }

    } catch (error) {
      console.error('❌ NCAAF: Error generating basic live alert:', error);
    }
  }

  // === PUBLIC METHODS ===

  async start(): Promise<void> {
    console.log('🚀 NCAAF Engine started');
  }

  async stop(): Promise<void> {
    console.log('🛑 NCAAF Engine stopped');
  }

  // === NCAAF ALERT GENERATION ===

  async checkGameSituations(gameState: NCAAGameState): Promise<void> {
    try {
      // Ensure NCAAF Alert Model is loaded
      await this.loadNCAAFAlertModel();
      if (!ncaafAlertModelInstance) {
        console.error('NCAAF Alert Model not available, generating basic live alert instead');
        await this.generateBasicLiveAlert(gameState.gameId);
        return;
      }

      console.log(`🎯 NCAAF: Running Alert Model check for ${gameState.awayTeam} @ ${gameState.homeTeam} - Q${gameState.quarter}, ${gameState.down}/${gameState.distance} at ${gameState.yardsToGoal}yd`);

      // Stage 1: L1 Trigger - Use the NCAAF alert model to determine if an alert should fire
      const alertResult = ncaafAlertModelInstance.checkNCAAFAlerts(gameState);

      if (!alertResult.shouldAlert) {
        console.log(`🏈 NCAAF: Alert Model check complete - no alert conditions met`);
        return; // No alert conditions met
      }

      console.log(`🚨 NCAAF: Alert Model triggered - Type: ${alertResult.alertType}, Priority: ${alertResult.priority}, Probability: ${alertResult.probability}`);

      // Get user settings to check if this alert type is enabled
      const userSettings = await this.getUserNCAAFSettings();
      const alertTypes = userSettings?.alertTypes || {};

      if (!this.isAlertTypeEnabled(alertResult.alertType, userSettings)) {
        console.log(`🔕 NCAAF Alert disabled in user settings: ${alertResult.alertType}`);
        return;
      }

      console.log(`✅ NCAAF: Alert type ${alertResult.alertType} is enabled in user settings`);

      // Enhanced deduplication for redzone alerts - include field position to prevent spam
      let deduplicationKey: string;
      if (alertResult.alertType === 'redZone') {
        // For redzone, include field position and use longer key to reduce frequency
        const yardsToGoal = gameState.yardsToGoal || 20;
        const positionZone = yardsToGoal <= 5 ? 'goalLine' : 
                           yardsToGoal <= 10 ? 'innerRedZone' : 'redZone';
        deduplicationKey = `${gameState.gameId}:${alertResult.alertType}:${gameState.quarter}:${positionZone}:${Math.floor((gameState.down || 1) / 2)}`;
      } else {
        deduplicationKey = `${gameState.gameId}:${alertResult.alertType}:${gameState.quarter}:${gameState.down || 0}:${gameState.distance || 0}`;
      }

      if (this.isDuplicateByKey(deduplicationKey)) {
        console.log(`🛡️ NCAAF: Alert blocked by deduplication - ${deduplicationKey}`);
        return;
      }

      console.log(`🎯 NCAAF: Proceeding with alert delivery - ${alertResult.alertType}`);

      // Stage 2: Generate user-friendly alert title and description
      const friendlyTitle = this.createFriendlyTitle(alertResult.alertType, gameState);
      const friendlyDescription = this.createFriendlyDescription(alertResult.alertType, gameState);
      const alertDescription = this.buildAlertDescription(alertResult, gameState);

      // Stage 3: Betbook Analysis - Generate betting insights
      let betbookData = null;
      try {
        betbookData = await getBetbookData({
          sport: 'NCAAF',
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          probability: alertResult.probability
        });
      } catch (error) {
        console.error('Stage 3 Betbook insights failed:', error);
      }

      // Stage 4: Delivery - Route through Alert Model for validation and processing  
      const validatedAlert = await this.processAlertThroughModel(alertResult, gameState, friendlyDescription, betbookData, deduplicationKey, friendlyTitle);

      if (validatedAlert) {
        console.log(`🏈 NCAAF Alert Generated: ${alertResult.alertType} - ${gameState.awayTeam} @ ${gameState.homeTeam} (Priority: ${alertResult.priority})`);
      }

      console.log(`🏈 NCAAF Alert Generated: ${alertResult.alertType} - ${gameState.awayTeam} @ ${gameState.homeTeam} (Priority: ${alertResult.priority})`);

    } catch (error) {
      console.error('Error in NCAAF checkGameSituations:', error);
    }
  }

  private async getUserNCAAFSettings(): Promise<any> {
    try {
      const allSettings = await storage.getAllSettings();
      const ncaafSettings = allSettings.find(s => s.sport === 'NCAAF');
      console.log(`🔍 NCAAF: Found settings:`, JSON.stringify(ncaafSettings, null, 2));
      return ncaafSettings || {};
    } catch (error) {
      console.error('Error fetching NCAAF user settings:', error);
      return {};
    }
  }

  private isAlertTypeEnabled(alertType: string, userSettings: any): boolean {
    const alertTypes = userSettings?.alertTypes || {};

    // Map alert model types to user setting keys
    const settingKeyMap: Record<string, string> = {
      'redZone': 'ncaafRedZone',
      'fourthDown': 'ncaafFourthDown', 
      'twoMinuteWarning': 'ncaafTwoMinuteWarning',
      'ncaafCloseGame': 'ncaafCloseGame',
      'overtime': 'ncaafOvertime',
      'goalLineStand': 'ncaafGoalLineStand',
      'bigPlayPotential': 'ncaafBigPlayPotential',
      'ncaafGameLive': 'ncaafGameLive' // For basic live game alerts
    };

    const settingKey = settingKeyMap[alertType] || alertType;
    const isEnabled = alertTypes[settingKey] === true;

    console.log(`🔍 NCAAF: Alert type ${alertType} -> setting ${settingKey} = ${isEnabled}`);
    return isEnabled;
  }

  private isDuplicateByKey(deduplicationKey: string): boolean {
    const now = Date.now();
    const existing = this.deduplicationCache.get(deduplicationKey);

    // Different cooldown times based on alert type
    let cooldownTime = 120000; // 2 minutes default
    if (deduplicationKey.includes(':redZone:')) {
      cooldownTime = 300000; // 5 minutes for redzone alerts
    } else if (deduplicationKey.includes(':fourthDown:')) {
      cooldownTime = 60000; // 1 minute for fourth down
    }

    if (existing && (now - existing.timestamp) < cooldownTime) {
      return true;
    }

    return false;
  }

  private recordDeduplicationByKey(deduplicationKey: string): void {
    this.deduplicationCache.set(deduplicationKey, {
      timestamp: Date.now(),
      priority: 80
    });
  }

  private buildAlertDescription(alertResult: any, gameState: NCAAGameState): string {
    // LAW #7: Consistent format, no duplicate info, 3-second readability
    const quarter = this.getQuarterName(Number(gameState.quarter) || 1);
    const timeLeft = this.formatTimeRemaining(gameState.timeRemaining);
    const situation = this.getSituationText(alertResult.alertType, gameState);

    // Single consistent format for ALL alerts
    return `${quarter} ${timeLeft}
${this.getDownText(gameState.down || 1)} & ${gameState.distance || 10}, ${gameState.yardsToGoal || 50}yd line
${situation}`;
  }

  private getSituationText(alertType: string, gameState: NCAAGameState): string {
    switch (alertType) {
      case 'redZone':
        return `Red zone scoring opportunity - high probability`;
      case 'fourthDown':
        return `4th down decision - must convert or lose possession`;
      case 'ncaafCloseGame':
        const pointDiff = Math.abs(gameState.score.home - gameState.score.away);
        return `${pointDiff}-point game in final minutes`;
      case 'overtime':
        return `Overtime period - next score could decide winner`;
      case 'twoMinuteWarning':
        return `Under 2 minutes - crunch time pressure`;
      case 'goalLineStand':
        return `Goal line stand - defense trying to prevent score`;
      default:
        return `Critical game situation developing`;
    }
  }

  private getQuarterName(quarter: number): string {
    switch (quarter) {
      case 1: return '1st Quarter';
      case 2: return '2nd Quarter'; 
      case 3: return '3rd Quarter';
      case 4: return '4th Quarter';
      default: return quarter > 4 ? 'Overtime' : `Quarter ${quarter}`;
    }
  }

  private getDownText(down: number): string {
    switch (down) {
      case 1: return '1st';
      case 2: return '2nd';
      case 3: return '3rd';
      case 4: return '4th';
      default: return `${down}th`;
    }
  }

  private formatTimeRemaining(seconds: number): string {
    if (!seconds || seconds <= 0) return '';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `(${minutes}:${remainingSeconds.toString().padStart(2, '0')} left)`;
    } else {
      return `(${remainingSeconds} seconds left)`;
    }
  }

  // LAW #7: Standard title format - WHAT + SCORE only (consistent across all sports)
  private buildStandardTitle(alertType: string, gameState: NCAAGameState): string {
    const scoreText = `${gameState.score.away}-${gameState.score.home}`;

    switch (alertType) {
      case 'redZone':
        return `🔴 Red Zone (${scoreText})`;
      case 'fourthDown':
        return `💥 4TH DOWN (${scoreText})`;
      case 'ncaafCloseGame':
        const pointDiff = Math.abs(gameState.score.home - gameState.score.away);
        return `🔥 ${pointDiff}-POINT GAME (${scoreText})`;
      case 'overtime':
        return `⚡ OVERTIME (${scoreText})`;
      case 'twoMinuteWarning':
        return `⏰ 2-MINUTE WARNING (${scoreText})`;
      case 'goalLineStand':
        return `🛡️ GOAL LINE STAND (${scoreText})`;
      case 'ncaafGameLive':
        return `🏈 LIVE GAME (${scoreText})`;
      default:
        return `🏈 GAME ALERT (${scoreText})`;
    }
  }

  private async sendTelegramIfEnabled(alert: any): Promise<void> {
    try {
      // Check if Telegram is enabled globally
      const settings = await this.getUserNCAAFSettings();
      if (settings?.telegramEnabled) {
        console.log('Telegram notifications disabled - config not available');
        // await sendTelegramAlert(config, alert);
      }
    } catch (error) {
      console.error('Error sending Telegram alert:', error);
    }
  }

  // Process alert through CJS alert model before sending to alerts page
  private async processAlertThroughModel(alertResult: any, gameState: NCAAGameState, alertDescription: string, betbookData: any, deduplicationKey: string, friendlyTitle?: string): Promise<any> {
    try {
      // Stage 1: Validate through NCAAF Alert Model (.cjs)
      if (!ncaafAlertModelInstance) {
        console.warn('NCAAF Alert Model not available');
        return null;
      }
      const modelValidation = ncaafAlertModelInstance.checkNCAAFAlerts(gameState);

      if (!modelValidation.shouldAlert) {
        console.log(`🛡️ NCAAF: Alert blocked by CJS model validation`);
        return null;
      }

      // Stage 1.5: CRITICAL - Validate user settings for THIS SPECIFIC alert type
      const userSettings = await this.getUserNCAAFSettings();
      if (!this.isAlertTypeEnabled(modelValidation.alertType, userSettings)) {
        console.log(`🔕 NCAAF: Alert type ${modelValidation.alertType} is disabled in user settings - blocking alert`);
        return null;
      }
      console.log(`✅ NCAAF: Alert type ${modelValidation.alertType} validated through user settings`);

      // Stage 2: Create alert object with CJS model data
      const alertId = randomUUID();
      console.log(`🆔 NCAAF: Generating CJS model alert with ID: ${alertId} | Type: ${modelValidation.alertType}`);

      // Use the friendly title passed from calling method
      const kidFriendlyTitle = friendlyTitle || this.createFriendlyTitle(modelValidation.alertType, gameState);
      const friendlyDescription = this.createFriendlyDescription(modelValidation.alertType, gameState);

      const finalAlert = {
        id: alertId,
        debugId: alertId.substring(0, 8), // Short ID for easy debugging
        type: modelValidation.alertType,
        priority: modelValidation.priority,
        title: kidFriendlyTitle,
        description: friendlyDescription,
        sport: 'NCAAF',
        gameInfo: {
          status: 'live',
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: gameState.score,
          quarter: gameState.quarter,
          situation: modelValidation.alertType,
          down: gameState.down,
          distance: gameState.distance,
          yardsToGoal: gameState.yardsToGoal
        },

        // Store CJS model analysis
        alertModelData: {
          validatedBy: 'NCAAFAlertModel.cjs',
          originalResult: alertResult,
          modelResult: modelValidation,
          gameStateSnapshot: {
            timestamp: new Date(),
            period: gameState.period,
            timeRemaining: gameState.timeRemaining,
            down: gameState.down,
            distance: gameState.distance,
            yardsToGoal: gameState.yardsToGoal,
            fieldPosition: gameState.fieldPosition,
            offense: gameState.offense,
            defense: gameState.defense,
            redZone: gameState.redZone,
            overtime: gameState.overtime,
            finalMinutes: gameState.finalMinutes,
            conference: gameState.conference
          }
        },

        probability: modelValidation.probability,
        confidence: 0.75,
        betbookData: betbookData,
        timestamp: new Date(),
        sentToTelegram: false,
        seen: false,
        reasons: modelValidation.reasons
      };

      // Stage 3: Store alert in database (now properly validated)
      await storage.createAlert(finalAlert);
      console.log(`💾 NCAAF: Alert stored in database`);
      console.log(`🆔 NCAAF: Alert ID: ${finalAlert.id} | Debug ID: ${finalAlert.debugId} | Type: ${finalAlert.type} | Priority: ${finalAlert.priority}`);

      // Stage 4: Record deduplication
      this.recordDeduplicationByKey(deduplicationKey);
      console.log(`🔄 NCAAF: Deduplication recorded for: ${deduplicationKey}`);

      // Stage 5: Send to Telegram if enabled
      await this.sendTelegramIfEnabled(finalAlert);

      // Stage 6: Call onAlert callback if set (WebSocket broadcast)
      if (this.onAlert) {
        this.onAlert(finalAlert);
        console.log(`📡 NCAAF: Alert broadcasted via WebSocket | ID: ${finalAlert.debugId}`);
      }

      return finalAlert;

    } catch (error) {
      console.error('❌ Error processing alert through CJS model:', error);
      return null;
    }
  }

  // Store game flow events for comprehensive analysis
  private async storeGameFlowEvent(gameState: NCAAGameState, eventType: string, eventData: any): Promise<void> {
    try {
      const gameFlowEvent = {
        id: randomUUID(),
        type: 'gameFlowEvent',
        sport: 'NCAAF',
        title: `Game Flow: ${eventType}`,
        description: `${eventType} event in ${gameState.awayTeam} @ ${gameState.homeTeam}`,
        gameInfo: {
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          status: 'STATUS_IN_PROGRESS',
          quarter: gameState.quarter,
          score: gameState.score,
          eventType: eventType
        },

        // Store detailed event data
        eventData: {
          timestamp: new Date(),
          period: gameState.period,
          timeRemaining: gameState.timeRemaining,
          down: gameState.down,
          distance: gameState.distance,
          yardsToGoal: gameState.yardsToGoal,
          fieldPosition: gameState.fieldPosition,
          eventType: eventType,
          eventDetails: eventData,
          gameContext: {
            scoreDifferential: Math.abs(gameState.homeScore - gameState.awayScore),
            possession: gameState.offense,
            weather: gameState.weather,
            momentumFactor: gameState.momentumFactor
          }
        },

        timestamp: new Date(),
        seen: false,
        priority: 60 // Lower priority for flow events
      };

      // Store the game flow event
      await storage.createAlert(gameFlowEvent);
      console.log(`📊 Game Flow Event Stored: ${eventType} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);

    } catch (error) {
      console.error('Error storing game flow event:', error);
    }
  }

  private createFriendlyTitle(alertType: string, gameState: NCAAGameState): string {
    const scoreText = `${gameState.awayScore}-${gameState.homeScore}`;
    
    switch (alertType) {
      case 'redZone':
        return `🚨 RED ZONE (${scoreText})`;
      case 'closeGame':
        return `🔥 CLOSE GAME (${scoreText})`;
      case 'fourthDown':
        return `💥 4TH DOWN (${scoreText})`;
      case 'twoMinuteWarning':
        return `⏰ 2-MINUTE WARNING (${scoreText})`;
      case 'overtime':
        return `🏈 OVERTIME (${scoreText})`;
      case 'goalLineStand':
        return `🛡️ GOAL LINE STAND (${scoreText})`;
      case 'bigPlayPotential':
        return `⚡ BIG PLAY SETUP (${scoreText})`;
      case 'gameStateSnapshot':
        return `📊 GAME TRACKER (${scoreText})`;
      case 'ncaafGameLive':
        return `🏈 LIVE GAME (${scoreText})`;
      default:
        return `🏈 GAME ALERT (${scoreText})`;
    }
  }

  private createFriendlyDescription(alertType: string, gameState: NCAAGameState): string {
    const quarter = this.getQuarterName(Number(gameState.quarter));
    const timeLeft = this.formatTimeRemaining(gameState.timeRemaining || 0);
    const downInfo = gameState.down && gameState.distance ? 
      `${this.getDownText(gameState.down)}, ${gameState.distance} yards to go` : 
      '1st down, 10 yards to go';
    const fieldPos = gameState.yardsToGoal ? `${gameState.yardsToGoal} yards from goal` : '50 yards from goal';
    
    switch (alertType) {
      case 'redZone':
        return `${quarter} ${timeLeft}
${downInfo}
${fieldPos} - High scoring opportunity!`;
      
      case 'closeGame':
        const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
        return `${quarter} ${timeLeft}
${downInfo}
${scoreDiff}-point game - Either team can win!`;
      
      case 'fourthDown':
        return `${quarter} ${timeLeft}
4th down, ${gameState.distance || 10} yards needed
Convert or lose possession!`;
      
      case 'twoMinuteWarning':
        return `${quarter} ${timeLeft}
${downInfo}
Crunch time - every play matters!`;
      
      case 'overtime':
        return `Overtime period
${downInfo}
${fieldPos} - Next score could decide it!`;
      
      case 'goalLineStand':
        return `${quarter} ${timeLeft}
${downInfo}
Goal line - Battle of inches!`;
      
      case 'bigPlayPotential':
        return `${quarter} ${timeLeft}
${downInfo}
${fieldPos} - Big play opportunity!`;

      case 'ncaafGameLive':
        return `${quarter} 15:00
Kickoff completed
Game is now in progress`;
      
      default:
        return `${quarter} ${timeLeft}
${downInfo}
${fieldPos}`;
    }
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';  
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  // Track significant game events for analysis
  private async trackGameEvents(previousState: NCAAGameState | null, currentState: NCAAGameState): Promise<void> {
    if (!previousState) return;

    try {
      // Score change event
      if (previousState.homeScore !== currentState.homeScore || previousState.awayScore !== currentState.awayScore) {
        await this.storeGameFlowEvent(currentState, 'SCORE_CHANGE', {
          previousScore: { home: previousState.homeScore, away: previousState.awayScore },
          newScore: { home: currentState.homeScore, away: currentState.awayScore },
          scoringTeam: currentState.homeScore > previousState.homeScore ? currentState.homeTeam : currentState.awayTeam
        });
      }

      // Quarter change event
      if (previousState.period !== currentState.period) {
        await this.storeGameFlowEvent(currentState, 'QUARTER_CHANGE', {
          previousQuarter: previousState.period,
          newQuarter: currentState.period
        });
      }

      // Red zone entry/exit
      if (previousState.redZone !== currentState.redZone) {
        await this.storeGameFlowEvent(currentState, currentState.redZone ? 'RED_ZONE_ENTRY' : 'RED_ZONE_EXIT', {
          team: currentState.offense,
          fieldPosition: currentState.fieldPosition
        });
      }

      // Turnover detection (possession change)
      if (previousState.offense !== currentState.offense && currentState.offense) {
        await this.storeGameFlowEvent(currentState, 'POSSESSION_CHANGE', {
          previousPossession: previousState.offense,
          newPossession: currentState.offense,
          fieldPosition: currentState.fieldPosition
        });
      }

      // Timeout usage
      if (previousState.timeoutsRemaining && currentState.timeoutsRemaining) {
        const homeTimeoutUsed = previousState.timeoutsRemaining.home > currentState.timeoutsRemaining.home;
        const awayTimeoutUsed = previousState.timeoutsRemaining.away > currentState.timeoutsRemaining.away;

        if (homeTimeoutUsed || awayTimeoutUsed) {
          await this.storeGameFlowEvent(currentState, 'TIMEOUT_USED', {
            team: homeTimeoutUsed ? currentState.homeTeam : currentState.awayTeam,
            timeoutsRemaining: currentState.timeoutsRemaining,
            gameContext: 'strategic timeout'
          });
        }
      }

    } catch (error) {
      console.error('Error tracking game events:', error);
    }
  }
  
  // New monitor method from the edited snippet
  async monitor(gameState: NCAAFGameStateV3): Promise<any[]> {
    this.gameStates.set(gameState.gameId, gameState);

    // Check redzone situation
    if (gameState.yardsToGoal && gameState.yardsToGoal <= 20) {
      const situationKey = `${gameState.quarter}_${gameState.down}_${gameState.yardsToGoal}`;
      const lastAlert = this.lastAlerts.get(gameState.gameId);

      if (lastAlert === situationKey) return [];

      const alert = this.createStandardAlert(gameState, 'REDZONE');
      const validation = AlertFormatValidator.validateCompliance(alert);

      if (!validation.isValid) {
        console.error('NCAAF ALERT VIOLATION:', validation.violations);
        return [];
      }

      this.lastAlerts.set(gameState.gameId, situationKey);
      return [alert];
    }

    return [];
  }

  private createStandardAlert(gameState: NCAAFGameStateV3, alertType: string): any {
    const alertId = `ncaaf_${gameState.gameId}_${Date.now()}`;

    const score = {
      home: gameState.homeScore,
      away: gameState.awayScore
    };

    return {
      id: alertId,
      type: alertType,
      sport: 'NCAAF',
      title: AlertFormatValidator.generateStandardTitle('NCAAF', alertType, score),
      description: AlertFormatValidator.generateStandardDescription('NCAAF', alertType, gameState),
      gameInfo: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        score,
        status: 'Live',
        situation: alertType,
        quarter: gameState.quarter,
        down: gameState.down,
        distance: gameState.distance,
        yardsToGoal: gameState.yardsToGoal
      },
      priority: 85,
      timestamp: new Date(),
      seen: false
    };
  }
}