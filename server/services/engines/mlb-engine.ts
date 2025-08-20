import { BaseSportEngine, AlertConfig } from './base-engine';
import { mlbApi } from '../mlb-api';
import { GameContext, PREDICTION_EVENTS } from '../ai-predictions';
import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { analyzeAlert } from '../openai';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';

interface MLBGameState {
  gameId: string;
  gamePk: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  balls: number;
  strikes: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  currentBatter?: {
    id: number;
    name: string;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      obp: number;
      ops: number;
      slg: number;
      atBats: number;
      hits: number;
      strikeOuts: number;
      walks: number;
    };
  };
  currentPitcher?: {
    id: number;
    name: string;
    throwHand: string;
    stats: {
      era: number;
      whip: number;
      strikeOuts: number;
      walks: number;
      wins: number;
      losses: number;
      saves: number;
      inningsPitched: string;
      hits: number;
      earnedRuns: number;
      homeRuns: number;
    };
  };
}

// Interface for the alert data to be inserted into storage
interface InsertAlert {
  id: string;
  type: string;
  sport: string;
  team: string;
  opponent: string;
  message: string;
  probability: number;
  priority: number;
  gameInfo: any; // Using 'any' for broader compatibility, but ideally a specific type
  aiContext?: string;
  aiConfidence: number;
  createdAt: Date;
  isRead: boolean;
}

export class MLBEngine extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 2000; // 2 seconds for ultra-fast real-time monitoring

  // Track last game state to prevent duplicate alerts
  private lastGameStates = new Map<string, string>(); // key: gameId-alertType, value: state hash

  alertConfigs: AlertConfig[] = [
    {
      type: "Game Start",
      settingKey: "inningChange",
      priority: 40,
      probability: 1.0,
      description: "⚾ GAME START - First pitch!",
      conditions: (state: MLBGameState) => 
        state.inning === 1 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "7th Inning Warning",
      settingKey: "lateInning",
      priority: 50,
      probability: 1.0,
      description: "🚨 7TH INNING STRETCH - Critical innings ahead!",
      conditions: (state: MLBGameState) => 
        state.inning === 7 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "Tie Game 9th Inning",
      settingKey: "closeGame",
      priority: 85,
      probability: 1.0, 
      description: "🔥 TIE GAME 9TH INNING - FINAL INNING DRAMA!",
      conditions: (state: MLBGameState) => 
        state.inning === 9 && state.inningState === 'top' && state.outs === 0 && 
        state.homeScore === state.awayScore
    },
    {
      type: "Bases Loaded 0 Outs",
      settingKey: "risp",
      priority: 95,
      probability: 1.0,
      description: "🚨 BASES LOADED, 0 OUTS! - MAXIMUM scoring opportunity!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 0
    },
    {
      type: "Bases Loaded 1 Out", 
      settingKey: "risp",
      priority: 85,
      probability: 1.0,
      description: "🔥 BASES LOADED, 1 OUT! - High-value scoring chance!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 1
    },
    {
      type: "Bases Loaded 2 Outs", 
      settingKey: "risp",
      priority: 95,
      probability: 1.0,
      description: "🚨 BASES LOADED, 2 OUTS! - MAXIMUM PRESSURE! Make or break moment!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 2
    },
    {
      type: "Runner on 3rd, 1 Out",
      settingKey: "risp",
      priority: 80,
      probability: 0.85,
      description: "🎯 RUNNER ON 3RD, 1 OUT! (55% scoring probability)",
      conditions: (state: MLBGameState) => 
        state.runners.third && !state.runners.first && !state.runners.second && state.outs === 1
    },
    {
      type: "Runners on 2nd & 3rd, 1 Out",
      settingKey: "risp",
      priority: 85,
      probability: 0.90,
      description: "🔥 RUNNERS ON 2ND & 3RD, 1 OUT! Prime scoring opportunity",
      conditions: (state: MLBGameState) => 
        state.runners.second && state.runners.third && !state.runners.first && state.outs === 1
    },
    {
      type: "Runners In Scoring Position",
      settingKey: "risp",
      priority: 70,
      probability: 0.8,
      description: "⚡ PRESSURE COOKER! Runners in scoring position",
      conditions: (state: MLBGameState) => 
        (state.runners.second || state.runners.third) && state.outs < 2
    },
    {
      type: "Close Game", 
      settingKey: "closeGame",
      priority: 80,
      probability: 0.7,
      description: "🔥 NAIL-BITER! One-run game!",
      conditions: (state: MLBGameState) => 
        Math.abs(state.homeScore - state.awayScore) <= 1 && state.inning >= 7
    },
    {
      type: "Late Inning Pressure",
      settingKey: "lateInning",
      priority: 65,
      probability: 0.6,
      description: "⏰ CRUNCH TIME! Final innings",
      conditions: (state: MLBGameState) => 
        state.inning >= 8 && Math.abs(state.homeScore - state.awayScore) <= 3
    },
    // Big-Time Hitter Alerts
    {
      type: "Star Batter Alert",
      settingKey: "starBatter",
      priority: 80,
      probability: 1.0,
      description: "⭐ STAR BATTER UP! Elite hitter at the plate!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter) return false;
        const stats = state.currentBatter.stats;
        return stats.avg >= 0.300 || stats.hr >= 20 || stats.ops >= 0.900;
      }
    },
    {
      type: "Power Hitter Alert",
      settingKey: "powerHitter", 
      priority: 85,
      probability: 1.0,
      description: "💪 POWER HITTER! 25+ HR slugger with runners on base!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter) return false;
        const hasRunnersOn = state.runners.first || state.runners.second || state.runners.third;
        return state.currentBatter.stats.hr >= 25 && hasRunnersOn;
      }
    },
    {
      type: "Elite Hitter in Clutch",
      settingKey: "eliteClutch",
      priority: 90,
      probability: 1.0,
      description: "🔥 ELITE HITTER IN CLUTCH! High OPS batter in pressure situation!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter) return false;
        const isClutch = (state.runners.second || state.runners.third) && state.outs >= 1;
        const isLateInning = state.inning >= 7;
        return state.currentBatter.stats.ops >= 0.850 && (isClutch || isLateInning);
      }
    },
    {
      type: "300+ Hitter Alert",
      settingKey: "avgHitter",
      priority: 75,
      probability: 1.0,
      description: "🎯 .300+ HITTER! Premium contact hitter at bat!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter) return false;
        return state.currentBatter.stats.avg >= 0.300;
      }
    },
    {
      type: "RBI Machine Alert",
      settingKey: "rbiMachine",
      priority: 80,
      probability: 1.0,
      description: "🏃‍♂️ RBI MACHINE! 80+ RBI producer with scoring opportunity!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter) return false;
        const scoringPosition = state.runners.second || state.runners.third;
        return state.currentBatter.stats.rbi >= 80 && scoringPosition;
      }
    },
    // AI Prediction-based alerts
    {
      type: "Home Run Situations",
      settingKey: "homeRun",
      priority: 85,
      probability: 1.0,
      description: "🚀 POWER ALERT! High home run potential!",
      isPrediction: true,
      predictionEvents: ["Home Run"],
      minimumPredictionProbability: 75
    },
    {
      type: "RBI Opportunity",
      priority: 75,
      probability: 1.0,
      description: "🎯 RBI OPPORTUNITY - High scoring probability!",
      isPrediction: true,
      predictionEvents: ["RBI Hit", "Scoring Play"],
      minimumPredictionProbability: 70
    },
    {
      type: "Clutch Moment Prediction",
      priority: 90,
      probability: 1.0,
      description: "⚡ CLUTCH MOMENT - AI detects game-changing potential!",
      isPrediction: true,
      predictionEvents: ["Walk-off Hit", "Grand Slam", "Game Winner"],
      minimumPredictionProbability: 65
    },
    // Live Events Alerts
    {
      type: "Runners on Base",
      settingKey: "runnersOnBase",
      priority: 60,
      probability: 1.0,
      description: "🏃 Runners on Base - Scoring opportunity developing!",
      conditions: (state: MLBGameState) => 
        state.runners.first || state.runners.second || state.runners.third
    },
    {
      type: "Hit Alert",
      settingKey: "hits",
      priority: 70,
      probability: 1.0,
      description: "🏏 HIT! Base hit extends the inning!",
      isPrediction: true,
      predictionEvents: ["Hit", "Single", "Double", "Triple"],
      minimumPredictionProbability: 60
    },
    {
      type: "Scoring Play",
      settingKey: "scoring",
      priority: 85,
      probability: 1.0,
      description: "🏃 TEAM SCORES! Run crosses the plate!",
      isPrediction: true,
      predictionEvents: ["Scoring Play", "RBI Hit"],
      minimumPredictionProbability: 70
    },
    {
      type: "Inning Change",
      settingKey: "inningChange",
      priority: 50,
      probability: 1.0,
      description: "🚀 New inning! Momentum shift opportunity",
      conditions: (state: MLBGameState) => 
        state.outs === 0 && (state.inningState === 'top' || state.inningState === 'bottom')
    },
    {
      type: "Home Run Alert",
      settingKey: "homeRunAlert",
      priority: 95,
      probability: 1.0,
      description: "🚀 HOME RUN! Ball is gone!",
      isPrediction: true,
      predictionEvents: ["Home Run"],
      minimumPredictionProbability: 75
    },
    {
      type: "Strikeout Alert",
      settingKey: "strikeouts",
      priority: 65,
      probability: 1.0,
      description: "⚾ STRIKEOUT! Batter goes down swinging!",
      isPrediction: true,
      predictionEvents: ["Strikeout"],
      minimumPredictionProbability: 70
    }
  ];

  extractGameState(liveFeed: any): MLBGameState | null {
    try {
      const linescore = liveFeed.liveData.linescore;
      const gameData = liveFeed.gameData;

      // Extract current batter and pitcher data
      let currentBatter = undefined;
      let currentPitcher = undefined;

      try {
        const plays = liveFeed.liveData?.plays;
        const currentPlay = plays?.currentPlay;

        // Get current batter
        if (currentPlay?.matchup?.batter) {
          const batter = currentPlay.matchup.batter;
          const batterStats = batter.stats?.find((stat: any) => stat.type?.displayName === 'statsSingleSeason')?.stats;

          currentBatter = {
            id: batter.id,
            name: batter.fullName || 'Unknown Batter',
            batSide: batter.batSide?.code || 'U',
            stats: {
              avg: batterStats?.avg ? parseFloat(batterStats.avg) : 0,
              hr: batterStats?.homeRuns || 0,
              rbi: batterStats?.rbi || 0,
              obp: batterStats?.obp ? parseFloat(batterStats.obp) : 0,
              ops: batterStats?.ops ? parseFloat(batterStats.ops) : 0,
              slg: batterStats?.slg ? parseFloat(batterStats.slg) : 0,
              atBats: batterStats?.atBats || 0,
              hits: batterStats?.hits || 0,
              strikeOuts: batterStats?.strikeOuts || 0,
              walks: batterStats?.baseOnBalls || 0
            }
          };
        }

        // Get current pitcher
        if (currentPlay?.matchup?.pitcher) {
          const pitcher = currentPlay.matchup.pitcher;
          const pitcherStats = pitcher.stats?.find((stat: any) => stat.type?.displayName === 'statsSingleSeason')?.stats;

          currentPitcher = {
            id: pitcher.id,
            name: pitcher.fullName || 'Unknown Pitcher',
            throwHand: pitcher.pitchHand?.code || 'U',
            stats: {
              era: pitcherStats?.era ? parseFloat(pitcherStats.era) : 0,
              whip: pitcherStats?.whip ? parseFloat(pitcherStats.whip) : 0,
              strikeOuts: pitcherStats?.strikeOuts || 0,
              walks: pitcherStats?.baseOnBalls || 0,
              wins: pitcherStats?.wins || 0,
              losses: pitcherStats?.losses || 0,
              saves: pitcherStats?.saves || 0,
              inningsPitched: pitcherStats?.inningsPitched || '0.0',
              hits: pitcherStats?.hits || 0,
              earnedRuns: pitcherStats?.earnedRuns || 0,
              homeRuns: pitcherStats?.homeRuns || 0
            }
          };
        }
      } catch (playerError) {
        console.log('Player data not available in current play');
      }

      const gameState = {
        gameId: `mlb-${gameData.game.pk}`,
        gamePk: gameData.game.pk,
        inning: linescore.currentInning || 1,
        inningState: (linescore.inningState === 'Top' ? 'top' : 'bottom') as 'top' | 'bottom',
        outs: linescore.outs || 0,
        balls: linescore.balls || 0,
        strikes: linescore.strikes || 0,
        runners: {
          first: !!linescore.offense?.first,
          second: !!linescore.offense?.second, 
          third: !!linescore.offense?.third,
        },
        homeScore: linescore.teams.home.runs || 0,
        awayScore: linescore.teams.away.runs || 0,
        homeTeam: gameData.teams.home.name,
        awayTeam: gameData.teams.away.name,
        currentBatter,
        currentPitcher,
      };

      // Debug logging for live game state
      console.log(`🔍 MLB Game State Debug - ${gameState.awayTeam} @ ${gameState.homeTeam}:`);
      console.log(`   Inning: ${gameState.inning} ${gameState.inningState}`);
      console.log(`   Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}`);
      console.log(`   Runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third}`);
      console.log(`   Outs: ${gameState.outs}, Balls: ${gameState.balls}, Strikes: ${gameState.strikes}`);

      if (gameState.currentBatter) {
        console.log(`   🏏 Current Batter: ${gameState.currentBatter.name} (${gameState.currentBatter.batSide}) - AVG: ${gameState.currentBatter.stats.avg}, HR: ${gameState.currentBatter.stats.hr}, RBI: ${gameState.currentBatter.stats.rbi}, OPS: ${gameState.currentBatter.stats.ops}`);
      }

      if (gameState.currentPitcher) {
        console.log(`   ⚾ Current Pitcher: ${gameState.currentPitcher.name} (${gameState.currentPitcher.throwHand}) - ERA: ${gameState.currentPitcher.stats.era}, WHIP: ${gameState.currentPitcher.stats.whip}, K: ${gameState.currentPitcher.stats.strikeOuts}, W-L: ${gameState.currentPitcher.stats.wins}-${gameState.currentPitcher.stats.losses}`);
      }


      return gameState;
    } catch (error) {
      console.error('Error extracting MLB game state:', error);
      return null;
    }
  }

  protected getGameSpecificInfo(gameState: MLBGameState) {
    return {
      inning: gameState.inning.toString(),
      inningState: gameState.inningState,
      outs: gameState.outs,
      balls: gameState.balls,
      strikes: gameState.strikes,
      runners: gameState.runners,
      priority: 85,
      scoringProbability: this.calculateScoringProbability(gameState),
      // Include current matchup for team planning context
      currentBatter: gameState.currentBatter ? {
        id: gameState.currentBatter.id,
        name: gameState.currentBatter.name,
        batSide: gameState.currentBatter.batSide,
        stats: {
          avg: gameState.currentBatter.stats.avg,
          hr: gameState.currentBatter.stats.hr,
          rbi: gameState.currentBatter.stats.rbi,
          obp: gameState.currentBatter.stats.obp,
          ops: gameState.currentBatter.stats.ops
        }
      } : undefined,
      currentPitcher: gameState.currentPitcher ? {
        id: gameState.currentPitcher.id,
        name: gameState.currentPitcher.name,
        throwHand: gameState.currentPitcher.throwHand,
        stats: {
          era: gameState.currentPitcher.stats.era,
          whip: gameState.currentPitcher.stats.whip,
          strikeOuts: gameState.currentPitcher.stats.strikeOuts,
          wins: gameState.currentPitcher.stats.wins,
          losses: gameState.currentPitcher.stats.losses
        }
      } : undefined
    };
  }

  protected buildGameContext(gameState: MLBGameState): GameContext {
    const runnersOn: string[] = [];
    if (gameState.runners.first) runnersOn.push("1st");
    if (gameState.runners.second) runnersOn.push("2nd");
    if (gameState.runners.third) runnersOn.push("3rd");

    return {
      sport: this.sport,
      inning: gameState.inning,
      outs: gameState.outs,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      scoreDifference: gameState.homeScore - gameState.awayScore,
      runnersOn,
      currentBatter: gameState.currentBatter,
      currentPitcher: gameState.currentPitcher,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      gameState: 'Live'
    };
  }

  private calculateScoringProbability(gameState: MLBGameState): number {
    let probability = 30; // Base probability

    // Adjust based on runners
    if (gameState.runners.first) probability += 10;
    if (gameState.runners.second) probability += 20;  
    if (gameState.runners.third) probability += 25;

    // Adjust based on outs
    if (gameState.outs === 0) probability += 20;
    else if (gameState.outs === 1) probability += 10;
    else probability -= 10;

    // Late inning pressure
    if (gameState.inning >= 8) probability += 15;

    return Math.min(95, Math.max(5, probability));
  }

  // Generate dynamic description based on actual game state
  private generateDynamicDescription(alert: AlertConfig, gameState: MLBGameState): string {
    const runners = gameState.runners;
    const outs = gameState.outs;
    const scoringProb = this.calculateScoringProbability(gameState);
    const batter = gameState.currentBatter;

    // Build runner description
    const runnerPositions = [];
    if (runners.first) runnerPositions.push('1ST');
    if (runners.second) runnerPositions.push('2ND');
    if (runners.third) runnerPositions.push('3RD');

    switch (alert.type) {
      case 'Star Batter Alert':
        if (batter) {
          const highlights = [];
          if (batter.stats.avg >= 0.300) highlights.push(`${batter.stats.avg.toFixed(3)} AVG`);
          if (batter.stats.hr >= 20) highlights.push(`${batter.stats.hr} HR`);
          if (batter.stats.ops >= 0.900) highlights.push(`${batter.stats.ops.toFixed(3)} OPS`);
          return `⭐ STAR BATTER: ${batter.name} (${highlights.join(', ')}) - ${outs} out${outs !== 1 ? 's' : ''}!`;
        }
        return alert.description;

      case 'Power Hitter Alert':
        if (batter) {
          return `💪 POWER HITTER: ${batter.name} (${batter.stats.hr} HR) with runners on base! ${outs} out${outs !== 1 ? 's' : ''}!`;
        }
        return alert.description;

      case 'Elite Hitter in Clutch':
        if (batter) {
          return `🔥 ELITE CLUTCH: ${batter.name} (${batter.stats.ops.toFixed(3)} OPS) in pressure situation! ${outs} out${outs !== 1 ? 's' : ''}!`;
        }
        return alert.description;

      case '300+ Hitter Alert':
        if (batter) {
          return `🎯 .300+ HITTER: ${batter.name} (${batter.stats.avg.toFixed(3)} AVG, ${batter.stats.hr} HR) at the plate!`;
        }
        return alert.description;

      case 'RBI Machine Alert':
        if (batter) {
          return `🏃‍♂️ RBI MACHINE: ${batter.name} (${batter.stats.rbi} RBIs) with scoring opportunity! ${outs} out${outs !== 1 ? 's' : ''}!`;
        }
        return alert.description;

      case 'Runner on 3rd, 1 Out':
      case 'Runner on 3rd, 1 Out':
        return `🎯 RUNNER ON 3RD, ${outs} OUT! (${scoringProb}% scoring probability)`;

      case 'Runners on 2nd & 3rd, 1 Out':
        return `🔥 RUNNERS ON 2ND & 3RD, ${outs} OUT! (${scoringProb}% scoring probability)`;

      case 'Bases Loaded 0 Outs':
        return `🚨 BASES LOADED, 0 OUTS! (${scoringProb}% scoring probability) - MAXIMUM opportunity!`;

      case 'Bases Loaded 1 Out':
        return `🔥 BASES LOADED, 1 OUT! (${scoringProb}% scoring probability) - High-value scoring chance!`;

      case 'Bases Loaded 2 Outs':
        return `🚨 BASES LOADED, 2 OUTS! (${scoringProb}% scoring probability) - MAXIMUM PRESSURE! Make or break moment!`;

      case 'Runners In Scoring Position':
        const scoringRunners = [];
        if (runners.second) scoringRunners.push('2ND');
        if (runners.third) scoringRunners.push('3RD');

        if (scoringRunners.length > 0) {
          const runnerText = scoringRunners.join(' & ');
          return `⚡ RUNNER${scoringRunners.length > 1 ? 'S' : ''} ON ${runnerText}, ${outs} OUT${outs !== 1 ? 'S' : ''}! (${scoringProb}% scoring probability)`;
        }
        return `⚡ PRESSURE COOKER! Runners in scoring position, ${outs} out${outs !== 1 ? 's' : ''}! (${scoringProb}% scoring probability)`;

      case 'Runners on Base':
        if (runnerPositions.length > 0) {
          const runnerText = runnerPositions.join(' & ');
          return `🏃 RUNNER${runnerPositions.length > 1 ? 'S' : ''} ON ${runnerText}, ${outs} OUT${outs !== 1 ? 'S' : ''}! (${scoringProb}% scoring probability)`;
        }
        return `🏃 Runners on base, ${outs} out${outs !== 1 ? 's' : ''}! (${scoringProb}% scoring probability)`;

      case 'Close Game':
        const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
        return `🔥 NAIL-BITER! ${scoreDiff}-run game in inning ${gameState.inning}! (${scoringProb}% scoring probability)`;

      case 'Late Inning Pressure':
        return `⏰ CRUNCH TIME! Final innings - Inning ${gameState.inning}, ${outs} out${outs !== 1 ? 's' : ''}! (${scoringProb}% scoring probability)`;

      case 'Tie Game 9th Inning':
        return `🔥 TIE GAME ${gameState.inning}TH INNING! (${scoringProb}% scoring probability) - FINAL INNING DRAMA!`;

      case '7th Inning Warning':
        return `🚨 7TH INNING STRETCH! (${scoringProb}% scoring probability) - Critical innings ahead!`;

      case 'Game Start':
        return `⚾ GAME START - First pitch! (${scoringProb}% scoring probability)`;

      default:
        // For other alerts, use the original description but add scoring probability
        return `${alert.description} (${scoringProb}% scoring probability)`;
    }
  }

  // Create a hash specific to MLB game state
  private createMLBStateHash(gameState: MLBGameState, alertType: string): string {
    // Only track properties relevant to each alert type
    let relevantState: any = {};

    // For runner-based alerts, track runners and outs
    if (alertType.toLowerCase().includes('runner') || alertType.toLowerCase().includes('bases')) {
      relevantState = {
        runners: gameState.runners,
        outs: gameState.outs,
        inning: gameState.inning,
        inningState: gameState.inningState
      };
    }
    // For inning-based alerts, track inning changes
    else if (alertType.toLowerCase().includes('inning')) {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState
      };
    }
    // For score-based alerts
    else if (alertType.toLowerCase().includes('score') || alertType.toLowerCase().includes('tie') || alertType.toLowerCase().includes('close')) {
      relevantState = {
        score: `${gameState.awayScore}-${gameState.homeScore}`,
        inning: gameState.inning
      };
    }
    // Default: track major game state changes
    else {
      relevantState = {
        inning: gameState.inning,
        inningState: gameState.inningState,
        outs: gameState.outs,
        runners: gameState.runners,
        score: `${gameState.awayScore}-${gameState.homeScore}`
      };
    }

    return JSON.stringify(relevantState);
  }

  // Check if we should trigger this alert (no duplicates)
  private shouldTriggerMLBAlert(alertType: string, gameState: MLBGameState): boolean {
    const key = `${gameState.gameId}-${alertType}`;
    const currentStateHash = this.createMLBStateHash(gameState, alertType);
    const lastStateHash = this.lastGameStates.get(key);

    if (lastStateHash === currentStateHash) {
      // Same game state, don't trigger duplicate alert
      return false;
    }

    // New game state, allow alert and track it
    this.lastGameStates.set(key, currentStateHash);
    return true;
  }

  // Override processAlerts to use dynamic descriptions and conditional AI analysis
  async processAlerts(triggeredAlerts: AlertConfig[], gameState: MLBGameState): Promise<void> {
    for (const alert of triggeredAlerts) {
      // Use MLB-specific duplicate detection
      if (!this.shouldTriggerMLBAlert(alert.type, gameState)) {
        continue;
      }

      try {
        // Get weather data for context
        const weatherData = await getWeatherData(gameState.homeTeam);

        // TEMPORARILY DISABLED: All OpenAI calls to reduce API usage
        let aiAnalysis = { context: "Standard game situation", confidence: 0 };
        // Commenting out to ensure zero API calls
        /*
        if (alert.priority >= 85) {
          const { analyzeAlert } = await import('../openai');
          aiAnalysis = await analyzeAlert(alert.type, this.sport, gameState, weatherData);
        }
        */

        const alertData: InsertAlert = {
          type: alert.type,
          sport: this.sport,
          title: alert.type,
          description: alert.description,
          gameInfo: {
            ...gameState,
            weather: weatherData
          },
          aiContext: aiAnalysis.context,
          aiConfidence: aiAnalysis.confidence
        };

        const createdAlert = await storage.createAlert(alertData);

        // Send to Telegram for high-priority alerts
        if (alert.priority >= 75 && settings?.telegramEnabled) {
          const telegramConfig = {
            botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
            chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
          };

          const sent = await sendTelegramAlert(telegramConfig, {
            ...createdAlert,
            aiContext: createdAlert.aiContext || undefined
          });
          if (sent) {
            await storage.markAlertSentToTelegram(createdAlert.id);
          }
        }

        console.log(`✅ ${this.sport} Alert created: ${alert.type} (Priority: ${alert.priority})`);

        // Broadcast to clients if callback exists
        if (this.onAlert) {
          this.onAlert(createdAlert);
        }

      } catch (error) {
        console.error(`Error processing ${this.sport} alert:`, error);
      }
    }
  }

  async monitor() {
    try {
      // Check if demo mode is active and real-time alerts should be paused
      const { demoSimulator } = await import('../../demo-simulator');
      if (demoSimulator.shouldPauseRealTimeAlerts()) {
        console.log('⏸️ MLB monitoring paused - demo mode active');
        return;
      }

      const settings = await storage.getSettingsBySport(this.sport);
      console.log(`📊 MLB Settings - AI Enabled: ${settings?.aiEnabled}`);

      // Enable core MLB settings if not set
      if (settings) {
        const coreSettings = {
          risp: true,
          closeGame: true,
          lateInning: true,
          starBatter: true,
          powerHitter: true,
          runnersOnBase: true,
          inningChange: true
        };

        let needsUpdate = false;
        const alertTypes = settings.alertTypes as any;
        for (const [key, value] of Object.entries(coreSettings)) {
          if (alertTypes[key] === undefined) {
            alertTypes[key] = value;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await storage.updateSettings(this.sport, { alertTypes });
          console.log(`✅ Updated MLB settings with core alert types`);
        }
      }

      const liveGames = await mlbApi.getLiveGames();
      console.log(`🎯 Found ${liveGames.length} live games`);
      if (liveGames.length === 0) return;

      console.log(`🔍 Checking ${liveGames.length} live ${this.sport} games...`);

      for (const game of liveGames) {
        try {
          console.log(`🎮 Processing game: ${game.awayTeam} @ ${game.homeTeam} (State: ${game.gameState}, PK: ${game.gamePk})`);

          if (game.gameState !== 'Live') {
            console.log(`⏭️ Skipping non-live game (${game.gameState})`);
            continue;
          }

          if (!game.gamePk) {
            console.log(`⏭️ Skipping game with no gamePk`);
            continue;
          }

          console.log(`🔍 Fetching live feed for game ${game.gamePk} (${game.awayTeam} @ ${game.homeTeam})`);
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);

          // Skip if live feed data isn't available yet (returns null for 404)
          if (!liveFeed) {
            console.log(`⚠️ No live feed data available for game ${game.gamePk} yet`);
            continue;
          }

          console.log(`✅ Got live feed data for game ${game.gamePk}, processing...`);

          const gameState = this.extractGameState(liveFeed);

          if (!gameState) continue;

          const triggeredAlerts = await this.checkAlertConditions(gameState);

          if (triggeredAlerts.length > 0) {
            console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
            console.log(`   Alert types triggered: ${triggeredAlerts.map(a => a.type).join(', ')}`);
            await this.processAlerts(triggeredAlerts, gameState);

            // Trigger AI analysis only for high-priority complex scenarios
            const highPriorityAlerts = triggeredAlerts.filter(alert => alert.priority >= 85);
            if (highPriorityAlerts.length > 0) {
              const { aiEngine } = await import('./ai-engine');
              const weatherData = await getWeatherData(gameState.homeTeam);
              await aiEngine.analyzeComplexScenario(gameState.gameId, this.sport, gameState, weatherData);
            }
          } else {
            console.log(`   No alerts triggered (runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third})`)
          }

        } catch (gameError) {
          console.error(`Error processing ${this.sport} game:`, gameError);
        }
      }

    } catch (error) {
      console.error(`${this.sport} monitoring error:`, error);
    }
  }
}

export const mlbEngine = new MLBEngine();