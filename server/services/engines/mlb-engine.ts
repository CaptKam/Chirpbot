// mlb-engine.ts
//
// Simplified ChirpBot MLB engine
// - Game status gating (only live games)  
// - User settings override
// - Simple deduplication
// - MLB scoring probability model integration

import { storage } from '../../storage';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { fetchJson } from '../http';

// Import MLB scoring probability model.  This CommonJS module provides
// functions for computing run‑scoring probabilities based on base/out
// state and situational modifiers.  We use dynamic import here because
// mlbAlertModel.js exports using CommonJS semantics.
let mlbAlertModel: any = null;

// Import the OpenAI engine for generating concise alert descriptions.
import { OpenAiEngine } from './OpenAiEngine';

// Import Betbook helper to generate betting insights.
import { getBetbookData } from './betbook-engine';

// === SIMPLIFIED INTERFACES ===

export interface EnhancedRunners {
  first?: { playerId: number; playerName: string };
  second?: { playerId: number; playerName: string };
  third?: { playerId: number; playerName: string };
}

export interface MLBGameStateV3 {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: EnhancedRunners;
  currentBatter?: {
    id: number;
    name: string;
    position: string;
    stats: { hr: number; avg: number; ops: number; obp?: number; slg?: number };
  };
  currentPitcher?: {
    id: number;
    name: string;
    position: string;
    stats: { era: number; whip: number; strikeOuts?: number; wins?: number; losses?: number };
  };
  ballpark?: string;
  weather?: {
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
  };
  venue?: string;
  balls?: number;
  strikes?: number;
}

export interface SimpleAlert {
  priority: number;
  description: string;
  reasons: string[];
  probability: number;
  deduplicationKey: string;
}

export class MLBEngine {
  // Simple Deduplication
  private deduplicationCache = new Map<string, { timestamp: number; priority: number }>();
  private readonly MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
  
  onAlert?: (alert: any) => void;

  // OpenAI engine instance used for Stage 2 alert description generation
  private readonly openAiEngine: OpenAiEngine;

  constructor() {
    console.log('🔧 MLBEngine initialized with Simplified Alert System & Integrated Player Detection');
    // Initialize OpenAI engine so that we can generate AI alert descriptions
    this.openAiEngine = new OpenAiEngine();
    // Load the MLB Alert Model
    this.loadMLBAlertModel();
  }

  private async loadMLBAlertModel() {
    try {
      if (!mlbAlertModel) {
        // Use dynamic import for CommonJS module
        mlbAlertModel = await import('./mlbAlertModel.cjs');
      }
    } catch (error) {
      console.error('Failed to load MLB Alert Model:', error);
    }
  }

  // === INTEGRATED MLB API METHODS ===

  async getTodaysGames(date?: string): Promise<any[]> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `${this.MLB_API_BASE}/schedule?sportId=1&date=${targetDate}&hydrate=game(content(summary,media(epg)),tickets),linescore(matchup,runners),metadata`;
      
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!data || !(data as any).dates?.[0]?.games) {
        console.log(`📅 No games found for ${targetDate}`);
        return [];
      }

      return (data as any).dates[0].games.map((game: any) => ({
        gamePk: game.gamePk,
        gameId: game.gamePk.toString(),
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        homeScore: game.teams.home.score || 0,
        awayScore: game.teams.away.score || 0,
        status: game.status.detailedState,
        gameDate: game.gameDate,
        startTime: game.gameDate,
        sport: 'MLB'
      }));
    } catch (error) {
      console.error('❌ MLB API Error:', error);
      return [];
    }
  }

  // === SIMPLIFIED ALERT GENERATION ===

  async checkGameSituations(gameState: MLBGameStateV3): Promise<void> {
    try {
      // Ensure MLB Alert Model is loaded
      await this.loadMLBAlertModel();
      if (!mlbAlertModel) {
        console.error('MLB Alert Model not available, skipping situation check');
        return;
      }

      // Stage 1: L1 Trigger - Use the MLB scoring probability model to determine if an alert should fire
      const modelState = this.mapGameStateForAlertModel(gameState);
      const scoringResult = mlbAlertModel.calcMLBScoringAlert(modelState);
      const severity = scoringResult.severity || 'NONE';
      
      if (severity !== 'NONE') {
        const reasons: string[] = scoringResult.reasons || scoringResult.reason || [];
        const alert: SimpleAlert = {
          priority: scoringResult.priority,
          description: '',
          reasons,
          probability: scoringResult.p_adj,
          deduplicationKey: this.generateDeduplicationKey(gameState, 'SCORING')
        };
        
        if (this.shouldEmitAlert(alert)) {
          await this.processAlert(alert, gameState);
        }
      }
    } catch (error) {
      console.error('❌ Error checking game situations:', error);
    }
  }

  /**
   * Process a triggered alert through all four stages of the alert flow.
   * Stage 1: L1 Trigger (already completed - we have the alert)
   * Stage 2: OpenAI Refinement - Generate concise alert description
   * Stage 3: Betbook Insights - Fetch betting advice and insights  
   * Stage 4: Delivery - Create alert record and broadcast
   */
  private async processAlert(alert: SimpleAlert, gameState: MLBGameStateV3): Promise<void> {
    try {
      // Stage 2: OpenAI Refinement
      let description = '';
      try {
        const situationContext = this.buildSituationContext(gameState, alert);
        const gameSituation = {
          sport: 'MLB',
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          gameState: `${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}`,
          situationContext,
          scoringProbability: alert.probability,
          priority: alert.priority
        };
        description = await this.openAiEngine.generateAlertDescription(gameSituation);
        
        // Ensure description fits within 120 character limit
        if (description.length > 120) {
          description = description.substring(0, 117) + '...';
        }
      } catch (error) {
        console.error('Stage 2 OpenAI refinement failed:', error);
        description = this.buildFallbackDescription(gameState, alert);
      }
      
      // Stage 3: Betbook Insights
      let betbookData = null;
      try {
        const alertContext = {
          sport: 'MLB',
          gameId: gameState.gameId,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          homeScore: gameState.homeScore,
          awayScore: gameState.awayScore,
          inning: gameState.inning,
          probability: alert.probability,
          priority: alert.priority,
          gameState: `${gameState.inning}${this.getOrdinalSuffix(gameState.inning)} ${gameState.inningState}`
        };
        betbookData = await getBetbookData(alertContext);
      } catch (error) {
        console.error('Stage 3 Betbook insights failed:', error);
        betbookData = {
          odds: { home: -110, away: +100, total: 8.5 },
          aiAdvice: 'Betting insights unavailable. Always gamble responsibly.',
          sportsbookLinks: [],
          bettingInsights: ['Monitor situation'],
          confidence: 0
        };
      }
      
      // Stage 4: Delivery
      await this.deliverAlert(alert, gameState, description, betbookData);
      
    } catch (error) {
      console.error('Error processing alert through four-stage flow:', error);
    }
  }

  /**
   * Stage 4: Delivery - Route through CJS Alert Model then create alert record
   */
  private async deliverAlert(alert: SimpleAlert, gameState: MLBGameStateV3, description: string, betbookData: any): Promise<void> {
    try {
      // Stage 1: Validate through MLB Alert Model (.cjs)
      const modelState = this.mapGameStateForAlertModel(gameState);
      const modelValidation = mlbAlertModel.checkScoringProbability(modelState);
      
      if (!modelValidation.shouldAlert) {
        console.log(`🛡️ MLB: Alert blocked by CJS model validation`);
        return;
      }

      // Stage 2: Create alert with CJS model validation
      const alertId = randomUUID();
      console.log(`🆔 MLB: Generating scoring alert with ID: ${alertId}`);
      
      const alertData = {
        id: alertId,
        debugId: alertId.substring(0, 8), // Short ID for easy debugging
        type: 'SCORING',
        sport: 'MLB',
        title: 'MLB Scoring Opportunity',
        description: description,
        priority: modelValidation.priority,
        gameInfo: {
          status: 'Live',
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          inning: gameState.inning,
          inningState: gameState.inningState,
          outs: gameState.outs,
          runners: {
            first: !!gameState.runners.first,
            second: !!gameState.runners.second,
            third: !!gameState.runners.third
          },
          score: {
            home: gameState.homeScore,
            away: gameState.awayScore
          },
          priority: modelValidation.priority,
          scoringProbability: modelValidation.probability,
          currentBatter: gameState.currentBatter,
          balls: gameState.balls,
          strikes: gameState.strikes
        },
        
        // Store CJS model analysis
        alertModelData: {
          validatedBy: 'mlbAlertModel.cjs',
          originalAlert: alert,
          modelValidation: modelValidation,
          severity: modelValidation.severity
        },
        
        createdAt: new Date(),
        seen: false,
        betbookData: betbookData
      };

      // Stage 3: Create alert in database (now properly validated)
      const createdAlert = await storage.createAlert(alertData);
      console.log(`💾 MLB: Alert stored in database`);
      console.log(`🆔 MLB: Alert ID: ${alertData.id} | Debug ID: ${alertData.debugId} | Type: ${alertData.type} | Priority: ${modelValidation.priority}`);
      
      // Stage 4: Record alert emission for deduplication
      this.recordAlertEmission(alert);
      console.log(`🔄 MLB: Deduplication recorded for: ${alert.deduplicationKey}`);
      
      // Stage 5: Broadcast to WebSocket clients
      if (this.onAlert) {
        this.onAlert({
          type: 'new_alert',
          data: createdAlert
        });
        console.log(`📡 MLB: Alert broadcasted via WebSocket | ID: ${alertData.debugId}`);
      }
      
      console.log(`✅ MLB Alert delivered via CJS model: ${description} (Priority: ${modelValidation.priority})`);
      
    } catch (error) {
      console.error('Error delivering alert through CJS model:', error);
    }
  }

  /**
   * Convert the current MLBGameStateV3 into the simplified state expected by mlbAlertModel.
   * This mapping extracts only the relevant pieces of information (bases, outs, inning,
   * batter/pitcher stats, weather and score) that our scoring probability model uses.
   *
   * @param gameState The live game state from the MLB API
   * @returns A plain object with clock, bases, batter, onDeck, pitcher, weather, park and score
   */
  private mapGameStateForAlertModel(gameState: MLBGameStateV3): any {
    // Base occupancy
    const bases = {
      on1B: Boolean(gameState.runners.first),
      on2B: Boolean(gameState.runners.second),
      on3B: Boolean(gameState.runners.third)
    };
    // Clock info
    const clock = {
      inning: gameState.inning,
      outs: gameState.outs
    };
    // Batter info
    const batterStats = gameState.currentBatter?.stats;
    const batter = {
      hrSeason: batterStats?.hr || 0,
      sprintSpeed: undefined
    };
    // On-deck batter (not available in simplified state)
    const onDeck = {
      hrSeason: 0
    };
    // Pitcher info
    const pitcherStats = gameState.currentPitcher?.stats;
    const pitcher = {
      whip: pitcherStats?.whip,
      timesFacedOrder: undefined,
      gbRate: undefined
    };
    // Weather info (convert to mlbAlertModel naming)
    const weather = {
      windMph: gameState.weather?.windSpeed,
      windToOutfield: typeof gameState.weather?.windDirection === 'string' ? /out/i.test(gameState.weather.windDirection || '') : undefined,
      temperatureF: gameState.weather?.temperature
    };
    // Park info (no detailed data available)
    const park = {
      dome: false,
      hrFactor: undefined
    };
    // Score info
    const score = {
      home: gameState.homeScore,
      away: gameState.awayScore
    };
    return { clock, bases, batter, onDeck, pitcher, weather, park, score };
  }

  /**
   * Build a human‑readable situation context summarizing runners, outs and inning.
   * This string is passed to OpenAI to provide context for generating an alert description.
   */
  private buildSituationContext(gameState: MLBGameStateV3, alert: SimpleAlert): string {
    const runners: string[] = [];
    if (gameState.runners.first) runners.push('1st');
    if (gameState.runners.second) runners.push('2nd');
    if (gameState.runners.third) runners.push('3rd');
    const runnerText = runners.length ? `Runners on ${runners.join(' & ')}` : 'No runners';
    const suffix = this.getOrdinalSuffix(gameState.inning);
    const parts = [
      runnerText,
      `${gameState.outs} outs`,
      `${gameState.inning}${suffix} ${gameState.inningState}`
    ];
    if (alert.reasons && alert.reasons.length) {
      parts.push(`Reasons: ${alert.reasons.join('; ')}`);
    }
    return parts.join(', ');
  }

  /**
   * Fallback description used when OpenAI fails to generate a suitable alert description.
   */
  private buildFallbackDescription(gameState: MLBGameStateV3, alert: SimpleAlert): string {
    const runners: string[] = [];
    if (gameState.runners.first) runners.push('1st');
    if (gameState.runners.second) runners.push('2nd');
    if (gameState.runners.third) runners.push('3rd');
    const suffix = this.getOrdinalSuffix(gameState.inning);
    return `${gameState.awayTeam} @ ${gameState.homeTeam}: ${Math.round(alert.probability * 100)}% scoring chance in the ${gameState.inning}${suffix} ${gameState.inningState} with ${runners.join('&') || 'no runners'}, ${gameState.outs} outs.`;
  }

  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';  
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  private generateDeduplicationKey(gameState: MLBGameStateV3, alertType: string): string {
    const basesHash = `${gameState.runners.first ? '1' : '0'}${gameState.runners.second ? '2' : '0'}${gameState.runners.third ? '3' : '0'}`;
    return `${gameState.gamePk}:${alertType}:${gameState.inning}:${gameState.inningState}:${basesHash}`;
  }

  private shouldEmitAlert(alert: SimpleAlert): boolean {
    const now = Date.now();
    const cached = this.deduplicationCache.get(alert.deduplicationKey);
    
    if (cached && (now - cached.timestamp) < 60000) {
      return false; // 60 second cooldown
    }
    
    return true;
  }

  private recordAlertEmission(alert: SimpleAlert): void {
    this.deduplicationCache.set(alert.deduplicationKey, {
      timestamp: Date.now(),
      priority: alert.priority
    });
    
    // Cleanup old entries
    if (this.deduplicationCache.size > 1000) {
      const oldestEntries = Array.from(this.deduplicationCache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)
        .slice(0, 100);
      
      for (const [key] of oldestEntries) {
        this.deduplicationCache.delete(key);
      }
    }
  }

  // === GAME MONITORING LOGIC ===

  async monitorLiveGames(): Promise<void> {
    try {
      const games = await this.getTodaysGames();
      const liveGames = games.filter(game => game.status.toLowerCase().includes('live') || game.status.toLowerCase().includes('in progress'));

      for (const game of liveGames) {
        try {
          const gameState = await this.fetchDetailedGameState(game.gamePk);
          if (gameState) {
            await this.checkGameSituations(gameState);
          }
        } catch (error) {
          console.error(`Error monitoring game ${game.gamePk}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in monitorLiveGames:', error);
    }
  }

  private async fetchDetailedGameState(gamePk: number): Promise<MLBGameStateV3 | null> {
    try {
      const url = `${this.MLB_API_BASE}/game/${gamePk}/linescore`;
      const data = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 5000
      });

      if (!data || !(data as any).currentInning) {
        return null;
      }

      const gameData = data as any;
      const inning = gameData.currentInning || 1;
      const inningState = gameData.inningState || 'top';
      const outs = gameData.outs || 0;

      // Extract runner information
      const runners: EnhancedRunners = {};
      if (gameData.offense?.first) {
        runners.first = {
          playerId: gameData.offense.first.id || 0,
          playerName: gameData.offense.first.fullName || 'Unknown'
        };
      }
      if (gameData.offense?.second) {
        runners.second = {
          playerId: gameData.offense.second.id || 0,
          playerName: gameData.offense.second.fullName || 'Unknown'
        };
      }
      if (gameData.offense?.third) {
        runners.third = {
          playerId: gameData.offense.third.id || 0,
          playerName: gameData.offense.third.fullName || 'Unknown'
        };
      }

      return {
        gameId: gamePk.toString(),
        gamePk: gamePk,
        homeTeam: gameData.teams?.home?.team?.name || 'Unknown',
        awayTeam: gameData.teams?.away?.team?.name || 'Unknown',
        homeScore: gameData.teams?.home?.runs || 0,
        awayScore: gameData.teams?.away?.runs || 0,
        inning: inning,
        inningState: inningState,
        outs: outs,
        runners: runners,
        currentBatter: gameData.offense?.batter ? {
          id: gameData.offense.batter.id || 0,
          name: gameData.offense.batter.fullName || 'Unknown',
          position: '',
          stats: {
            hr: 0,
            avg: 0,
            ops: 0
          }
        } : undefined,
        currentPitcher: gameData.defense?.pitcher ? {
          id: gameData.defense.pitcher.id || 0,
          name: gameData.defense.pitcher.fullName || 'Unknown',
          position: 'P',
          stats: {
            era: 0,
            whip: 0
          }
        } : undefined,
        ballpark: gameData.venue?.name,
        venue: gameData.venue?.name,
        balls: gameData.balls || 0,
        strikes: gameData.strikes || 0
      };
    } catch (error) {
      console.error(`Error fetching detailed game state for ${gamePk}:`, error);
      return null;
    }
  }

  // Legacy methods for compatibility
  private isScoringSituation(gameState: MLBGameStateV3): boolean {
    // Simple scoring situation logic
    return (
      !!gameState.runners.second || !!gameState.runners.third || // RISP
      (!!gameState.runners.first && !!gameState.runners.second && !!gameState.runners.third) || // Bases loaded
      (gameState.inning >= 7 && Math.abs(gameState.homeScore - gameState.awayScore) <= 1) // Late close game
    );
  }

  private calculatePriority(gameState: MLBGameStateV3): number {
    let priority = 70;

    // Bases loaded
    if (gameState.runners.first && gameState.runners.second && gameState.runners.third) {
      priority = 95;
    }
    // RISP
    else if (gameState.runners.second || gameState.runners.third) {
      priority = 85;
    }
    // Runner on first only
    else if (gameState.runners.first) {
      priority = 75;
    }

    // Late inning boost
    if (gameState.inning >= 7) priority += 5;
    if (gameState.inning >= 9) priority += 5;

    // Close game boost
    if (Math.abs(gameState.homeScore - gameState.awayScore) <= 1) {
      priority += 10;
    }

    return Math.min(priority, 100);
  }

  private calculateScoringProbability(gameState: MLBGameStateV3): number {
    let baseProb = 0.25; // Base scoring probability

    // Adjust for runners
    if (gameState.runners.first && gameState.runners.second && gameState.runners.third) {
      baseProb = 0.85; // Bases loaded
    } else if (gameState.runners.third) {
      baseProb = 0.65; // Runner on third
    } else if (gameState.runners.second) {
      baseProb = 0.45; // Runner on second
    } else if (gameState.runners.first) {
      baseProb = 0.30; // Runner on first
    }

    // Adjust for outs
    if (gameState.outs === 0) baseProb *= 1.2;
    else if (gameState.outs === 1) baseProb *= 1.0;
    else if (gameState.outs === 2) baseProb *= 0.7;

    return Math.min(baseProb, 0.95);
  }
}