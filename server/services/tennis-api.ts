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
  // Using tennis-data.co.uk API - provides real tennis data
  private readonly TENNIS_API_BASE = 'https://tennis-data.co.uk/api';
  
  async getLiveMatches(): Promise<TennisMatch[]> {
    try {
      // Try multiple sources for real tennis data
      const sources = [
        { name: 'Tennis-data.co.uk', url: `${this.TENNIS_API_BASE}/live` },
        { name: 'ESPN-Mobile', url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard' },
        { name: 'ATP-Tour', url: 'https://www.atptour.com/en/scores/current' }
      ];

      for (const source of sources) {
        try {
          console.log(`🎾 Trying ${source.name} tennis API...`);
          const response = await fetch(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/html, */*'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const matches = this.parseResponse(data, source.name);
            if (matches.length > 0) {
              console.log(`✅ Got ${matches.length} tennis matches from ${source.name}`);
              return matches;
            }
          }
        } catch (apiError) {
          console.log(`❌ ${source.name} failed:`, apiError.message);
          continue;
        }
      }

      console.log('🎾 All tennis APIs failed, trying ESPN with real tournaments...');
      
      // Try to get real tennis data by attempting direct ESPN tournament endpoints
      const espnUSOpen = await this.tryESPNTournament();
      if (espnUSOpen.length > 0) {
        return espnUSOpen;
      }
      
      console.log('🎾 No tennis matches available - returning empty result');
      return [];
      
    } catch (error) {
      console.error('Error fetching tennis matches:', error);
      return this.getScheduledMatches();
    }
  }

  private convertESPNTennisMatch(competition: any, event: any): TennisMatch | null {
    const competitors = competition.competitors || [];
    if (competitors.length < 2) return null;

    // Get both competitors 
    const homePlayer = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
    const awayPlayer = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

    // Extract real player names from ESPN tennis data
    const homeName = homePlayer?.athlete?.displayName || homePlayer?.athlete?.fullName || 'Unknown Player';
    const awayName = awayPlayer?.athlete?.displayName || awayPlayer?.athlete?.fullName || 'Unknown Player';

    console.log(`🎾 Parsing ESPN tennis match: ${homeName} vs ${awayName}`);

    // Extract score data from linescores (sets won)
    const homeLinescores = homePlayer?.linescores || [];
    const awayLinescores = awayPlayer?.linescores || [];

    return {
      matchId: competition.id || `tennis-${Date.now()}`,
      sport: 'TENNIS' as const,
      status: this.mapESPNStatus(competition.status?.type?.name || 'final'),
      players: {
        home: {
          id: homePlayer?.athlete?.id || `home-${Date.now()}`,
          name: homeName,
          country: homePlayer?.athlete?.flag?.alt || 'UNK',
          ranking: homePlayer?.curatedRank?.current || undefined
        },
        away: {
          id: awayPlayer?.athlete?.id || `away-${Date.now()}`,
          name: awayName,
          country: awayPlayer?.athlete?.flag?.alt || 'UNK',
          ranking: awayPlayer?.curatedRank?.current || undefined
        }
      },
      currentSet: Math.max(homeLinescores.length, awayLinescores.length, 1),
      sets: {
        home: homeLinescores.map((ls: any) => Math.floor(ls.value || 0)),
        away: awayLinescores.map((ls: any) => Math.floor(ls.value || 0))
      },
      gamesInSet: {
        home: Math.floor(homeLinescores[homeLinescores.length - 1]?.value || 0),
        away: Math.floor(awayLinescores[awayLinescores.length - 1]?.value || 0)
      },
      score: {
        home: '0',
        away: '0'
      },
      isTiebreak: false,
      serving: 'home',
      tournament: event.name || 'Tennis Tournament',
      surface: this.guessSurface(event.name || ''),
      startTime: competition.date || event.date || new Date().toISOString(),
      venue: competition.venue?.fullName || competition.venue?.court || 'Tennis Court'
    };
  }

  private convertESPNMatch(event: any, forceConvert = false): TennisMatch {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    
    // Debug: Log the actual ESPN data structure
    console.log(`🎾 ESPN Event structure:`, {
      eventId: event.id,
      eventName: event.name,
      competitorsCount: competitors.length,
      competitors: competitors.map((c: any) => ({
        id: c.id,
        homeAway: c.homeAway,
        athleteId: c.athlete?.id,
        athleteName: c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName,
        teamName: c.team?.displayName
      }))
    });
    
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
          id: homePlayer?.athlete?.id || homePlayer?.id || `home-${Date.now()}`,
          name: homePlayer?.athlete?.displayName || homePlayer?.athlete?.fullName || homePlayer?.athlete?.shortName || 'Unknown Player',
          country: homePlayer?.athlete?.flag?.alt || (homePlayer?.athlete?.flag?.href ? this.extractCountryFromFlag(homePlayer.athlete.flag.href) : 'UNK'),
          ranking: homePlayer?.curatedRank?.current || undefined
        },
        away: {
          id: awayPlayer?.athlete?.id || awayPlayer?.id || `away-${Date.now()}`,
          name: awayPlayer?.athlete?.displayName || awayPlayer?.athlete?.fullName || awayPlayer?.athlete?.shortName || 'Unknown Player', 
          country: awayPlayer?.athlete?.flag?.alt || (awayPlayer?.athlete?.flag?.href ? this.extractCountryFromFlag(awayPlayer.athlete.flag.href) : 'UNK'),
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
      tournament: event.name || event.league?.name || competition.venue?.fullName || 'Tennis Tournament',
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
    if (status.includes('in_progress') || status.includes('live') || status.includes('play') || status === 'status_in_progress') return 'live';
    if (status.includes('final') || status.includes('complete') || status === 'status_final') return 'final';
    if (status.includes('scheduled') || status === 'status_scheduled') return 'scheduled';
    return 'final'; // Default to final for unknown statuses
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

  private parseResponse(data: any, sourceName: string): TennisMatch[] {
    try {
      if (sourceName === 'ESPN-Mobile') {
        return this.parseESPNData(data);
      } else if (sourceName === 'Tennis-data.co.uk') {
        return this.parseTennisDataUK(data);
      } else if (sourceName === 'ATP-Tour') {
        return this.parseATPData(data);
      }
      return [];
    } catch (error) {
      console.error(`Error parsing ${sourceName} data:`, error);
      return [];
    }
  }

  private parseESPNData(data: any): TennisMatch[] {
    if (!data.events || !Array.isArray(data.events)) return [];
    
    const allMatches: TennisMatch[] = [];
    const liveMatches: TennisMatch[] = [];
    const completedMatches: TennisMatch[] = [];
    
    // ESPN tennis data structure: events contain tournaments, tournaments contain groupings -> competitions
    for (const event of data.events) {
      // Tennis tournaments have groupings (Men's Singles, Women's Singles, etc.)
      if (event.groupings && Array.isArray(event.groupings)) {
        for (const grouping of event.groupings) {
          if (grouping.competitions && Array.isArray(grouping.competitions)) {
            for (const competition of grouping.competitions) {
              if (competition.competitors && competition.competitors.length >= 2) {
                // This is an actual tennis match with competitors
                const match = this.convertESPNTennisMatch(competition, event);
                if (match) {
                  if (match.status === 'live') {
                    liveMatches.push(match);
                  } else if (match.status === 'final') {
                    completedMatches.push(match);
                  } else {
                    allMatches.push(match);
                  }
                }
              }
            }
          }
        }
      }
      
      // Also check direct competitions (older format)
      if (event.competitions && Array.isArray(event.competitions)) {
        for (const competition of event.competitions) {
          if (competition.competitors && competition.competitors.length >= 2) {
            const match = this.convertESPNTennisMatch(competition, event);
            if (match) {
              if (match.status === 'live') {
                liveMatches.push(match);
              } else if (match.status === 'final') {
                completedMatches.push(match);
              } else {
                allMatches.push(match);
              }
            }
          }
        }
      }
    }

    console.log(`🎾 Found ${liveMatches.length} live, ${completedMatches.length} completed, ${allMatches.length} scheduled tennis matches`);
    
    // Prioritize live matches, then scheduled, then completed as examples
    if (liveMatches.length > 0) {
      return liveMatches.slice(0, 5); // Show up to 5 live matches
    }
    
    if (allMatches.length > 0) {
      return allMatches.slice(0, 3); // Show upcoming scheduled matches
    }
    
    // Only show completed as fallback examples
    return completedMatches.slice(0, 3);
  }

  private parseTennisDataUK(data: any): TennisMatch[] {
    // Parse tennis-data.co.uk format
    if (!data.matches || !Array.isArray(data.matches)) return [];
    
    return data.matches.map((match: any) => ({
      matchId: match.id || `tennis-${Date.now()}-${Math.random()}`,
      sport: 'TENNIS' as const,
      status: this.mapStatus(match.status),
      players: {
        home: {
          id: match.player1?.id || 'unknown',
          name: match.player1?.name || 'Player 1',
          country: match.player1?.country || 'UNK',
          ranking: match.player1?.ranking
        },
        away: {
          id: match.player2?.id || 'unknown',
          name: match.player2?.name || 'Player 2',
          country: match.player2?.country || 'UNK',
          ranking: match.player2?.ranking
        }
      },
      currentSet: match.currentSet || 1,
      sets: {
        home: match.sets?.player1 || [],
        away: match.sets?.player2 || []
      },
      gamesInSet: {
        home: match.currentSetGames?.player1 || 0,
        away: match.currentSetGames?.player2 || 0
      },
      score: {
        home: match.currentScore?.player1 || '0',
        away: match.currentScore?.player2 || '0'
      },
      isTiebreak: match.isTiebreak || false,
      serving: match.serving || 'home',
      tournament: match.tournament || 'Tennis Tournament',
      surface: match.surface || 'Hard',
      startTime: match.startTime || new Date().toISOString(),
      venue: match.venue || 'Tennis Court'
    }));
  }

  private parseATPData(data: any): TennisMatch[] {
    // ATP Tour typically returns HTML, so this would need web scraping
    // For now, return empty array since we're focusing on JSON APIs
    return [];
  }

  private mapStatus(status: string): 'scheduled' | 'live' | 'final' {
    if (!status) return 'scheduled';
    const s = status.toLowerCase();
    if (s.includes('live') || s.includes('play') || s.includes('progress')) return 'live';
    if (s.includes('final') || s.includes('complete') || s.includes('finished')) return 'final';
    return 'scheduled';
  }

  private async tryESPNTournament(): Promise<TennisMatch[]> {
    try {
      // Try direct ESPN scoreboard with specific dates to get recent US Open matches
      const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChirpBot Tennis/1.0)',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`🎾 ESPN Tournament API returned ${data.events?.length || 0} events`);
        
        if (data.events && data.events.length > 0) {
          // Convert completed matches to show as examples (they are real tennis data)
          return data.events
            .slice(0, 3) // Take first 3 recent matches
            .map((event: any) => this.convertESPNMatch(event, true)) // Force convert for real data
            .filter((match: TennisMatch | null) => match !== null);
        }
      }
    } catch (error) {
      console.log('🎾 ESPN Tournament API failed:', error.message);
    }
    
    return [];
  }

  private getScheduledMatches(): TennisMatch[] {
    // Return empty array since user wants real data only
    console.log('🎾 No live tennis matches available - returning empty result');
    return [];
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