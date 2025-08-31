
import { MLBGameStateV3, SimpleAlert } from './index';
import { AlertFormatValidator } from './AlertFormatValidator';
import { getBetbookData, type AlertContext, type BetbookData } from './betbook-engine';
import { storage } from '../../storage';

import mlbAlertModel from './mlbAlertModel.cjs';

interface MLBAlert {
  id: string;
  debugId?: string;
  type: string;
  sport: 'MLB';
  title: string;
  description: string;
  gameInfo: {
    homeTeam: string;
    awayTeam: string;
    score: { home: number; away: number };
    status: string;
    situation: string;
    inning: number;
    inningState: string;
    outs: number;
    runners: { first: boolean; second: boolean; third: boolean };
  };
  betbookData?: BetbookData;
  priority: number;
  timestamp: Date;
  seen: boolean;
}

export class MLBEngine {
  private gameStates = new Map<string, MLBGameStateV3>();
  private lastAlerts = new Map<string, string>();

  /**
   * LAW #6 & #7: Create standardized MLB alert with betting data
   */
  private async createStandardAlert(gameState: MLBGameStateV3, alertResult: any): Promise<MLBAlert> {
    const alertId = `mlb_${gameState.gameId}_${Date.now()}`;
    const debugId = `${alertId.substring(0, 8).toUpperCase()}-S2-MLB`; // Step 2: MLB Engine
    
    console.log(`🔍 DEBUG: Creating MLB alert [${debugId}] via Step 2 MLB Engine`);
    
    // Use model validation
    const modelValidation = mlbAlertModel.checkScoringProbability(this.convertToModelFormat(gameState));
    
    const score = {
      home: gameState.homeScore,
      away: gameState.awayScore
    };

    // Generate betting context for betbook-engine
    const alertContext: AlertContext = {
      sport: 'MLB',
      gameId: gameState.gameId,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      inning: gameState.inning,
      outs: gameState.outs,
      runners: gameState.runners,
      priority: modelValidation.priority || 80,
      probability: modelValidation.probability || 0.65
    };

    // Generate betting data using betbook-engine
    let betbookData: BetbookData | undefined;
    try {
      betbookData = await getBetbookData(alertContext);
    } catch (error) {
      console.error('Error generating betbook data:', error);
      // Continue without betting data if it fails
    }

    return {
      id: alertId,
      debugId,
      type: 'SCORING',
      sport: 'MLB',
      title: AlertFormatValidator.generateStandardTitle('MLB', 'SCORING', score),
      description: AlertFormatValidator.generateStandardDescription('MLB', 'SCORING', gameState),
      gameInfo: {
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        score,
        status: 'Live',
        situation: 'RISP',
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs,
        runners: {
          first: !!gameState.runners.first,
          second: !!gameState.runners.second,
          third: !!gameState.runners.third
        }
      },
      betbookData,
      priority: modelValidation.priority || 80,
      timestamp: new Date(),
      seen: false
    };
  }

  /**
   * Main monitoring function - completely rewritten
   */
  async monitor(gameState: MLBGameStateV3): Promise<MLBAlert[]> {
    console.log(`🎯 MLB Monitor: Checking game ${gameState.gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam}`);
    console.log(`📊 Game State: Inning ${gameState.inning} ${gameState.inningState}, Score: ${gameState.awayScore}-${gameState.homeScore}`);
    console.log(`🏃 Runners: 1st=${!!gameState.runners.first}, 2nd=${!!gameState.runners.second}, 3rd=${!!gameState.runners.third}, Outs=${gameState.outs}`);
    
    this.gameStates.set(gameState.gameId, gameState);

    // Check if situation warrants alert
    const modelResult = mlbAlertModel.checkScoringProbability(this.convertToModelFormat(gameState));
    console.log(`🤖 Model Result:`, modelResult);
    
    if (!modelResult.shouldAlert) {
      console.log(`❌ MLB: Model says no alert needed for game ${gameState.gameId}`);
      return [];
    }

    // Create situation key for deduplication
    const situationKey = this.createSituationKey(gameState);
    const lastAlert = this.lastAlerts.get(gameState.gameId);
    console.log(`🔄 Dedup Check: Current=${situationKey}, Last=${lastAlert}`);

    // Only alert if situation changed
    if (lastAlert === situationKey) {
      console.log(`🔄 MLB: Skipping duplicate alert for game ${gameState.gameId}`);
      return [];
    }

    console.log(`🚨 MLB: Creating new alert for game ${gameState.gameId}`);

    // Create standardized alert
    const alert = await this.createStandardAlert(gameState, modelResult);
    
    // Validate compliance with Laws #6 and #7
    const validation = AlertFormatValidator.validateCompliance(alert);
    if (!validation.isValid) {
      console.error('ALERT COMPLIANCE VIOLATION:', validation.violations);
      return [];
    }

    console.log(`✅ MLB: Alert created successfully for game ${gameState.gameId}`);
    this.lastAlerts.set(gameState.gameId, situationKey);
    return [alert];
  }

  private createSituationKey(gameState: MLBGameStateV3): string {
    return `${gameState.inning}_${gameState.inningState}_${gameState.outs}_${gameState.runners.first ? '1' : '0'}${gameState.runners.second ? '1' : '0'}${gameState.runners.third ? '1' : '0'}`;
  }

  private convertToModelFormat(gameState: MLBGameStateV3) {
    return {
      clock: { inning: gameState.inning, outs: gameState.outs },
      bases: { 
        on1B: !!gameState.runners.first,
        on2B: !!gameState.runners.second, 
        on3B: !!gameState.runners.third
      },
      score: { home: gameState.homeScore, away: gameState.awayScore },
      batter: null,
      onDeck: null,
      pitcher: null,
      weather: null,
      park: null
    };
  }

  /**
   * Process a specific game for testing/debugging
   */
  async processSpecificGame(gameId: string): Promise<void> {
    console.log(`🎯 MLB: Processing specific game ${gameId}`);
    
    try {
      const games = await this.getTodaysGames();
      const game = games.find(g => g.gameId === gameId);
      
      if (!game) {
        console.log(`❌ MLB: Game ${gameId} not found in today's games`);
        // Create mock live game state for testing
        const mockGameState: MLBGameStateV3 = {
          gameId,
          gamePk: parseInt(gameId) || 12345,
          homeTeam: 'Boston Red Sox',
          awayTeam: 'New York Yankees',
          homeScore: 3,
          awayScore: 4,
          inning: 8,
          inningState: 'bottom',
          outs: 1,
          runners: {
            first: { playerId: 12345, playerName: 'Test Player' },
            second: { playerId: 12346, playerName: 'Test Player 2' },
            third: undefined
          }
        };
        
        console.log(`🧪 MLB: Using mock game state for testing`);
        const alerts = await this.monitor(mockGameState);
        
        if (alerts.length > 0) {
          console.log(`🚨 MLB: Generated ${alerts.length} test alerts - DISABLED FOR 4-STEP FLOW`);
          // DISABLED: Direct alert creation bypasses 4-step flow
          // These alerts should be created through the proper flow only
        }
        return;
      }

      // Build game state from real game data
      const gameState = await this.buildGameState(game);
      if (gameState) {
        const alerts = await this.monitor(gameState);
        
        if (alerts.length > 0) {
          console.log(`🚨 MLB: Generated ${alerts.length} alerts for game ${gameId} - DISABLED FOR 4-STEP FLOW`);
          // DISABLED: Direct alert creation bypasses 4-step flow
          // These alerts should be created through the proper flow only
        }
      }
    } catch (error) {
      console.error(`❌ MLB: Error processing game ${gameId}:`, error);
    }
  }

  /**
   * Build game state from game data
   */
  private async buildGameState(game: any): Promise<MLBGameStateV3 | null> {
    try {
      // IMPORTANT: Get monitored game data for accurate team names
      let fallbackHomeTeam = game.homeTeam;
      let fallbackAwayTeam = game.awayTeam;
      
      try {
        const monitoredGames = await storage.getAllMonitoredGames();
        console.log(`🔍 MLB: Found ${monitoredGames.length} total monitored games`);
        const monitoredGame = monitoredGames.find(mg => mg.gameId === game.gameId);
        if (monitoredGame) {
          fallbackHomeTeam = monitoredGame.homeTeamName || game.homeTeam;
          fallbackAwayTeam = monitoredGame.awayTeamName || game.awayTeam;
          console.log(`🏷️ MLB: Using monitored team names - ${fallbackAwayTeam} @ ${fallbackHomeTeam}`);
        } else {
          console.log(`🔍 MLB: Game ${game.gameId} not found in monitored games. Available IDs: [${monitoredGames.map(g => g.gameId).join(', ')}]`);
        }
      } catch (error) {
        console.error(`❌ MLB: Storage error for game ${game.gameId}:`, error);
        console.log(`⚠️ MLB: Could not get monitored game data for ${game.gameId}, using fallback`);
      }
      
      // For live games, get detailed data
      if (game.status && (game.status.includes('Progress') || game.status.includes('Live'))) {
        const detailedGame = await this.getGameDetails(game.gameId);
        if (detailedGame) {
          // Pass monitored team names as authoritative fallbacks
          return this.mapToGameState(detailedGame, fallbackHomeTeam, fallbackAwayTeam);
        }
      }
      
      // Basic game state from schedule data - Use monitored team names
      return {
        gameId: game.gameId,
        gamePk: parseInt(game.gameId) || game.gamePk,
        homeTeam: fallbackHomeTeam || 'Home',
        awayTeam: fallbackAwayTeam || 'Away',
        homeScore: game.homeScore || 0,
        awayScore: game.awayScore || 0,
        inning: game.inning || 1,
        inningState: game.inningState || 'top',
        outs: 0,
        runners: {}
      };
    } catch (error) {
      console.error('❌ MLB: Error building game state:', error);
      return null;
    }
  }

  /**
   * Get detailed game data from MLB API with FULL PLAYER DATA
   */
  private async getGameDetails(gameId: string): Promise<any> {
    try {
      // NEW: Get complete live game data with player information
      const url = `https://statsapi.mlb.com/api/v1/game/${gameId}/live?hydrate=linescore,plays,decisions,person,stats`;
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`📊 MLB: Retrieved detailed game data for ${gameId} with player info`);
      return data;
    } catch (error) {
      console.error(`❌ MLB: Error fetching game details for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Map API data to game state WITH FULL PLAYER DATA
   */
  private mapToGameState(gameData: any, fallbackHomeTeam?: string, fallbackAwayTeam?: string): MLBGameStateV3 {
    const linescore = gameData.liveData?.linescore || {};
    const currentInning = linescore.currentInning || 1;
    const inningState = linescore.inningState || 'Top';
    const offense = linescore.offense || {};
    const defense = linescore.defense || {};
    
    // Extract current batter data
    const currentBatter = offense.batter ? {
      id: offense.batter.id,
      name: offense.batter.fullName || 'Unknown Batter',
      position: offense.batter.primaryPosition?.name || 'Unknown',
      stats: {
        hr: offense.batter.stats?.batting?.homeRuns || 0,
        avg: parseFloat(offense.batter.stats?.batting?.avg || '0.000'),
        ops: parseFloat(offense.batter.stats?.batting?.ops || '0.000'),
        obp: parseFloat(offense.batter.stats?.batting?.obp || '0.000'),
        slg: parseFloat(offense.batter.stats?.batting?.slg || '0.000')
      }
    } : undefined;

    // Extract current pitcher data
    const currentPitcher = defense.pitcher ? {
      id: defense.pitcher.id,
      name: defense.pitcher.fullName || 'Unknown Pitcher',
      position: 'P',
      stats: {
        era: parseFloat(defense.pitcher.stats?.pitching?.era || '0.00'),
        whip: parseFloat(defense.pitcher.stats?.pitching?.whip || '0.00'),
        strikeOuts: defense.pitcher.stats?.pitching?.strikeOuts || 0,
        wins: defense.pitcher.stats?.pitching?.wins || 0,
        losses: defense.pitcher.stats?.pitching?.losses || 0
      }
    } : undefined;
    
    console.log(`👤 MLB Player Data: Batter=${currentBatter?.name}, Pitcher=${currentPitcher?.name}`);
    
    return {
      gameId: gameData.gamePk?.toString() || 'unknown',
      gamePk: gameData.gamePk || 0,
      homeTeam: gameData.gameData?.teams?.home?.name || fallbackHomeTeam || 'Home',
      awayTeam: gameData.gameData?.teams?.away?.name || fallbackAwayTeam || 'Away',
      homeScore: gameData.gameData?.teams?.home?.score || 0,
      awayScore: gameData.gameData?.teams?.away?.score || 0,
      inning: currentInning,
      inningState: inningState.toLowerCase() as 'top' | 'bottom',
      outs: linescore.outs || 0,
      balls: linescore.balls || 0,
      strikes: linescore.strikes || 0,
      currentBatter,
      currentPitcher,
      venue: gameData.gameData?.venue?.name,
      runners: {
        first: offense.first ? { 
          playerId: offense.first.id, 
          playerName: offense.first.fullName || 'Runner' 
        } : undefined,
        second: offense.second ? { 
          playerId: offense.second.id, 
          playerName: offense.second.fullName || 'Runner' 
        } : undefined,
        third: offense.third ? { 
          playerId: offense.third.id, 
          playerName: offense.third.fullName || 'Runner' 
        } : undefined
      }
    };
  }

  /**
   * Get today's MLB games - Required for API compatibility
   */
  async getTodaysGames(date: string = new Date().toISOString().split('T')[0]): Promise<any[]> {
    try {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.dates || data.dates.length === 0) {
        return [];
      }
      
      const games = data.dates[0].games || [];
      
      return games.map((game: any) => ({
        gameId: game.gamePk.toString(),
        homeTeam: game.teams.home.team.name,
        awayTeam: game.teams.away.team.name,
        homeScore: game.teams.home.score || 0,
        awayScore: game.teams.away.score || 0,
        status: game.status.abstractGameState,
        gameDate: game.gameDate,
        venue: game.venue.name,
        inning: game.linescore?.currentInning || 1,
        inningState: game.linescore?.inningState || 'Top'
      }));
    } catch (error) {
      console.error('Error fetching MLB games:', error);
      return [];
    }
  }
}
