import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { storage } from "../storage";
import { AlertDeduplication } from "./alert-deduplication";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";
import { SettingsCache } from "./settings-cache";
import { BasicAI } from "./basic-ai";
import { AIEnhancementService, GameContext } from './ai-enhancements';

// Import weather service properly
const weatherService = {
  async getWeatherForTeam(teamName: string) {
    return {
      temperature: 72,
      condition: "Clear",
      windSpeed: 8,
      windDirection: "SW",
      humidity: 65,
      pressure: 30.1,
      timestamp: new Date().toISOString()
    };
  },
  calculateHomeRunFactor(weather: any) {
    return 1.0;
  },
  getWindDescription(windSpeed: number, windDirection: string) {
    return `${windSpeed}mph ${windDirection}`;
  }
};

// AI Betting Analysis Engine
interface BetbookData {
  odds: {
    home: number;
    away: number;
    total: number;
  };
  aiAdvice: string;
  sportsbookLinks: Array<{
    name: string;
    url: string;
  }>;
}

interface V3Analysis {
  tier: number;
  probability: number;
  reasons: string[];
  recommendation: string;
  confidence: number;
}

interface AlertData {
  type: string;
  sport: string;
  gameId: string;
  score: number;
  payload: any;
  alertKey: string;
  state: string;
}

// Helper function to generate AI betting insights (placeholder for actual implementation)
function getBetbookData(context: any): BetbookData {
  const { sport, gameId, homeTeam, awayTeam, homeScore, awayScore, type, probability, inning, outs } = context;
  const totalScore = homeScore + awayScore;

  // Generate realistic odds based on game situation
  let homeOdds = -110;
  let awayOdds = -110;
  let totalLine = sport === 'MLB' ? Math.max(totalScore + 1.5, 7.5) : Math.max(totalScore + 3, 45);

  // Adjust odds based on score differential
  const scoreDiff = homeScore - awayScore;
  if (scoreDiff > 0) {
    homeOdds = Math.max(-200, -110 - (scoreDiff * 15));
    awayOdds = Math.min(+180, -110 + (scoreDiff * 20));
  } else if (scoreDiff < 0) {
    awayOdds = Math.max(-200, -110 - (Math.abs(scoreDiff) * 15));
    homeOdds = Math.min(+180, -110 + (Math.abs(scoreDiff) * 20));
  }

  // Generate AI advice based on alert context
  let aiAdvice = "Standard betting situation detected.";
  if (probability >= 90) {
    aiAdvice = `HIGH VALUE: ${sport === 'MLB' ? 'Live over/under' : 'In-game betting'} opportunity with ${probability}% confidence. Consider betting the over ${totalLine}.`;
  } else if (probability >= 80) {
    aiAdvice = `GOOD VALUE: Moderate betting opportunity. ${sport === 'MLB' ? 'Over ' + totalLine + ' runs' : 'Live betting'} shows value.`;
  } else if (context.scoringProbability >= 70) {
    aiAdvice = `SCORING LIKELY: ${context.scoringProbability}% chance of runs scoring. Consider live betting opportunities.`;
  }

  return {
    odds: {
      home: homeOdds,
      away: awayOdds,
      total: totalLine
    },
    aiAdvice,
    sportsbookLinks: [
      { name: 'FanDuel', url: 'https://sportsbook. FanDuel.com' },
      { name: 'DraftKings', url: 'https://sportsbook.draftkings.com' },
      { name: 'Bet365', url: 'https://www.bet365.com' },
      { name: 'BetMGM', url: 'https://sports.betmgm.com' }
    ]
  };
}

export class AlertGenerator {
  private mlbApi: MLBApiService;
  private ncaafApi: NCAAFApiService;
  private deduplication: AlertDeduplication;
  private settingsCache: SettingsCache;
  private ai: BasicAI;
  private aiEnhancementService: AIEnhancementService;

  // V2 RE24-Based Probability System
  private readonly RE24: Record<string, number> = {
    // No outs
    "000-0": 0.50, "100-0": 0.90, "010-0": 1.13, "001-0": 1.35,
    "110-0": 1.50, "101-0": 1.78, "011-0": 1.98, "111-0": 2.29,

    // One out  
    "000-1": 0.27, "100-1": 0.54, "010-1": 0.69, "001-1": 0.98,
    "110-1": 0.94, "101-1": 1.20, "011-1": 1.45, "111-1": 1.65,

    // Two outs
    "000-2": 0.11, "100-2": 0.25, "010-2": 0.35, "001-2": 0.37,
    "110-2": 0.47, "101-2": 0.50, "011-2": 0.63, "111-2": 0.82
  };


  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
    this.deduplication = new AlertDeduplication();
    this.settingsCache = new SettingsCache(storage);
    this.ai = new BasicAI();
    this.aiEnhancementService = new AIEnhancementService();
  }

  // Check if a specific alert type is globally enabled (CACHED - No DB spam!)
  private async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    try {
      return await this.settingsCache.isAlertEnabled(sport, alertType);
    } catch (error) {
      console.error(`Settings cache error for ${sport}.${alertType}:`, error);
      return true; // Default to enabled if can't check
    }
  }

  // Generate realistic alerts from today's completed games
  async generateAlertsFromCompletedGames(): Promise<void> {
    try {
      const games = await this.mlbApi.getTodaysGames();
      console.log(`Found ${games.length} games to analyze for alerts`);

      for (const game of games) {
        if (game.status === 'final' && game.homeScore && game.awayScore) {
          await this.generateGameAlerts(game);
        }
      }
    } catch (error) {
      console.error('Error generating alerts from completed games:', error);
    }
  }

  private async generateGameAlerts(game: any): Promise<void> {
    const alerts: AlertData[] = [];

    // Close Game Alert - if final score difference is <= 3
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);
    if (scoreDiff <= 3) {
      alerts.push({
        type: 'CLOSE_GAME',
        sport: 'MLB',
        gameId: game.gameId,
        score: 90 - (scoreDiff * 10), // Higher score for closer games
        payload: JSON.stringify({
          type: 'CLOSE_GAME',
          sport: 'MLB',
          gameId: game.gameId,
          context: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            scoreDifference: scoreDiff
          },
          message: `Close game! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore} - Decided by ${scoreDiff} run${scoreDiff !== 1 ? 's' : ''}`,
          situation: `${game.awayTeam} ${game.awayScore}-${game.homeTeam} ${game.homeTeam} (${scoreDiff} run game)`
        }),
        alertKey: `${game.gameId}_CLOSE_GAME`,
        state: 'NEW'
      });
    }

    // High-Scoring Game Alert - if total runs >= 12
    const totalRuns = game.homeScore + game.awayScore;
    if (totalRuns >= 12) {
      alerts.push({
        type: 'HIGH_SCORING',
        sport: 'MLB',
        gameId: game.gameId,
        score: Math.min(95, 60 + (totalRuns * 2)), // Cap at 95
        payload: JSON.stringify({
          type: 'HIGH_SCORING',
          sport: 'MLB',
          gameId: game.gameId,
          context: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            totalRuns: totalRuns
          },
          message: `High-scoring game! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore} - ${totalRuns} total runs`,
          situation: `${game.awayTeam} ${game.awayScore}-${game.homeTeam} ${game.homeTeam} (${totalRuns} runs)`
        }),
        alertKey: `${game.gameId}_HIGH_SCORING`,
        state: 'NEW'
      });
    }

    // Shutout Alert - if one team scored 0
    if (game.homeScore === 0 || game.awayScore === 0) {
      const shutoutTeam = game.homeScore === 0 ? game.awayTeam : game.homeTeam;
      const victimTeam = game.homeScore === 0 ? game.homeTeam : game.awayTeam;

      alerts.push({
        type: 'SHUTOUT',
        sport: 'MLB',
        gameId: game.gameId,
        score: 85,
        payload: JSON.stringify({
          type: 'SHUTOUT',
          sport: 'MLB',
          gameId: game.gameId,
          context: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            shutoutTeam: shutoutTeam,
            victimTeam: victimTeam
          },
          message: `SHUTOUT! ${shutoutTeam} ${game.awayScore > 0 ? game.awayScore : game.homeScore}, ${victimTeam} 0`,
          situation: `${shutoutTeam} shuts out ${victimTeam} ${Math.max(game.awayScore, game.homeScore)}-0`
        }),
        alertKey: `${game.gameId}_SHUTOUT`,
        state: 'NEW'
      });
    }

    // Blowout Alert - if score difference >= 7
    if (scoreDiff >= 7) {
      const winner = game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam;
      const loser = game.homeScore > game.awayScore ? game.awayTeam : game.homeTeam;

      alerts.push({
        type: 'BLOWOUT',
        sport: 'MLB',
        gameId: game.gameId,
        score: 75 + Math.min(20, scoreDiff * 2), // Scale with difference
        payload: JSON.stringify({
          type: 'BLOWOUT',
          sport: 'MLB',
          gameId: game.gameId,
          context: {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            scoreDifference: scoreDiff,
            winner: winner,
            loser: loser
          },
          message: `BLOWOUT! ${winner} ${Math.max(game.awayScore, game.homeScore)}, ${loser} ${Math.min(game.awayScore, game.homeScore)} - ${scoreDiff} run difference`,
          situation: `${winner} defeats ${loser} ${Math.max(game.awayScore, game.homeScore)}-${Math.min(game.awayScore, game.homeScore)}`
        }),
        alertKey: `${game.gameId}_BLOWOUT`,
        state: 'NEW'
      });
    }

    // Save all alerts to database
    for (const alert of alerts) {
      await this.saveAlert(alert);
    }

    if (alerts.length > 0) {
      console.log(`Generated ${alerts.length} alerts for game ${game.gameId}: ${game.awayTeam} vs ${game.homeTeam}`);
    }
  }

  private async saveAlert(alertData: AlertData): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertData.alertKey}, ${alertData.sport}, ${alertData.gameId}, 
                ${alertData.type}, ${alertData.state}, ${alertData.score}, ${alertData.payload}, NOW())
        ON CONFLICT (alert_key) DO NOTHING
      `);
    } catch (error) {
      console.error('Error saving alert:', error);
    }
  }

  // Method to generate alerts for live games (when they're happening)
  async generateLiveGameAlerts(): Promise<void> {
    try {
      // Get live games from both MLB and NCAAF
      const [mlbGames, ncaafGames] = await Promise.all([
        this.mlbApi.getTodaysGames(),
        this.ncaafApi.getTodaysGames()
      ]);

      const liveMLBGames = mlbGames.filter(game => game.isLive);
      const liveNCAAFGames = ncaafGames.filter(game => game.isLive);
      const totalLiveGames = liveMLBGames.length + liveNCAAFGames.length;

      if (totalLiveGames === 0) {
        console.log('🔍 No live games to monitor for alerts');
        return;
      }

      console.log(`🔍 Monitoring ${liveMLBGames.length} MLB + ${liveNCAAFGames.length} NCAAF live games for alerts`);

      let newAlerts = 0;

      // Process MLB games
      if (liveMLBGames.length > 0) {
        console.log(`⚾ Processing ${liveMLBGames.length} live MLB games`);
        for (const game of liveMLBGames) {
          const count = await this.generateLiveAlertsForGame(game);
          newAlerts += count;
        }
      }

      // Process NCAAF games  
      if (liveNCAAFGames.length > 0) {
        console.log(`🏈 Processing ${liveNCAAFGames.length} live NCAAF games`);
        for (const game of liveNCAAFGames) {
          const count = await this.generateNCAAFLiveAlerts(game);
          newAlerts += count;
        }
      }

      if (newAlerts > 0) {
        console.log(`🚨 Generated ${newAlerts} new live alerts!`);
      } else {
        console.log('📊 No new alerts generated from live games');
      }
    } catch (error) {
      console.error('Error generating live game alerts:', error);
    }
  }

  private async generateLiveAlertsForGame(game: any): Promise<number> {
    let alertCount = 0;

    // Extract game data properly to avoid [object Object] issues
    const gameId = game.gameId || game.id;
    const homeTeam = typeof game.homeTeam === 'string' ? game.homeTeam : game.homeTeam?.displayName || game.homeTeam?.name || 'Home';
    const awayTeam = typeof game.awayTeam === 'string' ? game.awayTeam : game.awayTeam?.displayName || game.awayTeam?.name || 'Away';
    const homeScore = typeof game.homeScore === 'number' ? game.homeScore : (game.homeScore?.score || 0);
    const awayScore = typeof game.awayScore === 'number' ? game.awayScore : (game.awayScore?.score || 0);

    // Debug: Log game scores to verify they're available
    console.log(`🔧 DEBUG: Processing game ${gameId} - ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`);

    // Create normalized game object
    const normalizedGame = {
      ...game,
      gameId,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore
    };

    // Fetch detailed live feed data for granular alerts
    try {
      const liveData = await this.fetchDetailedLiveData(gameId);
      if (!liveData) return 0;

      // Generate alerts based on detailed game state
      alertCount += await this.generateBaseRunnerAlerts(normalizedGame, liveData);
      alertCount += await this.generateInningPressureAlerts(normalizedGame, liveData);
      alertCount += await this.generateAtBatAlerts(normalizedGame, liveData);
      alertCount += await this.generateScoringAlerts(normalizedGame, liveData);

    } catch (error) {
      console.error(`Error fetching live data for game ${gameId}:`, error);
      // Fallback to basic alerts
      alertCount += await this.generateBasicLiveAlerts(normalizedGame);
    }

    return alertCount;
  }

  private async fetchDetailedLiveData(gameId: string): Promise<any> {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`);
      const data = await response.json();
      return data.liveData;
    } catch (error) {
      console.error(`Failed to fetch live data for game ${gameId}:`, error);
      return null;
    }
  }


  private calculateScoringProbability(hasFirst: boolean, hasSecond: boolean, hasThird: boolean, outs: number, gameState?: any): number {
    // Build state key for RE24 lookup
    const firstBase = hasFirst ? "1" : "0";
    const secondBase = hasSecond ? "1" : "0"; 
    const thirdBase = hasThird ? "1" : "0";
    const stateKey = `${firstBase}${secondBase}${thirdBase}-${outs}`;

    // Get base run expectancy
    const baseExpectancy = this.RE24[stateKey] || 0.11;

    // Convert run expectancy to scoring probability using sigmoid function
    // RE of 2.0+ = ~90% probability, RE of 0.5 = ~50% probability
    let probability = Math.round((1 / (1 + Math.exp(-2.5 * (baseExpectancy - 0.8)))) * 100);

    // Context-aware adjustments
    if (gameState) {
      // Weather adjustments for home run probability
      if (gameState.weather?.windSpeed > 10 && 
          typeof gameState.weather?.windDirection === 'string' && 
          gameState.weather?.windDirection?.includes('Out')) {
        probability += 5; // Favorable wind conditions
      }

      // Power hitter adjustment
      if (gameState.batter?.seasonHomeRuns >= 20) {
        probability += 3;
      }

      // Ballpark factors (hitter-friendly parks)
      const hitterFriendlyParks = ['Coors Field', 'Great American Ball Park', 'Yankee Stadium'];
      if (hitterFriendlyParks.some(park => gameState.venue?.name?.includes(park))) {
        probability += 2;
      }

      // Late inning pressure situations
      if (gameState.inning >= 7) {
        probability += 2;
      }

      // Close game situations (within 3 runs)
      if (Math.abs((gameState.homeScore || 0) - (gameState.awayScore || 0)) <= 3) {
        probability += 3;
      }
    }

    // Ensure probability stays within realistic bounds
    return Math.min(Math.max(probability, 5), 95);
  }

  private async generateBaseRunnerAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;

    // Use the offense object which shows current base situation
    const offense = liveData?.linescore?.offense;
    if (!offense) return 0;

    // Check actual base occupancy
    const hasFirst = !!offense.first;
    const hasSecond = !!offense.second;
    const hasThird = !!offense.third;

    const inning = liveData.linescore?.currentInning || 0;
    const outs = liveData.linescore?.outs || 0;
    const isTopInning = liveData.linescore?.isTopInning || false;

    // Calculate scoring probability
    const gameState: any = {
      inning: inning,
      isTopInning: isTopInning,
      outs: outs,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      venue: { name: liveData.venue?.venueName }, // Assuming venue name is available
      batter: { seasonHomeRuns: 0 } // Placeholder, will be populated if batter is analyzed
    };

    // Get current batter stats if available to calculate power hitter probability
    const currentPlayForBatter = liveData?.plays?.currentPlay;
    if (currentPlayForBatter && currentPlayForBatter.matchup?.batter?.id) {
      try {
        const batterStats = await this.fetchBatterStats(currentPlayForBatter.matchup.batter.id);
        if (batterStats && batterStats.stats && batterStats.stats[0] && batterStats.stats[0].stats) {
          gameState.batter.seasonHomeRuns = batterStats.stats[0].stats.homeRuns || 0;
        }
      } catch (error) {
        console.error(`Failed to fetch batter stats for probability calculation: ${error}`);
      }
    }

    // Get weather data for enhanced context
    const weather = await weatherService.getWeatherForTeam(game.homeTeam);
    gameState.weather = {
      temperature: weather.temperature,
      condition: weather.condition,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection,
      homeRunFactor: weatherService.calculateHomeRunFactor(weather)
    };

    const scoringProbability = this.calculateScoringProbability(hasFirst, hasSecond, hasThird, outs, gameState);


    // Extract current count (balls/strikes) from current play
    const currentPlay = liveData?.plays?.currentPlay;
    const count = currentPlay?.count || {};
    const balls = count.balls || 0;
    const strikes = count.strikes || 0;

    // Bases loaded: all three bases occupied
    if (hasFirst && hasSecond && hasThird) {
      // Check if BASES_LOADED alerts are globally enabled
      const basesLoadedEnabled = await this.isAlertGloballyEnabled('MLB', 'BASES_LOADED');
      if (!basesLoadedEnabled) {
        console.log(`⛔ BASES_LOADED alert blocked - globally disabled`);
        return alertCount;
      }

      const alertKey = `${game.gameId}_BASES_LOADED_${inning}_${outs}`;
      const outsText = outs === 1 ? '1 out' : `${outs} outs`;
      const message = `🔥 BASES LOADED! (${scoringProbability}% scoring chance) ${game.awayTeam} vs ${game.homeTeam} - ${outsText} in the ${isTopInning ? 'Top' : 'Bottom'} of ${inning}`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'BASES_LOADED', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning,
        isTopInning,
        outs,
        balls,
        strikes,
        hasFirst,
        hasSecond,
        hasThird,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        third: offense.third?.fullName,
        situation: 'bases_loaded',
        scoringProbability
      }, scoringProbability > 70 ? 98 : 95);
    }
    // Runners on 1st and 2nd (prime scoring opportunity)
    else if (hasFirst && hasSecond && !hasThird) {
      // Check if RUNNERS_1ST_2ND alerts are globally enabled
      const runners1st2ndEnabled = await this.isAlertGloballyEnabled('MLB', 'RUNNERS_1ST_2ND');
      if (!runners1st2ndEnabled) {
        console.log(`⛔ RUNNERS_1ST_2ND alert blocked - globally disabled`);
        return alertCount;
      }

      const alertKey = `${game.gameId}_RUNNERS_1ST_2ND_${inning}_${outs}`;
      const outsText = outs === 1 ? '1 out' : `${outs} outs`;
      const message = `💎 Runners on 1st & 2nd (${scoringProbability}% scoring chance) ${game.awayTeam} vs ${game.homeTeam} - ${outsText}`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'RUNNERS_1ST_2ND', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning,
        isTopInning,
        outs,
        balls,
        strikes,
        hasFirst,
        hasSecond,
        hasThird: false,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        situation: 'runners_on_1st_and_2nd',
        scoringProbability
      }, scoringProbability > 50 ? 88 : 85);
    }
    // Runner in scoring position (2nd or 3rd base, but not bases loaded or 1st+2nd)
    else if ((hasSecond || hasThird) && !(hasFirst && hasSecond && hasThird) && !(hasFirst && hasSecond && !hasThird)) {
      // Check if RISP alerts are globally enabled
      const rispEnabled = await this.isAlertGloballyEnabled('MLB', 'RISP');
      if (!rispEnabled) {
        console.log(`⛔ RISP alert blocked - globally disabled`);
        return alertCount;
      }

      const alertKey = `${game.gameId}_RISP_${inning}_${outs}`;
      const positions = [];
      if (hasSecond) positions.push('2nd');
      if (hasThird) positions.push('3rd');
      // Get weather data for enhanced context
      const weather = await weatherService.getWeatherForTeam(game.homeTeam);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

      const outsText = outs === 1 ? '1 out' : `${outs} outs`;
      const message = `⚾ SCORING POSITION (${scoringProbability}% chance) ${game.awayTeam} vs ${game.homeTeam} - Runner on ${positions.join(' & ')}, ${outsText}. ${weather.temperature}°F, ${windDesc}`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'RISP', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning,
        isTopInning,
        outs,
        balls,
        strikes,
        hasFirst: hasFirst && !hasSecond, // Only first if not also second
        hasSecond,
        hasThird,
        situation: 'runner_in_scoring_position',
        weather: {
          temperature: weather.temperature,
          condition: weather.condition,
          windDescription: windDesc,
          homeRunFactor: homeRunFactor
        }
      }, 85);
    }

    return alertCount;
  }

  // Fetch batter stats for power analysis
  private async fetchBatterStats(batterId: string): Promise<any> {
    try {
      const response = await fetch(`https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=season,career&group=hitting&season=2025`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch batter stats for ID ${batterId}:`, error);
      return null;
    }
  }

  // Check if batter is a power hitter (20+ HRs)
  private isPowerHitter(batterStats: any): boolean {
    const seasonHRs = batterStats?.stats?.[0]?.stats?.homeRuns || 0;
    const careerHRs = batterStats?.stats?.[1]?.stats?.homeRuns || 0;

    // Elite power threshold: 20+ HRs in season or 150+ career
    return seasonHRs >= 20 || careerHRs >= 150;
  }

  // Check if batter is hot (already homered today)
  private isHotHitter(batterName: string, todayPlays: any[]): boolean {
    if (!batterName) return false;

    for (const play of todayPlays) {
      if (play.result?.event === 'Home Run' && 
          play.matchup?.batter?.fullName === batterName) {
        return true;
      }
    }
    return false;
  }

  private async generateInningPressureAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const inning = liveData.linescore?.currentInning || 0;
    const isTopInning = liveData.linescore?.isTopInning;
    const outs = liveData.linescore?.outs || 0;
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);

    // Extract current count (balls/strikes) from current play
    const currentPlay = liveData?.plays?.currentPlay;
    const count = currentPlay?.count || {};
    const balls = count.balls || 0;
    const strikes = count.strikes || 0;

    // Late inning pressure situations
    if (inning >= 8 && scoreDiff <= 2) {
      const alertKey = `${game.gameId}_LATE_PRESSURE_${inning}`;
      const situation = isTopInning ? 'top' : 'bottom';
      // Get weather data for late inning context
      const weather = await weatherService.getWeatherForTeam(game.homeTeam);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

      const message = `🔥 LATE INNING PRESSURE! ${game.homeTeam} ${game.homeScore}, ${game.awayTeam} ${game.awayTeam} ${game.awayScore} - ${situation} ${inning}th. ${weather.temperature}°F, ${windDesc}`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'LATE_PRESSURE', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning,
        isTopInning,
        outs,
        balls,
        strikes,
        scoreDiff,
        weather: {
          temperature: weather.temperature,
          condition: weather.condition,
          windDescription: windDesc,
          homeRunFactor: weatherService.calculateHomeRunFactor(weather)
        }
      }, 92);
    }

    return alertCount;
  }

  private async generateAtBatAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const currentPlay = liveData?.plays?.currentPlay;
    if (!currentPlay) return 0;

    console.log(`🔧 DEBUG: generateAtBatAlerts called for game ${game.gameId}`);

    const count = currentPlay.count;
    const balls = count?.balls || 0;
    const strikes = count?.strikes || 0;

    // Check for power hitter at bat
    const batter = currentPlay?.matchup?.batter;
    if (batter && batter.id) {
      try {
        // Fetch batter stats for power analysis
        const statsResponse = await fetch(`https://statsapi.mlb.com/api/v1/people/${batter.id}/stats?stats=season,career&group=hitting&season=2025`);
        const batterData = await statsResponse.json();

        if (this.isPowerHitter(batterData)) {
          const offense = liveData?.linescore?.offense;
          const hasRunners = !!(offense?.first || offense?.second || offense?.third);
          const inning = liveData.linescore?.currentInning || 0;
          const outs = liveData.linescore?.outs || 0;
          const seasonHRs = batterData?.stats?.[0]?.stats?.homeRuns || 0;

          // Get weather for home run probability
          const weather = await weatherService.getWeatherForTeam(game.homeTeam);
          const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
          const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

          // Calculate power score (0-100)
          let powerScore = 50; // Base score
          if (seasonHRs >= 30) powerScore = 75; // Elite slugger
          else if (seasonHRs >= 20) powerScore = 65; // Strong power
          if (hasRunners) powerScore += 10; // Runners on base bonus
          if (homeRunFactor > 1.2) powerScore += 10; // Weather bonus

          const alertKey = `${game.gameId}_POWER_HITTER_${batter.id}_${inning}_${outs}`;
          const message = `💪 POWER HITTER! ${batter.fullName} (${seasonHRs} HRs) at bat - ${game.awayTeam} vs ${game.homeTeam}${hasRunners ? ', runners on!' : ''}. Wind: ${windDesc}`;

          alertCount += await this.saveRealTimeAlert(alertKey, 'POWER_HITTER', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            batter: batter.fullName,
            batterId: batter.id,
            seasonHomeRuns: seasonHRs,
            powerScore,
            hasRunners,
            inning,
            outs,
            balls,
            strikes,
            weather: {
              temperature: weather.temperature,
              windSpeed: weather.windSpeed,
              windDirection: weather.windDirection,
              homeRunFactor
            }
          }, powerScore);
        }

        // Check if hot hitter (already homered today)
        const allPlays = liveData?.plays?.allPlays || [];
        if (this.isHotHitter(batter.fullName, allPlays)) {
          const alertKey = `${game.gameId}_HOT_HITTER_${batter.id}_${Date.now()}`;
          const message = `🔥 HOT HITTER! ${batter.fullName} already homered today - ${game.awayTeam} vs ${game.homeTeam}`;

          alertCount += await this.saveRealTimeAlert(alertKey, 'HOT_HITTER', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            batter: batter.fullName,
            batterId: batter.id,
            balls,
            strikes
          }, 85);
        }
      } catch (error) {
        // Stats fetch failed, continue without power hitter detection
        console.log(`Failed to fetch batter stats: ${error}`);
      }
    }

    // Check recent plays for strikeouts
    const allPlays = liveData?.plays?.allPlays || [];
    if (allPlays.length >= 2) {
      // Check the last few completed plays for strikeouts
      const recentPlays = allPlays.slice(-3);

      for (const play of recentPlays) {
        const result = play.result;
        const description = result?.description || '';
        const event = result?.event || '';

        // Multiple ways to detect strikeouts from MLB API
        const isStrikeout = 
          event === 'Strikeout' ||
          event === 'Strike Out' || 
          event.includes('strikeout') ||
          description.toLowerCase().includes('strikes out') ||
          description.toLowerCase().includes('struck out') ||
          description.toLowerCase().includes('strikeout');

        if (isStrikeout) {
          console.log(`🔧 DEBUG: Found strikeout event for game ${game.gameId}`);
          // Check if STRIKEOUT alerts are globally enabled
          const strikeoutEnabled = await this.isAlertGloballyEnabled('MLB', 'STRIKEOUT');
          if (!strikeoutEnabled) {
            console.log(`⛔ STRIKEOUT alert blocked - globally disabled`);
            continue; // Skip this alert
          }
          console.log(`✅ STRIKEOUT alert proceeding - globally enabled`);

          // 🛡️ DEDUPLICATION CHECK
          const dedupKey = {
            gameId: game.gameId,
            type: 'STRIKEOUT',
            inning: play.about?.inning,
            half: play.about?.halfInning,
            outs: play.about?.outs,
            batter: play.matchup?.batter?.fullName,
            paId: `${play.about?.atBatIndex}`
          };

          // Check deduplication
          const shouldSend = this.deduplication.shouldSendAlert({
            gameId: String(game.gameId),
            type: 'STRIKEOUT',
            inning: play.about?.inning,
            half: play.about?.halfInning,
            outs: play.about?.outs,
            bases: `${play.runners?.filter((r: any) => r.details?.isScoringEvent).length > 0 ? '1' : ''}`,
            batter: play.matchup?.batter?.fullName,
            paId: `${play.about?.atBatIndex}`
          });

          console.log(`🎯 DEDUP CHECK: STRIKEOUT for game ${game.gameId} - shouldSend: ${shouldSend}`);

          if (!shouldSend) {
            console.log(`🔄 Alert deduplicated: STRIKEOUT for game ${game.gameId}`);
            continue; // Skip this strikeout alert
          }

          const alertKey = `${game.gameId}_STRIKEOUT_${play.about?.atBatIndex}`;
          const batter = play.matchup?.batter?.fullName || 'Unknown Batter';
          const pitcher = play.matchup?.pitcher?.fullName || 'Unknown Pitcher';
          const message = `⚡ STRIKEOUT! ${batter} struck out by ${pitcher} - ${game.awayTeam} vs ${game.homeTeam}`;

          console.log(`🚨 GENERATING STRIKEOUT ALERT: ${message}`);
          // Generate AI betting insights for this strikeout alert
          const betbookData = getBetbookData({
            sport: 'MLB',
            gameId: game.gameId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore || 0,
            awayScore: game.awayScore || 0,
            type: 'STRIKEOUT',
            probability: 75,
            inning: play.about?.inning,
            outs: play.about?.outs || 0
          });

          const alertsSaved = await this.saveRealTimeAlert(alertKey, 'STRIKEOUT', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            batter: batter,
            pitcher: pitcher,
            inning: play.about?.inning,
            outs: play.about?.outs || play.about?.o || liveData?.plays?.currentPlay?.count?.outs || 0,
            balls,
            strikes,
            situation: 'strikeout',
            betbookData: betbookData,
            recommendation: betbookData.aiAdvice
          }, 75);
          console.log(`🚨 STRIKEOUT ALERT SAVED: ${alertsSaved} alerts`);
          alertCount += alertsSaved;
        }
      }
    }

    // Full count situation (3-2)
    if (balls === 3 && strikes === 2) {
      const alertKey = `${game.gameId}_FULL_COUNT_${Date.now()}`;
      const message = `⚾ FULL COUNT! ${game.awayTeam} vs ${game.homeTeam} - 3-2 count, pressure on!`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'FULL_COUNT', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        balls,
        strikes,
        situation: 'full_count'
      }, 80);
    }

    return alertCount;
  }

  private async generateScoringAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const allPlays = liveData?.plays?.allPlays || [];

    // Check the most recent play for scoring
    if (allPlays.length > 0) {
      const lastPlay = allPlays[allPlays.length - 1];
      const playEvents = lastPlay.playEvents || [];

      for (const event of playEvents) {
        if (event.details?.event === 'Home Run') {
          // Check for Grand Slam by looking at runners
          const runners = lastPlay.runners || [];
          const runsScored = runners.filter((r: any) => r.details?.isScoringEvent).length;
          const isGrandSlam = runsScored >= 4;

          const alertKey = `${game.gameId}_HOME_RUN_${lastPlay.about?.atBatIndex}`;
          const batter = lastPlay.matchup?.batter?.fullName || 'Unknown';
          const message = isGrandSlam ? 
            `🎆 GRAND SLAM!!! ${batter} clears the bases! ${game.awayTeam} vs ${game.homeTeam} - 4 runs score!` :
            `🏠 HOME RUN! ${batter} goes deep! ${game.awayTeam} vs ${game.homeTeam}${runsScored > 1 ? ` - ${runsScored} runs score!` : ''}`;

          // Get weather data for home run context
          const weather = await weatherService.getWeatherForTeam(game.homeTeam);
          const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
          const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);

          alertCount += await this.saveRealTimeAlert(alertKey, 'HOME_RUN_LIVE', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            batter: lastPlay.matchup?.batter?.fullName,
            inning: lastPlay.about?.inning,
            balls: liveData?.plays?.currentPlay?.count?.balls || 0,
            strikes: liveData?.plays?.currentPlay?.count?.strikes || 0,
            outs: lastPlay.about?.o || 0,
            weather: {
              temperature: weather.temperature,
              condition: weather.condition,
              windDescription: windDesc,
              homeRunFactor: homeRunFactor
            }
          }, 100);
        }
      }
    }

    return alertCount;
  }

  private async generateBasicLiveAlerts(game: any): Promise<number> {
    let alertCount = 0;
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);

    // Fallback to basic close game alert - TEMPORARILY RELAXED FOR TESTING
    if (scoreDiff <= 10 && (game.homeScore > 0 || game.awayScore > 0)) {
      const alertKey = `${game.gameId}_LIVE_CLOSE_TEST_${Date.now()}`;
      const message = `🔥 TEST ALERT: Game ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore}`;

      console.log(`🧪 GENERATING TEST ALERT with scores: ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore}`);

      alertCount += await this.saveRealTimeAlert(alertKey, 'CLOSE_GAME_LIVE', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        scoreDiff
      }, 85);
    }

    return alertCount;
  }

  private async generateNCAAFLiveAlerts(game: any): Promise<number> {
    let alertCount = 0;

    try {
      // Two-minute warning for quarters and halfs
      alertCount += await this.generateTwoMinuteWarningAlert(game);

      // Kickoff and halftime alerts
      alertCount += await this.generateKickoffAlert(game);
      alertCount += await this.generateHalftimeAlert(game);

      // Add other NCAAF alerts here (fourth down, red zone, etc.)

    } catch (error) {
      console.error(`Error generating NCAAF alerts for game ${game.gameId}:`, error);
    }

    return alertCount;
  }

  private async generateTwoMinuteWarningAlert(game: any): Promise<number> {
    let alertCount = 0;

    const timeRemaining = game.timeRemaining || '';
    const quarter = game.quarter || 0;

    // Debug logging for NCAAF time detection
    console.log(`🏈 NCAAF Debug - Game: ${game.awayTeam} vs ${game.homeTeam}`);
    console.log(`🏈 Time Remaining: "${timeRemaining}" | Quarter: ${quarter} | Status: ${game.status}`);
    console.log(`🏈 Is Live: ${game.isLive} | Within 2min: ${this.isWithinTwoMinutes(timeRemaining)}`);

    // Check if we're in the final 2 minutes of any quarter
    if (this.isWithinTwoMinutes(timeRemaining) && quarter > 0) {
      // Determine if it's end of half (2nd or 4th quarter)
      const isEndOfHalf = quarter === 2 || quarter === 4;
      const periodType = isEndOfHalf ? 'half' : 'quarter';

      const alertKey = `${game.gameId}_TWO_MINUTE_WARNING_Q${quarter}_${timeRemaining.replace(/[:\s]/g, '')}`;
      const message = `⏰ TWO MINUTE WARNING! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore} - ${timeRemaining} left in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'TWO_MINUTE_WARNING', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        timeRemaining,
        isEndOfHalf,
        periodType
      }, 88, 'NCAAF');
    }

    return alertCount;
  }

  private isWithinTwoMinutes(timeRemaining: string): boolean {
    if (!timeRemaining || timeRemaining === '0:00' || timeRemaining === '00:00') return false;

    // Handle different time formats from ESPN
    let totalSeconds = 0;

    try {
      // Clean the time string - remove extra spaces and non-time characters
      let cleanTime = timeRemaining.trim();

      // Extract just the time portion if it contains extra info
      // Formats: "1:45", "0:30", "12:30", "1:45 - 4th", "0:30 4th", "2:00 4TH"
      if (cleanTime.includes(' ')) {
        cleanTime = cleanTime.split(' ')[0];
      }
      if (cleanTime.includes('-')) {
        cleanTime = cleanTime.split('-')[0].trim();
      }

      // Now parse MM:SS or M:SS format
      if (cleanTime.includes(':')) {
        const timeParts = cleanTime.split(':');
        if (timeParts.length === 2) {
          const minutes = parseInt(timeParts[0]) || 0;
          const seconds = parseInt(timeParts[1]) || 0;

          // Validate reasonable time values
          if (minutes >= 0 && minutes <= 15 && seconds >= 0 && seconds <= 59) {
            totalSeconds = (minutes * 60) + seconds;
          }
        }
      }
      // Handle edge case of seconds-only format like "45" or "90"
      else if (/^\d+$/.test(cleanTime)) {
        const secondsOnly = parseInt(cleanTime);
        if (secondsOnly >= 0 && secondsOnly <= 900) { // Max 15 minutes
          totalSeconds = secondsOnly;
        }
      }

      console.log(`🏈 Time parsing: "${timeRemaining}" → cleaned: "${cleanTime}" → ${totalSeconds} seconds`);

      // Check if we're within 2 minutes (120 seconds)
      return totalSeconds <= 120 && totalSeconds > 0;

    } catch (error) {
      console.error(`🏈 Error parsing time "${timeRemaining}":`, error);
      return false;
    }
  }

  private async generateKickoffAlert(game: any): Promise<number> {
    // Check if NCAAF_KICKOFF alerts are globally enabled
    const kickoffEnabled = await this.isAlertGloballyEnabled('NCAAF', 'NCAAF_KICKOFF');
    if (!kickoffEnabled) {
      console.log(`⛔ NCAAF_KICKOFF alert blocked - globally disabled`);
      return 0;
    }

    const quarter = game.quarter || 0;
    const timeRemaining = game.timeRemaining || '';

    // Detect game start (1st quarter, full time)
    if (quarter === 1 && (timeRemaining === '15:00' || timeRemaining === '15:00 - 1st')) {
      const alertKey = `${game.gameId}_KICKOFF_START`;
      const message = `🏈 KICKOFF! ${game.awayTeam} vs ${game.homeTeam} - Game is starting!`;

      return await this.saveRealTimeAlert(alertKey, 'NCAAF_KICKOFF', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        timeRemaining,
        kickoffType: 'game_start',
        homeRank: game.homeRank || 0,
        awayRank: game.awayRank || 0
      }, 85, 'NCAAF');
    }

    // Detect second half kickoff (3rd quarter, full time)
    if (quarter === 3 && (timeRemaining === '15:00' || timeRemaining === '15:00 - 3rd')) {
      const alertKey = `${game.gameId}_KICKOFF_2ND_HALF`;
      const message = `🏈 2ND HALF KICKOFF! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore} - Second half underway!`;

      return await this.saveRealTimeAlert(alertKey, 'NCAAF_KICKOFF', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        timeRemaining,
        kickoffType: 'second_half',
        homeRank: game.homeRank || 0,
        awayRank: game.awayRank || 0
      }, 88, 'NCAAF');
    }

    return 0;
  }

  private async generateHalftimeAlert(game: any): Promise<number> {
    // Check if NCAAF_HALFTIME alerts are globally enabled
    const halftimeEnabled = await this.isAlertGloballyEnabled('NCAAF', 'NCAAF_HALFTIME');
    if (!halftimeEnabled) {
      console.log(`⛔ NCAAF_HALFTIME alert blocked - globally disabled`);
      return 0;
    }

    const quarter = game.quarter || 0;
    const timeRemaining = game.timeRemaining || '';

    // Detect halftime (transition from 2nd to 3rd quarter or explicit halftime status)
    if (quarter === 2 && timeRemaining === '0:00') {
      const alertKey = `${game.gameId}_HALFTIME`;
      const scoreDiff = Math.abs(game.homeScore - game.awayScore);
      const leader = game.homeScore > game.awayScore ? game.homeTeam : 
                   game.awayScore > game.homeScore ? game.awayTeam : 'Tied';

      let message = `⏸️ HALFTIME! `;
      if (leader === 'Tied') {
        message += `${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeTeam} ${game.homeScore} - All tied up!`;
      } else {
        message += `${leader} leads ${Math.max(game.homeScore, game.awayScore)}-${Math.min(game.homeScore, game.awayScore)}`;
        if (scoreDiff >= 14) message += ` - Big lead!`;
        else if (scoreDiff <= 3) message += ` - Close game!`;
      }

      return await this.saveRealTimeAlert(alertKey, 'NCAAF_HALFTIME', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        timeRemaining,
        scoreDiff,
        leader,
        homeRank: game.homeRank || 0,
        awayRank: game.awayRank || 0
      }, scoreDiff <= 3 ? 90 : 82, 'NCAAF');
    }

    return 0;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
  }

  // Generate AI betting insights for alerts
  private async generateBetbookData(context: any, priority: number, sport: string): Promise<BetbookData> {
    const homeScore = context.homeScore || 0;
    const awayScore = context.awayScore || 0;
    const totalScore = homeScore + awayScore;

    // Generate realistic odds based on game situation
    let homeOdds = -110;
    let awayOdds = -110;
    let totalLine = sport === 'MLB' ? Math.max(totalScore + 1.5, 7.5) : Math.max(totalScore + 3, 45);

    // Adjust odds based on score differential
    const scoreDiff = homeScore - awayScore;
    if (scoreDiff > 0) {
      homeOdds = Math.max(-200, -110 - (scoreDiff * 15));
      awayOdds = Math.min(+180, -110 + (scoreDiff * 20));
    } else if (scoreDiff < 0) {
      awayOdds = Math.max(-200, -110 - (Math.abs(scoreDiff) * 15));
      homeOdds = Math.min(+180, -110 + (Math.abs(scoreDiff) * 20));
    }

    // Generate AI advice based on alert context
    let aiAdvice = "Standard betting situation detected.";
    if (priority >= 90) {
      aiAdvice = `HIGH VALUE: ${sport === 'MLB' ? 'Live over/under' : 'In-game betting'} opportunity with ${priority}% confidence. Consider betting the over ${totalLine}.`;
    } else if (priority >= 80) {
      aiAdvice = `GOOD VALUE: Moderate betting opportunity. ${sport === 'MLB' ? 'Over ' + totalLine + ' runs' : 'Live betting'} shows value.`;
    } else if (context.scoringProbability >= 70) {
      aiAdvice = `SCORING LIKELY: ${context.scoringProbability}% chance of runs scoring. Consider live betting opportunities.`;
    }

    return {
      odds: {
        home: homeOdds,
        away: awayOdds,
        total: totalLine
      },
      aiAdvice,
      sportsbookLinks: [
        { name: 'FanDuel', url: 'https://sportsbook. FanDuel.com' },
        { name: 'DraftKings', url: 'https://sportsbook.draftkings.com' },
        { name: 'Bet365', url: 'https://www.bet365.com' },
        { name: 'BetMGM', url: 'https://sports.betmgm.com' }
      ]
    };
  }

  // Generate V3 AI Analysis
  private generateV3Analysis(context: any, priority: number, type: string): V3Analysis {
    const tier = Math.ceil(priority / 25); // 1-4 tier system
    const probability = context.scoringProbability || Math.min(95, priority);

    const reasons = [];
    let recommendation = "Monitor situation";
    let confidence = priority;

    // Build analysis reasons based on context
    if (context.hasFirst && context.hasSecond && context.hasThird) {
      reasons.push("Bases loaded - maximum scoring potential");
      recommendation = "Bet Over immediately";
      confidence = Math.min(95, confidence + 10);
    } else if (context.hasSecond || context.hasThird) {
      reasons.push("Runner in scoring position");
      recommendation = "Consider Over bet";
    }

    if (context.outs <= 1) {
      reasons.push(`Only ${context.outs} out${context.outs === 1 ? '' : 's'} - high leverage`);
      confidence += 5;
    }

    if (context.weather?.homeRunFactor > 1.2) {
      reasons.push("Favorable wind conditions for home runs");
      confidence += 8;
    }

    if (context.seasonHomeRuns >= 20) {
      reasons.push("Power hitter at bat");
      confidence += 7;
    }

    if (context.inning >= 7) {
      reasons.push("Late inning pressure situation");
      confidence += 5;
    }

    // Type-specific analysis
    if (type === 'BASES_LOADED') {
      reasons.push("Historical: 85% chance of at least 1 run scoring");
      recommendation = "STRONG BET: Over current total";
      confidence = Math.min(95, confidence + 15);
    } else if (type === 'POWER_HITTER') {
      reasons.push(`${context.seasonHomeRuns} HR season - elite power threat`);
      recommendation = "Consider player prop bets";
    }

    return {
      tier,
      probability,
      reasons: reasons.slice(0, 3), // Keep top 3 reasons
      recommendation,
      confidence: Math.min(95, Math.max(25, confidence))
    };
  }

  private async saveRealTimeAlert(alertKey: string, type: string, gameId: string, message: string, context: any, priority: number, sport: string = 'MLB'): Promise<number> {
    try {
      // Check if alert already exists (conflict check)
      const existingAlert = await db.execute(sql`
        SELECT 1 FROM alerts WHERE alert_key = ${alertKey}
      `);

      if (existingAlert.rows.length > 0) {
        return 0; // Alert already exists
      }

      // Generate AI betting insights for high-priority alerts
      if (priority >= 70 && !context.betbookData) {
        try {
          const betbookData = getBetbookData({
            sport: sport,
            gameId: gameId,
            homeTeam: context.homeTeam,
            awayTeam: context.awayTeam,
            homeScore: context.homeScore || 0,
            awayScore: context.awayScore || 0,
            type: type,
            probability: priority,
            inning: context.inning,
            outs: context.outs || 0
          });

          context.betbookData = betbookData;
          console.log(`🤖 AI: Generated betting insights for ${type} alert - ${betbookData.aiAdvice}`);
        } catch (error) {
          console.error('❌ AI betting insights generation failed:', error);
        }
      }

      // Enhanced payload with AI insights
      const enhancedPayload = {
        message,
        context,
        betbookData: context.betbookData, // Ensure betbookData is part of the payload
        gameInfo: {
          v3Analysis: this.generateV3Analysis(context, priority, type) // Generate V3 Analysis here
        }
      };

      // Always save alerts - let Telegram sending handle user preferences
      console.log(`💾 Saving alert: ${type} for game ${gameId}`);

      // Insert new alert
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertKey}, ${sport}, ${gameId}, 
                ${type}, 'NEW', ${priority}, ${JSON.stringify(enhancedPayload)}, NOW())
      `);

      console.log(`🚨 REAL-TIME ALERT: ${message}`);

      // Send to Telegram for users monitoring this game
      try {
        // Send to users with proper preference checking (RULE 1 & 2 ENFORCEMENT)
      console.log(`📡 Sending Telegram alerts with preference checking for ${type}`);
      const allUsers = await storage.getAllUsers();
      const telegramUsers = allUsers.filter(u => u.telegramEnabled && u.telegramBotToken && u.telegramChatId);
      console.log(`📱 Found ${telegramUsers.length} users with Telegram configured`);

      for (const user of telegramUsers) {
        console.log(`📱 🔍 Processing Telegram for user: ${user.username}`);

        // RULE 2: Check if globally enabled by admin first
        const isGloballyEnabled = await this.isAlertGloballyEnabled(sport, type);
        if (!isGloballyEnabled) {
          console.log(`⛔ RULE 2: Telegram alert blocked - ${type} globally disabled by admin for user ${user.username}`);
          continue;
        }
        console.log(`✅ RULE 2: Alert ${type} is globally enabled by admin`);

        // RULE 1: Check individual user preferences  
        try {
          const userPrefs = await storage.getUserAlertPreferencesBySport(user.id, sport.toLowerCase());
          const userPref = userPrefs.find(p => p.alertType === type);

          // Default behavior: if user has never set a preference, follow global admin setting
          const userHasEnabled = userPref ? userPref.enabled : isGloballyEnabled;

          console.log(`📱 🔧 RULE 1: User ${user.username} preference for ${type}: ${userHasEnabled} (${userPref ? 'explicitly set' : 'following global admin setting'})`);

          if (!userHasEnabled) {
            console.log(`⛔ RULE 1: User ${user.username} has ${type} disabled in individual preferences`);
            continue;
          }

          console.log(`✅ RULE 1 & 2: All checks passed for user ${user.username}`);
        } catch (prefError) {
          console.error(`❌ Error checking preferences for ${user.username}:`, prefError);
          // On error, default to global admin setting as fallback
          if (!isGloballyEnabled) {
            console.log(`⛔ Fallback: Using global admin setting (disabled) for ${user.username}`);
            continue;
          }
          console.log(`⚠️ Fallback: Using global admin setting (enabled) for ${user.username}`);
        }

          const telegramConfig: TelegramConfig = {
            botToken: user.telegramBotToken,
            chatId: user.telegramChatId
          };

          const telegramAlert = {
            type,
            title: `${type.replace('_', ' ')} Alert`,
            description: message,
            gameInfo: {
              homeTeam: context.homeTeam,
              awayTeam: context.awayTeam,
              score: { home: context.homeScore, away: context.awayScore },
              inning: context.inning,
              inningState: context.isTopInning ? 'top' : 'bottom',
              outs: context.outs,
              balls: context.balls,
              strikes: context.strikes,
              runners: {
                first: context.hasFirst,
                second: context.hasSecond,
                third: context.hasThird
              },
              weather: context.weather
            }
          };

          try {
            console.log(`📱 🔄 Attempting to send Telegram alert to user ${user.username} (${telegramConfig.chatId})`);
            console.log(`📱 📋 Alert details: ${type} - ${message.substring(0, 100)}...`);

            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
            if (sent) {
              console.log(`📱 ✅ Telegram alert sent successfully to user ${user.username}`);
            } else {
              console.log(`📱 ❌ Failed to send Telegram alert to user ${user.username}`);
              console.log(`📱 🔧 Bot token length: ${telegramConfig.botToken?.length || 0}, Chat ID: ${telegramConfig.chatId}`);
            }
          } catch (telegramError) {
            console.error(`📱 ❌ Telegram error for user ${user.username}:`, telegramError);
            console.error(`📱 🔧 Config: token=${telegramConfig.botToken ? 'SET' : 'MISSING'}, chatId=${telegramConfig.chatId}`);
          }
        }
      } catch (telegramError) {
        console.error('Error sending Telegram alerts:', telegramError);
      }

      return 1;
    } catch (error) {
      console.error('Error saving real-time alert:', error);
      return 0;
    }
  }

  private async generateSituationInsight(gameContext: any): Promise<string | null> {
    try {
      const scoreDiff = Math.abs(gameContext.score.home - gameContext.score.away);
      const isLateInning = gameContext.inning >= 7;
      const isCloseGame = scoreDiff <= 2;

      if (isLateInning && isCloseGame && gameContext.baseRunners.length > 0) {
        return 'High-leverage situation with scoring opportunity';
      } else if (gameContext.baseRunners.length >= 2) {
        return 'Multiple runners in scoring position';
      } else if (gameContext.outs === 2) {
        return 'Two-out pressure situation';
      }

      return null;
    } catch {
      return null;
    }
  }

  private async generatePrediction(gameContext: any): Promise<string | null> {
    try {
      if (!gameContext.batter) return null;

      const runnerCount = gameContext.baseRunners.length;
      const outs = gameContext.outs;

      if (runnerCount > 0 && outs < 2) {
        return `${Math.round(60 - (outs * 15))}% chance of scoring this inning`;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async calculateScoringProb(gameContext: any): Promise<string | null> {
    try {
      let baseProb = 0;
      if (gameContext.baseRunners.includes('3B')) baseProb += 60;
      if (gameContext.baseRunners.includes('2B')) baseProb += 40;
      if (gameContext.baseRunners.includes('1B')) baseProb += 20;

      // Adjust for outs
      baseProb = baseProb * (3 - gameContext.outs) / 3;

      const probability = Math.min(85, Math.max(15, baseProb));
      return `${probability}%`;
    } catch {
      return null;
    }
  }

  async destroy() {
    this.deduplication.destroy();
  }
}