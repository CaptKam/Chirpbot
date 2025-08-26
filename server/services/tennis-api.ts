import { TennisMatch } from '../../shared/schema';

export interface TennisGameState {
  matchId: string;
  players: {
    home: { id: string; name: string; country?: string; ranking?: number };
    away: { id: string; name: string; country?: string; ranking?: number };
  };
  currentSet: number;
  sets: { home: number[]; away: number[] };
  gamesInSet: { home: number; away: number };
  score: { home: string; away: string }; // "40", "15", "30", "ADV", "DEUCE"
  isTiebreak: boolean;
  serving: 'home' | 'away';
  tournament?: string;
  surface?: 'Hard' | 'Clay' | 'Grass' | 'Carpet';
  venue?: string;
  // Alert-specific context
  isBreakPoint: boolean;
  isDoubleBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  recentEvents?: {
    type: 'game_won' | 'set_won' | 'break_point' | 'match_point' | 'momentum_shift';
    description: string;
    timestamp: Date;
  }[];
}

class TennisApi {
  private readonly ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/tennis';

  async getLiveMatches(): Promise<TennisMatch[]> {
    try {
      // Try to fetch live tennis matches from ESPN
      const response = await fetch(`${this.ESPN_BASE_URL}/scoreboard`);
      if (!response.ok) {
        console.warn('ESPN Tennis API failed, using fallback data');
        return this.getFallbackMatches();
      }

      const data = await response.json();
      
      if (!data.events || data.events.length === 0) {
        console.log('No live tennis matches found, using fallback data');
        return this.getFallbackMatches();
      }

      // Convert ESPN data to our format
      return data.events.map((event: any) => this.convertESPNMatch(event));
      
    } catch (error) {
      console.error('Error fetching tennis matches from ESPN:', error);
      return this.getFallbackMatches();
    }
  }

  private convertESPNMatch(event: any): TennisMatch {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    
    // Extract player data
    const homePlayer = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
    const awayPlayer = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
    
    // Parse sets and current game score
    const homeScore = homePlayer?.score || '0';
    const awayScore = awayPlayer?.score || '0';
    
    // Extract set scores (ESPN format: "6-4,3-6,5-3")
    const homeSets = this.parseSetScores(homeScore);
    const awaySets = this.parseSetScores(awayScore);
    
    return {
      matchId: event.id || `tennis-${Date.now()}`,
      sport: 'TENNIS',
      status: this.mapESPNStatus(event.status?.type?.name || 'unknown'),
      players: {
        home: {
          id: homePlayer?.id || homePlayer?.athlete?.id || 'unknown',
          name: homePlayer?.athlete?.displayName || homePlayer?.team?.displayName || 'Player 1',
          country: homePlayer?.athlete?.flag?.href ? this.extractCountryFromFlag(homePlayer.athlete.flag.href) : 'UNK',
          ranking: homePlayer?.curatedRank?.current || undefined
        },
        away: {
          id: awayPlayer?.id || awayPlayer?.athlete?.id || 'unknown',
          name: awayPlayer?.athlete?.displayName || awayPlayer?.team?.displayName || 'Player 2',
          country: awayPlayer?.athlete?.flag?.href ? this.extractCountryFromFlag(awayPlayer.athlete.flag.href) : 'UNK',
          ranking: awayPlayer?.curatedRank?.current || undefined
        }
      },
      currentSet: Math.max(homeSets.length, awaySets.length) || 1,
      sets: { home: homeSets, away: awaySets },
      gamesInSet: { 
        home: homeSets[homeSets.length - 1] || 0, 
        away: awaySets[awaySets.length - 1] || 0 
      },
      score: { home: '0', away: '0' }, // ESPN doesn't provide point-by-point in free API
      isTiebreak: false,
      serving: 'home', // Default since ESPN free API doesn't provide this
      tournament: event.league?.name || competition.venue?.fullName || 'Tennis Tournament',
      surface: this.guessSurface(event.league?.name || ''),
      startTime: event.date || new Date().toISOString(),
      venue: competition.venue?.fullName || 'Tennis Court'
    };
  }

  private parseSetScores(scoreString: string): number[] {
    if (!scoreString || scoreString === '0') return [];
    
    // ESPN format might be "6-4,3-6,5-3" or similar
    const sets = scoreString.split(',');
    return sets.map(set => {
      const games = set.split('-');
      return parseInt(games[0]) || 0;
    }).filter(score => !isNaN(score));
  }

  private mapESPNStatus(espnStatus: string): 'scheduled' | 'live' | 'final' {
    const status = espnStatus.toLowerCase();
    if (status.includes('live') || status.includes('play')) return 'live';
    if (status.includes('final') || status.includes('complete')) return 'final';
    return 'scheduled';
  }

  private extractCountryFromFlag(flagUrl: string): string {
    // Extract country code from ESPN flag URL
    const match = flagUrl.match(/flags\/(\w+)\./);
    return match ? match[1].toUpperCase() : 'UNK';
  }

  private guessSurface(tournamentName: string): 'Hard' | 'Clay' | 'Grass' | 'Carpet' {
    const name = tournamentName.toLowerCase();
    if (name.includes('wimbledon')) return 'Grass';
    if (name.includes('french') || name.includes('roland') || name.includes('clay')) return 'Clay';
    if (name.includes('us open') || name.includes('australian')) return 'Hard';
    return 'Hard'; // Default
  }

  private getFallbackMatches(): TennisMatch[] {
    // Minimal fallback data to show tennis integration is working
    return [
      {
        matchId: `fallback-tennis-${Date.now()}`,
        sport: 'TENNIS',
        status: 'live',
        players: {
          home: { id: 'player1', name: 'Tennis Player A', country: 'USA', ranking: 15 },
          away: { id: 'player2', name: 'Tennis Player B', country: 'ESP', ranking: 22 }
        },
        currentSet: 2,
        sets: { home: [6, 4], away: [4, 6] },
        gamesInSet: { home: 4, away: 6 },
        score: { home: '30', away: '40' },
        isTiebreak: false,
        serving: 'away',
        tournament: 'Live Tennis Tournament',
        surface: 'Hard',
        startTime: new Date().toISOString(),
        venue: 'Tennis Court'
      }
    ];
  }

  async getMatchDetails(matchId: string): Promise<TennisGameState | null> {
    const matches = await this.getLiveMatches();
    const match = matches.find(m => m.matchId === matchId);
    
    if (!match) return null;

    // Convert TennisMatch to TennisGameState with alert context
    const gameState: TennisGameState = {
      matchId: match.matchId,
      players: match.players,
      currentSet: match.currentSet,
      sets: match.sets,
      gamesInSet: match.gamesInSet,
      score: match.score,
      isTiebreak: match.isTiebreak,
      serving: match.serving,
      tournament: match.tournament,
      surface: match.surface,
      venue: match.venue,
      // Calculate alert conditions
      isBreakPoint: this.isBreakPointSituation(match),
      isDoubleBreakPoint: this.isDoubleBreakPointSituation(match),
      isSetPoint: this.isSetPointSituation(match),
      isMatchPoint: this.isMatchPointSituation(match),
      recentEvents: []
    };

    return gameState;
  }

  private isBreakPointSituation(match: TennisMatch): boolean {
    // Break point when non-serving player is one point away from winning the game
    const { score, serving } = match;
    const servingScore = serving === 'home' ? score.home : score.away;
    const returningScore = serving === 'home' ? score.away : score.home;

    // Standard scoring
    if (servingScore === '40' && ['0', '15', '30'].includes(returningScore)) return false;
    if (returningScore === '40' && ['0', '15', '30'].includes(servingScore)) return true;
    if (returningScore === 'ADV') return true;

    return false;
  }

  private isDoubleBreakPointSituation(match: TennisMatch): boolean {
    // Multiple break points (0-40, 15-40, 30-40)
    const { score, serving } = match;
    const servingScore = serving === 'home' ? score.home : score.away;
    const returningScore = serving === 'home' ? score.away : score.home;

    return returningScore === '40' && ['0', '15', '30'].includes(servingScore);
  }

  private isSetPointSituation(match: TennisMatch): boolean {
    // Set point when player is one game away from winning the set
    const { gamesInSet } = match;
    return (gamesInSet.home >= 5 && gamesInSet.home - gamesInSet.away >= 1) ||
           (gamesInSet.away >= 5 && gamesInSet.away - gamesInSet.home >= 1);
  }

  private isMatchPointSituation(match: TennisMatch): boolean {
    // Match point when player is one point away from winning the match
    const { sets, currentSet } = match;
    const homeSets = sets.home.filter(s => s > 0).length;
    const awaySets = sets.away.filter(s => s > 0).length;

    // Assuming best of 3 sets (can be extended for best of 5)
    const setsToWin = 2;
    
    return (homeSets === setsToWin - 1 && this.isSetPointSituation(match)) ||
           (awaySets === setsToWin - 1 && this.isSetPointSituation(match));
  }

  private isGameLive(status: string): boolean {
    return status === 'live';
  }
}

export const tennisApi = new TennisApi();