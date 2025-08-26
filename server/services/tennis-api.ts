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
  private readonly BASE_URL = 'https://api.example-tennis.com'; // Replace with real API

  async getLiveMatches(): Promise<TennisMatch[]> {
    // For now, return mock data - replace with real API integration
    const mockMatches: TennisMatch[] = [
      {
        matchId: 'atp-2025-wimbledon-001',
        sport: 'TENNIS',
        status: 'live',
        players: {
          home: { id: 'player1', name: 'Novak Djokovic', country: 'SRB', ranking: 1 },
          away: { id: 'player2', name: 'Rafael Nadal', country: 'ESP', ranking: 2 }
        },
        currentSet: 3,
        sets: { home: [6, 4, 2], away: [4, 6, 6] },
        gamesInSet: { home: 2, away: 6 },
        score: { home: '40', away: '30' },
        isTiebreak: false,
        serving: 'away',
        tournament: 'Wimbledon 2025',
        surface: 'Grass',
        startTime: new Date().toISOString(),
        venue: 'Centre Court, All England Club'
      },
      {
        matchId: 'wta-2025-rolandgarros-002',
        sport: 'TENNIS',
        status: 'live',
        players: {
          home: { id: 'player3', name: 'Iga Swiatek', country: 'POL', ranking: 1 },
          away: { id: 'player4', name: 'Aryna Sabalenka', country: 'BLR', ranking: 3 }
        },
        currentSet: 2,
        sets: { home: [6, 3], away: [3, 5] },
        gamesInSet: { home: 3, away: 5 },
        score: { home: 'DEUCE', away: 'DEUCE' },
        isTiebreak: false,
        serving: 'home',
        tournament: 'Roland Garros 2025',
        surface: 'Clay',
        startTime: new Date().toISOString(),
        venue: 'Court Philippe-Chatrier'
      }
    ];

    return mockMatches;
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