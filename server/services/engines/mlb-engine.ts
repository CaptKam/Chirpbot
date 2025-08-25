import { BaseSportEngine, AlertConfig } from './base-engine';
import { getWeatherData } from '../weather';
import { storage } from '../../storage';
import { mlbApi } from '../mlb-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert } from '../ai-analysis';
import { analyzeHybridRE24, generateHybridAlertDescription, cleanupCache } from './hybrid-re24-ai';
import { enhancedWeatherService } from '../enhanced-weather';
// NEW
import { estimateHRProbability, classifyTier } from './power-hitter';

export interface MLBGameState {
  gameId: string;
  gamePk: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  inningState: 'top' | 'bottom';
  outs: number;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  currentBatter?: {
    id: number;
    name: string;
    battingOrder?: number;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      obp: number;
      ops: number;
      slg: number;
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
      wins: number;
      losses: number;
    };
  };
  // Recent events for new alert types
  recentPlay?: {
    result?: string;
    description?: string;
    isHomeRun?: boolean;
    isScoringPlay?: boolean;
    isHit?: boolean;
    isStrikeout?: boolean;
    runnersMoved?: boolean;
    rbiCount?: number;
    hitType?: string; // 'single', 'double', 'triple', 'home_run'
  };
  ballpark?: {
    name?: string;
    windSpeed?: number;
    windDirection?: string;
    temperature?: number;
  };
  count?: {
    balls: number;
    strikes: number;
  };
  // Added for weather integration
  venue?: string;
  // V1 parity: plate appearance ID for enhanced deduplication
  paId?: string;
  weather?: {
    temperature?: number;
    windSpeed?: number;
    windDirection?: string;
    humidity?: number;
    pressure?: number;
    condition?: string; // e.g., 'Dome', 'Retractable Roof', 'Outdoor'
  };
}

export class MLBEngine extends BaseSportEngine {
  sport = 'MLB';
  monitoringInterval = 1500; // 1.5 seconds normal polling (optimized from your successful system)
  private apiFailureCount = 0;
  private lastApiError: Date | null = null;

  // 🎯 GAME SITUATIONS ALERTS ONLY - Focus on key game moments
  alertConfigs: AlertConfig[] = [
    // === CORE GAME SITUATIONS ===
    {
      type: "Runners in Scoring Position",
      settingKey: "risp",
      priority: 85,
      probability: 1.0,
      description: "🏃‍♂️ RISP Alert! Runner(s) in scoring position!",
      conditions: (state: MLBGameState) => state.runners.second || state.runners.third
    },
    {
      type: "Bases Loaded",
      settingKey: "basesLoaded",
      priority: 95,
      probability: 1.0,
      description: "🔥 BASES LOADED! Maximum pressure situation!",
      conditions: (state: MLBGameState) => state.runners.first && state.runners.second && state.runners.third
    },
    {
      type: "Runners on Base",
      settingKey: "runnersOnBase",
      priority: 60,
      probability: 1.0,
      description: "🏃‍♂️ RUNNERS ON BASE! Scoring opportunity!",
      conditions: (state: MLBGameState) => state.runners.first || state.runners.second || state.runners.third
    },
    {
      type: "Close Game Alert",
      settingKey: "closeGame",
      priority: 90,
      probability: 1.0,
      description: "⚖️ CLOSE GAME! One-run game in late innings!",
      conditions: (state: MLBGameState) => {
        const scoreDiff = Math.abs(state.homeScore - state.awayScore);
        // Only trigger if there are runners on base or high-leverage situation
        const hasRunners = state.runners.first || state.runners.second || state.runners.third;
        return scoreDiff <= 1 && state.inning >= 7 && (hasRunners || state.outs === 2);
      }
    },
    {
      type: "Late Inning Alert",
      settingKey: "lateInning",
      priority: 75,
      probability: 1.0,
      description: "⏰ LATE INNING PRESSURE! Critical moments ahead!",
      conditions: (state: MLBGameState) => {
        // Only trigger in late innings if there are runners or it's a critical situation
        const hasRunners = state.runners.first || state.runners.second || state.runners.third;
        const isCloseGame = Math.abs(state.homeScore - state.awayScore) <= 2;
        return state.inning >= 8 && (hasRunners || (isCloseGame && state.outs === 2));
      }
    },
    {
      type: "Extra Innings",
      settingKey: "extraInnings",
      priority: 100,
      probability: 1.0,
      description: "⚾ EXTRA INNINGS! Game extends beyond the 9th!",
      conditions: (state: MLBGameState) => state.inning >= 10
    }
  ];

  protected getGameSpecificInfo(gameState: any): any {
    return {
      inning: gameState.inning,
      inningState: gameState.inningState,
      outs: gameState.outs,
      runners: gameState.runners,
      currentBatter: gameState.currentBatter,
      currentPitcher: gameState.currentPitcher,
      count: gameState.count // Add count information for UI display
    };
  }

  protected buildGameContext(gameState: any): any {
    return {
      sport: this.sport,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      inning: gameState.inning,
      score: { home: gameState.homeScore, away: gameState.awayScore },
      runners: gameState.runners,
      outs: gameState.outs,
      currentBatter: gameState.currentBatter
    };
  }

  private async getHybridAnalysis(gameState: MLBGameState): Promise<any> {
    try {
      const { analyzeHybridRE24 } = await import('./hybrid-re24-ai');
      // Convert our gameState to the expected format with numeric gamePk
      const hybridGameState = {
        ...gameState,
        gamePk: Number(gameState.gamePk) || 0
      };
      return await analyzeHybridRE24(hybridGameState);
    } catch (error) {
      console.error('Failed to get hybrid analysis:', error);
      return null;
    }
  }

  async extractGameState(gameData: any): Promise<MLBGameState | null> {
    try {
      // Handle different data source formats
      let gameId, gamePk, homeTeam, awayTeam, inning, inningState, homeScore, awayScore, outs;
      let runners: { first: boolean; second: boolean; third: boolean } = { first: false, second: false, third: false };
      let currentBatter, currentPitcher, recentPlay, venue;
      let ballparkConditions: any = {}; // Default empty object

      // ESPN format detection
      if (gameData.competitions && gameData.competitions[0]) {
        const competition = gameData.competitions[0];
        const competitors = competition.competitors;

        gameId = gameData.id || `espn-${gameData.uid}`;
        gamePk = Number(gameData.id) || 0;
        venue = competition.venue?.fullName || 'Unknown Venue';

        const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
        const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');

        homeTeam = homeCompetitor?.team?.displayName || 'Unknown Home';
        awayTeam = awayCompetitor?.team?.displayName || 'Unknown Away';
        homeScore = parseInt(homeCompetitor?.score || '0');
        awayScore = parseInt(awayCompetitor?.score || '0');

        // ESPN game situation
        const situation = competition.situation;
        if (situation) {
          inning = situation.inning || 1;
          inningState = situation.inningHalf === 'top' ? 'top' : 'bottom';
          outs = situation.outs || 0;

          // Base runners
          if (situation.onFirst) runners.first = true;
          if (situation.onSecond) runners.second = true;
          if (situation.onThird) runners.third = true;

          // Current batter
          if (situation.batter) {
            currentBatter = {
              id: situation.batter.playerId || 0,
              name: situation.batter.displayName || 'Unknown',
              batSide: situation.batter.batSide || 'R',
              stats: {
                avg: parseFloat(situation.batter.avg || '0.250'),
                hr: parseInt(situation.batter.homeRuns || '0'),
                rbi: parseInt(situation.batter.rbi || '0'),
                obp: parseFloat(situation.batter.onBasePercentage || '0.320'),
                ops: parseFloat(situation.batter.onBasePlusSlugging || '0.720'),
                slg: parseFloat(situation.batter.sluggingPercentage || '0.400')
              }
            };
          }
        }
      }
      // MLB.com API format
      else if (gameData.liveData || gameData.gamePk) {
        const gameDataMLBApi = gameData; // Rename to avoid conflict
        const liveData = gameDataMLBApi.liveData;
        const gameDataInfo = gameDataMLBApi.gameData;

        gameId = gameDataInfo.game.id;
        gamePk = gameDataInfo.game.pk;
        venue = gameDataInfo.venue?.fullName || 'Unknown Venue';

        homeTeam = gameDataInfo.teams.home.name;
        awayTeam = gameDataInfo.teams.away.name;
        homeScore = liveData.linescore?.teams?.home?.runs || 0;
        awayScore = liveData.linescore?.teams?.away?.runs || 0;

        const currentPlay = liveData.plays.currentPlay;
        const about = currentPlay?.about || {};
        inning = about.inning || 1;
        inningState = about.isTopInning ? 'top' : 'bottom';
        outs = about.outs || 0;
        
        // Try multiple sources for runner data
        const situation = liveData.situation;
        if (situation) {
          runners.first = situation.isRunnerOnFirst;
          runners.second = situation.isRunnerOnSecond;
          runners.third = situation.isRunnerOnThird;
          console.log(`🔍 Runner data from situation: 1st=${runners.first}, 2nd=${runners.second}, 3rd=${runners.third}`);
        }
        
        // Fallback: Check current play for runner data
        if (!situation && currentPlay?.runners) {
          console.log(`🔍 Checking currentPlay.runners:`, currentPlay.runners);
          currentPlay.runners.forEach((runner: any) => {
            if (runner.movement?.start === '1B') runners.first = true;
            if (runner.movement?.start === '2B') runners.second = true;
            if (runner.movement?.start === '3B') runners.third = true;
          });
        }
        
        // Fallback: Check recent plays for runner movements
        if (!situation && liveData.plays?.allPlays) {
          const recentPlays = liveData.plays.allPlays.slice(-5); // Check last 5 plays
          recentPlays.forEach((play: any) => {
            if (play.runners && play.runners.length > 0) {
              console.log(`🔍 Found runners in recent play:`, play.runners);
              play.runners.forEach((runner: any) => {
                if (runner.movement?.end === '1B' && !runner.movement?.isOut) runners.first = true;
                if (runner.movement?.end === '2B' && !runner.movement?.isOut) runners.second = true;
                if (runner.movement?.end === '3B' && !runner.movement?.isOut) runners.third = true;
              });
            }
          });
        }
        
        // Fallback: Check linescore offense data
        if (!situation && liveData.linescore?.offense) {
          const offense = liveData.linescore.offense;
          console.log(`🔍 Checking linescore offense:`, offense);
          if (offense.first) runners.first = true;
          if (offense.second) runners.second = true;
          if (offense.third) runners.third = true;
        }
        
        // Emergency fallback: Manual runner detection from play descriptions
        if (!situation && currentPlay?.result?.description) {
          const desc = currentPlay.result.description.toLowerCase();
          if (desc.includes('runner') || desc.includes('on base')) {
            console.log(`🔍 Detecting runners from play description: "${currentPlay.result.description}"`);
            if (desc.includes('first') || desc.includes('1st')) runners.first = true;
            if (desc.includes('second') || desc.includes('2nd')) runners.second = true;
            if (desc.includes('third') || desc.includes('3rd')) runners.third = true;
          }
        }
        
        // Debug: Log final runner state for troubleshooting
        if (runners.first || runners.second || runners.third) {
          console.log(`✅ RUNNERS DETECTED: 1st=${runners.first}, 2nd=${runners.second}, 3rd=${runners.third} for ${homeTeam} vs ${awayTeam}`);
        }
        
        const boxscore = liveData.boxscore;

        // Track recent play for event-based alerts
        recentPlay = {};
        let count: any = {};

        // Analyze current play for hits, home runs, scoring
        if (currentPlay?.result) {
          const playResult = currentPlay.result;
          const playDescription = currentPlay.description || '';

          // Home Run Detection
          const isHomeRun = playResult.type === 'atBat' &&
                          (playResult.event?.includes('Home Run') ||
                           playDescription.toLowerCase().includes('home run') ||
                           playDescription.toLowerCase().includes('homers'));

          // Hit Detection (any safe hit)
          const isHit = playResult.type === 'atBat' &&
                       (playResult.event?.includes('Single') ||
                        playResult.event?.includes('Double') ||
                        playResult.event?.includes('Triple') ||
                        isHomeRun);

          // Strikeout Detection - Enhanced pattern matching
          const isStrikeout = playResult.type === 'atBat' &&
                            (playResult.event?.includes('Strikeout') ||
                             playResult.event?.includes('Strike Out') ||
                             playResult.event?.includes('Struck Out') ||
                             playDescription.toLowerCase().includes('strikes out') ||
                             playDescription.toLowerCase().includes('strikeout') ||
                             playDescription.toLowerCase().includes('struck out') ||
                             playDescription.toLowerCase().includes('swinging') ||
                             playDescription.toLowerCase().includes('looking') ||
                             (playResult.event?.toLowerCase().includes('strike') && 
                              playResult.event?.toLowerCase().includes('out')));

          // Scoring Play Detection
          const isScoringPlay = playResult.rbi > 0 ||
                              playDescription.toLowerCase().includes('scores') ||
                              playDescription.toLowerCase().includes('rbi');

          // Hit Type Classification
          let hitType = '';
          if (playResult.event?.includes('Single')) hitType = 'single';
          else if (playResult.event?.includes('Double')) hitType = 'double';
          else if (playResult.event?.includes('Triple')) hitType = 'triple';
          else if (isHomeRun) hitType = 'home_run';

          recentPlay = {
            result: playResult.event,
            description: playDescription,
            isHomeRun,
            isHit,
            isStrikeout,
            isScoringPlay,
            rbiCount: playResult.rbi || 0,
            hitType,
            runnersMoved: !!(currentPlay.runners && currentPlay.runners.length > 0)
          };
        }

        // Extract count information
        count = {
          balls: about.balls || 0,
          strikes: about.strikes || 0
        };

        // Fallback strikeout detection from count and outs
        if (!recentPlay.isStrikeout && count.strikes === 3 && outs !== undefined) {
          const previousPlay = liveData.plays?.allPlays?.[liveData.plays.allPlays.length - 1];
          if (previousPlay?.result?.type === 'atBat' && previousPlay.about?.outs > about.outs) {
            recentPlay.isStrikeout = true;
            recentPlay.result = previousPlay.result?.event || 'Strikeout';
            recentPlay.description = previousPlay.description || 'Batter struck out';
          }
        }

        // Extract ballpark info if available (from liveData.weather if present, otherwise from gameData.venue)
        if (liveData.weather) {
          ballparkConditions = {
            windSpeed: liveData.weather.wind?.speed,
            windDirection: String(liveData.weather.wind?.direction || ''),
            temperature: liveData.weather.temp
          };
        } else if (gameDataInfo.venue) {
          ballparkConditions = {
            windSpeed: gameDataInfo.venue.wind?.speed,
            windDirection: String(gameDataInfo.venue.wind?.direction || ''),
            temperature: gameDataInfo.venue.temp
          };
        }


        const offensiveTeam = inningState === 'top' ? 'away' : 'home';
        const currentBatterId = currentPlay?.matchup?.batter?.id;

        if (currentBatterId && boxscore?.teams?.[offensiveTeam]?.players) {
          const playerKey = `ID${currentBatterId}`;
          const batterData = boxscore.teams[offensiveTeam].players[playerKey];

          if (batterData?.person) {
            const battingStats = batterData.stats?.batting || {};
            console.log(`🎯 Batter stats found for ${batterData.person.fullName}:`, JSON.stringify(battingStats));
            
            // Improve fallback handling for empty strings and missing data
            const avg = battingStats.avg && battingStats.avg !== "" && battingStats.avg !== "0.000" ? parseFloat(battingStats.avg) : 0.275;
            const hr = battingStats.homeRuns && battingStats.homeRuns !== "" ? parseInt(battingStats.homeRuns) : 15;
            const rbi = battingStats.rbi && battingStats.rbi !== "" ? parseInt(battingStats.rbi) : 50;
            const obp = battingStats.obp && battingStats.obp !== "" && battingStats.obp !== "0.000" ? parseFloat(battingStats.obp) : 0.340;
            const ops = battingStats.ops && battingStats.ops !== "" && battingStats.ops !== "0.000" ? parseFloat(battingStats.ops) : 0.800;
            const slg = battingStats.slg && battingStats.slg !== "" && battingStats.slg !== "0.000" ? parseFloat(battingStats.slg) : 0.460;
            
            currentBatter = {
              id: currentBatterId,
              name: batterData.person.fullName,
              battingOrder: batterData.battingOrder || 0,
              batSide: batterData.person.batSide?.code || 'U',
              stats: {
                avg: avg,
                hr: hr,
                rbi: rbi,
                obp: obp,
                ops: ops,
                slg: slg
              }
            };
            console.log(`✅ Processed batter stats - AVG: ${avg}, HR: ${hr}, RBI: ${rbi}, OPS: ${ops}`);
          }
        } else {
          console.log(`⚠️ No boxscore data available for current batter ${currentBatterId}`);
          // If no API stats available, create a realistic fallback batter
          if (currentBatterId && currentPlay?.matchup?.batter?.fullName) {
            currentBatter = {
              id: currentBatterId,
              name: currentPlay.matchup.batter.fullName,
              battingOrder: 1,
              batSide: currentPlay.matchup.batter.batSide?.code || 'U',
              stats: {
                avg: 0.275,
                hr: 15,
                rbi: 50,
                obp: 0.340,
                ops: 0.800,
                slg: 0.460
              }
            };
            console.log(`✅ Created fallback batter stats for ${currentBatter.name}`);
          }
        }

        const pitchingTeam = inningState === 'top' ? 'home' : 'away';
        const currentPitcherId = currentPlay?.matchup?.pitcher?.id;

        if (currentPitcherId && boxscore?.teams?.[pitchingTeam]?.players) {
          const playerKey = `ID${currentPitcherId}`;
          const pitcherData = boxscore.teams[pitchingTeam].players[playerKey];

          if (pitcherData?.person) {
            const pitchingStats = pitcherData.stats?.pitching || {};
            console.log(`⚾ Pitcher stats found for ${pitcherData.person.fullName}:`, JSON.stringify(pitchingStats));
            
            // Improve fallback handling for empty strings and missing data
            const era = pitchingStats.era && pitchingStats.era !== "" && pitchingStats.era !== "0.00" ? parseFloat(pitchingStats.era) : 4.25;
            const whip = pitchingStats.whip && pitchingStats.whip !== "" && pitchingStats.whip !== "0.00" ? parseFloat(pitchingStats.whip) : 1.25;
            const strikeOuts = pitchingStats.strikeOuts && pitchingStats.strikeOuts !== "" ? parseInt(pitchingStats.strikeOuts) : 85;
            const wins = pitchingStats.wins && pitchingStats.wins !== "" ? parseInt(pitchingStats.wins) : 8;
            const losses = pitchingStats.losses && pitchingStats.losses !== "" ? parseInt(pitchingStats.losses) : 6;
            
            currentPitcher = {
              id: currentPitcherId,
              name: pitcherData.person.fullName,
              throwHand: pitcherData.person.pitchHand?.code || 'U',
              stats: {
                era: era,
                whip: whip,
                strikeOuts: strikeOuts,
                wins: wins,
                losses: losses
              }
            };
            console.log(`✅ Processed pitcher stats - ERA: ${era}, WHIP: ${whip}, K: ${strikeOuts}, W-L: ${wins}-${losses}`);
          }
        } else {
          console.log(`⚠️ No boxscore data available for current pitcher ${currentPitcherId}`);
          // If no API stats available, create a realistic fallback pitcher
          if (currentPitcherId && currentPlay?.matchup?.pitcher?.fullName) {
            currentPitcher = {
              id: currentPitcherId,
              name: currentPlay.matchup.pitcher.fullName,
              throwHand: currentPlay.matchup.pitcher.pitchHand?.code || 'U',
              stats: {
                era: 4.25,
                whip: 1.25,
                strikeOuts: 85,
                wins: 8,
                losses: 6
              }
            };
            console.log(`✅ Created fallback pitcher stats for ${currentPitcher.name}`);
          }
        }
      } else {
        console.log("⚠️ Unknown game data format encountered.");
        return null;
      }

      // Fetch weather data for the game location
      let weather = null;
      try {
        if (venue && venue !== 'Unknown Venue') {
          const weatherData = await enhancedWeatherService.getEnhancedWeatherData(venue);
          if (weatherData) {
            weather = {
              temperature: weatherData.temperature,
              windSpeed: weatherData.windSpeed,
              windDirection: String(weatherData.windDirection),
              humidity: weatherData.humidity,
              pressure: weatherData.pressure,
              condition: weatherData.stadium.features.dome ? 'Dome' :
                        weatherData.stadium.features.retractableRoof ? 'Retractable Roof' :
                        'Outdoor'
            };
          }
        }
      } catch (weatherError) {
        console.log(`⚠️ Weather data unavailable for ${venue}: ${weatherError}`);
      }


      // V1 parity: Extract plate appearance ID for enhanced deduplication
      let paId: string | undefined;
      try {
        // Try to get PA ID from current play data
        const currentPlay = gameData.liveData?.plays?.currentPlay;
        if (currentPlay?.about?.atBatIndex !== undefined) {
          paId = `${gamePk}-${currentPlay.about.atBatIndex}`;
        } else if (currentPlay?.playEvents && currentPlay.playEvents.length > 0) {
          // Fallback: use most recent play event index
          const lastEvent = currentPlay.playEvents[currentPlay.playEvents.length - 1];
          if (lastEvent?.index !== undefined) {
            paId = `${gamePk}-${lastEvent.index}`;
          }
        }
        if (paId) {
          console.log(`✅ Extracted PA ID: ${paId}`);
        }
      } catch (paError) {
        console.log(`⚠️ Could not extract PA ID: ${paError}`);
      }

      const gameState: MLBGameState = {
        gameId,
        gamePk,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        inning,
        inningState: inningState as 'top' | 'bottom',
        outs,
        runners,
        venue,
        weather: weather || undefined,
        currentBatter,
        currentPitcher,
        recentPlay,
        count: {
          balls: gameData.liveData?.plays?.currentPlay?.count?.balls || 0,
          strikes: gameData.liveData?.plays?.currentPlay?.count?.strikes || 0
        },
        ballpark: ballparkConditions, // Assign extracted ballpark data
        paId: paId // V1 parity: plate appearance ID
      };

      // Debug current batter info
      console.log(`🔍 MLB Game State Debug - ${awayTeam} @ ${homeTeam}:`);
      console.log(`   Inning: ${inning} ${inningState}`);
      console.log(`   Score: ${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}`);
      console.log(`   Runners: 1st=${runners.first}, 2nd=${runners.second}, 3rd=${runners.third}`);
      console.log(`   Outs: ${outs}, Balls: ${gameState.count?.balls || 0}, Strikes: ${gameState.count?.strikes || 0}`);
      if (gameState.weather) {
        console.log(`   Weather: ${gameState.weather.condition}, Temp: ${gameState.weather.temperature}°F, Wind: ${gameState.weather.windSpeed}mph ${gameState.weather.windDirection}`);
      }

      if (currentBatter) {
        console.log(`   🏏 ✅ Current Batter: ${currentBatter.name} (${currentBatter.batSide}) - AVG: ${currentBatter.stats.avg.toFixed(3)}, HR: ${currentBatter.stats.hr}, RBI: ${currentBatter.stats.rbi}, OPS: ${currentBatter.stats.ops.toFixed(3)}`);
      } else {
        console.log(`   🏏 ❌ No current batter data available`);
      }

      // Debug recent play events for strikeout detection
      if (recentPlay?.result) {
        console.log(`   🎯 Recent Play: ${recentPlay.result} - ${recentPlay.description}`);
        console.log(`   ⚡ Strikeout detected: ${recentPlay.isStrikeout ? 'YES' : 'NO'}`);
        if (recentPlay.isStrikeout) {
          console.log(`   🚨 STRIKEOUT ALERT should trigger!`);
        }
      }

      if (currentPitcher) {
        console.log(`   ⚾ Current Pitcher: ${currentPitcher.name} (${currentPitcher.throwHand}) - ERA: ${currentPitcher.stats.era}, WHIP: ${currentPitcher.stats.whip}, K: ${currentPitcher.stats.strikeOuts}, W-L: ${currentPitcher.stats.wins}-${currentPitcher.stats.losses}`);
      }

      return gameState;

    } catch (error) {
      console.error('Error extracting MLB game state:', error);
      return null;
    }
  }

  // NEW — build one AlertConfig for a power-hitter PA, or return []
  private buildPowerHitterAlerts(gameState: MLBGameState): AlertConfig[] {
    const batter = gameState.currentBatter;
    const pitcher = gameState.currentPitcher;

    // Require real batter/pitcher and a live PA context
    if (!batter || !pitcher || gameState.outs >= 3) return [];

    // Map existing game state to model inputs
    const batterStats = {
      id: batter.id,
      name: batter.name,
      handedness: (batter.batSide as any) ?? "U",
      seasonHR: batter.stats.hr ?? 0,
      seasonPA: batter.stats.hr ?? 0,  // using HR as a proxy when AB not available
    };

    // Approximate TBF using available stats
    const tbfApprox = (pitcher.stats.strikeOuts ?? 0) * 3; // rough approximation

    const pitcherStats = {
      id: pitcher.id,
      handedness: (pitcher.throwHand as any) ?? "U",
      hrPer9: 1.2, // default HR/9 when not available
      tbf: tbfApprox > 50 ? tbfApprox : 400,
    };

    const ctx = {
      parkHrFactor: 1.0,  // if you have park factors, plug them here
      windMph: undefined, // we don't have direction → keep conservative multiplier
      inning: gameState.inning,
      half: gameState.inningState,
      outs: gameState.outs,
      risp: !!(gameState.runners.second || gameState.runners.third),
      scoreDiffAbs: Math.abs(gameState.homeScore - gameState.awayScore),
    };

    const p = estimateHRProbability(batterStats, pitcherStats, ctx);
    const tier = classifyTier(p);
    if (!tier) return [];

    // Base priority by tier
    let priority = tier === "A" ? 90 : tier === "B" ? 80 : 70;
    if (ctx.risp) priority += 2;
    if (gameState.inning >= 8 || ctx.scoreDiffAbs <= 1) priority += 2;
    priority = Math.min(priority, 100);

    const description = `💥 POWER HITTER — ${batter.name} at bat • P(HR this PA): ${(p * 100).toFixed(1)}% [${tier}]`;

    const alert: AlertConfig = {
      type: "POWER_HITTER_AT_BAT",
      settingKey: "powerHitter",
      priority,
      probability: 1.0,        // deterministic firing; dedupe will guard spam
      description,
      conditions: () => true,   // we already checked conditions above
    };

    return [alert];
  }

  async monitor() {
    try {
      // Clean up AI cache periodically
      if (Math.random() < 0.1) { // 10% chance each cycle
        cleanupCache();
      }

      // Real-time alerts are always active (no demo mode)
      const settings = await storage.getSettingsBySport(this.sport);
      console.log(`📊 MLB Settings - Monitoring: ${settings ? 'Enabled' : 'Disabled'}`);

      // Enable core MLB settings if not set
      if (settings) {
        const coreSettings = {
          risp: true,
          closeGame: true,
          lateInning: true,
          starBatter: false, // Disabled by default - star batter alerts were duplicating
          powerHitter: true, // ✅ Enable Power Hitter alerts by default
          runnersOnBase: true,
          inningChange: false, // Disabled by default
          re24Advanced: true,  // ✅ Enable RE24 hybrid system
          // New alert types
          homeRun: true,
          homeRunAlert: true,
          hits: true,
          scoring: true,
          strikeouts: true, // Enable strikeout alerts by default
          basesLoaded: true // ✅ Enable bases loaded alerts
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

      // 🔧 Use multi-source aggregator for fast data with V1-style date handling
      const { multiSourceAggregator, isLive } = await import('../multi-source-aggregator');
      
      // Use America/New_York timezone for proper MLB date handling (V1-style)
      const getMLBDate = (): string => {
        const now = new Date();
        const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        return easternTime.toISOString().split('T')[0];
      };
      
      const games = await multiSourceAggregator.getMLBGames(getMLBDate());
      
      // V1-style live game filtering using the normalized isLive function
      const liveGames = games.filter(game => {
        const status = game.status?.toLowerCase() || '';
        return isLive(status);
      });
      console.log(`🎯 Found ${liveGames.length} live games`);
      if (liveGames.length === 0) return;

      for (const game of liveGames) {
        try {
          // Map the game ID from multi-source aggregator to gamePk
          const gamePk = Number(game.id || game.gamePk); // Ensure numeric gamePk

          // V1-style status validation using the normalized isLive function
          const status = game.status?.toLowerCase() || '';
          const { isLive } = await import('../multi-source-aggregator');
          const isLiveGame = isLive(status);
          
          if (!isLiveGame || !gamePk) {
            continue;
          }

          // Skip if we've had too many API failures recently
          if (this.apiFailureCount >= 3 && this.lastApiError && (Date.now() - this.lastApiError.getTime()) < 60000) {
            if (this.apiFailureCount <= 3 || this.apiFailureCount % 20 === 0) {
              console.log(`⏸️ Skipping API calls due to recent failures (${this.apiFailureCount} failures in last minute)`);
            }
            continue;
          }

          console.log(`🔍 Fetching live feed for game ${gamePk} (${game.awayTeam} @ ${game.homeTeam})`);
          const liveFeed = await mlbApi.getLiveFeed(gamePk);

          if (!liveFeed) {
            console.log(`⚠️ No live feed data available for game ${gamePk} yet`);
            continue;
          }

          this.apiFailureCount = 0;
          this.lastApiError = null;

          console.log(`✅ Got live feed data for game ${gamePk}, processing...`);

          const gameState = await this.extractGameState(liveFeed);

          if (!gameState) continue;

          console.log(`🔍 Processing ${this.alertConfigs.length} alert configs for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
          let triggeredAlerts = await this.checkAlertConditions(gameState);

          // NEW — add data-driven Power-Hitter alert for the current PA
          try {
            const power = this.buildPowerHitterAlerts(gameState);
            if (power.length) {
              triggeredAlerts = [...triggeredAlerts, ...power];
            }
          } catch (e) {
            console.error("POWER_HITTER_AT_BAT compute error:", e);
          }

          if (triggeredAlerts.length > 0) {
            console.log(`⚡ Found ${triggeredAlerts.length} alerts for ${gameState.homeTeam} vs ${gameState.awayTeam}`);
            console.log(`   Alert types triggered: ${triggeredAlerts.map(a => a.type).join(', ')}`);
            // Use base engine's processAlerts with single deduplication system
            await this.processAlerts(triggeredAlerts, gameState);
          } else {
            console.log(`   No alerts triggered (runners: 1st=${gameState.runners.first}, 2nd=${gameState.runners.second}, 3rd=${gameState.runners.third})`);
          }

        } catch (gameError) {
          this.apiFailureCount++;
          this.lastApiError = new Date();

          if (this.apiFailureCount <= 3 || this.apiFailureCount % 10 === 0) {
            console.error(`Error processing ${this.sport} game (failure ${this.apiFailureCount}):`, gameError instanceof Error ? gameError.message : 'Unknown error');
          }

          if (this.apiFailureCount >= 5) {
            this.monitoringInterval = Math.min(60000, 15000 * Math.min(this.apiFailureCount / 5, 4));
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

  // Corrected RP24 probability calculation using actual scoring probabilities
  private calculateRP24Probability(state: MLBGameState): number {
    // Use the same RP24 table as in hybrid-re24-ai.ts for consistency
    const RE24_RP24: Record<string, { RE: number; RP: number }> = {
      "000-0": { RE: 0.50, RP: 0.27 }, "000-1": { RE: 0.27, RP: 0.17 }, "000-2": { RE: 0.11, RP: 0.07 },
      "100-0": { RE: 0.90, RP: 0.43 }, "100-1": { RE: 0.54, RP: 0.28 }, "100-2": { RE: 0.25, RP: 0.14 },
      "010-0": { RE: 1.14, RP: 0.62 }, "010-1": { RE: 0.70, RP: 0.43 }, "010-2": { RE: 0.33, RP: 0.23 },
      "001-0": { RE: 1.32, RP: 0.68 }, "001-1": { RE: 0.94, RP: 0.67 }, "001-2": { RE: 0.36, RP: 0.30 },
      "110-0": { RE: 1.50, RP: 0.61 }, "110-1": { RE: 0.95, RP: 0.44 }, "110-2": { RE: 0.45, RP: 0.23 },
      "101-0": { RE: 1.68, RP: 0.69 }, "101-1": { RE: 1.08, RP: 0.56 }, "101-2": { RE: 0.47, RP: 0.32 },
      "011-0": { RE: 1.95, RP: 0.84 }, "011-1": { RE: 1.24, RP: 0.71 }, "011-2": { RE: 0.54, RP: 0.41 },
      "111-0": { RE: 2.25, RP: 0.85 }, "111-1": { RE: 1.54, RP: 0.66 }, "111-2": { RE: 0.76, RP: 0.41 },
    };

    const key = `${state.runners.first ? 1 : 0}${state.runners.second ? 1 : 0}${state.runners.third ? 1 : 0}-${state.outs}`;
    const data = RE24_RP24[key] || { RE: 0.50, RP: 0.27 };
    
    return data.RP; // Return actual probability of scoring ≥1 run, not derived from expected runs
  }

  async processAlerts(triggeredAlerts: AlertConfig[], gameState: MLBGameState): Promise<void> {
    // Remove duplicates by alert type to prevent processing the same alert multiple times
    const uniqueAlerts = triggeredAlerts.filter((alert, index, self) => 
      index === self.findIndex(a => a.type === alert.type)
    );
    for (const alert of uniqueAlerts) {
      // 🔥 CRITICAL: Check deduplication BEFORE processing
      if (!this.shouldTriggerAlert(alert.type, gameState.gameId, gameState)) {
        console.log(`⏭️ Alert '${alert.type}' skipped due to deduplication`);
        continue;
      }

      let customTitle = alert.description;
      let finalDescription = alert.description;

      // Apply AI enhancement for high priority alerts
      if (alert.priority >= 80) {
        try {
          const { enhanceHighPriorityAlert } = await import('../ai-analysis');
          const gameContext = this.buildGameContext(gameState);
          const enhanced = await enhanceHighPriorityAlert(alert.type, gameContext, alert.description, alert.priority);
          if (enhanced) {
            finalDescription = enhanced.enhancedDescription;
          }
        } catch (error) {
          console.error('AI enhancement failed:', error);
        }
      }

      const alertData = {
        id: randomUUID(),
        title: customTitle,
        type: alert.type,
        description: finalDescription,
        sport: this.sport,
        team: gameState.homeTeam,
        opponent: gameState.awayTeam,
        message: finalDescription,
        probability: alert.probability,
        priority: alert.priority,
        createdAt: new Date(),
        isRead: false,
        gameInfo: {
          gameId: gameState.gameId,
          gamePk: gameState.gamePk,
          homeTeam: gameState.homeTeam,
          awayTeam: gameState.awayTeam,
          status: 'live',
          inning: gameState.inning,
          inningState: gameState.inningState,
          outs: gameState.outs,
          runners: gameState.runners,
          currentBatter: gameState.currentBatter ? {
            id: gameState.currentBatter.id,
            name: gameState.currentBatter.name,
            battingOrder: gameState.currentBatter.battingOrder,
            batSide: gameState.currentBatter.batSide,
            stats: {
              avg: gameState.currentBatter.stats.avg,
              hr: gameState.currentBatter.stats.hr,
              rbi: gameState.currentBatter.stats.rbi,
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
          } : undefined,
          // NEW: Hybrid RE24+AI Analysis Data
          hybridAnalysis: await this.getHybridAnalysis(gameState).catch(() => null)
        }
      };

      // Send to Telegram for users who have it enabled
      const usersWithTelegram = await storage.getUsersWithTelegramEnabled();
      for (const user of usersWithTelegram) {
        if (user.telegramBotToken && user.telegramChatId) {
          const telegramConfig = {
            botToken: user.telegramBotToken,
            chatId: user.telegramChatId,
          };

          const sent = await sendTelegramAlert(telegramConfig, alertData);
          if (sent) {
            console.log(`📱 Telegram alert sent to ${user.username || 'User'} for: ${customTitle}`);
          } else {
            console.log(`❌ Failed to send Telegram alert to ${user.username || 'User'} for: ${customTitle}`);
          }
        }
      }

      // Store the alert
      await storage.createAlert(alertData);
      console.log(`✅ Alert '${customTitle}' processed and stored.`);
    }
  }
}

// Export instance for use in other parts of the application
export const mlbEngine = new MLBEngine();