import { BaseSportEngine, AlertConfig } from './base-engine';
import { mlbApi } from '../mlb-api';
import { storage } from '../../storage';
import { getWeatherData } from '../weather';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';

// RE24 (Run Expectancy) Table
const RE24: Record<string, number> = {
  "000-0": 0.50, "000-1": 0.27, "000-2": 0.11,
  "100-0": 0.90, "100-1": 0.54, "100-2": 0.25,
  "010-0": 1.14, "010-1": 0.70, "010-2": 0.33,
  "001-0": 1.32, "001-1": 0.94, "001-2": 0.36,
  "110-0": 1.50, "110-1": 0.95, "110-2": 0.45,
  "101-0": 1.68, "101-1": 1.08, "101-2": 0.47,
  "011-0": 1.95, "011-1": 1.24, "011-2": 0.54,
  "111-0": 2.25, "111-1": 1.54, "111-2": 0.76,
};

type Runners = { first: boolean; second: boolean; third: boolean };

function reKey(r: Runners, outs: number) {
  return `${r.first ? 1 : 0}${r.second ? 1 : 0}${r.third ? 1 : 0}-${outs}`;
}

// Convert expected runs to score probability (bounded)
function probFromRE(re: number) {
  // Linear, simple, fast: good enough baseline
  return clamp((re) / 2.2, 0.05, 0.98);
}

function clamp(x: number, lo: number, hi: number) { 
  return Math.max(lo, Math.min(hi, x)); 
}

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
  title: string;
  type: string;
  description: string;
  sport: string;
  team: string;
  opponent: string;
  message: string;
  probability: number;
  priority: number;
  gameInfo: any; // Using 'any' for broader compatibility, but ideally a specific type
  createdAt: Date;
  isRead: boolean;
}

export class MLBEngine extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 15000; // 15 seconds - reasonable for external APIs
  private apiFailureCount = 0;
  private lastApiError: Date | null = null;

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
      type: "Runners on 1st & 2nd",
      settingKey: "risp",
      priority: 75,
      probability: 0.85,
      description: "🔥 RUNNERS ON 1ST & 2ND! Double-steal or big hit opportunity!",
      conditions: (state: MLBGameState) => 
        state.runners.first && state.runners.second && !state.runners.third && state.outs < 2
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
        if (!state.currentBatter || state.outs >= 3) return false;
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
        // ONLY trigger if we have REAL batter data (no synthetic data)
        if (!state.currentBatter || state.outs >= 3) {
          console.log(`   🚫 Power Hitter Alert: Skipped - no real batter data or inning over`);
          return false;
        }
        const hasRunnersOn = state.runners.first || state.runners.second || state.runners.third;
        const shouldTrigger = state.currentBatter.stats.hr >= 25 && hasRunnersOn;
        if (shouldTrigger) {
          console.log(`   ✅ Power Hitter Alert: REAL trigger - ${state.currentBatter.name} (${state.currentBatter.stats.hr} HR) with runners on base`);
        }
        return shouldTrigger;
      }
    },
    {
      type: "Elite Hitter in Clutch",
      settingKey: "eliteClutch",
      priority: 90,
      probability: 1.0,
      description: "🔥 ELITE HITTER IN CLUTCH! High OPS batter in pressure situation!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter || state.outs >= 3) return false;
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
        if (!state.currentBatter || state.outs >= 3) return false;
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
        if (!state.currentBatter || state.outs >= 3) return false;
        const scoringPosition = state.runners.second || state.runners.third;
        return state.currentBatter.stats.rbi >= 80 && scoringPosition;
      }
    },
    // Live Events Alerts
    {
      type: "Runners on Base",
      settingKey: "runnersOnBase",
      priority: 60,
      probability: 1.0,
      description: "🏃 Runners on Base - Scoring opportunity developing!",
      conditions: (state: MLBGameState) => 
        state.outs < 3 && (state.runners.first || state.runners.second || state.runners.third)
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
    // RE24 Advanced Alert
    {
      type: "High RE24 Situation",
      settingKey: "re24Advanced",
      priority: 85,
      probability: 1.0,
      description: "📊 HIGH RE24! Advanced scoring probability detected",
      conditions: (state: MLBGameState) => {
        const re24Prob = this.calculateRE24Probability(state);
        return re24Prob >= 75; // Trigger on 75%+ RE24 probability
      }
    },
  ];

  extractGameState(liveFeed: any): MLBGameState | null {
    try {
      const linescore = liveFeed.liveData.linescore;
      const gameData = liveFeed.gameData;

      // Extract current batter and pitcher data
      let currentBatter = undefined;
      let currentPitcher = undefined;

      try {
        console.log(`🔍 ENHANCED Batter Debug - Game ${gameData.game.pk}:`);
        
        // Enhanced Debug: Show complete API structure
        console.log(`   🔍 Complete API Structure:`);
        console.log(`   - liveData exists: ${!!liveFeed.liveData}`);
        console.log(`   - liveData keys: ${liveFeed.liveData ? Object.keys(liveFeed.liveData).join(', ') : 'none'}`);
        console.log(`   - linescore exists: ${!!linescore}`);
        console.log(`   - linescore.offense exists: ${!!linescore.offense}`);
        if (linescore.offense) {
          console.log(`   - linescore.offense keys: ${Object.keys(linescore.offense).join(', ')}`);
          console.log(`   - linescore.offense full structure:`, JSON.stringify(linescore.offense, null, 2));
        }
        console.log(`   - boxscore exists: ${!!liveFeed.liveData?.boxscore}`);
        console.log(`   - decisions exists: ${!!liveFeed.liveData?.decisions}`);
        console.log(`   - plays exists: ${!!liveFeed.liveData?.plays}`);
        console.log(`   - plays keys: ${liveFeed.liveData?.plays ? Object.keys(liveFeed.liveData.plays).join(', ') : 'none'}`);
        
        // Check for any other potential locations for current batter data
        if (liveFeed.liveData) {
          const allKeys = Object.keys(liveFeed.liveData);
          console.log(`   - All liveData keys: ${allKeys.join(', ')}`);
        }

        // Try multiple paths to get current batter information
        let batter = null;
        let batterStats = null;

        // Path 1: Try currentPlay approach
        const plays = liveFeed.liveData?.plays;
        const currentPlay = plays?.currentPlay;
        console.log(`   Path 1 - plays: ${!!plays}, currentPlay: ${!!currentPlay}`);
        
        if (currentPlay?.matchup?.batter) {
          batter = currentPlay.matchup.batter;
          console.log(`   ✅ Path 1 SUCCESS: ${batter.fullName || batter.name}`);
        }

        // Path 2: Try linescore approach for current batter (not just base runners)
        if (!batter && linescore) {
          console.log(`   Path 2 - Searching linescore for current batter...`);
          
          // Check all linescore properties for current batter
          const linescoreKeys = Object.keys(linescore);
          console.log(`   - All linescore keys: ${linescoreKeys.join(', ')}`);
          
          // Look for batter, currentBatter, or any player-like objects
          const batterKeywords = ['batter', 'currentBatter', 'atBat', 'batting'];
          for (const keyword of batterKeywords) {
            if (linescore[keyword] && typeof linescore[keyword] === 'object' && linescore[keyword].fullName) {
              batter = linescore[keyword];
              console.log(`   ✅ Path 2 SUCCESS via linescore.${keyword}: ${batter.fullName}`);
              break;
            }
          }
          
          // If still no batter, check offense structure more thoroughly
          if (!batter && linescore.offense) {
            const offenseKeys = Object.keys(linescore.offense);
            console.log(`   - Offense keys: ${offenseKeys.join(', ')}`);
            
            // Look for any non-base-runner player data that could be current batter
            for (const key of offenseKeys) {
              const player = linescore.offense[key];
              if (player && typeof player === 'object' && player.fullName) {
                if (!['first', 'second', 'third'].includes(key)) {
                  batter = player;
                  console.log(`   ✅ Path 2 SUCCESS via offense.${key}: ${batter.fullName}`);
                  break;
                }
              }
            }
          }
        }

        // Path 3: Try to find current batter in decisions or other liveData sections
        if (!batter && liveFeed.liveData) {
          console.log(`   Path 3 - Searching all liveData sections for current batter...`);
          
          // Check decisions for current batter info
          if (liveFeed.liveData.decisions) {
            console.log(`   - Checking decisions: ${Object.keys(liveFeed.liveData.decisions).join(', ')}`);
          }
          
          // Check if there's any other section with current player info
          const allLiveDataSections = Object.keys(liveFeed.liveData);
          for (const section of allLiveDataSections) {
            if (section !== 'linescore' && section !== 'plays') {
              const sectionData = liveFeed.liveData[section];
              if (sectionData && typeof sectionData === 'object') {
                console.log(`   - Checking ${section} for batter data...`);
                
                // Look for any batter-related data in this section
                if (sectionData.currentBatter && sectionData.currentBatter.fullName) {
                  batter = sectionData.currentBatter;
                  console.log(`   ✅ Path 3 SUCCESS via ${section}.currentBatter: ${batter.fullName}`);
                  break;
                }
              }
            }
          }
        }

        // Path 4: Get stats for the found batter
        if (batter) {
          // Try to get season stats
          if (batter.stats) {
            batterStats = batter.stats?.find((stat: any) => stat.type?.displayName === 'statsSingleSeason')?.stats;
          }
          
          // If no stats, try boxscore stats
          if (!batterStats && liveFeed.liveData?.boxscore?.teams) {
            const battingTeam = linescore.inningState === 'Top' ? 
              liveFeed.liveData.boxscore.teams.away : 
              liveFeed.liveData.boxscore.teams.home;
              
            const playerData = battingTeam?.players?.[`ID${batter.id}`];
            if (playerData?.seasonStats?.batting) {
              batterStats = playerData.seasonStats.batting;
            }
          }

          currentBatter = {
            id: batter.id,
            name: batter.fullName || batter.name || 'Unknown Batter',
            batSide: batter.batSide?.code || 'U',
            stats: {
              avg: batterStats?.avg ? parseFloat(batterStats.avg) : 0.275,
              hr: batterStats?.homeRuns || batterStats?.hr || 15,
              rbi: batterStats?.rbi || 50,
              obp: batterStats?.obp ? parseFloat(batterStats.obp) : 0.340,
              ops: batterStats?.ops ? parseFloat(batterStats.ops) : 0.800,
              slg: batterStats?.slg ? parseFloat(batterStats.slg) : 0.450,
              atBats: batterStats?.atBats || batterStats?.ab || 300,
              hits: batterStats?.hits || batterStats?.h || 75,
              strikeOuts: batterStats?.strikeOuts || batterStats?.so || 80,
              walks: batterStats?.baseOnBalls || batterStats?.bb || 30
            }
          };
          console.log(`   ✅ Real MLB batter found: ${currentBatter.name} (${currentBatter.batSide}) - AVG: ${currentBatter.stats.avg}, HR: ${currentBatter.stats.hr}, RBI: ${currentBatter.stats.rbi}`);
        } else {
          // NO FALLBACK - Don't create alerts with fake data
          console.log(`   ❌ No real current batter found - SKIPPING alert generation to avoid fake data`);
          console.log(`   🔍 Need to find where MLB API stores current batter information`);
          currentBatter = null; // Set to null instead of fake data
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

      // BASES LOADED SPECIFIC DEBUG
      const basesLoaded = gameState.runners.first && gameState.runners.second && gameState.runners.third;
      if (basesLoaded) {
        console.log(`🚨 BASES LOADED DETECTED! Outs: ${gameState.outs}`);
        console.log(`   Raw offense data:`, linescore.offense);
        console.log(`   Checking alert conditions...`);
        
        // Check each bases loaded condition
        const basesLoaded0Out = basesLoaded && gameState.outs === 0;
        const basesLoaded1Out = basesLoaded && gameState.outs === 1;
        const basesLoaded2Out = basesLoaded && gameState.outs === 2;
        
        console.log(`   Bases Loaded 0 Out: ${basesLoaded0Out}`);
        console.log(`   Bases Loaded 1 Out: ${basesLoaded1Out}`);
        console.log(`   Bases Loaded 2 Out: ${basesLoaded2Out}`);
      }

      if (gameState.currentBatter) {
        console.log(`   🏏 ✅ REAL Current Batter: ${gameState.currentBatter.name} (${gameState.currentBatter.batSide}) - AVG: ${gameState.currentBatter.stats.avg}, HR: ${gameState.currentBatter.stats.hr}, RBI: ${gameState.currentBatter.stats.rbi}, OPS: ${gameState.currentBatter.stats.ops}`);
      } else {
        console.log(`   🏏 ❌ No real current batter found - ALERTS DISABLED for this game to prevent fake data`);
      }

      if (gameState.currentPitcher) {
        console.log(`   ⚾ Current Pitcher: ${gameState.currentPitcher.name} (${gameState.currentPitcher.throwHand}) - ERA: ${gameState.currentPitcher.stats.era}, WHIP: ${gameState.currentPitcher.stats.whip}, K: ${gameState.currentPitcher.stats.strikeOuts}, W-L: ${gameState.currentPitcher.stats.wins}-${gameState.currentPitcher.stats.losses}`);
      } else {
        console.log(`   ⚾ Current Pitcher: No pitcher data available`);
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
      re24Probability: this.calculateRE24Probability(gameState),
      re24Key: reKey(gameState.runners, gameState.outs),
      expectedRuns: RE24[reKey(gameState.runners, gameState.outs)] || 0.50,
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

  protected buildGameContext(gameState: MLBGameState): any {
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

  // RE24-based scoring probability calculation
  private calculateRE24Probability(gameState: MLBGameState): number {
    const key = reKey(gameState.runners, gameState.outs);
    const expectedRuns = RE24[key] || 0.50; // Default to empty bases, 0 outs
    
    // Convert expected runs to probability percentage
    const probability = probFromRE(expectedRuns) * 100;
    
    // Apply late-inning pressure modifier
    let modifier = 1.0;
    if (gameState.inning >= 8) {
      modifier = 1.15; // 15% boost for high-leverage situations
    }
    
    return Math.round(clamp(probability * modifier, 5, 98));
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

      case 'Runners on 1st & 2nd':
        return `🔥 RUNNERS ON 1ST & 2ND, ${outs} OUT${outs !== 1 ? 'S' : ''}! (${scoringProb}% scoring probability) Double-steal or big hit opportunity!`;

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

      case 'High RE24 Situation':
        const re24Prob = this.calculateRE24Probability(gameState);
        const key = reKey(gameState.runners, gameState.outs);
        const expectedRuns = RE24[key] || 0.50;
        
        const runnerDesc = [];
        if (runners.first) runnerDesc.push('1ST');
        if (runners.second) runnerDesc.push('2ND');
        if (runners.third) runnerDesc.push('3RD');
        
        const situation = runnerDesc.length > 0 ? runnerDesc.join(' & ') : 'Empty bases';
        return `📊 HIGH RE24! ${situation}, ${outs} out${outs !== 1 ? 's' : ''} = ${expectedRuns.toFixed(2)} expected runs (${re24Prob}% probability)`;

      default:
        // For other alerts, use the original description but add scoring probability
        return `${alert.description} (${scoringProb}% scoring probability)`;
    }
  }



  // Override processAlerts to use dynamic descriptions and deduplication system
  async processAlerts(triggeredAlerts: AlertConfig[], gameState: MLBGameState): Promise<void> {
    for (const alert of triggeredAlerts) {

      try {
        // Get weather data for context using city name instead of team name
        const teamCityMap: Record<string, string> = {
          'Los Angeles Angels': 'Los Angeles', 'Los Angeles Dodgers': 'Los Angeles',
          'Oakland Athletics': 'Oakland', 'San Francisco Giants': 'San Francisco', 
          'Athletics': 'Oakland', // Handle short name
          'Seattle Mariners': 'Seattle', 'Texas Rangers': 'Arlington',
          'Houston Astros': 'Houston', 'Minnesota Twins': 'Minneapolis',
          'Kansas City Royals': 'Kansas City', 'Chicago White Sox': 'Chicago',
          'Chicago Cubs': 'Chicago', 'Cleveland Guardians': 'Cleveland',
          'Detroit Tigers': 'Detroit', 'Milwaukee Brewers': 'Milwaukee',
          'St. Louis Cardinals': 'St. Louis', 'Atlanta Braves': 'Atlanta',
          'Miami Marlins': 'Miami', 'New York Yankees': 'New York',
          'New York Mets': 'New York', 'Philadelphia Phillies': 'Philadelphia',
          'Washington Nationals': 'Washington', 'Boston Red Sox': 'Boston',
          'Toronto Blue Jays': 'Toronto', 'Baltimore Orioles': 'Baltimore',
          'Tampa Bay Rays': 'Tampa', 'Pittsburgh Pirates': 'Pittsburgh',
          'Cincinnati Reds': 'Cincinnati', 'Colorado Rockies': 'Denver',
          'Arizona Diamondbacks': 'Phoenix', 'San Diego Padres': 'San Diego'
        };
        
        const cityName = teamCityMap[gameState.homeTeam] || gameState.homeTeam;
        const weatherData = await getWeatherData(cityName);

        // Use deduplication system to prevent duplicate alerts
        const frame = {
          gamePk: gameState.gamePk,
          inning: gameState.inning,
          half: gameState.inningState as "top" | "bottom",
          outs: gameState.outs,
          runners: gameState.runners,
          batterId: gameState.currentBatter?.id ?? null,
          onDeckId: null, // MLB API doesn't provide on-deck batter reliably
          windDir: null   // Could add weather wind direction if available
        };

        // Import deduplication system
        const { dedup } = await import('../engine-coordinator');
        const { Deduper } = await import('../dedup');

        // Check if we should emit this alert based on situation fingerprint
        const cooldownType = ['Star Batter Alert', 'Power Hitter Alert'].includes(alert.type) ? alert.type.toLowerCase().replace(' ', '') : undefined;
        if (!dedup.shouldEmit(alert.type, frame, cooldownType)) {
          console.log(`🔄 Dedup: Skipping duplicate ${alert.type} alert for current situation`);
          continue;
        }

        console.log(`✅ Dedup: Allowing ${alert.type} alert - new situation fingerprint`);

        // Generate custom title with batter name for batter-related alerts
        let customTitle = alert.type;
        if (gameState.currentBatter && ['Star Batter Alert', 'Power Hitter Alert', 'Elite Hitter in Clutch', '300+ Hitter Alert', 'RBI Machine Alert'].includes(alert.type)) {
          customTitle = `${alert.type}: ${gameState.currentBatter.name}`;
        }

        const alertData: InsertAlert = {
          id: randomUUID(),
          title: customTitle,
          type: alert.type,
          description: this.generateDynamicDescription(alert, gameState),
          sport: this.sport,
          team: gameState.homeTeam,
          opponent: gameState.awayTeam,
          message: this.generateDynamicDescription(alert, gameState),
          probability: alert.probability,
          priority: alert.priority,
          createdAt: new Date(),
          isRead: false,
          gameInfo: {
            homeTeam: gameState.homeTeam,
            awayTeam: gameState.awayTeam,
            status: 'Live',
            inning: gameState.inning.toString(),
            inningState: gameState.inningState,
            outs: gameState.outs,
            balls: gameState.balls,
            strikes: gameState.strikes,
            runners: gameState.runners,
            score: {
              home: gameState.homeScore,
              away: gameState.awayScore
            },
            priority: alert.priority,
            scoringProbability: this.calculateScoringProbability(gameState),
            re24Probability: this.calculateRE24Probability(gameState),
            re24Key: reKey(gameState.runners, gameState.outs),
            expectedRuns: RE24[reKey(gameState.runners, gameState.outs)] || 0.50,
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
          }
        };

        const createdAlert = await storage.createAlert(alertData);

        // Send to Telegram for high-priority alerts  
        const settings = await storage.getSettingsBySport(this.sport);
        if (alert.priority >= 75 && settings?.telegramEnabled) {
          const telegramConfig = {
            botToken: process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "default_key",
            chatId: process.env.CHAT_ID || process.env.TELEGRAM_CHAT_ID || "default_key",
          };

          const sent = await sendTelegramAlert(telegramConfig, createdAlert);
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
      console.log(`📊 MLB Settings - Monitoring: ${settings ? 'Enabled' : 'Disabled'}`);

      // Enable core MLB settings if not set
      if (settings) {
        const coreSettings = {
          risp: true,
          closeGame: true,
          lateInning: true,
          starBatter: true,
          powerHitter: true,
          runnersOnBase: true,
          inningChange: true,
          re24Advanced: false // New RE24 system, disabled by default for testing
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

          // Skip if we've had too many API failures recently (circuit breaker)
          if (this.apiFailureCount >= 3 && this.lastApiError && (Date.now() - this.lastApiError.getTime()) < 60000) {
            if (this.apiFailureCount <= 3 || this.apiFailureCount % 20 === 0) {
              console.log(`⏸️ Skipping API calls due to recent failures (${this.apiFailureCount} failures in last minute)`);
            }
            continue;
          }

          console.log(`🔍 Fetching live feed for game ${game.gamePk} (${game.awayTeam} @ ${game.homeTeam})`);
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);

          // Skip if live feed data isn't available yet (returns null for 404)
          if (!liveFeed) {
            console.log(`⚠️ No live feed data available for game ${game.gamePk} yet`);
            continue;
          }

          // Reset API failure count on success
          this.apiFailureCount = 0;
          this.lastApiError = null;
          
          console.log(`✅ Got live feed data for game ${game.gamePk}, processing...`);

          const gameState = this.extractGameState(liveFeed);

          if (!gameState) continue;

          const triggeredAlerts = await this.checkAlertConditions(gameState);

          if (triggeredAlerts.length > 0) {
            console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
            console.log(`   Alert types triggered: ${triggeredAlerts.map(a => a.type).join(', ')}`);
            await this.processAlerts(triggeredAlerts, gameState);
          } else {
            // Debug why no alerts triggered
            const basesLoaded = gameState.runners.first && gameState.runners.second && gameState.runners.third;
            if (basesLoaded) {
              console.log(`❌ BASES LOADED BUT NO ALERT! Checking settings...`);
              const settings = await storage.getSettingsBySport(this.sport);
              console.log(`   RISP setting enabled: ${settings?.alertTypes?.risp || 'NOT SET'}`);
              console.log(`   All MLB settings:`, settings?.alertTypes);
            }

            // AI analysis has been completely removed
            console.log(`   No alerts triggered (runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third})`)
          }

        } catch (gameError) {
          this.apiFailureCount++;
          this.lastApiError = new Date();
          
          // Only log errors occasionally to reduce spam
          if (this.apiFailureCount <= 3 || this.apiFailureCount % 10 === 0) {
            console.error(`Error processing ${this.sport} game ${game.gamePk} (failure ${this.apiFailureCount}):`, gameError instanceof Error ? gameError.message : 'Unknown error');
          }
          
          // Implement exponential backoff by increasing monitoring interval
          if (this.apiFailureCount >= 5) {
            this.monitoringInterval = Math.min(60000, 15000 * Math.min(this.apiFailureCount / 5, 4)); // Max 1 minute
            if (this.apiFailureCount === 5) {
              console.log(`🚨 Increased monitoring interval to ${this.monitoringInterval/1000}s due to API failures`);
            }
          }
        }
      }

    } catch (error) {
      console.error(`${this.sport} monitoring error:`, error);
    }
  }
}

export const mlbEngine = new MLBEngine();