/**
 * Enhanced MLB Live Game Feed - Gets detailed player information
 * This service provides detailed base runner names and stats
 */
import { fetchJson } from '../utils/fetch';

export interface BaseRunner {
  id: number;
  name: string;
  position: string;
  stats?: {
    avg?: number;
    obp?: number;
    slg?: number;
  };
}

export interface EnhancedRunners {
  first: { occupied: boolean; player: BaseRunner | null };
  second: { occupied: boolean; player: BaseRunner | null };
  third: { occupied: boolean; player: BaseRunner | null };
}

export interface EnhancedGameState {
  gamePk: number;
  runners: EnhancedRunners;
  currentBatter?: BaseRunner;
  currentPitcher?: BaseRunner;
  outs: number;
  balls: number;
  strikes: number;
}

export class EnhancedMLBFeedService {
  private readonly BASE_URL = 'https://statsapi.mlb.com/api/v1';

  /**
   * Get detailed player information for live games
   */
  async getEnhancedGameState(gamePk: number): Promise<EnhancedGameState | null> {
    try {
      const url = `${this.BASE_URL}/game/${gamePk}/feed/live`;
      
      const response = await fetchJson(url, {
        headers: {
          'User-Agent': 'ChirpBot/2.0',
          'Accept': 'application/json'
        },
        timeoutMs: 8000
      });

      if (!response?.liveData?.linescore) {
        console.log(`⚠️ No linescore data available for game ${gamePk}`);
        return null;
      }

      const linescore = response.liveData.linescore;
      const offense = linescore.offense || {};
      const defense = linescore.defense || {};

      // Extract detailed base runner information
      const runners: EnhancedRunners = {
        first: this.extractRunnerInfo(offense.first),
        second: this.extractRunnerInfo(offense.second),
        third: this.extractRunnerInfo(offense.third)
      };

      // Extract current batter/pitcher information
      const currentBatter = this.extractPlayerInfo(offense.batter);
      const currentPitcher = this.extractPlayerInfo(defense.pitcher);

      const enhancedState: EnhancedGameState = {
        gamePk,
        runners,
        currentBatter,
        currentPitcher,
        outs: linescore.outs || 0,
        balls: linescore.balls || 0,
        strikes: linescore.strikes || 0
      };

      console.log(`✅ Enhanced game state for ${gamePk}:`);
      console.log(`   🏃‍♂️ Runners: ${this.formatRunners(runners)}`);
      if (currentBatter) {
        console.log(`   🥎 Batter: ${currentBatter.name} (${currentBatter.stats?.avg?.toFixed(3) || 'N/A'})`);
      }

      return enhancedState;

    } catch (error) {
      console.error(`Error fetching enhanced game state for ${gamePk}:`, error);
      return null;
    }
  }

  private extractRunnerInfo(runnerData: any): { occupied: boolean; player: BaseRunner | null } {
    if (!runnerData || !runnerData.id) {
      return { occupied: false, player: null };
    }

    return {
      occupied: true,
      player: {
        id: runnerData.id,
        name: runnerData.fullName || `Player #${runnerData.id}`,
        position: runnerData.primaryPosition?.code || '',
        stats: {
          avg: runnerData.stats?.batting?.avg || undefined,
          obp: runnerData.stats?.batting?.obp || undefined,
          slg: runnerData.stats?.batting?.slg || undefined
        }
      }
    };
  }

  private extractPlayerInfo(playerData: any): BaseRunner | null {
    if (!playerData || !playerData.id) {
      return null;
    }

    return {
      id: playerData.id,
      name: playerData.fullName || `Player #${playerData.id}`,
      position: playerData.primaryPosition?.code || '',
      stats: {
        avg: playerData.stats?.batting?.avg || playerData.stats?.pitching?.era || undefined
      }
    };
  }

  private formatRunners(runners: EnhancedRunners): string {
    const occupied = [];
    if (runners.first.occupied && runners.first.player) {
      occupied.push(`1st: ${runners.first.player.name}`);
    }
    if (runners.second.occupied && runners.second.player) {
      occupied.push(`2nd: ${runners.second.player.name}`);
    }
    if (runners.third.occupied && runners.third.player) {
      occupied.push(`3rd: ${runners.third.player.name}`);
    }
    
    return occupied.length > 0 ? occupied.join(', ') : 'Bases empty';
  }
}

export const enhancedMLBFeed = new EnhancedMLBFeedService();