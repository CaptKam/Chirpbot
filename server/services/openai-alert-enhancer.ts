import OpenAI from "openai";

// Use the existing alert structure from the database
interface Alert {
  id: string;
  alertKey: string;
  sport: string;
  gameId: string;
  type: string;
  state: string;
  score: number;
  payload: {
    message?: string;
    team?: string;
    confidence?: number;
    gamePk?: string;
    inning?: number;
    outs?: number;
    baseRunners?: { first: boolean; second: boolean; third: boolean };
    openaiEnhanced?: boolean;
    originalMessage?: string;
    status?: 'LIVE' | 'UPDATED' | 'EXPIRED';
    originalAlertId?: string;
    openaiMonitored?: boolean;
  };
  createdAt: Date;
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface LiveAlertState {
  alertId: string;
  gamePk: string;
  inning: number;
  halfInning: string;
  outs: number;
  baseRunners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  batter: string;
  situation: string;
  lastUpdate: Date;
  status: 'LIVE' | 'UPDATED' | 'EXPIRED';
}

// Track live alerts that OpenAI is monitoring
const liveAlerts = new Map<string, LiveAlertState>();

export class OpenAIAlertEnhancer {
  
  /**
   * STEP 1: Enhance alert before sending
   * Uses "13-year-old test" - crystal clear and exciting
   */
  async enhanceAlert(alert: Alert): Promise<Alert> {
    try {
      const originalMessage = alert.payload.message || 'Alert';
      
      const prompt = `You are enhancing sports alerts for ChirpBot V2. Make this alert MORE EXCITING and CRYSTAL CLEAR using the "13-year-old test" - any 13-year-old should instantly understand what's happening and get excited.

ORIGINAL ALERT: "${originalMessage}"

ENHANCEMENT RULES:
1. Start with an exciting emoji (⚡🔥🚨💥🎯)
2. Use SIMPLE words a kid would understand
3. Build excitement with caps and punctuation
4. Keep it under 120 characters
5. Make it sound like the most exciting thing ever

GAME CONTEXT:
- Team: ${alert.payload.team}
- Confidence: ${alert.payload.confidence}%
- Type: ${alert.type}

Respond with ONLY the enhanced message, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.7
      });

      const enhancedMessage = response.choices[0].message.content?.trim() || originalMessage;
      
      return {
        ...alert,
        payload: {
          ...alert.payload,
          message: enhancedMessage,
          openaiEnhanced: true,
          originalMessage: originalMessage
        }
      };
    } catch (error) {
      console.error('OpenAI enhancement failed:', error);
      return alert; // Return original if enhancement fails
    }
  }

  /**
   * STEP 2: Start live monitoring for this alert
   */
  async startLiveMonitoring(alert: Alert, gameData: any): Promise<void> {
    const alertState: LiveAlertState = {
      alertId: alert.id,
      gamePk: alert.payload.gamePk || alert.gameId,
      inning: gameData.liveData?.linescore?.currentInning || 1,
      halfInning: gameData.liveData?.linescore?.inningHalf || 'Top',
      outs: gameData.liveData?.linescore?.outs || 0,
      baseRunners: {
        first: gameData.liveData?.linescore?.offense?.first || false,
        second: gameData.liveData?.linescore?.offense?.second || false,
        third: gameData.liveData?.linescore?.offense?.third || false
      },
      batter: gameData.liveData?.boxscore?.teams?.away?.batters?.[0] || 'Unknown',
      situation: alert.payload.message || 'Alert',
      lastUpdate: new Date(),
      status: 'LIVE'
    };

    liveAlerts.set(alert.id, alertState);
    console.log(`🤖 OpenAI now monitoring alert: ${alert.id}`);
  }

  /**
   * STEP 3: Check for situation changes and update alerts
   */
  async monitorLiveAlerts(currentGameStates: Map<string, any>): Promise<Alert[]> {
    const updatedAlerts: Alert[] = [];

    for (const [alertId, alertState] of Array.from(liveAlerts.entries())) {
      const currentGame = currentGameStates.get(alertState.gamePk);
      
      if (!currentGame || currentGame.status.abstractGameState !== 'Live') {
        // Game ended - expire the alert
        alertState.status = 'EXPIRED';
        alertState.lastUpdate = new Date();
        
        const expiredAlert = await this.createStatusUpdate(alertState, 'Game finished!');
        if (expiredAlert) updatedAlerts.push(expiredAlert);
        
        // Remove from monitoring after 5 minutes
        setTimeout(() => liveAlerts.delete(alertId), 5 * 60 * 1000);
        continue;
      }

      // Check if situation changed
      const currentRunners = {
        first: currentGame.liveData?.linescore?.offense?.first || false,
        second: currentGame.liveData?.linescore?.offense?.second || false,
        third: currentGame.liveData?.linescore?.offense?.third || false
      };

      const currentInning = currentGame.liveData?.linescore?.currentInning || 1;
      const currentOuts = currentGame.liveData?.linescore?.outs || 0;

      // Detect significant changes
      const runnersChanged = JSON.stringify(currentRunners) !== JSON.stringify(alertState.baseRunners);
      const inningChanged = currentInning !== alertState.inning;
      const outsChanged = currentOuts !== alertState.outs;

      if (runnersChanged || inningChanged || outsChanged) {
        // Situation changed - update the alert
        alertState.baseRunners = currentRunners;
        alertState.inning = currentInning;
        alertState.outs = currentOuts;
        alertState.status = 'UPDATED';
        alertState.lastUpdate = new Date();

        const updatedAlert = await this.createStatusUpdate(alertState, 'Situation changed!');
        if (updatedAlert) updatedAlerts.push(updatedAlert);
      }
    }

    return updatedAlerts;
  }

  /**
   * Create an updated alert with new status
   */
  private async createStatusUpdate(alertState: LiveAlertState, reason: string): Promise<Alert | null> {
    try {
      const runnersText = this.formatRunnerSituation(alertState.baseRunners);
      const statusEmoji = alertState.status === 'EXPIRED' ? '⏰' : '🔄';
      
      const prompt = `Update this baseball alert because the situation changed:

ORIGINAL SITUATION: "${alertState.situation}"
NEW STATUS: ${alertState.status}
CURRENT RUNNERS: ${runnersText}
INNING: ${alertState.inning} ${alertState.halfInning}
OUTS: ${alertState.outs}
REASON: ${reason}

Create an exciting updated message using "13-year-old test". Start with ${statusEmoji} and make it clear this is an update. Keep under 120 characters.

Respond with ONLY the updated message.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.8
      });

      const updatedMessage = response.choices[0].message.content?.trim();
      if (!updatedMessage) return null;

      return {
        id: `${alertState.alertId}-${alertState.status.toLowerCase()}-${Date.now()}`,
        alertKey: `openai-update-${Date.now()}`,
        sport: 'MLB',
        gameId: alertState.gamePk,
        type: 'LIVE_UPDATE',
        state: alertState.status,
        score: 95,
        payload: {
          message: updatedMessage,
          team: '', // Will be populated by caller
          confidence: 95,
          gamePk: alertState.gamePk,
          originalAlertId: alertState.alertId,
          status: alertState.status,
          openaiMonitored: true
        },
        createdAt: alertState.lastUpdate
      };
    } catch (error) {
      console.error('Failed to create status update:', error);
      return null;
    }
  }

  private formatRunnerSituation(runners: { first: boolean; second: boolean; third: boolean }): string {
    const positions = [];
    if (runners.first) positions.push('1st');
    if (runners.second) positions.push('2nd');
    if (runners.third) positions.push('3rd');
    
    if (positions.length === 0) return 'Bases empty';
    if (positions.length === 3) return 'Bases loaded';
    return positions.join(' & ') + ' base' + (positions.length > 1 ? 's' : '');
  }

  /**
   * Get all currently monitored alerts
   */
  getLiveAlerts(): LiveAlertState[] {
    return Array.from(liveAlerts.values());
  }

  /**
   * Stop monitoring a specific alert
   */
  stopMonitoring(alertId: string): void {
    liveAlerts.delete(alertId);
  }
}

export const openaiEnhancer = new OpenAIAlertEnhancer();