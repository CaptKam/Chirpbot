
export interface GameStartResult {
  shouldAlert: boolean;
  message: string;
  priority: number;
  context: any;
}

export async function checkAlert(gameState: any): Promise<GameStartResult> {
  // Check if it's the opening kickoff (1st quarter, 15:00 or close to it, 0-0 score)
  const isGameStart = gameState.quarter === 1 && 
                     gameState.homeScore === 0 && 
                     gameState.awayScore === 0 &&
                     gameState.isLive &&
                     isKickoffTime(gameState.timeRemaining);

  if (!isGameStart) {
    return {
      shouldAlert: false,
      message: '',
      priority: 0,
      context: gameState
    };
  }

  const message = `🏈 Game Starting - Opening kickoff between ${gameState.awayTeam} and ${gameState.homeTeam}`;

  return {
    shouldAlert: true,
    message,
    priority: 40,
    context: {
      ...gameState,
      alertType: 'GAME_START',
      situation: 'Opening kickoff'
    }
  };
}

function isKickoffTime(timeRemaining: string): boolean {
  if (!timeRemaining) return false;

  try {
    const totalSeconds = parseTimeToSeconds(timeRemaining);
    return totalSeconds >= 880 && totalSeconds <= 900; // Between 14:40 and 15:00
  } catch (error) {
    return false;
  }
}

function parseTimeToSeconds(timeString: string): number {
  const cleanTime = timeString.trim().split(' ')[0];
  if (cleanTime.includes(':')) {
    const [minutes, seconds] = cleanTime.split(':').map(t => parseInt(t) || 0);
    return (minutes * 60) + seconds;
  }
  return parseInt(cleanTime) || 0;
}
