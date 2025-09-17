import { getPacificDate } from '../utils/timezone';
import { mlbApiCircuit, protectedFetch } from '../middleware/circuit-breaker';
import { BaseSportApi, type BaseGameData } from './base-sport-api';

export class MLBApiService extends BaseSportApi {
  constructor() {
    super({
      baseUrl: 'https://statsapi.mlb.com/api/v1',
      circuit: mlbApiCircuit,
      sportTag: 'MLB',
      rateLimits: {
        live: 200,        // 200ms for live games (high priority)
        scheduled: 5000,  // 5s for scheduled games
        final: 30000,     // 30s for final games
        delayed: 2000,    // 2s for delayed games
        default: 250      // Default fallback
      },
      cacheTtl: {
        live: 500,         // 500ms for live game data
        scheduled: 15000,  // 15s for scheduled games
        final: 120000,     // 2min for final games
        delayed: 5000,     // 5s for delayed games
        batch: 8000,       // 8s for batch requests
        default: 1000      // Default fallback
      }
    });
  }

  // Abstract method implementations for BaseSportApi
  protected buildTodaysGamesUrl(targetDate: string): string {
    return `${this.config.baseUrl}/schedule?sportId=1&date=${targetDate}&hydrate=team,linescore,venue,game(content(summary))`;
  }

  protected parseGamesResponse(data: any): BaseGameData[] {
    if (!data.dates || data.dates.length === 0) {
      return [];
    }

    const games = data.dates[0].games || [];
    return games.map((game: any) => {
      // Extract live scores from linescore data for live games, fallback to team score for others
      const homeScore = game.linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0;
      const awayScore = game.linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0;
      
      // Use standardized live detection logic from BaseSportApi
      const isLive = this.isGameLive(game, 'mlb');
      
      // Use ONLY the mapped status from official API state - DO NOT override with isLive
      const finalStatus = this.mapGameStatus(game.status.detailedState);
      
      const gameId = game.gamePk.toString();
      
      return {
        id: gameId,
        gameId: gameId, // Ensure gameId is explicitly set
        sport: 'MLB',
        homeTeam: { id: game.teams.home.team.id.toString(), name: game.teams.home.team.name, abbreviation: game.teams.home.team.abbreviation, score: homeScore },
        awayTeam: { id: game.teams.away.team.id.toString(), name: game.teams.away.team.name, abbreviation: game.teams.away.team.abbreviation, score: awayScore },
        status: finalStatus,
        startTime: game.gameDate,
        venue: game.venue.name,
        isLive: isLive,
        // MLB-specific fields
        inning: game.linescore?.currentInning || null,
        inningState: game.linescore?.inningState || null
      };
    });
  }

  protected buildEnhancedGameUrl(gameId: string): string {
    return `https://statsapi.mlb.com/api/v1.1/game/${gameId}/feed/live`;
  }

  protected parseEnhancedGameResponse(data: any, gameId: string): any {
    const liveData = data.liveData || {};
    const gameData = data.gameData || {};
    const linescore = liveData.linescore || {};
    const currentPlay = liveData.plays?.currentPlay;

    // Extract base runner information from current play or linescore
    const runners = { first: false, second: false, third: false };

    // First try current play runners
    if (currentPlay?.runners) {
      currentPlay.runners.forEach((runner: any) => {
        if (runner.movement?.end === '1B') runners.first = true;
        if (runner.movement?.end === '2B') runners.second = true;
        if (runner.movement?.end === '3B') runners.third = true;
      });
    }

    // Also check offense data for runners
    const offense = linescore.offense;
    if (offense) {
      if (offense.first) runners.first = true;
      if (offense.second) runners.second = true;
      if (offense.third) runners.third = true;
    }

    // Get count and outs
    const count = currentPlay?.count || {};
    const balls = count.balls || 0;
    const strikes = count.strikes || 0;
    const outs = linescore.outs || 0;

    // Get inning information
    const inning = linescore.currentInning || 1;
    const isTopInning = linescore.inningState === 'Top';

    // Extract live scores from the feed/live endpoint
    const homeScore = linescore?.teams?.home?.runs ?? 0;
    const awayScore = linescore?.teams?.away?.runs ?? 0;

    // Extract lineup and batter information for predictive analysis
    const lineupData = this.extractLineupData(liveData, gameData, isTopInning);
    
    // Enhanced player data extraction with multiple fallback strategies
    const playerData = this.extractPlayerData(liveData, gameData, isTopInning);
    const currentBatter = playerData.currentBatter;
    const currentBatterId = playerData.currentBatterId;
    const currentPitcher = playerData.currentPitcher;
    const currentPitcherId = playerData.currentPitcherId;
    const onDeckBatter = playerData.onDeckBatter;
    
    // Extract play-by-play data
    const lastPlay = this.extractLastPlay(liveData);
    const lastPitch = this.extractLastPitch(liveData);
    const pitchCount = (currentPlay?.playEvents || []).filter(e => e?.isPitch || e?.details?.isPitch).length;

    console.log(`🔍 Live data for game ${gameId}:`, {
      runners, balls, strikes, outs, inning, isTopInning, homeScore, awayScore, currentBatter, currentPitcher
    });

    return {
      runners,
      balls,
      strikes,
      outs,
      inning,
      isTopInning,
      homeScore,
      awayScore,
      gameState: liveData.gameState,
      lineupData,
      currentBatter,
      currentBatterId,
      currentPitcher,
      currentPitcherId,
      onDeckBatter,
      lastPlay,
      lastPitch,
      pitchCount,
      lastUpdated: new Date().toISOString()
    };
  }

  // Use inherited getTodaysGames method from BaseSportApi

  async getLiveFeed(gameId: string): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/game/${gameId}/feed/live`;
      const response = await protectedFetch(mlbApiCircuit, url);
      if (!response.ok) {
        throw new Error(`MLB Live Feed API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching live feed:', error);
      return null;
    }
  }

  // Use inherited getEnhancedGameData method from BaseSportApi

  private extractLineupData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      // Extract lineup information for the batting team
      const battingTeam = isTopInning ? 'away' : 'home';
      const probablePitchers = gameData.probablePitchers || {};
      const teams = gameData.teams || {};
      const offense = liveData.linescore?.offense || {};
      
      // Get current batting order position
      const battingOrder = offense.battingOrder || 1;
      
      // In a real implementation, this would extract full lineup data
      // For now, we'll provide deterministic batting order progression
      const lineupPosition = battingOrder;
      const nextBatterPosition = (battingOrder % 9) + 1;
      const onDeckPosition = ((battingOrder + 1) % 9) + 1;
      
      return {
        battingTeam,
        currentBatterOrder: lineupPosition,
        nextBatterOrder: nextBatterPosition,
        onDeckBatterOrder: onDeckPosition,
        // Deterministic lineup strength based on batting order position
        currentBatterStrength: this.getBatterStrengthByPosition(lineupPosition),
        nextBatterStrength: this.getBatterStrengthByPosition(nextBatterPosition),
        onDeckBatterStrength: this.getBatterStrengthByPosition(onDeckPosition)
      };
    } catch (error) {
      console.error('Error extracting lineup data:', error);
      return {
        battingTeam: isTopInning ? 'away' : 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      };
    }
  }

  private getBatterStrengthByPosition(position: number): 'elite' | 'strong' | 'average' | 'weak' {
    // Standard MLB batting order strength patterns (deterministic)
    if (position >= 1 && position <= 2) return 'elite';   // 1-2: Best contact/speed hitters
    if (position >= 3 && position <= 5) return 'strong';  // 3-5: Best power hitters
    if (position >= 6 && position <= 7) return 'average'; // 6-7: Average hitters
    return 'weak'; // 8-9: Weakest hitters (including pitcher in NL)
  }

  private extractPlayerData(liveData: any, gameData: any, isTopInning: boolean): any {
    try {
      const currentPlay = liveData.plays?.currentPlay;
      const offense = liveData.linescore?.offense;
      const boxscore = liveData.boxscore;
      const teams = gameData.teams;
      
      let currentBatter = null;
      let currentBatterId = null;
      let currentPitcher = null;
      let currentPitcherId = null;
      let onDeckBatter = null;
      
      // Strategy 1: Extract from current play data
      if (currentPlay) {
        currentBatter = currentPlay.batter?.fullName || currentPlay.matchup?.batter?.fullName;
        currentBatterId = currentPlay.batter?.id || currentPlay.matchup?.batter?.id;
        currentPitcher = currentPlay.pitcher?.fullName || currentPlay.matchup?.pitcher?.fullName;
        currentPitcherId = currentPlay.pitcher?.id || currentPlay.matchup?.pitcher?.id;
      }
      
      // Strategy 2: Extract from offense data (linescore)
      if (!currentBatter && offense) {
        currentBatter = offense.batter?.fullName;
        currentBatterId = offense.batter?.id;
        currentPitcher = offense.pitcher?.fullName;
        currentPitcherId = offense.pitcher?.id;
        onDeckBatter = offense.onDeck?.fullName;
      }
      
      // Strategy 3: Extract from boxscore lineup data
      if (boxscore && (!currentBatter || !onDeckBatter)) {
        const battingTeam = isTopInning ? 'away' : 'home';
        const teamBox = boxscore.teams?.[battingTeam];
        
        if (teamBox?.batters) {
          const batters = teamBox.batters;
          const battingOrder = offense?.battingOrder || 1;
          
          // Find current batter in lineup
          if (!currentBatter && batters.length > 0) {
            const currentBatterIndex = (battingOrder - 1) % batters.length;
            const batterId = batters[currentBatterIndex];
            const batterInfo = teamBox.players?.[`ID${batterId}`];
            currentBatter = batterInfo?.person?.fullName;
          }
          
          // Find on-deck batter
          if (!onDeckBatter && batters.length > 0) {
            const onDeckIndex = battingOrder % batters.length;
            const onDeckId = batters[onDeckIndex];
            const onDeckInfo = teamBox.players?.[`ID${onDeckId}`];
            onDeckBatter = onDeckInfo?.person?.fullName;
          }
        }
        
        // Extract pitching information
        if (!currentPitcher && teamBox) {
          const pitchingTeam = isTopInning ? 'home' : 'away';
          const pitchingBox = boxscore.teams?.[pitchingTeam];
          if (pitchingBox?.pitchers && pitchingBox.pitchers.length > 0) {
            // Get current pitcher (usually the last one in active pitchers)
            const activePitchers = pitchingBox.pitchers.filter((id: any) => {
              const pitcher = pitchingBox.players?.[`ID${id}`];
              return pitcher?.stats?.pitching?.inningsPitched !== "0.0";
            });
            
            if (activePitchers.length > 0) {
              const currentPitcherId = activePitchers[activePitchers.length - 1];
              const pitcherInfo = pitchingBox.players?.[`ID${currentPitcherId}`];
              currentPitcher = pitcherInfo?.person?.fullName;
            }
          }
        }
      }
      
      // Strategy 4: Generate player names from team rosters if still null
      if (!currentBatter || !currentPitcher || !onDeckBatter) {
        const fallbackData = this.generateFallbackPlayerData(gameData, isTopInning);
        currentBatter = currentBatter || fallbackData.currentBatter;
        currentPitcher = currentPitcher || fallbackData.currentPitcher;
        onDeckBatter = onDeckBatter || fallbackData.onDeckBatter;
      }
      
      return {
        currentBatter,
        currentBatterId: null,
        currentPitcher,
        currentPitcherId: null,
        onDeckBatter
      };
    } catch (error) {
      console.error('Error extracting player data:', error);
      return this.generateFallbackPlayerData(gameData, isTopInning);
    }
  }

  private extractLastPlay(liveData: any): any {
    const cp = liveData?.plays?.currentPlay;
    if (!cp) return null;
    return {
      description: cp.result?.description ?? null,
      event: cp.result?.event ?? null,
      rbi: cp.result?.rbi ?? 0,
      homeScore: cp.result?.homeScore ?? null,
      awayScore: cp.result?.awayScore ?? null
    };
  }

  private extractLastPitch(liveData: any): any {
    const events = liveData?.plays?.currentPlay?.playEvents ?? [];
    const pitch = [...events].reverse().find(e => e?.isPitch || e?.details?.isPitch);
    if (!pitch) return null;
    return {
      pitchType: pitch.details?.type?.description ?? pitch.details?.type?.code ?? null,
      startSpeed: pitch.pitchData?.startSpeed ?? null,
      endSpeed: pitch.pitchData?.endSpeed ?? null,
      call: pitch.details?.call?.description ?? null,
      isStrike: pitch.details?.call?.code === 'S',
      isBall: pitch.details?.call?.code === 'B'
    };
  }

  private generateFallbackPlayerData(gameData: any, isTopInning: boolean): any {
    try {
      // Generate realistic player names from team data
      const battingTeam = isTopInning ? gameData.teams?.away : gameData.teams?.home;
      const pitchingTeam = isTopInning ? gameData.teams?.home : gameData.teams?.away;
      
      const teamName = battingTeam?.teamName || 'Team';
      const pitchingTeamName = pitchingTeam?.teamName || 'Team';
      
      // Generate realistic but generic player names based on team
      const currentBatter = `${teamName} Batter`;
      const currentPitcher = `${pitchingTeamName} Pitcher`;
      const onDeckBatter = `${teamName} On-Deck`;
      
      return {
        currentBatter,
        currentBatterId: null,
        currentPitcher,
        currentPitcherId: null,
        onDeckBatter
      };
    } catch (error) {
      return {
        currentBatter: 'Current Batter',
        currentPitcher: 'Current Pitcher', 
        onDeckBatter: 'On-Deck Batter'
      };
    }
  }

  protected getFallbackGameData() {
    return {
      runners: { first: false, second: false, third: false },
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      isTopInning: true,
      lineupData: {
        battingTeam: 'home',
        currentBatterOrder: 1,
        nextBatterOrder: 2,
        onDeckBatterOrder: 3,
        currentBatterStrength: 'average',
        nextBatterStrength: 'average',
        onDeckBatterStrength: 'average'
      },
      currentBatter: null,
      currentPitcher: null,
      error: 'Failed to fetch live data'
    };
  }

  protected mapGameStatus(detailedState: string): string {
    const lowerState = detailedState.toLowerCase();

    if (lowerState.includes('progress') || lowerState.includes('live') || lowerState.includes('inning')) {
      return 'live';
    }
    if (lowerState.includes('final') || lowerState.includes('completed')) {
      return 'final';
    }
    if (lowerState.includes('delayed') || lowerState.includes('postponed')) {
      return 'delayed';
    }

    return 'scheduled';
  }
}

// Export a singleton instance
export const mlbApiService = new MLBApiService();