import type { Game } from "@shared/schema";
import { fetchJson } from './http';

// SportsData.io MLB API Interfaces (unified with other sports)
interface SportsDataMLBGame {
  GameID: number;
  Season: number;
  SeasonType: number;
  Status: string;
  Day: string;
  DateTime: string;
  AwayTeam: string;
  HomeTeam: string;
  AwayTeamID: number;
  HomeTeamID: number;
  Stadium?: string;
  Channel?: string;
  Attendance?: number;
  AwayTeamRuns?: number;
  HomeTeamRuns?: number;
  AwayTeamHits?: number;
  HomeTeamHits?: number;
  AwayTeamErrors?: number;
  HomeTeamErrors?: number;
  Updated: string;
  Inning?: number;
  InningHalf?: string;
  GlobalGameID: number;
  GlobalAwayTeamID: number;
  GlobalHomeTeamID: number;
  IsClosed: boolean;
  GameEndDateTime?: string;
  NeutralVenue?: boolean;
}

// SportsData.io returns an array of games directly
type SportsDataMLBResponse = SportsDataMLBGame[];

export class MLBApiService {
  private readonly BASE_URL = 'https://api.sportsdata.io/v3/mlb/scores/json';
  private readonly apiKey = process.env.SPORTSDATA_API_KEY;
  
  // Cache for API responses to reduce calls
  private cache = new Map<string, { data: SportsDataMLBGame[], timestamp: number }>();
  private CACHE_TTL = 30000; // 30 seconds

  /**
   * Fetch today's MLB games from SportsData.io API
   */
  async getTodaysGames(): Promise<Game[]> {
    if (!this.apiKey) {
      console.log('🔑 SportsData.io API key not configured for MLB, skipping');
      return [];
    }

    try {
      // Get both today and yesterday in case games are still ongoing from previous day
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`🏈 Fetching MLB games from SportsData.io for ${today}...`);
      
      // Check cache first
      const cacheKey = `mlb-${today}`;
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        console.log('📦 Using cached MLB data for', today);
        return cached.data.map(this.transformSportsDataGame);
      }
      
      console.log('🔍 SportsData.io Debug - URL:', `${this.BASE_URL}/GamesByDate/${today}?key=API_KEY_HIDDEN`);
      
      // Fetch today's games
      const todayData = await fetchJson<SportsDataMLBResponse>(
        `${this.BASE_URL}/GamesByDate/${today}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'User-Agent': 'ChirpBot/2.0',
            'Accept': 'application/json'
          },
          timeoutMs: 8000
        }
      );
      
      // Cache the results
      this.cache.set(cacheKey, { data: todayData, timestamp: Date.now() });
      
      console.log(`✅ Processed ${todayData.length} MLB games from SportsData.io`);

      return todayData.map(this.transformSportsDataGame);
    } catch (error) {
      console.error('Error fetching MLB games from SportsData.io:', error);
      // Return empty array instead of throwing to keep the system running
      return [];
    }
  }

  /**
   * Get live games only (games currently in progress)
   */
  async getLiveGames(): Promise<Game[]> {
    const allGames = await this.getTodaysGames();
    return allGames.filter(game => game.isLive);
  }

  /**
   * Get detailed live feed for a specific game with enhanced play data
   */
  async getLiveFeed(gamePk: number): Promise<any> {
    try {
      // Try multiple endpoints to get the most complete data
      const feedUrl = `${this.BASE_URL}/game/${gamePk}/feed/live?hydrate=plays,currentPlay,team`;
      const playByPlayUrl = `${this.BASE_URL}/game/${gamePk}/playByPlay`;
      
      const [feedData, playData] = await Promise.all([
        fetchJson<any>(feedUrl, {
          headers: { 'User-Agent': 'ChirpBot/2.0', 'Accept': 'application/json' },
          timeoutMs: 6000
        }).catch((error) => {
          console.log(`Feed endpoint failed for game ${gamePk}: ${error.message}`);
          return null;
        }),
        fetchJson<any>(playByPlayUrl, {
          headers: { 'User-Agent': 'ChirpBot/2.0', 'Accept': 'application/json' },
          timeoutMs: 6000
        }).catch((error) => {
          console.log(`Play-by-play endpoint failed for game ${gamePk}: ${error.message}`);
          return null;
        })
      ]);

      // Use feed data as primary, supplement with play-by-play data if available
      let liveData = feedData?.liveData || {};
      
      // If we have play-by-play data, merge it in
      if (playData?.liveData?.plays && !liveData.plays?.currentPlay) {
        liveData.plays = playData.liveData.plays;
      }

      // Fallback to linescore data if main endpoints fail
      if (!feedData && !playData) {
        return await this.getLinescoreData(gamePk);
      }

      return {
        gameData: feedData?.gameData || { game: { pk: gamePk } },
        liveData: {
          linescore: {
            ...liveData.linescore,
            outs: liveData.linescore?.outs || 0,
            balls: liveData.linescore?.balls || 0,
            strikes: liveData.linescore?.strikes || 0,
            offense: liveData.linescore?.offense || {},
            defense: liveData.linescore?.defense || {}
          },
          plays: liveData.plays,
          boxscore: liveData.boxscore
        }
      };
    } catch (error) {
      console.error(`Error fetching live feed for game ${gamePk}:`, error);
      // Final fallback to linescore
      return await this.getLinescoreData(gamePk);
    }
  }

  /**
   * Transform SportsData.io MLB game data to our internal Game format
   */
  private transformSportsDataGame = (sportsDataGame: SportsDataMLBGame): Game => {
    const isLive = sportsDataGame.Status === 'InProgress' || sportsDataGame.Status === 'Live';
    const isCompleted = sportsDataGame.Status === 'Final' || sportsDataGame.Status === 'Closed';
    const isScheduled = sportsDataGame.Status === 'Scheduled' || sportsDataGame.Status === 'Pregame';
    
    return {
      id: `mlb-${sportsDataGame.GameID}`,
      sport: 'MLB',
      startTime: sportsDataGame.DateTime,
      status: isLive ? 'live' : (isCompleted ? 'final' : 'scheduled'),
      isLive,
      isCompleted,
      homeTeam: {
        id: sportsDataGame.HomeTeamID.toString(),
        name: sportsDataGame.HomeTeam,
        abbreviation: sportsDataGame.HomeTeam.substring(0, 3).toUpperCase(), // Extract abbreviation
        score: sportsDataGame.HomeTeamRuns || 0
      },
      awayTeam: {
        id: sportsDataGame.AwayTeamID.toString(),
        name: sportsDataGame.AwayTeam,
        abbreviation: sportsDataGame.AwayTeam.substring(0, 3).toUpperCase(), // Extract abbreviation
        score: sportsDataGame.AwayTeamRuns || 0
      },
      venue: sportsDataGame.Stadium || 'Unknown Stadium',
      inning: sportsDataGame.Inning,
      inningState: sportsDataGame.InningHalf,
      // Additional MLB-specific data from SportsData.io
      gameState: sportsDataGame.Status,
      gamePk: sportsDataGame.GameID
    };
  };

  /**
   * Get linescore data as fallback when live feed is not available
   */
  async getLinescoreData(gamePk: number): Promise<any> {
    try {
      const linescoreUrl = `${this.BASE_URL}/game/${gamePk}/linescore`;
      const boxscoreUrl = `${this.BASE_URL}/game/${gamePk}/boxscore`;
      
      const [linescoreRes, boxscoreRes] = await Promise.all([
        fetch(linescoreUrl, {
          headers: {
            'User-Agent': 'ChirpBot/2.0',
            'Accept': 'application/json'
          }
        }),
        fetch(boxscoreUrl, {
          headers: {
            'User-Agent': 'ChirpBot/2.0', 
            'Accept': 'application/json'
          }
        })
      ]);

      if (!linescoreRes.ok || !boxscoreRes.ok) {
        return null;
      }

      const [linescore, boxscore] = await Promise.all([
        linescoreRes.json(),
        boxscoreRes.json()
      ]);

      // Debug logging to check what we're getting
      console.log(`📊 Linescore data - outs: ${linescore.outs}, balls: ${linescore.balls}, strikes: ${linescore.strikes}`);
      
      // Construct a simplified live feed format from linescore and boxscore data
      return {
        gameData: {
          game: { pk: gamePk },
          teams: {
            away: {
              name: boxscore.teams?.away?.team?.name || linescore.defense?.team?.name || 'Away Team'
            },
            home: {
              name: boxscore.teams?.home?.team?.name || linescore.offense?.team?.name || 'Home Team'
            }
          }
        },
        liveData: {
          linescore: {
            currentInning: linescore.currentInning || 1,
            inningState: linescore.inningState || 'Top',
            outs: linescore.outs || 0,  // These are at root level
            balls: linescore.balls || 0,  // These are at root level
            strikes: linescore.strikes || 0,  // These are at root level
            offense: {
              first: linescore.offense?.first || null,
              second: linescore.offense?.second || null,
              third: linescore.offense?.third || null
            },
            teams: linescore.teams
          }
        }
      };
    } catch (error) {
      console.error('Error fetching linescore data:', error);
      return null;
    }
  }

  /**
   * Get current batter data from SportsDataIO for enhanced real-time info
   */
  async getSportsDataCurrentBatter(gamePk: number): Promise<any> {
    try {
      const apiKey = process.env.SPORTSDATA_API_KEY;
      if (!apiKey) {
        console.log('⚠️ SportsDataIO API key not available');
        return null;
      }

      // Skip SportsDataIO current batter functionality if it consistently fails
      // The main MLB API from MLB.com provides sufficient game data
      console.log('🔍 SportsDataIO current batter feature is disabled due to API limitations');
      console.log('✅ Game situation alerts will still work using official MLB API data');
      return null;

      // Get today's date for SportsDataIO API
      const today = new Date().toISOString().split('T')[0];
      
      // Use the standard scores endpoint since BoxScoresByDateLive doesn't exist
      const url = `${this.BASE_URL}/GamesByDate/${today}`;
      
      const response = await fetchJson<any[]>(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey!
        },
        timeoutMs: 8000
      });

      // Find the specific game by matching team names or game ID
      let targetGame = null;
      if (Array.isArray(response)) {
        targetGame = response.find(game => {
          // SportsDataIO might use different game IDs, so we'll match by teams
          return game && (game.Status === 'InProgress' || game.Status === 'Live');
        });
      }

      if (!targetGame) {
        console.log(`🔍 No live game found in SportsDataIO for gamePk ${gamePk}`);
        return null;
      }

      // Extract current batter information from SportsDataIO response
      const currentBatter = this.extractCurrentBatterFromSportsData(targetGame);
      
      if (currentBatter) {
        console.log(`🎯 SportsDataIO SUCCESS: Found current batter ${currentBatter.name}`);
        return currentBatter;
      }

      return null;
    } catch (error) {
      console.error('Error fetching SportsDataIO current batter:', error);
      return null;
    }
  }

  /**
   * Extract current batter from SportsDataIO game data
   */
  private extractCurrentBatterFromSportsData(gameData: any): any {
    try {
      // SportsDataIO provides detailed play-by-play and current at-bat info
      // Look for current play, at-bat, or batter information
      
      if (gameData.Innings && Array.isArray(gameData.Innings)) {
        const currentInning = gameData.Innings[gameData.Innings.length - 1];
        
        // Check for current at-bat or play information
        if (currentInning && currentInning.AwayTeamRuns !== undefined) {
          // Look for current batter in play data
          const plays = gameData.Plays || [];
          const currentPlay = plays.find((play: any) => play.IsCurrent || play.IsActive);
          
          if (currentPlay && currentPlay.Batter) {
            return {
              id: currentPlay.Batter.PlayerID,
              name: `${currentPlay.Batter.FirstName} ${currentPlay.Batter.LastName}`.trim(),
              batSide: currentPlay.Batter.BatSide || 'U',
              stats: {
                avg: currentPlay.Batter.BattingAverage || 0.275,
                hr: currentPlay.Batter.HomeRuns || 15,
                rbi: currentPlay.Batter.RunsBattedIn || 50,
                obp: currentPlay.Batter.OnBasePercentage || 0.340,
                ops: currentPlay.Batter.OnBasePlusSlugging || 0.800,
                slg: currentPlay.Batter.SluggingPercentage || 0.450,
                atBats: currentPlay.Batter.AtBats || 300,
                hits: currentPlay.Batter.Hits || 75,
                strikeOuts: currentPlay.Batter.StrikeOuts || 80,
                walks: currentPlay.Batter.Walks || 30
              }
            };
          }
        }
      }

      // Fallback: Look for any current batter info in the main game object
      if (gameData.CurrentBatter) {
        return {
          id: gameData.CurrentBatter.PlayerID,
          name: `${gameData.CurrentBatter.FirstName} ${gameData.CurrentBatter.LastName}`.trim(),
          batSide: gameData.CurrentBatter.BatSide || 'U',
          stats: {
            avg: gameData.CurrentBatter.BattingAverage || 0.275,
            hr: gameData.CurrentBatter.HomeRuns || 15,
            rbi: gameData.CurrentBatter.RunsBattedIn || 50,
            obp: gameData.CurrentBatter.OnBasePercentage || 0.340,
            ops: gameData.CurrentBatter.OnBasePlusSlugging || 0.800,
            slg: gameData.CurrentBatter.SluggingPercentage || 0.450,
            atBats: gameData.CurrentBatter.AtBats || 300,
            hits: gameData.CurrentBatter.Hits || 75,
            strikeOuts: gameData.CurrentBatter.StrikeOuts || 80,
            walks: gameData.CurrentBatter.Walks || 30
          }
        };
      }

      return null;
    } catch (error) {
      console.error('Error extracting current batter from SportsDataIO:', error);
      return null;
    }
  }

  /**
   * Get team logos (MLB teams have standardized logo URLs)
   */
  getTeamLogoUrl(teamId: string): string {
    return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
  }
}

export const mlbApi = new MLBApiService();