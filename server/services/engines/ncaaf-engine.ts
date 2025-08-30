import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

// Import OpenAI and Betbook engines for alert processing
import { OpenAiEngine } from './OpenAiEngine';
import { getBetbookData } from './betbook-engine';
import { alertDeduplicationEngine } from '../AlertDeduplicationEngine';

// Import NCAAF Alert Model (CommonJS module)
let ncaafAlertModel: any = null;

// Type declaration for NCAAFAlertModel
declare module './NCAAFAlertModel.cjs' {
  export function checkNCAAFAlerts(gameState: any): any;
  export function ncaafL1Alert(gameState: any): any;
  export function ncaafL2Alert(gameState: any): any;
  export function ncaafL3Alert(gameState: any): any;
}

interface NCAAGameState {
  gameId: string;
  period: number;
  quarter: number | string;
  timeRemaining: number; // seconds remaining
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  sport: string; // 'football'
  conference: string;
  down?: number;
  distance?: number;
  yardsToGoal?: number;
  offense?: string;
  defense?: string;
  score: { home: number; away: number };
  weather?: {
    windMph?: number;
    precipitation?: boolean;
    dome?: boolean;
  };
  momentumFactor?: number;
  topAdvantage?: number;
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

  // OpenAI engine instance for alert description generation
  private readonly openAiEngine: OpenAiEngine;

  constructor() {
    console.log('🏈 NCAAF Engine initialized with ESPN API integration (College Football)');
    // Initialize OpenAI engine for generating AI alert descriptions
    this.openAiEngine = new OpenAiEngine();
    // Load the NCAAF Alert Model
    this.loadNCAAFAlertModel();
  }

  private async loadNCAAFAlertModel() {
    try {
      if (!ncaafAlertModel) {
        // Use dynamic import for CommonJS module
        ncaafAlertModel = await import('./NCAAFAlertModel.cjs');
      }
    } catch (error) {
      console.error('Failed to load NCAAF Alert Model:', error);
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
      if (!gameState) {
        console.log(`🏈 NCAAF: No game state parsed for ${game.gameId}, generating basic alert...`);
        await this.generateBasicLiveAlert(game.gameId);
        return;
      }

      console.log(`🏈 NCAAF: Processing game state for ${gameState.gameId} - Quarter: ${gameState.quarter}, Score: ${gameState.score?.home || 0}-${gameState.score?.away || 0}`);
      
      // If no detailed game data, generate basic live alert
      if (!gameState.quarter || gameState.quarter === 'undefined' || gameState.quarter === undefined) {
        console.log(`🏈 NCAAF: No detailed quarter data for ${gameState.gameId} (quarter: ${gameState.quarter}), generating basic live alert...`);
        await this.generateBasicLiveAlert(gameState.gameId);
        return;
      }
      
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
    const isFinalMinutes = this.isFinalMinutes(gameState.timeRemaining, gameState.period);
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
      console.log(`🏈 NCAAF: Processing specific game ${gameId} for alerts...`);
      
      // Try to get game data and generate basic alerts
      const games = await this.getTodaysGames();
      const targetGame = games.find(game => game.gameId === gameId);
      
      if (!targetGame) {
        console.log(`🏈 NCAAF: Game ${gameId} not found, generating basic live game alert`);
        await this.generateBasicLiveAlert(gameId);
        return;
      }

      console.log(`🏈 NCAAF: Found game data for ${gameId}, processing alerts...`);
      await this.processGameForAlerts(targetGame);
    } catch (error) {
      console.error(`❌ NCAAF: Error processing specific game ${gameId}:`, error);
      // Fallback: try to generate a basic alert anyway
      await this.generateBasicLiveAlert(gameId);
    }
  }

  // Generate a basic "Game Live" alert when detailed data isn't available
  private async generateBasicLiveAlert(gameId: string): Promise<void> {
    try {
      console.log(`🏈 NCAAF: Generating basic live alert for game ${gameId}`);
      
      // Get monitored games to find team names
      const monitoredGames = await storage.getAllMonitoredGames();
      const gameInfo = monitoredGames.find(g => g.gameId === gameId);
      
      if (!gameInfo) {
        console.log(`🏈 NCAAF: No monitored game info found for ${gameId}`);
        return;
      }

      // Check if user has any NCAAF alerts enabled - basic live alerts should always proceed if any alert type is enabled
      const userSettings = await this.getUserNCAAFSettings();
      console.log(`🔍 NCAAF: Debug - userSettings:`, JSON.stringify(userSettings, null, 2));
      const alertTypes = userSettings?.alertTypes || {};
      console.log(`🔍 NCAAF: Debug - alertTypes:`, JSON.stringify(alertTypes, null, 2));
      const hasAnyEnabled = Object.values(alertTypes).some((enabled: any) => enabled === true);
      console.log(`🔍 NCAAF: Debug - hasAnyEnabled:`, hasAnyEnabled);
      if (!hasAnyEnabled) {
        console.log(`🔕 NCAAF: All NCAAF alerts disabled in user settings`);
        return;
      }
      console.log(`✅ NCAAF: User settings allow alerts, proceeding...`);
      
      console.log(`✅ NCAAF: User has alerts enabled, generating live game alert...`);

      // Stage 2: OpenAI Enhancement - Generate enhanced description instead of basic text
      let enhancedTitle = `🏈 COLLEGE FOOTBALL LIVE`;
      let enhancedDescription = `${gameInfo.awayTeamName} @ ${gameInfo.homeTeamName} is now live!`;
      let aiConfidence = 0.75;
      
      try {
        const gameSituation = {
          sport: 'NCAAF',
          homeTeam: gameInfo.homeTeamName,
          awayTeam: gameInfo.awayTeamName,
          homeScore: 0,
          awayScore: 0,
          gameState: 'Opening Kickoff - 1st Quarter',
          situationContext: `${gameInfo.awayTeamName} opens their season on the road against ${gameInfo.homeTeamName}. Both teams have game-planned extensively for this moment, with offensive coordinators looking to establish early rhythm while defensive units aim to create immediate pressure and force early mistakes. The opening drive will set the tone for momentum and field position battle.`,
          scoringProbability: 0.75,
          priority: 85
        };
        const aiDescription = await this.openAiEngine.generateAlertDescription(gameSituation);
        
        if (aiDescription && aiDescription.length > 10) {
          enhancedTitle = `🏈 ${gameInfo.awayTeamName} @ ${gameInfo.homeTeamName}`;
          enhancedDescription = aiDescription;
          aiConfidence = 0.85; // Higher confidence for AI-generated content
          console.log(`🤖 NCAAF: OpenAI enhanced basic alert - Description: ${enhancedDescription}`);
        }
      } catch (error) {
        console.error('🤖 NCAAF: OpenAI enhancement failed for basic alert, using fallback:', error);
      }

      // Stage 3: Betbook Analysis - Get betting insights even for basic alerts
      let betbookData = null;
      try {
        betbookData = await getBetbookData({
          sport: 'NCAAF',
          homeTeam: gameInfo.homeTeamName,
          awayTeam: gameInfo.awayTeamName,
          situation: 'Game Live',
          probability: 0.8
        });
        console.log(`💰 NCAAF: Betbook data integrated for basic alert`);
      } catch (error) {
        console.error('💰 NCAAF: Betbook data failed for basic alert:', error);
      }

      // Stage 4: Create enhanced live game alert (now with AI and betting insights)
      const alert = {
        id: randomUUID(),
        type: 'ncaafGameLive',
        sport: 'NCAAF',
        priority: 70,
        title: enhancedTitle,
        message: enhancedDescription,
        description: enhancedDescription,
        gameInfo: {
          sport: 'NCAAF',
          gameId: gameId,
          homeTeam: gameInfo.homeTeamName || 'Home Team',
          awayTeam: gameInfo.awayTeamName || 'Away Team',
          situation: 'Game Live',
          quarter: 'Live',
          score: { home: 0, away: 0 }
        },
        probability: 0.8,
        confidence: aiConfidence,
        betbookData: betbookData,
        timestamp: new Date(),
        userId: 'system',
        seen: false
      };

      // Check with deduplication engine before sending
      const deduplicationResult = alertDeduplicationEngine.shouldSendAlert(alert);
      
      if (!deduplicationResult.shouldSend) {
        console.log(`🛡️ NCAAF: Alert blocked by deduplication engine - ${deduplicationResult.reason}`);
        return;
      }

      // Update alert with unique ID from deduplication engine
      alert.id = deduplicationResult.uniqueId;

      // Store and broadcast the alert
      await storage.createAlert(alert);
      console.log(`📢 NCAAF: Basic live alert sent for ${gameInfo.awayTeamName} @ ${gameInfo.homeTeamName} (ID: ${alert.id})`);
      
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
      if (!ncaafAlertModel) {
        console.error('NCAAF Alert Model not available, skipping situation check');
        return;
      }

      // Stage 1: L1 Trigger - Use the NCAAF alert model to determine if an alert should fire
      const alertResult = ncaafAlertModel.checkNCAAFAlerts(gameState);
      
      if (!alertResult.shouldAlert) {
        return; // No alert conditions met
      }

      // Get user settings to check if this alert type is enabled
      const userSettings = await this.getUserNCAAFSettings();
      if (!this.isAlertTypeEnabled(alertResult.alertType, userSettings)) {
        console.log(`🔕 NCAAF Alert disabled in user settings: ${alertResult.alertType}`);
        return;
      }

      // Check deduplication
      if (this.isDuplicate(alertResult, gameState)) {
        return;
      }

      // Stage 2: OpenAI Analysis - Generate contextual description  
      const aiDescription = await this.openAiEngine.generateSportsAlert({
        sport: 'NCAAF',
        situation: alertResult.reasons.join(', '),
        gameContext: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
        quarter: gameState.quarter?.toString() || '1',
        score: `${gameState.score.away}-${gameState.score.home}`,
        priority: alertResult.priority
      });

      // Stage 3: Betbook Analysis - Generate betting insights
      const betbookData = await getBetbookData({
        sport: 'NCAAF',
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        situation: alertResult.alertType,
        probability: alertResult.probability
      });

      // Stage 4: Delivery - Create and store the alert
      const finalAlert = {
        id: randomUUID(),
        type: alertResult.alertType,
        priority: alertResult.priority,
        title: aiDescription?.title || `NCAAF ${alertResult.alertType}`,
        message: aiDescription?.description || alertResult.reasons.join(', '),
        gameData: {
          sport: 'NCAAF',
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: gameState.score,
          quarter: gameState.quarter,
          situation: alertResult.alertType
        },
        probability: alertResult.probability,
        confidence: aiDescription?.confidence || 0.75,
        betbookData: betbookData || undefined,
        timestamp: new Date(),
        sentToTelegram: false,
        seen: false
      };

      // Store alert in database  
      await storage.createAlert({
        ...finalAlert,
        sport: 'NCAAF',
        description: finalAlert.message,
        gameInfo: {
          status: 'live',
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: gameState.score,
          quarter: gameState.quarter
        }
      });
      
      // Send to Telegram if enabled
      await this.sendTelegramIfEnabled({
        ...finalAlert,
        sport: 'NCAAF',
        description: finalAlert.message,
        gameInfo: {
          status: 'live',
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          score: gameState.score,
          quarter: gameState.quarter
        }
      });
      
      // Call onAlert callback if set
      if (this.onAlert) {
        this.onAlert(finalAlert);
      }

      console.log(`🏈 NCAAF Alert Generated: ${alertResult.alertType} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);

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
    // Map alert types to user setting keys
    const settingKey = alertType; // Direct mapping since we use the same keys
    return userSettings[settingKey] === true;
  }

  private isDuplicate(alertResult: any, gameState: NCAAGameState): boolean {
    const deduplicationKey = `${gameState.gameId}:${alertResult.alertType}:${gameState.quarter}:${gameState.down || 0}`;
    const now = Date.now();
    const existing = this.deduplicationCache.get(deduplicationKey);
    
    if (existing && (now - existing.timestamp) < 60000) { // 1 minute cooldown
      return true;
    }
    
    this.deduplicationCache.set(deduplicationKey, {
      timestamp: now,
      priority: alertResult.priority
    });
    
    return false;
  }

  private async sendTelegramIfEnabled(alert: any): Promise<void> {
    try {
      // Check if Telegram is enabled globally
      const settings = await this.getUserNCAAFSettings();
      if (settings?.telegramEnabled) {
        await sendTelegramAlert(alert);
      }
    } catch (error) {
      console.error('Error sending Telegram alert:', error);
    }
  }
}