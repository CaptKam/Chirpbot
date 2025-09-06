
export interface GameStartResult {
  shouldAlert: boolean;
  message: string;
  priority: number;
  context: any;
}

export async function checkAlert(gameState: any): Promise<GameStartResult> {
  // Check if it's the start of the game (top 1st inning, 0-0 score)
  const isGameStart = gameState.inning === 1 && 
                     gameState.halfInning === 'top' && 
                     gameState.homeScore === 0 && 
                     gameState.awayScore === 0 &&
                     gameState.isLive;

  if (!isGameStart) {
    return {
      shouldAlert: false,
      message: '',
      priority: 0,
      context: gameState
    };
  }

  const message = `⚾ Game Starting - First pitch between ${gameState.awayTeam} and ${gameState.homeTeam}`;

  return {
    shouldAlert: true,
    message,
    priority: 40,
    context: {
      ...gameState,
      alertType: 'GAME_START',
      situation: 'First pitch of the game'
    }
  };
}
