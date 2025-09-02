import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";
import crypto from 'crypto';
// Assume 'storage' is imported and available for saving alerts
// import * as storage from './storage'; 

// Dummy storage object for demonstration purposes if not provided
const storage = {
  saveAlert: async (alert: any) => {
    console.log('Saving alert:', alert);
    // In a real scenario, this would interact with a database or storage service
  }
};

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
  private processedAlerts: Set<string>; // For deduplication of real-time alerts

  constructor() {
    this.mlbApi = new MLBApiService();
    this.processedAlerts = new Set<string>();
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
      const games = await this.mlbApi.getTodaysGames(); // Assuming this also fetches NCAAF games if supported by API
      const liveGames = games.filter(game => game.isLive);

      if (liveGames.length === 0) {
        console.log('🔍 No live games to monitor for alerts');
        return;
      }

      console.log(`🔍 Monitoring ${liveGames.length} live games for alerts`);

      let newAlerts = 0;
      for (const game of liveGames) {
        // Call the updated generateAlertsForGame method
        const count = await this.generateAlertsForGame(game);
        newAlerts += count;
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

  // Updated to handle different sports
  async generateAlertsForGame(game: any): Promise<number> {
    try {
      if (game.sport === 'MLB') {
        return await this.generateMLBAlerts(game);
      } else if (game.sport === 'NCAAF') {
        return await this.generateNCAAFAlerts(game);
      }
      // Add other sports as needed
      return 0;
    } catch (error) {
      console.error(`❌ Error generating alerts for game ${game.gameId}:`, error);
      return 0;
    }
  }

  // Placeholder for MLB specific alerts
  private async generateMLBAlerts(game: any): Promise<number> {
    // This method would contain the logic previously in generateLiveAlertsForGame
    // For now, we'll call the individual alert generation methods directly
    try {
      const liveData = await this.fetchDetailedLiveData(game.gameId);
      if (!liveData) return 0;

      // Debug log current play data
      const currentPlay = liveData?.plays?.currentPlay;
      if (currentPlay) {
        const count = currentPlay.count;
        console.log(`🔍 At-bat check for ${game.awayTeam} @ ${game.homeTeam}:`, {
          balls: count?.balls || 0,
          strikes: count?.strikes || 0,
          batter: currentPlay.matchup?.batter?.fullName || 'Unknown',
          atBatIndex: currentPlay.about?.atBatIndex || 0
        });
      } else {
        console.log(`⚠️ No current play data for ${game.awayTeam} @ ${game.homeTeam}`);
      }

      let alertCount = 0;
      alertCount += await this.generateBaseRunnerAlerts(game, liveData);
      alertCount += await this.generateInningPressureAlerts(game, liveData);
      alertCount += await this.generateAtBatAlerts(game, liveData);
      alertCount += await this.generateScoringAlerts(game, liveData);
      alertCount += await this.generatePowerBatterOnDeck(game, liveData);
      alertCount += await this.generateClutchBatterOnDeck(game, liveData);
      return alertCount;
    } catch (error) {
      console.error(`Error generating MLB live data alerts for game ${game.gameId}:`, error);
      // Fallback to basic alerts
      return await this.generateBasicLiveAlerts(game);
    }
  }

  private async fetchDetailedLiveData(gameId: string): Promise<any> {
    try {
      // This endpoint might need adjustment for NCAAF if different
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

    const offense = liveData?.linescore?.offense;
    if (!offense) return 0;

    const hasFirst = !!offense.first;
    const hasSecond = !!offense.second;
    const hasThird = !!offense.third;

    const inning = liveData.linescore?.currentInning || 0;
    const outs = liveData.linescore?.outs || 0;

    const currentPlay = liveData?.plays?.currentPlay;
    const count = currentPlay?.count;
    const balls = count?.balls || 0;
    const strikes = count?.strikes || 0;

    if (hasFirst && hasSecond && hasThird) {
      const alertKey = `${game.gameId}_BASES_LOADED_${inning}_${outs}`;
      const message = `🔥 BASES LOADED! ${game.awayTeam} vs ${game.homeTeam} - ${outs} outs, Inning ${inning}`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'BASES_LOADED', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        inning,
        outs,
        balls,
        strikes,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        third: offense.third?.fullName,
        situation: 'bases_loaded'
      }, 98);
    }
    else if (hasFirst && hasSecond && !hasThird) {
      const alertKey = `${game.gameId}_RUNNERS_1ST_2ND_${inning}_${outs}`;
      const message = `💎 RUNNERS ON 1ST & 2ND! ${game.awayTeam} vs ${game.homeTeam} - Prime scoring position, ${outs} outs`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'RUNNERS_1ST_2ND', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        inning,
        outs,
        balls,
        strikes,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        hasFirst,
        hasSecond,
        situation: 'runners_on_1st_and_2nd'
      }, 88);
    }
    else if ((hasSecond || hasThird) && !(hasFirst && hasSecond && hasThird) && !(hasFirst && hasSecond && !hasThird)) {
      const alertKey = `${game.gameId}_RISP_${inning}_${outs}`;
      const positions = [];
      if (hasSecond) positions.push('2nd');
      if (hasThird) positions.push('3rd');
      const message = `⚾ RUNNER IN SCORING POSITION! ${game.awayTeam} vs ${game.homeTeam} - ${positions.join(' & ')} base, ${outs} outs`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'RISP', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        inning,
        outs,
        balls,
        strikes,
        hasSecond,
        hasThird,
        situation: 'runner_in_scoring_position'
      }, 85);
    }

    return alertCount;
  }

  private async generateInningPressureAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const inning = liveData.linescore?.currentInning || 0;
    const isTopInning = liveData.linescore?.isTopInning;
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);

    if (inning >= 8 && scoreDiff <= 2) {
      const alertKey = `${game.gameId}_LATE_PRESSURE_${inning}`;
      const situation = isTopInning ? 'top' : 'bottom';
      const message = `🔥 LATE INNING PRESSURE! ${game.homeTeam} ${game.homeScore}, ${game.awayTeam} ${game.awayScore} - ${situation} ${inning}th`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'LATE_PRESSURE', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        inning,
        isTopInning,
        scoreDiff
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
    
    const inning = liveData.linescore?.currentInning || 0;
    const outs = liveData.linescore?.outs || 0;
    const atBatIndex = currentPlay.about?.atBatIndex || 0;
    const batter = currentPlay.matchup?.batter;

    // Full Count Alert (3-2)
    if (balls === 3 && strikes === 2) {
      const alertKey = `${game.gameId}_FULL_COUNT_${inning}_${atBatIndex}_${batter?.id || 'unknown'}`;
      const message = `⚾ FULL COUNT! ${game.awayTeam} vs ${game.homeTeam} - 3-2 count, pressure on!`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'FULL_COUNT', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        balls,
        strikes,
        outs,
        inning,
        batter: batter?.fullName || 'Unknown',
        batterID: batter?.id,
        atBatIndex,
        situation: 'full_count'
      }, 80);
    }

    // Two Strike Count Alert (any count with 2 strikes)
    if (strikes === 2 && balls < 3) {
      const alertKey = `${game.gameId}_TWO_STRIKES_${inning}_${atBatIndex}_${balls}${strikes}`;
      const message = `🔥 TWO STRIKES! ${game.awayTeam} vs ${game.homeTeam} - ${balls}-2 count, batter in trouble!`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'TWO_STRIKES', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        balls,
        strikes,
        outs,
        inning,
        batter: batter?.fullName || 'Unknown',
        batterID: batter?.id,
        atBatIndex,
        situation: 'two_strikes'
      }, 75);
    }

    // Three Ball Count Alert (any count with 3 balls)
    if (balls === 3 && strikes < 2) {
      const alertKey = `${game.gameId}_THREE_BALLS_${inning}_${atBatIndex}_${balls}${strikes}`;
      const message = `🎯 THREE BALLS! ${game.awayTeam} vs ${game.homeTeam} - 3-${strikes} count, walk threat!`;

      alertCount += await this.saveRealTimeAlert(alertKey, 'THREE_BALLS', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        balls,
        strikes,
        outs,
        inning,
        batter: batter?.fullName || 'Unknown',
        batterID: batter?.id,
        atBatIndex,
        situation: 'three_balls'
      }, 70);
    }

    return alertCount;
  }

  private async generateScoringAlerts(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const allPlays = liveData?.plays?.allPlays || [];

    if (allPlays.length > 0) {
      const lastPlay = allPlays[allPlays.length - 1];
      const playEvents = lastPlay.playEvents || [];

      for (const event of playEvents) {
        if (event.details?.event === 'Home Run') {
          const alertKey = `${game.gameId}_HOME_RUN_${lastPlay.about?.atBatIndex}`;
          const message = `🏠 HOME RUN! ${game.awayTeam} vs ${game.homeTeam} - Just happened!`;

          alertCount += await this.saveRealTimeAlert(alertKey, 'HOME_RUN_LIVE', game.gameId, message, {
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            batter: lastPlay.matchup?.batter?.fullName,
            inning: lastPlay.about?.inning
          }, 100);
        }
      }
    }

    return alertCount;
  }

  private async generateBasicLiveAlerts(game: any): Promise<number> {
    let alertCount = 0;
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);

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

  private async generatePowerBatterOnDeck(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const offense = liveData?.linescore?.offense ?? {};
    const hasRunner = Boolean(offense.first || offense.second || offense.third);
    if (!hasRunner) return 0;

    const matchup = liveData?.plays?.currentPlay?.matchup;
    const onDeck = matchup?.onDeck;
    if (!onDeck) return 0;

    const stats = onDeck?.stats?.batting;
    if (stats?.ops && stats.ops >= 0.8 || stats?.homeRuns >= 20) {
      const inning = liveData?.linescore?.currentInning ?? 0;
      const tb = liveData?.linescore?.isTopInning ? 'T' : 'B';

      const alertKey = `${game.gameId}_POWER_BATTER_ON_DECK_${inning}_${tb}`;

      const score = 85;
      const message = `💥 POWER BATTER ON DECK: ${onDeck.fullName} with runners on for ${game.awayTeam} @ ${game.homeTeam}`;
      alertCount += await this.saveRealTimeAlert(alertKey, 'POWER_BATTER_ON_DECK', game.gameId, message, { 
        inning, 
        tb, 
        batter: onDeck.fullName,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        situation: 'power_batter_on_deck'
      }, score);
    }

    return alertCount;
  }

  private async generateClutchBatterOnDeck(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const inning = liveData?.linescore?.currentInning ?? 0;
    if (inning < 7) return 0;

    const scoreDiff = Math.abs(game.homeScore - game.awayScore);
    if (scoreDiff > 2) return 0;

    const offense = liveData?.linescore?.offense ?? {};
    const isRISP = Boolean(offense.second || offense.third);
    if (!isRISP) return 0;

    const matchup = liveData?.plays?.currentPlay?.matchup;
    const onDeck = matchup?.onDeck;
    if (!onDeck) return 0;

    const stats = onDeck?.stats?.batting;
    if (stats?.rbi && stats.rbi >= 60) {
      const tb = liveData?.linescore?.isTopInning ? 'T' : 'B';
      const alertKey = `${game.gameId}_CLUTCH_BATTER_ON_DECK_${inning}_${tb}`;

      const score = 90;
      const message = `🔥 CLUTCH BATTER ON DECK: ${onDeck.fullName} (RBI leader) — ${game.awayTeam} @ ${game.homeTeam}`;
      alertCount += await this.saveRealTimeAlert(alertKey, 'CLUTCH_BATTER_ON_DECK', game.gameId, message, { 
        inning, 
        tb, 
        batter: onDeck.fullName,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        situation: 'clutch_batter_on_deck'
      }, score);
    }

    return alertCount;
  }

  // Modified to accept sport and use it in the alert
  private async saveRealTimeAlert(alertKey: string, type: string, gameId: string, message: string, metadata: any, confidence: number, sport: string = 'MLB'): Promise<number> {
    if (this.processedAlerts.has(alertKey)) {
      return 0;
    }

    this.processedAlerts.add(alertKey);

    const alert = {
      id: crypto.randomUUID(),
      type,
      sport,
      gameId,
      message,
      metadata,
      confidence,
      createdAt: new Date()
    };

    await storage.saveAlert(alert);
    console.log(`🚨 REAL-TIME ALERT: ${message}`);
    return 1;
  }

  // New method for NCAAF specific alerts
  private async generateNCAAFAlerts(game: any): Promise<number> {
    // User setting toggle would be checked here, e.g., if (userSettings.ncaafTwoMinuteWarningEnabled)
    if (!game.isLive) return 0;

    let totalAlerts = 0;

    try {
      // Two minute warning - triggers in final 2 minutes of each quarter/half
      totalAlerts += await this.generateTwoMinuteWarning(game);

      // Close game alerts for NCAAF
      totalAlerts += await this.generateNCAAFCloseGame(game);

    } catch (error) {
      console.error(`❌ Error in NCAAF alert generation for game ${game.gameId}:`, error);
    }

    return totalAlerts;
  }

  // NCAAF Two Minute Warning Alert
  private async generateTwoMinuteWarning(game: any): Promise<number> {
    // Assuming game object has properties like timeRemaining, quarter, homeScore, awayScore
    const timeRemaining = game.timeRemaining || ''; // e.g., "1:45"
    const quarter = game.quarter || 0; // e.g., 1, 2, 3, 4, or OT periods

    // Parse time remaining (format might be "1:45" or "01:45")
    const timeMatch = timeRemaining.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return 0;

    const minutes = parseInt(timeMatch[1]);
    const seconds = parseInt(timeMatch[2]);
    const totalSeconds = minutes * 60 + seconds;

    // Trigger for final 2 minutes (120 seconds) of any quarter/half
    // Using a small window (e.g., 110-120 seconds) to avoid multiple alerts for the same period
    if (totalSeconds <= 120 && totalSeconds > 110) {
      const isHalf = quarter === 2 || quarter === 4; // Assuming quarters 1-4, 2 is end of 1st half, 4 is end of 2nd half
      const periodType = isHalf ? 'half' : 'quarter';

      // Construct a unique alert key
      const alertKey = `${game.gameId}_TWO_MINUTE_WARNING_Q${quarter}_${Math.floor(totalSeconds / 10)}`;
      const message = `⏰ TWO MINUTE WARNING! End of ${quarter}${this.getOrdinalSuffix(quarter)} ${periodType} - ${timeRemaining} remaining`;

      return await this.saveRealTimeAlert(alertKey, 'TWO_MINUTE_WARNING', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        timeRemaining,
        totalSeconds,
        periodType,
        isHalf
      }, 88, 'NCAAF');
    }

    return 0;
  }

  // NCAAF Close Game Alert
  private async generateNCAAFCloseGame(game: any): Promise<number> {
    const scoreDiff = Math.abs(game.homeScore - game.awayScore);
    const quarter = game.quarter || 0;

    // Trigger for close games in the 4th quarter or overtime
    // Threshold can be adjusted (e.g., <= 7 for NCAAF football)
    if (quarter >= 4 && scoreDiff <= 7 && (game.homeScore > 0 || game.awayScore > 0)) {
      const alertKey = `${game.gameId}_NCAAF_CLOSE_Q${quarter}`;
      const overtimeText = quarter > 4 ? ' (OT)' : ''; // Assuming quarters > 4 indicate overtime
      const message = `🔥 CLOSE GAME! ${game.homeTeam} ${game.homeScore}, ${game.awayTeam} ${game.awayScore}${overtimeText}`;

      return await this.saveRealTimeAlert(alertKey, 'CLOSE_GAME', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        quarter,
        scoreDiff,
        isOvertime: quarter > 4
      }, 85, 'NCAAF');
    }

    return 0;
  }

  // Helper to get ordinal suffix (e.g., 1st, 2nd, 3rd)
  private getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return num + 'st';
    if (j === 2 && k !== 12) return num + 'nd';
    if (j === 3 && k !== 13) return num + 'rd';
    return num + 'th';
  }
}