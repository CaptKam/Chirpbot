
import { MLBGameStateV3, SimpleAlert } from './index';
import { AlertFormatValidator } from './AlertFormatValidator';
import { getBetbookData, type AlertContext, type BetbookData } from './betbook-engine';

import mlbAlertModel from './mlbAlertModel.cjs';

interface MLBAlert {
  id: string;
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
  public onAlert?: (alert: any) => void;

  /**
   * LAW #6 & #7: Create standardized MLB alert with betting data
   */
  private async createStandardAlert(gameState: MLBGameStateV3, alertResult: any): Promise<MLBAlert> {
    const alertId = `mlb_${gameState.gameId}_${Date.now()}`;
    
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
    this.gameStates.set(gameState.gameId, gameState);

    // Check if situation warrants alert
    const modelResult = mlbAlertModel.checkScoringProbability(this.convertToModelFormat(gameState));
    
    if (!modelResult.shouldAlert) {
      return [];
    }

    // Create situation key for deduplication
    const situationKey = this.createSituationKey(gameState);
    const lastAlert = this.lastAlerts.get(gameState.gameId);

    // Only alert if situation changed
    if (lastAlert === situationKey) {
      return [];
    }

    // Create standardized alert
    const alert = await this.createStandardAlert(gameState, modelResult);
    
    // Validate compliance with Laws #6 and #7
    const validation = AlertFormatValidator.validateCompliance(alert);
    if (!validation.isValid) {
      console.error('ALERT COMPLIANCE VIOLATION:', validation.violations);
      return [];
    }

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
   * Process a specific game for live monitoring - Required for engine compatibility
   */
  async processSpecificGame(gameId: string): Promise<void> {
    try {
      // Fetch specific game data from MLB API
      const url = `https://statsapi.mlb.com/api/v1/game/${gameId}/linescore`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data || !data.teams) {
        console.log(`🔍 MLB: No data found for game ${gameId}`);
        return;
      }

      // Convert to MLBGameStateV3 format
      const gameState: MLBGameStateV3 = {
        gameId: gameId,
        homeTeam: data.teams.home.team?.name || 'Home Team',
        awayTeam: data.teams.away.team?.name || 'Away Team',
        homeScore: data.teams.home.runs || 0,
        awayScore: data.teams.away.runs || 0,
        inning: data.currentInning || 1,
        inningState: data.inningState || 'Top',
        outs: data.outs || 0,
        runners: {
          first: data.offense?.first || null,
          second: data.offense?.second || null,
          third: data.offense?.third || null
        },
        balls: data.balls || 0,
        strikes: data.strikes || 0
      };

      console.log(`⚾ MLB: Processing game ${gameId} - ${gameState.awayTeam} @ ${gameState.homeTeam} (${gameState.awayScore}-${gameState.homeScore})`);

      // Process the game state for alerts
      const alerts = await this.monitor(gameState);
      
      // If alerts generated, trigger them via callback
      if (alerts.length > 0 && this.onAlert) {
        alerts.forEach(alert => this.onAlert!(alert));
      }
      
    } catch (error) {
      console.error(`❌ MLB: Error processing game ${gameId}:`, error);
    }
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
