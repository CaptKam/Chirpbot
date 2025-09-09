
export interface PlayerContext {
  displayName: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  stats: {
    battingAvg?: number;
    homeRuns?: number;
    rbis?: number;
    era?: number; // for pitchers
  };
  isStarPlayer: boolean;
  contextualInfo: string;
}

export class PlayerContextService {
  
  static enhanceAlertWithPlayer(baseMessage: string, gameState: any, alertType: string): string {
    const playerContext = this.generatePlayerContext(gameState, alertType);
    
    if (!playerContext) return baseMessage;
    
    // Different enhancement styles based on alert priority
    if (playerContext.impact === 'HIGH') {
      return `${baseMessage} ⭐ ${playerContext.contextualInfo}`;
    } else if (playerContext.impact === 'MEDIUM') {
      return `${baseMessage} 🔥 ${playerContext.contextualInfo}`;
    } else {
      return `${baseMessage} ⚾ ${playerContext.contextualInfo}`;
    }
  }
  
  static generatePlayerContext(gameState: any, alertType: string): PlayerContext | null {
    // For baseball alerts, focus on current batter
    if (gameState.sport === 'MLB' && gameState.currentBatter) {
      return this.getBaseballPlayerContext(gameState.currentBatter, alertType);
    }
    
    // For football alerts, focus on current player with ball or quarterback
    if (['NFL', 'NCAAF'].includes(gameState.sport) && gameState.currentPlayer) {
      return this.getFootballPlayerContext(gameState.currentPlayer, alertType);
    }
    
    // For basketball, focus on player with ball or leading scorer
    if (gameState.sport === 'WNBA' && gameState.currentPlayer) {
      return this.getBasketballPlayerContext(gameState.currentPlayer, alertType);
    }
    
    return null;
  }
  
  private static getBaseballPlayerContext(batter: any, alertType: string): PlayerContext {
    const playerName = batter.fullName || batter.name || batter.lastName || 'Unknown';
    const battingAvg = parseFloat(batter.seasonStats?.avg || batter.avg || '0');
    const homeRuns = batter.seasonStats?.homeRuns || batter.hr || 0;
    const rbis = batter.seasonStats?.rbi || batter.rbi || 0;
    
    const isStarPlayer = this.isBaseballStarPlayer(batter);
    
    let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let contextualInfo = `${playerName} at bat`;
    
    if (isStarPlayer) {
      impact = 'HIGH';
      contextualInfo = `${playerName} at bat!`;
    } else if (battingAvg > 0.320 || homeRuns > 30) {
      impact = 'HIGH';
      contextualInfo = `${playerName} (.${Math.round(battingAvg * 1000)}, ${homeRuns} HRs) at bat!`;
    } else if (battingAvg > 0.280 || homeRuns > 20) {
      impact = 'MEDIUM';
      contextualInfo = `${playerName} (.${Math.round(battingAvg * 1000)}) at bat`;
    }
    
    // Alert-specific enhancements
    if (alertType.includes('BASES_LOADED') && rbis > 80) {
      contextualInfo += ` (${rbis} RBIs this season)`;
      impact = impact === 'LOW' ? 'MEDIUM' : impact;
    }
    
    return {
      displayName: playerName,
      impact,
      stats: { battingAvg, homeRuns, rbis },
      isStarPlayer,
      contextualInfo
    };
  }
  
  private static getFootballPlayerContext(player: any, alertType: string): PlayerContext {
    const playerName = player.fullName || player.name || player.lastName || 'Unknown';
    const position = player.position || '';
    
    const isStarPlayer = this.isFootballStarPlayer(player);
    
    let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let contextualInfo = `${playerName} (${position})`;
    
    if (isStarPlayer) {
      impact = 'HIGH';
      contextualInfo = `${playerName} has the ball!`;
    } else if (position === 'QB') {
      impact = 'MEDIUM';
      contextualInfo = `QB ${playerName} in control`;
    }
    
    return {
      displayName: playerName,
      impact,
      stats: {},
      isStarPlayer,
      contextualInfo
    };
  }
  
  private static getBasketballPlayerContext(player: any, alertType: string): PlayerContext {
    const playerName = player.fullName || player.name || player.lastName || 'Unknown';
    const points = player.seasonStats?.points || player.ppg || 0;
    
    const isStarPlayer = this.isBasketballStarPlayer(player);
    
    let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    let contextualInfo = `${playerName}`;
    
    if (isStarPlayer) {
      impact = 'HIGH';
      contextualInfo = `${playerName} in action!`;
    } else if (points > 20) {
      impact = 'MEDIUM';
      contextualInfo = `${playerName} (${points} PPG)`;
    }
    
    return {
      displayName: playerName,
      impact,
      stats: { battingAvg: points },
      isStarPlayer,
      contextualInfo
    };
  }
  
  private static isBaseballStarPlayer(batter: any): boolean {
    const playerName = (batter.fullName || batter.name || batter.lastName || '').toLowerCase();
    
    const starPlayers = [
      'shohei ohtani', 'ohtani', 'mike trout', 'trout', 'mookie betts', 'betts',
      'aaron judge', 'judge', 'bryce harper', 'harper', 'manny machado', 'machado',
      'vladimir guerrero', 'guerrero', 'fernando tatis', 'tatis', 'juan soto', 'soto',
      'ronald acuna', 'acuna', 'freddie freeman', 'freeman', 'corey seager', 'seager',
      'yordan alvarez', 'alvarez', 'jose altuve', 'altuve', 'kyle tucker', 'tucker'
    ];

    return starPlayers.some(star => playerName.includes(star));
  }
  
  private static isFootballStarPlayer(player: any): boolean {
    const playerName = (player.fullName || player.name || player.lastName || '').toLowerCase();
    
    const starPlayers = [
      'josh allen', 'allen', 'patrick mahomes', 'mahomes', 'joe burrow', 'burrow',
      'justin herbert', 'herbert', 'lamar jackson', 'jackson', 'dak prescott', 'prescott',
      'derrick henry', 'henry', 'christian mccaffrey', 'mccaffrey', 'tyreek hill', 'hill',
      'davante adams', 'adams', 'cooper kupp', 'kupp', 'travis kelce', 'kelce'
    ];

    return starPlayers.some(star => playerName.includes(star));
  }
  
  private static isBasketballStarPlayer(player: any): boolean {
    const playerName = (player.fullName || player.name || player.lastName || '').toLowerCase();
    
    const starPlayers = [
      'alyssa thomas', 'thomas', 'breanna stewart', 'stewart', 'aja wilson', 'wilson',
      'diana taurasi', 'taurasi', 'sabrina ionescu', 'ionescu', 'kelsey plum', 'plum',
      'jonquel jones', 'jones', 'candace parker', 'parker'
    ];

    return starPlayers.some(star => playerName.includes(star));
  }
}
