import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { weatherService } from "./weather-service";
import { storage } from "../storage";
import { AlertDeduplication } from "./alert-deduplication";
import { sendTelegramAlert, type TelegramConfig } from "./telegram";

interface AlertData {
  type: string;
  sport: string;
  gameId: string;
  score: number;
  payload: any;
  alertKey: string;
  state: string;
}

export class AlertGenerator {
  private mlbApi: MLBApiService;
  private ncaafApi: NCAAFApiService;
  private deduplication: AlertDeduplication;

  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
    this.deduplication = new AlertDeduplication();
  }

  // Check if a specific alert type is globally enabled
  private async isAlertGloballyEnabled(sport: string, alertType: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking global settings for ${sport}.${alertType}`);
      const globalSettings: Record<string, boolean> = await storage.getGlobalAlertSettings(sport);
      const isEnabled = globalSettings[alertType] !== false;
      console.log(`🔍 Global ${sport}.${alertType} setting: ${isEnabled} (raw: ${globalSettings[alertType]})`);
      return isEnabled;
    } catch (error) {
      console.error(`Error checking global settings for ${sport}.${alertType}:`, error);
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
          message: `Close game! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} - Decided by ${scoreDiff} run${scoreDiff !== 1 ? 's' : ''}`,
          situation: `${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam} (${scoreDiff} run game)`
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
          message: `High-scoring game! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} - ${totalRuns} total runs`,
          situation: `${game.awayTeam} ${game.awayScore}-${game.homeScore} ${game.homeTeam} (${totalRuns} runs)`
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
    
    // Fetch detailed live feed data for granular alerts
    try {
      const liveData = await this.fetchDetailedLiveData(game.gameId);
      if (!liveData) return 0;

      // Generate alerts based on detailed game state
      alertCount += await this.generateBaseRunnerAlerts(game, liveData);
      alertCount += await this.generateInningPressureAlerts(game, liveData);
      alertCount += await this.generateAtBatAlerts(game, liveData);
      alertCount += await this.generateScoringAlerts(game, liveData);

    } catch (error) {
      console.error(`Error fetching live data for game ${game.gameId}:`, error);
      // Fallback to basic alerts
      alertCount += await this.generateBasicLiveAlerts(game);
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

  // Calculate empirical scoring probability based on MLB statistics
  private calculateScoringProbability(hasFirst: boolean, hasSecond: boolean, hasThird: boolean, outs: number): number {
    // Based on decades of MLB statistical analysis - real historical data
    if (hasFirst && hasSecond && hasThird) {
      if (outs === 0) return 85;  // Bases loaded, no outs: 85% scoring chance
      if (outs === 1) return 70;  // Bases loaded, one out: 70% scoring chance
      if (outs === 2) return 35;  // Bases loaded, two outs: 35% scoring chance
    }
    
    if (hasSecond && hasThird && !hasFirst) {
      if (outs === 0) return 87;  // Runners 2nd & 3rd, no outs: 87% scoring chance
      if (outs === 1) return 65;  // Runners 2nd & 3rd, one out: 65% scoring chance
      if (outs === 2) return 30;  // Runners 2nd & 3rd, two outs: 30% scoring chance
    }
    
    if (hasThird && !hasFirst && !hasSecond) {
      if (outs === 0) return 75;  // Runner 3rd only, no outs: 75% scoring chance
      if (outs === 1) return 55;  // Runner 3rd only, one out: 55% scoring chance
      if (outs === 2) return 25;  // Runner 3rd only, two outs: 25% scoring chance
    }
    
    if (hasFirst && hasThird && !hasSecond) {
      if (outs === 0) return 70;  // Runners 1st & 3rd, no outs: 70% scoring chance
      if (outs === 1) return 55;  // Runners 1st & 3rd, one out: 55% scoring chance
      if (outs === 2) return 27;  // Runners 1st & 3rd, two outs: 27% scoring chance
    }
    
    if (hasFirst && hasSecond && !hasThird) {
      if (outs === 0) return 60;  // Runners 1st & 2nd, no outs: 60% scoring chance
      if (outs === 1) return 45;  // Runners 1st & 2nd, one out: 45% scoring chance
      if (outs === 2) return 22;  // Runners 1st & 2nd, two outs: 22% scoring chance
    }
    
    if (hasSecond && !hasFirst && !hasThird) {
      if (outs === 0) return 60;  // Runner 2nd only, no outs: 60% scoring chance
      if (outs === 1) return 40;  // Runner 2nd only, one out: 40% scoring chance
      if (outs === 2) return 20;  // Runner 2nd only, two outs: 20% scoring chance
    }
    
    return 0;
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
    const scoringProbability = this.calculateScoringProbability(hasFirst, hasSecond, hasThird, outs);
    
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
      
      const message = `🔥 LATE INNING PRESSURE! ${game.homeTeam} ${game.homeScore}, ${game.awayTeam} ${game.awayScore} - ${situation} ${inning}th. ${weather.temperature}°F, ${windDesc}`;
      
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
          
          if (!this.deduplication.shouldSendAlert(dedupKey, 'plate-appearance')) {
            console.log(`🚫 STRIKEOUT alert blocked - deduplication filter`);
            continue; // Skip this duplicate alert
          }
          
          const alertKey = `${game.gameId}_STRIKEOUT_${play.about?.atBatIndex}`;
          const batter = play.matchup?.batter?.fullName || 'Unknown Batter';
          const pitcher = play.matchup?.pitcher?.fullName || 'Unknown Pitcher';
          const message = `⚡ STRIKEOUT! ${batter} struck out by ${pitcher} - ${game.awayTeam} vs ${game.homeTeam}`;
          
          alertCount += await this.saveRealTimeAlert(alertKey, 'STRIKEOUT', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            batter: batter,
            pitcher: pitcher,
            inning: play.about?.inning,
            outs: play.about?.outs || play.about?.o || liveData?.plays?.currentPlay?.count?.outs || 0,
            balls,
            strikes,
            situation: 'strikeout'
          }, 75);
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
          const runsScored = runners.filter(r => r.details?.isScoringEvent).length;
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

    // Fallback to basic close game alert
    if (scoreDiff <= 3 && (game.homeScore > 0 || game.awayScore > 0)) {
      const alertKey = `${game.gameId}_LIVE_CLOSE`;
      const message = `🔥 LIVE: Close game! ${game.homeTeam} ${game.homeScore}, ${game.awayTeam} ${game.awayScore}`;
      
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
      const message = `⏰ TWO MINUTE WARNING! ${game.awayTeam} ${game.awayScore}, ${game.homeTeam} ${game.homeScore} - ${timeRemaining} left in ${quarter}${this.getOrdinalSuffix(quarter)} quarter`;
      
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
    if (!timeRemaining || timeRemaining === '0:00') return false;
    
    // Handle different time formats from ESPN
    let totalSeconds = 0;
    
    // Format: "1:45", "0:30", "12:30"
    if (timeRemaining.includes(':')) {
      const timeParts = timeRemaining.split(':');
      if (timeParts.length === 2) {
        const minutes = parseInt(timeParts[0]) || 0;
        const seconds = parseInt(timeParts[1]) || 0;
        totalSeconds = (minutes * 60) + seconds;
      }
    }
    // Format: "1:45 - 4th", "0:30 4th" (with quarter info)
    else if (timeRemaining.includes(' ')) {
      const timeOnly = timeRemaining.split(' ')[0];
      if (timeOnly.includes(':')) {
        const timeParts = timeOnly.split(':');
        if (timeParts.length === 2) {
          const minutes = parseInt(timeParts[0]) || 0;
          const seconds = parseInt(timeParts[1]) || 0;
          totalSeconds = (minutes * 60) + seconds;
        }
      }
    }
    
    console.log(`🏈 Time parsing: "${timeRemaining}" → ${totalSeconds} seconds`);
    
    // Check if we're within 2 minutes (120 seconds)
    return totalSeconds <= 120 && totalSeconds > 0;
  }

  private getOrdinalSuffix(num: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const remainder = num % 100;
    return suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0];
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

      // Insert new alert
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertKey}, ${sport}, ${gameId}, 
                ${type}, 'NEW', ${priority}, ${JSON.stringify({ message, context })}, NOW())
      `);
      
      console.log(`🚨 REAL-TIME ALERT: ${message}`);

      // Send to Telegram for users monitoring this game
      try {
        // Get all monitored games and filter by this gameId
        const allMonitoredGames = await storage.getAllMonitoredGames();
        const usersMonitoringGame = allMonitoredGames.filter(mg => mg.gameId === gameId);
        
        for (const monitoredGame of usersMonitoringGame) {
          // Get user details including Telegram settings
          const user = await storage.getUserById(monitoredGame.userId);
          if (user && user.telegramEnabled && user.telegramBotToken && user.telegramChatId) {
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

            const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
            if (sent) {
              console.log(`📱 Telegram alert sent to user ${user.username}`);
            }
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
}