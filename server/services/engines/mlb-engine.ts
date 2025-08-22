import { BaseSportEngine, AlertConfig } from './base-engine';
import { getWeatherData } from '../weather';
import { storage } from '../../storage';
import * as mlbApi from '../mlb-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';

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
      settingKey: "avgHitter",
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
      settingKey: "basesLoaded",
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
    }
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

  async extractGameState(liveFeed: any): Promise<MLBGameState | null> {
    try {
      if (!liveFeed?.liveData?.plays?.currentPlay) {
        return null;
      }

      const gameData = liveFeed.gameData;
      const liveData = liveFeed.liveData;
      const currentPlay = liveData.plays.currentPlay;
      const boxscore = liveData.boxscore;

      const homeTeam = gameData.teams.home.name;
      const awayTeam = gameData.teams.away.name;
      const homeScore = liveData.linescore?.teams?.home?.runs || 0;
      const awayScore = liveData.linescore?.teams?.away?.runs || 0;

      const about = currentPlay.about || {};
      const inning = about.inning || 1;
      const inningState = about.isTopInning ? 'top' : 'bottom';
      const outs = about.outs || 0;

      const runners = {
        first: !!(currentPlay.runners?.find((r: any) => r.movement?.end === '1B' && !r.movement?.isOut)),
        second: !!(currentPlay.runners?.find((r: any) => r.movement?.end === '2B' && !r.movement?.isOut)),
        third: !!(currentPlay.runners?.find((r: any) => r.movement?.end === '3B' && !r.movement?.isOut))
      };

      // Track recent play for event-based alerts
      let recentPlay: any = {};
      let count: any = {};
      let ballpark: any = {};
      
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
        
        // Strikeout Detection
        const isStrikeout = playResult.type === 'atBat' && 
                          (playResult.event?.includes('Strikeout') ||
                           playResult.event?.includes('Strike Out') ||
                           playDescription.toLowerCase().includes('strikes out') ||
                           playDescription.toLowerCase().includes('strikeout') ||
                           playDescription.toLowerCase().includes('struck out'));
        
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
      
      // Extract ballpark info if available
      if (gameData.venue || liveData.weather) {
        ballpark = {
          name: gameData.venue?.name,
          windSpeed: liveData.weather?.wind?.speed,
          windDirection: liveData.weather?.wind?.direction,
          temperature: liveData.weather?.temp
        };
      }

      let currentBatter;
      const offensiveTeam = inningState === 'top' ? 'away' : 'home';
      const currentBatterId = currentPlay.matchup?.batter?.id;

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

      let currentPitcher;
      const pitchingTeam = inningState === 'top' ? 'home' : 'away';
      const currentPitcherId = currentPlay.matchup?.pitcher?.id;

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

      const gameState: MLBGameState = {
        gameId: gameData.game.id,
        gamePk: gameData.game.pk,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        inning,
        inningState,
        outs,
        runners,
        currentBatter,
        currentPitcher,
        recentPlay,
        count,
        ballpark
      };

      // Debug current batter info
      console.log(`🔍 MLB Game State Debug - ${awayTeam} @ ${homeTeam}:`);
      console.log(`   Inning: ${inning} ${inningState}`);
      console.log(`   Score: ${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}`);
      console.log(`   Runners: 1st=${runners.first}, 2nd=${runners.second}, 3rd=${runners.third}`);
      console.log(`   Outs: ${outs}, Balls: ${about.balls || 0}, Strikes: ${about.strikes || 0}`);
      
      if (currentBatter) {
        console.log(`   🏏 ✅ REAL Current Batter: ${currentBatter.name} (${currentBatter.batSide}) - AVG: ${currentBatter.stats.avg.toFixed(3)}, HR: ${currentBatter.stats.hr}, RBI: ${currentBatter.stats.rbi}, OPS: ${currentBatter.stats.ops.toFixed(3)}`);
      } else {
        console.log(`   🏏 ❌ No current batter data available`);
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
          scoring: true
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
          console.log(`🎮 Processing game: ${game.awayTeam} @ ${game.homeTeam} (State: ${game.gameState}, PK: ${game.gamePk})`);

          if (game.gameState !== 'Live') {
            console.log(`⏭️ Skipping non-live game (${game.gameState})`);
            continue;
          }

          if (!game.gamePk) {
            console.log(`⏭️ Skipping game with no gamePk`);
            continue;
          }

          // Skip if we've had too many API failures recently
          if (this.apiFailureCount >= 3 && this.lastApiError && (Date.now() - this.lastApiError.getTime()) < 60000) {
            if (this.apiFailureCount <= 3 || this.apiFailureCount % 20 === 0) {
              console.log(`⏸️ Skipping API calls due to recent failures (${this.apiFailureCount} failures in last minute)`);
            }
            continue;
          }

          console.log(`🔍 Fetching live feed for game ${game.gamePk} (${game.awayTeam} @ ${game.homeTeam})`);
          const liveFeed = await mlbApi.getLiveFeed(game.gamePk);

          if (!liveFeed) {
            console.log(`⚠️ No live feed data available for game ${game.gamePk} yet`);
            continue;
          }

          this.apiFailureCount = 0;
          this.lastApiError = null;
          
          console.log(`✅ Got live feed data for game ${game.gamePk}, processing...`);

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
            console.error(`Error processing ${this.sport} game ${game.gamePk} (failure ${this.apiFailureCount}):`, gameError instanceof Error ? gameError.message : 'Unknown error');
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
}

// Export instance for use in other parts of the application
export const mlbEngine = new MLBEngine();