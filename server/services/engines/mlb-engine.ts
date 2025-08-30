
import { MLBGameStateV3, SimpleAlert } from './index';
import { AlertFormatValidator } from './AlertFormatValidator';

const mlbAlertModel = require('./mlbAlertModel.cjs');

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
  priority: number;
  timestamp: Date;
  seen: boolean;
}

export class MLBEngine {
  private gameStates = new Map<string, MLBGameStateV3>();
  private lastAlerts = new Map<string, string>();

  /**
   * LAW #6 & #7: Create standardized MLB alert
   */
  private createStandardAlert(gameState: MLBGameStateV3, alertResult: any): MLBAlert {
    const alertId = `mlb_${gameState.gameId}_${Date.now()}`;
    
    // Use model validation
    const modelValidation = mlbAlertModel.checkScoringProbability(this.convertToModelFormat(gameState));
    
    const score = {
      home: gameState.homeScore,
      away: gameState.awayScore
    };

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
    const alert = this.createStandardAlert(gameState, modelResult);
    
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
}
