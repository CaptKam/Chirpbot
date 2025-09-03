import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import { NCAAFApiService } from "./ncaaf-api";
import { weatherService } from "./weather-service";
import { storage } from "../storage";

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

  constructor() {
    this.mlbApi = new MLBApiService();
    this.ncaafApi = new NCAAFApiService();
  }

  // Check if alert type is enabled globally AND has enabled users
  private async isAlertTypeEnabled(sport: string, alertType: string): Promise<boolean> {
    try {
      // First check if the alert type is globally enabled by admin
      const globalSettings = await storage.getGlobalAlertSettings(sport);
      const isGloballyEnabled = globalSettings[alertType] === true; // Explicit check - must be true
      
      if (!isGloballyEnabled) {
        console.log(`Alert '${alertType}' for ${sport} disabled by admin`);
        return false; // If admin disabled it globally, don't generate alerts
      }
      
      // Then check if any user has this alert type enabled
      const enabledPreferences = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM user_alert_preferences 
        WHERE sport = ${sport} 
        AND alert_type = ${alertType} 
        AND enabled = true
      `);
      
      const count = enabledPreferences[0]?.count || 0;
      return count > 0;
    } catch (error) {
      console.error(`Error checking if alert type ${alertType} is enabled:`, error);
      // Default to false to prevent unwanted alerts if there's an error
      return false;
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
    
    // Extract current count (balls/strikes) from current play
    const currentPlay = liveData?.plays?.currentPlay;
    const count = currentPlay?.count || {};
    const balls = count.balls || 0;
    const strikes = count.strikes || 0;

    // Bases loaded: all three bases occupied
    if (hasFirst && hasSecond && hasThird) {
      // Check if any user has bases loaded alerts enabled before generating
      const basesLoadedEnabled = await this.isAlertTypeEnabled('MLB', 'BASES_LOADED');
      if (basesLoadedEnabled) {
        const alertKey = `${game.gameId}_BASES_LOADED_${inning}_${outs}`;
        const message = `🔥 BASES LOADED! ${game.awayTeam} vs ${game.homeTeam} - ${outs} outs, Inning ${inning}`;
        
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
          situation: 'bases_loaded'
        }, 98);
      }
    }
    // Runners on 1st and 2nd (prime scoring opportunity)
    else if (hasFirst && hasSecond && !hasThird) {
      // Check if any user has runners 1st & 2nd alerts enabled before generating
      const runners1st2ndEnabled = await this.isAlertTypeEnabled('MLB', 'RUNNERS_1ST_2ND');
      if (runners1st2ndEnabled) {
        const alertKey = `${game.gameId}_RUNNERS_1ST_2ND_${inning}_${outs}`;
        const message = `💎 RUNNERS ON 1ST & 2ND! ${game.awayTeam} vs ${game.homeTeam} - Prime scoring position, ${outs} outs`;
        
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
          situation: 'runners_on_1st_and_2nd'
        }, 88);
      }
    }
    // Runner in scoring position (2nd or 3rd base, but not bases loaded or 1st+2nd)
    else if ((hasSecond || hasThird) && !(hasFirst && hasSecond && hasThird) && !(hasFirst && hasSecond && !hasThird)) {
      const alertKey = `${game.gameId}_RISP_${inning}_${outs}`;
      const positions = [];
      if (hasSecond) positions.push('2nd');
      if (hasThird) positions.push('3rd');
      // Get weather data for enhanced context
      const weather = await weatherService.getWeatherForTeam(game.homeTeam);
      const homeRunFactor = weatherService.calculateHomeRunFactor(weather);
      const windDesc = weatherService.getWindDescription(weather.windSpeed, weather.windDirection);
      
      const message = `⚾ RUNNER IN SCORING POSITION! ${game.awayTeam} vs ${game.homeTeam} - ${positions.join(' & ')} base, ${outs} outs. ${weather.temperature}°F, ${windDesc}`;
      
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

    const count = currentPlay.count;
    const balls = count?.balls || 0;
    const strikes = count?.strikes || 0;

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
          // Check if any user has strikeout alerts enabled before generating
          const strikeoutEnabled = await this.isAlertTypeEnabled('MLB', 'STRIKEOUT');
          if (strikeoutEnabled) {
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
    }

    // Full count situation (3-2)
    if (balls === 3 && strikes === 2) {
      // Check if any user has full count alerts enabled before generating
      const fullCountEnabled = await this.isAlertTypeEnabled('MLB', 'FULL_COUNT');
      if (fullCountEnabled) {
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
          const alertKey = `${game.gameId}_HOME_RUN_${lastPlay.about?.atBatIndex}`;
          const message = `🏠 HOME RUN! ${game.awayTeam} vs ${game.homeTeam} - Just happened!`;
          
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
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertKey}, ${sport}, ${gameId}, 
                ${type}, 'NEW', ${priority}, ${JSON.stringify({ message, context })}, NOW())
        ON CONFLICT (alert_key) DO NOTHING
      `);
      
      console.log(`🚨 REAL-TIME ALERT: ${message}`);
      return 1;
    } catch (error) {
      // Ignore conflicts (already exists)
      return 0;
    }
  }
}