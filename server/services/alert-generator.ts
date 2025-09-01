import { db } from "../db";
import { sql } from "drizzle-orm";
import { MLBApiService } from "./mlb-api";

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

  constructor() {
    this.mlbApi = new MLBApiService();
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
      const games = await this.mlbApi.getTodaysGames();
      const liveGames = games.filter(game => game.isLive);
      
      if (liveGames.length === 0) {
        console.log('🔍 No live games to monitor for alerts');
        return;
      }

      console.log(`🔍 Monitoring ${liveGames.length} live games for alerts`);
      
      let newAlerts = 0;
      for (const game of liveGames) {
        const count = await this.generateLiveAlertsForGame(game);
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
      alertCount += await this.generatePowerBatterOnDeck(game, liveData);
      alertCount += await this.generateClutchBatterOnDeck(game, liveData);

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

    // Bases loaded: all three bases occupied
    if (hasFirst && hasSecond && hasThird) {
      const alertKey = `${game.gameId}_BASES_LOADED_${inning}_${outs}`;
      const message = `🔥 BASES LOADED! ${game.awayTeam} vs ${game.homeTeam} - ${outs} outs, Inning ${inning}`;
      
      alertCount += await this.saveRealTimeAlert(alertKey, 'BASES_LOADED', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        inning,
        outs,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        third: offense.third?.fullName,
        situation: 'bases_loaded'
      }, 98);
    }
    // Runners on 1st and 2nd (prime scoring opportunity)
    else if (hasFirst && hasSecond && !hasThird) {
      const alertKey = `${game.gameId}_RUNNERS_1ST_2ND_${inning}_${outs}`;
      const message = `💎 RUNNERS ON 1ST & 2ND! ${game.awayTeam} vs ${game.homeTeam} - Prime scoring position, ${outs} outs`;
      
      alertCount += await this.saveRealTimeAlert(alertKey, 'RUNNERS_1ST_2ND', game.gameId, message, {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        inning,
        outs,
        first: offense.first?.fullName,
        second: offense.second?.fullName,
        hasFirst,
        hasSecond,
        situation: 'runners_on_1st_and_2nd'
      }, 88);
    }
    // Runner in scoring position (2nd or 3rd base, but not bases loaded or 1st+2nd)
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

    // Late inning pressure situations
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

  private async generatePowerBatterOnDeck(game: any, liveData: any): Promise<number> {
    let alertCount = 0;
    const offense = liveData?.linescore?.offense ?? {};
    const hasRunner = Boolean(offense.first || offense.second || offense.third);
    if (!hasRunner) return 0;

    const matchup = liveData?.plays?.currentPlay?.matchup;
    const onDeck = matchup?.onDeck; // MLB feed has onDeck info
    if (!onDeck) return 0;

    // Simplified check: OPS ≥ .800 or HR ≥ 20 (you can tune)
    const stats = onDeck?.stats?.batting;
    if (stats?.ops && stats.ops >= 0.8 || stats?.homeRuns >= 20) {
      const inning = liveData?.linescore?.currentInning ?? 0;
      const tb = liveData?.linescore?.isTopInning ? 'T' : 'B';

      const alertKey = `${game.gameId}_POWER_BATTER_ON_DECK_${inning}_${tb}`;
      
      const score = 85; // baseline
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
    if (stats?.rbi && stats.rbi >= 60) { // or use clutch% if available
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

  private async saveRealTimeAlert(alertKey: string, type: string, gameId: string, message: string, context: any, priority: number): Promise<number> {
    try {
      await db.execute(sql`
        INSERT INTO alerts (id, alert_key, sport, game_id, type, state, score, payload, created_at)
        VALUES (gen_random_uuid(), ${alertKey}, 'MLB', ${gameId}, 
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