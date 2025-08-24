import { BaseSportEngine, AlertConfig } from './base-engine';
import { getWeatherData } from '../weather';
import { storage } from '../../storage';
import { mlbApi } from '../mlb-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert } from '../ai-analysis';
import { analyzeHybridRE24, generateHybridAlertDescription, cleanupCache } from './hybrid-re24-ai';
import { enhancedWeatherService } from '../enhanced-weather';

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
    battingOrder: number;
    batSide: string;
    stats: {
      avg: number;
      hr: number;
      rbi: number;
      ops: number;
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
  monitoringInterval = 1000; // 1 second for lightning-fast betting alerts
  private apiFailureCount = 0;
  private lastApiError: Date | null = null;

  alertConfigs: AlertConfig[] = [
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
      priority: 75,
      probability: 1.0,
      description: "💥 POWER HITTER up to bat! Home run potential!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter || state.outs >= 3) return false;
        return state.currentBatter.stats.hr >= 15;
      }
    },
    {
      type: "300+ Hitter Alert",
      settingKey: "starBatter",  // Fixed: was 'avgHitter' which doesn't exist
      priority: 75, // Boost for AI enhancement
      probability: 1.0,
      description: "🎯 HIGH AVERAGE BATTER (.300+) stepping up to plate!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter || state.outs >= 3) return false;
        return state.currentBatter.stats.avg >= 0.300;
      }
    },
    {
      type: "Runners in Scoring Position",
      settingKey: "risp",
      priority: 85,
      probability: 1.0,
      description: "🏃‍♂️ RISP Alert! Runner(s) in scoring position!",
      conditions: (state: MLBGameState) => state.runners.second || state.runners.third
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
      type: "Bases Loaded",
      settingKey: "risp",  // Fixed: was 'basesLoaded' which doesn't exist
      priority: 95,
      probability: 1.0,
      description: "🔥 BASES LOADED! Maximum pressure situation!",
      conditions: (state: MLBGameState) => state.runners.first && state.runners.second && state.runners.third
    },
    {
      type: "Close Game Alert",
      settingKey: "closeGame",
      priority: 90,
      probability: 1.0,
      description: "⚖️ CLOSE GAME! One-run game in late innings!",
      conditions: (state: MLBGameState) => {
        const scoreDiff = Math.abs(state.homeScore - state.awayScore);
        return scoreDiff <= 1 && state.inning >= 7;
      }
    },
    {
      type: "Late Inning Alert",
      settingKey: "lateInning",
      priority: 75,
      probability: 1.0,
      description: "⏰ LATE INNING PRESSURE! Critical moments ahead!",
      conditions: (state: MLBGameState) => state.inning >= 8
    },
    {
      type: "Inning Change",
      settingKey: "inningChange",
      priority: 50,
      probability: 1.0,
      description: "⚾ Inning change - new opportunities!",
      conditions: (state: MLBGameState) => state.inning >= 1
    },
    {
      type: "Game Start",
      settingKey: "inningChange",
      priority: 40,
      probability: 1.0,
      description: "⚾ GAME START - First pitch!",
      conditions: (state: MLBGameState) => state.inning === 1 && state.inningState === 'top'
    },
    // NEW ALERT TYPES IMPLEMENTATION
    {
      type: "Home Run Situation",
      settingKey: "homeRun",
      priority: 90,
      probability: 0.85,
      description: "🎯 HOME RUN SETUP! Perfect conditions for a long ball!",
      conditions: (state: MLBGameState) => {
        if (!state.currentBatter || state.outs >= 3) return false;

        // High HR probability conditions
        const batterHasHRPower = state.currentBatter.stats.hr >= 15;
        const favorableCount = state.count && (state.count.balls >= 2 && state.count.strikes <= 1);
        const runnersOnBase = state.runners.first || state.runners.second || state.runners.third;
        const windFavor = !!(state.ballpark?.windSpeed && state.ballpark.windSpeed >= 10);

        // Combine factors for home run potential
        return batterHasHRPower && (favorableCount || runnersOnBase || windFavor);
      }
    },
    {
      type: "Home Run Alert",
      settingKey: "homeRunAlert",
      priority: 100,
      probability: 1.0,
      description: "🚀 HOME RUN! Ball is GONE!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isHomeRun);
      }
    },
    {
      type: "Grand Slam Alert",
      settingKey: "homeRunAlert",
      priority: 100,
      probability: 1.0,
      description: "💥 GRAND SLAM! Bases were loaded - 4 RBIs!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isHomeRun && state.recentPlay?.rbiCount && state.recentPlay.rbiCount >= 4);
      }
    },
    {
      type: "Hit Alert",
      settingKey: "hits",
      priority: 70,
      probability: 1.0,
      description: "⚾ BASE HIT! Runner reaches safely!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isHit && !state.recentPlay?.isHomeRun);
      }
    },
    {
      type: "Extra Base Hit",
      settingKey: "hits",
      priority: 85,
      probability: 1.0,
      description: "💨 EXTRA BASE HIT! Runner advances multiple bases!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isHit &&
                 (state.recentPlay?.hitType === 'double' ||
                  state.recentPlay?.hitType === 'triple'));
      }
    },
    {
      type: "RBI Hit",
      settingKey: "scoring",
      priority: 90,
      probability: 1.0,
      description: "🏃‍♂️ RBI HIT! Runner scores from base!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isScoringPlay &&
                 state.recentPlay?.rbiCount &&
                 state.recentPlay.rbiCount > 0 &&
                 !state.recentPlay?.isHomeRun);
      }
    },
    {
      type: "Scoring Play",
      settingKey: "scoring",
      priority: 85,
      probability: 1.0,
      description: "⚡ RUN SCORES! Points on the board!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isScoringPlay);
      }
    },
    {
      type: "Multiple RBI Play",
      settingKey: "scoring",
      priority: 95,
      probability: 1.0,
      description: "🔥 MULTIPLE RBIs! Big scoring play!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isScoringPlay &&
                 state.recentPlay?.rbiCount &&
                 state.recentPlay.rbiCount >= 2 &&
                 !state.recentPlay?.isHomeRun);
      }
    },
    {
      type: "Strikeout Alert",
      settingKey: "strikeouts",
      priority: 80,
      probability: 1.0,
      description: "⚡ STRIKEOUT! Batter goes down swinging!",
      conditions: (state: MLBGameState) => {
        return !!(state.recentPlay?.isStrikeout);
      }
    },
    // RE24 Advanced Alert with corrected RP24 probability
    {
      type: "High RE24 Situation",
      settingKey: "re24Advanced",
      priority: 85,
      probability: 1.0,
      description: async (state: MLBGameState) => {
        const rp24Prob = this.calculateRP24Probability(state);
        const runners = [];
        if (state.runners.first) runners.push('1ST');
        if (state.runners.second) runners.push('2ND');
        if (state.runners.third) runners.push('3RD');
        const runnerText = runners.length > 0 ? runners.join(' & ') : 'Empty bases';

        // Get weather data
        let weatherText = '';
        try {
          const stadiumName = `${state.homeTeam} Stadium`;
          const weatherData = await enhancedWeatherService.getEnhancedWeatherData(stadiumName);
          if (weatherData) {
            const windComponent = weatherData.calculations.windComponent;
            const windDirection = windComponent > 0 ? 'helping' : windComponent < 0 ? 'hindering' : 'crosswind';
            const weatherSummary = enhancedWeatherService.getWeatherEffectsSummary(weatherData);
            weatherText = ` | ${weatherSummary.emoji} Wind: ${weatherData.windSpeed}mph (${Math.abs(windComponent)}mph ${windDirection} toward CF)`;
          }
        } catch (error) {
          // Weather unavailable, continue without it
        }

        return `📊 HIGH RP24! ${runnerText}, ${state.outs} out - ${(rp24Prob * 100).toFixed(1)}% scoring probability${weatherText}`;
      },
      conditions: (state: MLBGameState) => {
        const rp24Prob = this.calculateRP24Probability(state);
        return rp24Prob >= 0.75; // Trigger on 75%+ RP24 probability
      }
    },
    // NEW: Hybrid RE24+AI Alert
    {
      type: "Hybrid RE24+AI Analysis",
      settingKey: "useRE24System",  // Fixed: was 'hybridRE24' which doesn't exist
      priority: 90,
      probability: 1.0,
      description: "🧠 HYBRID ANALYSIS! AI-enhanced RP24 probability detected",
      conditions: async (state: MLBGameState) => {
        try {
          const analysis = await analyzeHybridRE24(state);
          return analysis.finalProbability >= 0.80 && analysis.confidence >= 85;
        } catch (error) {
          console.error('Hybrid RE24 analysis failed:', error);
          return false;
        }
      }
    },
  ];

  protected getGameSpecificInfo(gameState: any): any {
    return {
      inning: gameState.inning,
      inningState: gameState.inningState,
      outs: gameState.outs,
      runners: gameState.runners,
      currentBatter: gameState.currentBatter,
      currentPitcher: gameState.currentPitcher
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
        gamePk = parseInt(gameData.id) || 0;
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

        const about = liveData.plays.currentPlay?.about || {};
        inning = about.inning || 1;
        inningState = about.isTopInning ? 'top' : 'bottom';
        outs = about.outs || 0;

        const situation = liveData.situation;
        if (situation) {
          runners.first = situation.isRunnerOnFirst;
          runners.second = situation.isRunnerOnSecond;
          runners.third = situation.isRunnerOnThird;
        }

        const currentPlay = liveData.plays.currentPlay;
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
        if (!recentPlay.isStrikeout && count.strikes === 3 && gameState.outs !== undefined) {
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
            windDirection: liveData.weather.wind?.direction,
            temperature: liveData.weather.temp
          };
        } else if (gameDataInfo.venue) {
          ballparkConditions = {
            windSpeed: gameDataInfo.venue.wind?.speed,
            windDirection: gameDataInfo.venue.wind?.direction,
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
            currentBatter = {
              id: currentBatterId,
              name: batterData.person.fullName,
              battingOrder: batterData.battingOrder || 0,
              batSide: batterData.person.batSide?.code || 'U',
              stats: {
                avg: parseFloat(battingStats.avg || '0.000'),
                hr: parseInt(battingStats.homeRuns || '0'),
                rbi: parseInt(battingStats.rbi || '0'),
                ops: parseFloat(battingStats.ops || '0.000')
              }
            };
          }
        }

        const pitchingTeam = inningState === 'top' ? 'home' : 'away';
        const currentPitcherId = currentPlay?.matchup?.pitcher?.id;

        if (currentPitcherId && boxscore?.teams?.[pitchingTeam]?.players) {
          const playerKey = `ID${currentPitcherId}`;
          const pitcherData = boxscore.teams[pitchingTeam].players[playerKey];

          if (pitcherData?.person) {
            const pitchingStats = pitcherData.stats?.pitching || {};
            currentPitcher = {
              id: currentPitcherId,
              name: pitcherData.person.fullName,
              throwHand: pitcherData.person.pitchHand?.code || 'U',
              stats: {
                era: parseFloat(pitchingStats.era || '0.00'),
                whip: parseFloat(pitchingStats.whip || '0.00'),
                strikeOuts: parseInt(pitchingStats.strikeOuts || '0'),
                wins: parseInt(pitchingStats.wins || '0'),
                losses: parseInt(pitchingStats.losses || '0')
              }
            };
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
              windDirection: weatherData.windDirection,
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


      const gameState: MLBGameState = {
        gameId,
        gamePk,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        inning,
        inningState,
        outs,
        runners,
        venue,
        weather,
        currentBatter,
        currentPitcher,
        recentPlay,
        count: {
          balls: gameData.liveData?.plays?.currentPlay?.count?.balls || 0,
          strikes: gameData.liveData?.plays?.currentPlay?.count?.strikes || 0
        },
        ballpark: ballparkConditions // Assign extracted ballpark data
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
          powerHitter: false,
          runnersOnBase: true,
          inningChange: false, // Disabled by default
          re24Advanced: false,
          // New alert types
          homeRun: true,
          homeRunAlert: true,
          hits: true,
          scoring: true,
          strikeouts: true // Enable strikeout alerts by default
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

      // 🔧 Use multi-source aggregator for fast data
      const { multiSourceAggregator } = await import('../multi-source-aggregator');
      const games = await multiSourceAggregator.getMLBGames(new Date().toISOString().split('T')[0]);
      const liveGames = games.filter(game => game.status?.toLowerCase().includes('live') || game.status?.toLowerCase().includes('in progress'));
      console.log(`🎯 Found ${liveGames.length} live games`);
      if (liveGames.length === 0) return;

      console.log(`🔍 Checking ${liveGames.length} live ${this.sport} games...`);

      for (const game of liveGames) {
        try {
          // Map the game ID from multi-source aggregator to gamePk
          const gamePk = game.id || game.gamePk;
          console.log(`🎮 Processing game: ${game.awayTeam} @ ${game.homeTeam} (Status: ${game.status}, ID/PK: ${gamePk})`);

          // Already filtered for live games above, but double-check
          if (!game.status?.toLowerCase().includes('live') && !game.status?.toLowerCase().includes('in progress')) {
            console.log(`⏭️ Skipping non-live game (${game.status})`);
            continue;
          }

          if (!gamePk) {
            console.log(`⏭️ Skipping game with no game ID`);
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

          const triggeredAlerts = await this.checkAlertConditions(gameState);

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
    for (const alert of triggeredAlerts) {
      // 🔥 CRITICAL: Check deduplication BEFORE processing
      if (!this.shouldTriggerAlert(alert.type, gameState.gameId, gameState)) {
        console.log(`⏭️ Alert '${alert.type}' skipped due to deduplication`);
        continue;
      }

      let customTitle = alert.description;
      let finalDescription = alert.description;

      // Enhanced: Add hybrid RE24+AI analysis for high-priority alerts with fallback
      let hybridAnalysis = null;
      if (alert.priority >= 85) {
        try {
          hybridAnalysis = await analyzeHybridRE24(gameState);
          console.log(`🧠 Hybrid Analysis: Base ${hybridAnalysis.baseRE24Probability}% → Final ${hybridAnalysis.finalProbability}% (${hybridAnalysis.aiInsight})`);

          // Track prediction for learning system
          if (hybridAnalysis.finalProbability >= 80) {
            console.log(`📊 High-confidence prediction logged for learning system`);
          }
        } catch (error) {
          console.error('Hybrid analysis failed, using base RE24:', error);
          // Fallback to basic RE24 calculation
          const baseRE24 = this.calculateRE24Probability(gameState);
          if (baseRE24 >= 75) {
            console.log(`⚡ Fallback: Base RE24 ${baseRE24}% triggers alert`);
          }
        }
      }

      // Generate a more descriptive message using AI if available and applicable
      if (hybridAnalysis && alert.settingKey === 'hybridRE24') {
        finalDescription = generateHybridAlertDescription(hybridAnalysis, gameState);
        customTitle = `Hybrid RE24+AI: ${gameState.awayTeam} @ ${gameState.homeTeam}`; // More specific title for this alert type
      } else if (enhanceHighPriorityAlert[alert.settingKey]) {
        // Apply generic AI enhancement for other high-priority alerts if a specific handler exists
        finalDescription = enhanceHighPriorityAlert[alert.settingKey](gameState, alert.description);
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
        priority: hybridAnalysis?.alertPriority || alert.priority, // Use AI-enhanced priority if available
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
          hybridAnalysis: hybridAnalysis ? {
            baseRE24Probability: hybridAnalysis.baseRE24Probability,
            aiContextMultiplier: hybridAnalysis.aiContextMultiplier,
            finalProbability: hybridAnalysis.finalProbability,
            aiInsight: hybridAnalysis.aiInsight,
            confidence: hybridAnalysis.confidence,
            isHighLeverage: hybridAnalysis.isHighLeverage,
            bettingRecommendation: hybridAnalysis.betingRecommendation
          } : undefined
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