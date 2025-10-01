import { GameState } from '../../base-engine';
import { scoreMlbAlert, MLBState, MLBAlertScore } from '../../mlb-prob-model';

export function convertGameStateToMLBState(gameState: GameState, additionalData?: {
  batterISO?: number;
  batterHardHit?: number;
  batterHandedness?: 'L'|'R'|'S';
  pitcherHR9?: number;
  pitcherGB?: number;
  pitcherHandedness?: 'L'|'R';
  platoonAdv?: boolean;
  parkHRFactor?: number;
  windMph?: number;
  windDir?: 'out'|'in'|'left'|'right'|'cross'|'unknown';
  tempF?: number;
}): MLBState {
  return {
    gameId: gameState.gameId,
    score: {
      away: gameState.awayScore || 0,
      home: gameState.homeScore || 0
    },
    half: {
      frame: gameState.isTopInning ? 'Top' : 'Bot',
      inning: gameState.inning || 1
    },
    outs: (gameState.outs || 0) as 0|1|2,
    bases: {
      on1B: gameState.hasFirst || false,
      on2B: gameState.hasSecond || false,
      on3B: gameState.hasThird || false
    },
    batter: additionalData ? {
      name: gameState.currentBatter,
      iso: additionalData.batterISO,
      hardHit: additionalData.batterHardHit,
      handedness: additionalData.batterHandedness
    } : {
      name: gameState.currentBatter
    },
    pitcher: additionalData ? {
      hrPer9: additionalData.pitcherHR9,
      gbRate: additionalData.pitcherGB,
      handedness: additionalData.pitcherHandedness
    } : undefined,
    matchup: additionalData?.platoonAdv !== undefined ? {
      platoonAdv: additionalData.platoonAdv
    } : undefined,
    park: additionalData?.parkHRFactor !== undefined ? {
      hrFactor: additionalData.parkHRFactor
    } : undefined,
    weather: (additionalData?.windMph !== undefined || additionalData?.tempF !== undefined) ? {
      windMph: additionalData.windMph,
      windDir: additionalData.windDir,
      tempF: additionalData.tempF
    } : undefined
  };
}

export function enhanceAlertWithProbability(
  gameState: GameState,
  baseContext: any,
  additionalData?: Parameters<typeof convertGameStateToMLBState>[1]
): { enhancedContext: any; probScore: MLBAlertScore | null } {
  const mlbState = convertGameStateToMLBState(gameState, additionalData);
  const probScore = scoreMlbAlert(mlbState);
  
  if (!probScore) {
    return { enhancedContext: baseContext, probScore: null };
  }
  
  const enhancedContext = {
    ...baseContext,
    mlbProbModel: {
      variant: probScore.variant,
      eventProbability: probScore.p_event,
      leverage: probScore.leverage,
      confidence: probScore.confidence,
      priority: probScore.priority,
      aiSummary: probScore.aiText,
      dedupeKey: probScore.dedupeKey
    }
  };
  
  return { enhancedContext, probScore };
}
