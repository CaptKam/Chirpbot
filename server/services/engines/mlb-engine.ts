import { BaseSportEngine, AlertConfig } from './base-engine';
import { mlbApi } from '../mlb-api';
import { PREDICTION_EVENTS } from '../ai-predictions';
import { storage, type IStorage } from '../../storage';
import { getWeatherData } from '../weather';
import { analyzeAlert } from '../openai';
import { sendTelegramAlert } from '../telegram';
import { hssEngine, GameContext, GameDelta } from './hss-engine';

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
  onDeckBatter?: {
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

export class MLBEngine extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 2000; // 2 seconds for ultra-fast real-time monitoring

  // Track last game state to prevent duplicate alerts
  private lastGameStates = new Map<string, string>(); // key: gameId-alertType, value: state hash

  alertConfigs: AlertConfig[] = [
    {
      type: "Game Start",
      priority: 40,
      probability: 1.0,
      description: "⚾ GAME START - First pitch!",
      conditions: (state: MLBGameState) => 
        state.inning === 1 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "7th Inning Warning", 
      priority: 50,
      probability: 1.0,
      description: "🚨 7TH INNING STRETCH - Critical innings ahead!",
      conditions: (state: MLBGameState) => 
        state.inning === 7 && state.inningState === 'top' && state.outs === 0
    },
    {
      type: "Tie Game 9th Inning",
      priority: 85,
      probability: 1.0, 
      description: "🔥 TIE GAME 9TH INNING - FINAL INNING DRAMA!",
      conditions: (state: MLBGameState) => 
        state.inning === 9 && state.inningState === 'top' && state.outs === 0 && 
        state.homeScore === state.awayScore
    },
    {
      type: "Bases Loaded 0 Outs",
      priority: 95,
      probability: 1.0,
      description: "🚨 BASES LOADED, 0 OUTS! - MAXIMUM scoring opportunity!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 0
    },
    {
      type: "Bases Loaded 1 Out", 
      priority: 85,
      probability: 1.0,
      description: "🔥 BASES LOADED, 1 OUT! - High-value scoring chance!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && state.runners.third && state.outs === 1
    },
    {
      type: "Bases Loaded 2 Outs", 
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

  constructor() {
    super();
    
    // Show HSS example calculation on startup
    console.log('🎯 HSS Engine Example Calculation:');
    hssEngine.exampleCalculation();
  }

  extractGameState(liveFeed: any): MLBGameState | null {
    try {
      const linescore = liveFeed.liveData.linescore;
      const gameData = liveFeed.gameData;

      // Extract current batter, on-deck batter, and pitcher data
      let currentBatter = undefined;
      let onDeckBatter = undefined;
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

        // Get on-deck batter from lineup
        try {
          const lineup = liveFeed.liveData?.boxscore?.teams;
          const isTopInning = linescore.inningState === 'Top';
          const battingTeam = isTopInning ? lineup?.away : lineup?.home;

          if (battingTeam?.battingOrder) {
            // Find current batter position in lineup
            const currentBatterIndex = battingTeam.battingOrder.findIndex((player: any) => player.id === currentBatter?.id);
            if (currentBatterIndex !== -1 && currentBatterIndex < battingTeam.battingOrder.length - 1) {
              const onDeckPlayer = battingTeam.battingOrder[currentBatterIndex + 1];
              const onDeckStats = onDeckPlayer.stats?.find((stat: any) => stat.type?.displayName === 'statsSingleSeason')?.stats;

              onDeckBatter = {
                id: onDeckPlayer.id,
                name: onDeckPlayer.fullName || 'Unknown On-Deck',
                batSide: onDeckPlayer.batSide?.code || 'U',
                stats: {
                  avg: onDeckStats?.avg ? parseFloat(onDeckStats.avg) : 0,
                  hr: onDeckStats?.homeRuns || 0,
                  rbi: onDeckStats?.rbi || 0,
                  obp: onDeckStats?.obp ? parseFloat(onDeckStats.obp) : 0,
                  ops: onDeckStats?.ops ? parseFloat(onDeckStats.ops) : 0,
                  slg: onDeckStats?.slg ? parseFloat(onDeckStats.slg) : 0,
                  atBats: onDeckStats?.atBats || 0,
                  hits: onDeckStats?.hits || 0,
                  strikeOuts: onDeckStats?.strikeOuts || 0,
                  walks: onDeckStats?.baseOnBalls || 0
                }
              };
            }
          }
        } catch (onDeckError) {
          console.log('On-deck batter data not available');
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
        onDeckBatter,
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

      if (gameState.onDeckBatter) {
        console.log(`   🔄 On-Deck: ${gameState.onDeckBatter.name} (${gameState.onDeckBatter.batSide}) - AVG: ${gameState.onDeckBatter.stats.avg}, HR: ${gameState.onDeckBatter.stats.hr}, RBI: ${gameState.onDeckBatter.stats.rbi}, OPS: ${gameState.onDeckBatter.stats.ops}`);
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
          ops: gameState.currentBatter.stats.ops,
          slg: gameState.currentBatter.stats.slg,
          atBats: gameState.currentBatter.stats.atBats,
          hits: gameState.currentBatter.stats.hits,
          strikeOuts: gameState.currentBatter.stats.strikeOuts,
          walks: gameState.currentBatter.stats.walks
        }
      } : undefined,
      onDeckBatter: gameState.onDeckBatter ? {
        id: gameState.onDeckBatter.id,
        name: gameState.onDeckBatter.name,
        batSide: gameState.onDeckBatter.batSide,
        stats: {
          avg: gameState.onDeckBatter.stats.avg,
          hr: gameState.onDeckBatter.stats.hr,
          rbi: gameState.onDeckBatter.stats.rbi,
          obp: gameState.onDeckBatter.stats.obp,
          ops: gameState.onDeckBatter.stats.ops,
          slg: gameState.onDeckBatter.stats.slg,
          atBats: gameState.onDeckBatter.stats.atBats,
          hits: gameState.onDeckBatter.stats.hits,
          strikeOuts: gameState.onDeckBatter.stats.strikeOuts,
          walks: gameState.onDeckBatter.stats.walks
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
          walks: gameState.currentPitcher.stats.walks,
          wins: gameState.currentPitcher.stats.wins,
          losses: gameState.currentPitcher.stats.losses,
          saves: gameState.currentPitcher.stats.saves,
          inningsPitched: gameState.currentPitcher.stats.inningsPitched,
          hits: gameState.currentPitcher.stats.hits,
          earnedRuns: gameState.currentPitcher.stats.earnedRuns,
          homeRuns: gameState.currentPitcher.stats.homeRuns
        }
      } : undefined
    };
  }

  private buildGameContext(gameState: MLBGameState): GameContext {
    return {
      runners: gameState.runners,
      outs: gameState.outs,
      inning: gameState.inning,
      inningState: gameState.inningState,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      batter: {
        name: gameState.currentBatter?.name || 'Unknown',
        hr: gameState.currentBatter?.stats.hr || 15, // Default values - should come from player stats
        iso: gameState.currentBatter?.stats.ops - gameState.currentBatter?.stats.avg || 0.180 // Placeholder for ISO calculation
      },
      onDeck: {
        name: gameState.onDeckBatter?.name || 'Unknown',
        hr: gameState.onDeckBatter?.stats.hr || 12,
        iso: gameState.onDeckBatter?.stats.ops - gameState.onDeckBatter?.stats.avg || 0.160 // Placeholder for ISO calculation
      },
      pitcher: {
        name: gameState.currentPitcher?.name || 'Unknown',
        pitchCount: gameState.pitcher?.stats.strikeOuts || 0, // Placeholder for pitch count
        isStarter: gameState.pitcher?.stats.strikeOuts ? gameState.pitcher.stats.strikeOuts < 80 : true // Placeholder for starter check
      },
      leverageIndex: this.calculateLeverageIndex(gameState),
      balls: gameState.balls,
      strikes: gameState.strikes,
      platoonAdvantage: 'neutral', // Would need batter/pitcher handedness data
      wind: {
        mph: 8, // Mock data - would come from weather service
        direction: 'S',
        toCenterField: true
      },
      park: {
        hrFactor: 100 // Would come from park factors database
      },
      bullpenERA: 3.8 // Would come from team stats
    };
  }

  private calculateLeverageIndex(gameState: MLBGameState): number {
    // Simplified LI calculation - would use more sophisticated formula in production
    const scoreDiff = Math.abs(gameState.homeScore - gameState.awayScore);
    const inningWeight = gameState.inning >= 7 ? 1.5 : 1.0;
    const runnersWeight = (gameState.runners.second || gameState.runners.third) ? 1.3 : 1.0;

    let baseLI = 1.0;
    if (scoreDiff <= 1) baseLI = 2.0;
    else if (scoreDiff <= 2) baseLI = 1.5;
    else if (scoreDiff <= 3) baseLI = 1.2;

    return baseLI * inningWeight * runnersWeight;
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

    // Build runner description
    const runnerPositions = [];
    if (runners.first) runnerPositions.push('1ST');
    if (runners.second) runnerPositions.push('2ND');
    if (runners.third) runnerPositions.push('3RD');

    switch (alert.type) {
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

  // Override processAlerts to use dynamic descriptions
  async processAlerts(triggeredAlerts: AlertConfig[], gameState: MLBGameState): Promise<void> {
    for (const alert of triggeredAlerts) {
      // Use MLB-specific duplicate detection
      if (!this.shouldTriggerMLBAlert(alert.type, gameState)) {
        continue;
      }

      try {
        const weatherData = await getWeatherData(gameState.homeTeam);

        // Generate dynamic description based on actual game state
        const dynamicDescription = this.generateDynamicDescription(alert, gameState);

        const alertData = {
          type: alert.type,
          sport: this.sport,
          title: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
          description: dynamicDescription,
          gameInfo: {
            score: { 
              away: gameState.awayScore, 
              home: gameState.homeScore 
            },
            status: 'Live',
            awayTeam: gameState.awayTeam,
            homeTeam: gameState.homeTeam,
            ...this.getGameSpecificInfo(gameState),
            // Include live player data in alert
            currentBatter: gameState.currentBatter,
            onDeckBatter: gameState.onDeckBatter,
            currentPitcher: gameState.currentPitcher
          },
          weatherData,
          aiContext: undefined as string | undefined,
          aiConfidence: alert.priority,
          sentToTelegram: false,
        };

        // Get settings for this sport
        const settings = await storage.getSettingsBySport(this.sport);

        // Get AI analysis for high-priority alerts
        if (alert.priority >= 70 && settings?.aiEnabled) {
          const analysis = await analyzeAlert(
            alertData.type,
            alertData.sport,
            alertData.gameInfo,
            weatherData
          );
          alertData.aiContext = analysis.context || undefined;
          alertData.aiConfidence = analysis.confidence;
        }

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
      const settings = await storage.getSettingsBySport(this.sport);
      console.log(`📊 MLB Settings - AI Enabled: ${settings?.aiEnabled}`);

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

  // Placeholder for the checkAlertConditions method if it's defined in BaseSportEngine
  private async checkAlertConditions(gameState: MLBGameState): Promise<AlertConfig[]> {
    const triggeredAlerts: AlertConfig[] = [];
    
    // Get settings to check if alert types are enabled
    const settings = await storage.getSettingsBySport(this.sport);
    
    for (const alertConfig of this.alertConfigs) {
      // Check if this alert type is enabled in settings
      if (alertConfig.settingKey && !(settings.alertTypes as any)[alertConfig.settingKey]) {
        console.log(`⏭️ Alert type '${alertConfig.type}' skipped - setting '${alertConfig.settingKey}' is disabled`);
        continue;
      }
      
      // Check if the alert is AI-prediction based or condition-based
      if (alertConfig.isPrediction) {
        // Logic to check against AI predictions would go here
        // For now, we'll assume all prediction-based alerts are potentially triggerable
        // In a real scenario, you'd fetch predictions and check against minimumProbability
        // Example: if (await this.checkPrediction(alertConfig.predictionEvents, alertConfig.minimumPredictionProbability)) { ... }
        
        // For now, let's simulate a condition for demonstration
        if (alertConfig.type === "Home Run Alert" && gameState.currentBatter?.stats.hr > 20) {
          triggeredAlerts.push(alertConfig);
        } else if (alertConfig.type === "RBI Opportunity" && gameState.currentBatter?.stats.rbi > 50) {
          triggeredAlerts.push(alertConfig);
        }
      } else {
        // Check static conditions
        if (alertConfig.conditions && alertConfig.conditions(gameState)) {
          triggeredAlerts.push(alertConfig);
        }
      }
    }
    return triggeredAlerts;
  }

  // Check if a specific alert type is enabled in settings
  private async isAlertTypeEnabled(settingKey: string): Promise<boolean> {
    const settings = await storage.getSettingsBySport(this.sport);
    return !!(settings.alertTypes as any)[settingKey];
  }

  // Placeholder for createAlert if it's defined in BaseSportEngine
  private async createAlert(alertDef: AlertConfig, gameState: MLBGameState, game: any): Promise<AlertConfig | null> {
    // This method is usually implemented in the concrete engine to format the alert
    // For this example, we'll just return the alert definition if it matches
    return alertDef;
  }

  // Override parent shouldTriggerAlert method
  protected shouldTriggerAlert(alertType: string, gameId: string, gameState: any): boolean {
    // Call parent method
    const shouldTrigger = super.shouldTriggerAlert(alertType, gameId, gameState);
    
    if (!shouldTrigger) return false;
    
    // Additional MLB-specific checks
    if (alertType === 'RBI Opportunity' && gameState.currentBatter?.stats.hr && gameState.currentBatter.stats.hr < 10) {
      if (gameState.currentBatter.stats.rbi && gameState.currentBatter.stats.rbi < 30) {
        return Math.random() < 0.3;
      }
    }
    
    return true;
  }

  private async runEnhancedAnalysis(gameState: MLBGameState, game: any): Promise<void> {
    try {
      // Get weather data
      const weatherData = await getWeatherData(
        game.venue?.name || 'Unknown'
      );

      // Generate AI context with high-scoring situation analysis
      const aiContext = await analyzeAlert(
        "HSS Analysis", // Generic type for HSS analysis
        this.sport,
        {
          ...this.getGameSpecificInfo(gameState),
          awayTeam: gameState.awayTeam,
          homeTeam: gameState.homeTeam,
          currentBatter: gameState.currentBatter,
          onDeckBatter: gameState.onDeckBatter,
          currentPitcher: gameState.currentPitcher,
        },
        weatherData,
        'high_scoring_probability' // Focus area for HSS
      );

      if (aiContext) {
        console.log(`🤖 HSS AI Analysis: ${aiContext.context.substring(0, 100)}...`);
        // Could create special HSS alert here based on aiContext.confidence
      }
    } catch (error) {
      console.error('❌ Error in enhanced HSS analysis:', error);
    }
  }

  async processGame(game: any): Promise<void> {
    if (game.status.statusCode !== '2') return; // Only process live games

    console.log(`🎮 Processing game: ${game.teams.away?.team?.name} @ ${game.teams.home?.team?.name} (State: ${game.status.detailedState}, PK: ${game.gamePk})`);

    try {
      const gameState = this.extractGameState(game); // Use extracted game state directly
      if (!gameState) {
        console.log(`❌ No game state available for game ${game.gamePk}`);
        return;
      }

      console.log(`🔍 MLB Game State Debug - ${gameState.awayTeam} @ ${gameState.homeTeam}:`);
      console.log(`   Inning: ${gameState.inning} ${gameState.inningState}`);
      console.log(`   Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeTeam} ${gameState.homeScore}`);
      console.log(`   Runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third}`);
      console.log(`   Outs: ${gameState.outs}, Balls: ${gameState.balls}, Strikes: ${gameState.strikes}`);

      // HSS Event-Driven Evaluation
      const gameId = `mlb-${gameState.gamePk}`;
      const currentContext = this.buildGameContext(gameState);
      const deltas = hssEngine.identifyDeltas(undefined, currentContext); // TODO: Get previous context from storage if available

      const hssScore = hssEngine.calculateHSSScore(currentContext);
      console.log(`🎯 HSS Score: ${hssScore.toFixed(3)} (${deltas.length > 0 ? 'deltas: ' + deltas.join(', ') : 'no deltas'})`);

      // Check if we should run LLM evaluation
      if (hssEngine.shouldRunLLM(gameId, currentContext, deltas)) {
        console.log(`🚀 HSS triggered LLM evaluation (score: ${hssScore.toFixed(3)})`);

        // Run enhanced AI analysis
        await this.runEnhancedAnalysis(gameState, game);

        // Set cooldown
        hssEngine.setCooldown(gameId, currentContext);
      }

      // Check traditional alert types (for now, keeping both systems)
      const triggeredAlerts = await this.checkAlertConditions(gameState);

      if (triggeredAlerts.length > 0) {
        console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
        console.log(`   Alert types triggered: ${triggeredAlerts.map(a => a.type).join(', ')}`);
        await this.processAlerts(triggeredAlerts, gameState);
      } else {
        console.log(`   No alerts triggered (runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third})`);
      }

    } catch (error) {
      console.error(`❌ Error processing game ${game.gamePk}:`, error);
    }
  }
}

export const mlbEngine = new MLBEngine();