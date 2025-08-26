import { BaseSportEngine, AlertConfig } from './base-engine';
import { storage } from '../../storage';
import { tennisApi, TennisGameState } from '../tennis-api';
import { sendTelegramAlert } from '../telegram';
import { randomUUID } from 'crypto';
import { enhanceHighPriorityAlert } from '../ai-analysis';
import { alertDeduplication } from '../alert-deduplication';
import crypto from 'crypto';

// --- Types for Tennis edge-triggered system ---
type Side = "home" | "away";

// A stable identity for *this* point, whether or not the feed provides a sequence id
function stablePointKey(s: any) {
  const set = s.currentSet ?? 0;
  const gH = s.gamesInSet?.home ?? 0;
  const gA = s.gamesInSet?.away ?? 0;
  const pH = s.score?.home ?? "-";
  const pA = s.score?.away ?? "-";
  const tbH = s.tbPoints?.home ?? 0;
  const tbA = s.tbPoints?.away ?? 0;
  const sv = s.serving ?? "-";
  const tb = s.isTiebreak ? `TB:${tbH}-${tbA}` : `P:${pH}-${pA}`;
  return `S${set}:G${gH}-${gA}:${tb}:SV${sv}`;
}

// Severity ladder for a single point (rises only): BP (1) → DBP (2) → SP (3) → MP (4)
function computeStage(s: any): 0|1|2|3|4 {
  // Match point?
  const mp = isSetOrMatchPoint(s);
  if (mp?.kind === "match") return 4;
  if (mp?.kind === "set") return 3;

  // Break points (tiebreak has no BP concept)
  if (!s.isTiebreak && s.score) {
    const server: Side | null = s.serving ?? null;
    if (server) {
      const rec: Side = server === "home" ? "away" : "home";
      const sp = s.score[server];
      const rp = s.score[rec];
      const doubleBP = (rp === "40" && (sp === "0" || sp === "15"));
      const singleBP = (rp === "40" && sp === "30") || rp === "Ad" || rp === "ADV";
      if (doubleBP) return 2;
      if (singleBP) return 1;
    }
  }
  return 0;
}

// Set/Match point detector
function isSetOrMatchPoint(s: any): null | { kind: "set"|"match", side: Side } {
  // Tiebreak path
  if (s.isTiebreak) {
    const tbH = s.tbPoints?.home ?? 0;
    const tbA = s.tbPoints?.away ?? 0;
    const lead = tbH - tbA;
    const hPointAway = tbH >= 6 && lead >= 1;
    const aPointAway = tbA >= 6 && -lead >= 1;
    if (hPointAway || aPointAway) {
      const side: Side = hPointAway ? "home" : "away";
      const setsWon = s.sets?.[side] ?? 0;
      const target = 2; // best-of-3 default
      return { kind: (setsWon === target - 1) ? "match" : "set", side };
    }
    return null;
  }
  
  // Non-tiebreak path (game point that clinches set/match)
  for (const side of ["home","away"] as Side[]) {
    if (!s.score) continue;
    const me = s.score[side];
    const op = s.score[side === "home" ? "away" : "home"];
    const atGP = (me === "40" && (op === "0" || op === "15" || op === "30")) || me === "Ad" || me === "ADV";
    if (!atGP) continue;
    
    const myGames = s.gamesInSet?.[side] ?? 0;
    const opGames = s.gamesInSet?.[side === "home" ? "away" : "home"] ?? 0;
    const next = myGames + 1;
    const winsSet = next >= 6 && (next - opGames) >= 2;
    if (!winsSet) continue;
    
    const setsWon = s.sets?.[side] ?? 0;
    const target = 2;
    return { kind: (setsWon === target - 1) ? "match" : "set", side };
  }
  return null;
}

// Format points for display
function formatPoints(s: any): string {
  if (s.isTiebreak) {
    return `${s.tbPoints?.home ?? 0}-${s.tbPoints?.away ?? 0}`;
  }
  return `${s.score?.home ?? '0'}-${s.score?.away ?? '0'}`;
}

// Hash key generator
function hashKey(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex");
}

export class TennisEngine extends BaseSportEngine {
  sport = 'TENNIS';
  monitoringInterval = 2000; // 2 seconds for tennis (faster paced than baseball)
  
  // Stage tracking for edge-triggered alerts
  private lastStage = new Map<string, number>(); // key = matchId + stablePointKey
  
  // Metrics for monitoring
  private metrics = {
    attempts: 0,
    suppressed: 0,
    generated: 0
  };

  extractGameState(apiData: any): TennisGameState {
    return apiData; // Tennis API already returns properly formatted TennisGameState
  }

  getGameSpecificInfo(gameState: TennisGameState): any {
    return {
      players: gameState.players,
      currentSet: gameState.currentSet,
      score: gameState.score,
      gamesInSet: gameState.gamesInSet,
      sets: gameState.sets,
      serving: gameState.serving,
      tournament: gameState.tournament,
      surface: gameState.surface
    };
  }

  buildGameContext(gameState: TennisGameState): any {
    return {
      matchId: gameState.matchId,
      players: gameState.players,
      currentSet: gameState.currentSet,
      score: gameState.score,
      gamesInSet: gameState.gamesInSet,
      sets: gameState.sets,
      serving: gameState.serving,
      tournament: gameState.tournament,
      surface: gameState.surface,
      isBreakPoint: gameState.isBreakPoint,
      isSetPoint: gameState.isSetPoint,
      isMatchPoint: gameState.isMatchPoint,
      isTiebreak: gameState.isTiebreak
    };
  }

  // No longer needed - using edge-triggered system instead
  alertConfigs: AlertConfig[] = [];

  async getLiveMatches(): Promise<TennisGameState[]> {
    try {
      const liveMatches = await tennisApi.getLiveMatches();
      const gameStates: TennisGameState[] = [];

      for (const match of liveMatches) {
        if (match.status === 'live') {
          const gameState = await tennisApi.getMatchDetails(match.matchId);
          if (gameState) {
            gameStates.push(gameState);
          }
        }
      }

      console.log(`🎾 Found ${gameStates.length} live tennis matches`);
      return gameStates;
    } catch (error) {
      console.error('Tennis API error:', error);
      return [];
    }
  }

  async processAlerts(triggeredAlerts: any[], gameState: TennisGameState): Promise<void> {
    // Debug: Log what we're processing
    console.log(`🎾 DEBUG: Processing match ${gameState.matchId} - ${gameState.players?.home?.name || 'Unknown'} vs ${gameState.players?.away?.name || 'Unknown'}`);
    console.log(`🎾 DEBUG: Score: ${gameState.score?.home || '?'}-${gameState.score?.away || '?'}, Set: ${gameState.currentSet || '?'}, Games: ${gameState.gamesInSet?.home || '?'}-${gameState.gamesInSet?.away || '?'}`);
    console.log(`🎾 DEBUG: Serving: ${gameState.serving || 'Unknown'}, Tiebreak: ${gameState.isTiebreak || false}`);
    
    const alerts: any[] = [];
    
    // Edge-triggered alert generation
    const pKey = `${gameState.matchId}:${stablePointKey(gameState)}`;
    const stage = computeStage(gameState);
    const prev = this.lastStage.get(pKey) ?? 0;
    
    // Log point progression for debugging
    console.log(`🎾 DEBUG: Stage calculation - prev: ${prev}, current: ${stage}, stableKey: ${stablePointKey(gameState)}`);
    if (prev !== stage) {
      console.log(JSON.stringify({ t:"STAGE", key: stablePointKey(gameState), prev, stage, matchId: gameState.matchId }));
    }

    // Only act on rising edge
    if (stage > prev) {
      this.lastStage.set(pKey, stage);

      // Map stage to type/priority/title
      const map = {
        1: { type: "TENNIS_BREAK_POINT", prio: 80, title: "Break Point" },
        2: { type: "TENNIS_DOUBLE_BREAK_POINT", prio: 92, title: "Double Break Point" },
        3: { type: "TENNIS_SET_POINT", prio: 93, title: "Set Point" },
        4: { type: "TENNIS_MATCH_POINT", prio: 98, title: "Match Point" },
      } as const;

      const def = (map as any)[stage];
      if (def) {
        // Leverage bump for single BP only (kept feed-only unless late)
        let prio = def.prio;
        if (stage === 1) { // single BP
          const late = Math.max(gameState.gamesInSet?.home || 0, gameState.gamesInSet?.away || 0) >= 9
                    || (gameState.sets?.home === 1 && gameState.sets?.away === 1);
          prio = late ? 88 : 80;
        }

        // Dedup key tied to stable point (so repeated ticks do nothing)
        const dedupKey = `${gameState.matchId}:${def.type}:${stablePointKey(gameState)}`;
        this.metrics.attempts++;
        console.log(JSON.stringify({ t:"ALERT_ATTEMPT", sport:"TENNIS", type: def.type, key: dedupKey, prio }));

        if (!alertDeduplication.shouldAllow(def.type, gameState.matchId, dedupKey, { escalationOnly: true, timeWindow: 15000 })) {
          this.metrics.suppressed++;
        } else {
          alerts.push(this.makeAlert(def.type, def.title, prio,
            `${def.title} • ${formatPoints(gameState)} (${gameState.serving === "home" ? "Serve" : gameState.serving === "away" ? "Return" : "—"})`,
            gameState));
        }
      }
    }

    // Tiebreak Start is also edge-triggered
    const tbKey = `${gameState.matchId}:TB_START:S${gameState.currentSet}`;
    if (gameState.isTiebreak && !this.lastStage.has(tbKey)) {
      this.lastStage.set(tbKey, 1);
      const k = `${gameState.matchId}:TENNIS_TIEBREAK_START:S${gameState.currentSet}`;
      this.metrics.attempts++;
      if (alertDeduplication.shouldAllow("TENNIS_TIEBREAK_START", gameState.matchId, k, { timeWindow: 30000 })) {
        alerts.push(this.makeAlert("TENNIS_TIEBREAK_START", "Tiebreak Start", 80,
          `Tiebreak in Set ${gameState.currentSet} — ${formatPoints(gameState)}`, gameState));
      } else {
        this.metrics.suppressed++;
      }
    }

    // Process generated alerts
    if (alerts.length > 0) {
      console.log(`🎾 Processing ${alerts.length} alerts for match ${gameState.matchId}`);
      
      // Check if any users are monitoring this match
      const monitoringUsers = await this.getUsersMonitoringMatch(gameState.matchId);
      
      if (monitoringUsers.length === 0) {
        console.log(`⏭️ No users monitoring match ${gameState.matchId}, skipping`);
        return;
      }

      console.log(`👥 ${monitoringUsers.length} users monitoring match ${gameState.matchId}: ${monitoringUsers.join(', ')}`);

      for (const alert of alerts) {
        await this.generateAlert(alert, monitoringUsers);
      }
    }
  }

  private async getUsersMonitoringMatch(matchId: string): Promise<string[]> {
    try {
      console.log(`🔍 Looking for users monitoring tennis match: ${matchId}`);
      const allMonitoredGames = await storage.getAllMonitoredGames();
      const matchingUsers = allMonitoredGames
        .filter(game => game.sport === 'TENNIS' && game.gameId === matchId)
        .map(game => game.userId);
      console.log(`👥 Found ${matchingUsers.length} users monitoring match ${matchId}: ${matchingUsers.join(', ')}`);
      return matchingUsers;
    } catch (error) {
      console.error('Error fetching users monitoring tennis match:', error);
      return [];
    }
  }

  private makeAlert(type: string, title: string, priority: number, description: string, gameState: TennisGameState): any {
    return { type, title, priority, description, gameState };
  }

  private async generateAlert(
    alert: { type: string, title: string, priority: number, description: string, gameState: TennisGameState },
    userIds: string[]
  ): Promise<void> {
    const { type, title, priority, description, gameState } = alert;
    const alertId = randomUUID();
    
    // Create rich alert context
    const context = {
      match: {
        players: gameState.players,
        score: gameState.score,
        set: gameState.currentSet,
        games: gameState.gamesInSet,
        serving: gameState.serving,
        tournament: gameState.tournament
      }
    };

    let enhancedDescription = description;
    
    // Enhance description with context
    enhancedDescription = `${enhancedDescription}\n\n${gameState.players.home.name} vs ${gameState.players.away.name}\nSet ${gameState.currentSet}: ${gameState.gamesInSet.home}-${gameState.gamesInSet.away}\nScore: ${gameState.score.home} - ${gameState.score.away}`;
    
    if (gameState.tournament) {
      enhancedDescription += `\n📍 ${gameState.tournament}`;
    }

    // Enhanced AI analysis for high-priority alerts
    if (priority >= 85) {
      try {
        // Convert tennis context to format AI expects
        const aiContext = {
          homeTeam: gameState.players?.home?.name || 'Player 1',
          awayTeam: gameState.players?.away?.name || 'Player 2',
          score: { 
            home: gameState.gamesInSet?.home || 0, 
            away: gameState.gamesInSet?.away || 0 
          },
          inning: `Set ${gameState.currentSet || 1}`,
          outs: undefined
        };
        const aiEnhancement = await enhanceHighPriorityAlert(
          type,
          aiContext,
          enhancedDescription,
          priority
        );
        if (aiEnhancement && aiEnhancement.enhancedDescription) {
          enhancedDescription = aiEnhancement.enhancedDescription;
        }
      } catch (error) {
        console.error('🤖 Advanced AI Enhancement failed:', error);
      }
    }

    // Generate dedup hash for upsert
    const dedupKey = `${gameState.matchId}:${type}:${stablePointKey(gameState)}`;
    const dedupHash = hashKey(dedupKey);

    // Store alert with dedup protection
    const alertData = {
      id: alertId,
      type,
      title: `🎾 ${title}`,
      description: enhancedDescription,
      sport: 'TENNIS' as const,
      priority,
      gameId: gameState.matchId,
      probability: 1.0,
      aiConfidence: null,
      timestamp: new Date(),
      seen: false,
      dedupHash,
      gameInfo: {
        status: 'live',
        homeTeam: gameState.players.home.name,
        awayTeam: gameState.players.away.name,
        quarter: undefined,
        inning: undefined,
        period: undefined,
        inningState: undefined,
        outs: undefined,
        balls: undefined,
        strikes: undefined,
        runners: undefined,
        bases: undefined,
        count: undefined,
        score: {
          home: gameState.gamesInSet?.home || 0,
          away: gameState.gamesInSet?.away || 0
        },
        set: gameState.currentSet,
        gameScore: {
          home: gameState.score?.home || '0',
          away: gameState.score?.away || '0'
        }
      }
    };

    const createdAlert = await storage.createAlert(alertData);
    this.metrics.generated++;

    // Broadcast Tennis alerts over WebSocket
    this.onAlert?.({
      type: 'alert',
      data: createdAlert
    });

    // Send to monitoring users  
    for (const userId of userIds) {
      // Check global tennis alert settings
      const settings = await storage.getSettingsBySport('TENNIS');
      const settingKey = this.getSettingKeyFromType(type);
      if (settings?.alertTypes[settingKey] && settings.telegramEnabled) {
        await sendTelegramAlert(enhancedDescription);
      }
    }

    console.log(`✅ Tennis alert generated: ${type} for match ${gameState.matchId}`);
  }

  async monitor(): Promise<void> {
    try {
      console.log('🎾 Tennis engine monitoring live matches...');
      
      // Get live tennis matches
      const liveMatches = await this.getLiveMatches();
      console.log(`🎾 Found ${liveMatches.length} live tennis matches`);
      console.log(`🎾 DEBUG: First match structure:`, liveMatches[0] ? JSON.stringify(liveMatches[0], null, 2) : 'No matches');
      
      // Load AI settings from database
      const aiSettings = await storage.getAiSettingsBySport('TENNIS');
      
      // Process each live match with edge-triggered alerts
      for (const gameState of liveMatches) {
        console.log(`🎾 PROCESSING: Match ${gameState.matchId}, Set ${gameState.currentSet}, Games ${gameState.gamesInSet?.home}-${gameState.gamesInSet?.away}`);
        try {
          await this.processAlerts([], gameState);
          
          // Try AI opportunity checking (non-blocking) with real database settings
          try {
            console.log(`🤖 AI Check: Match ${gameState.matchId}, enabled: ${aiSettings?.enabled}, betting: ${aiSettings?.bettingOppsEnabled}`);
            if (aiSettings?.bettingOppsEnabled) {
              await this.maybeEmitAIOpportunity(gameState, aiSettings);
            } else {
              console.log(`🤖 AI opportunities disabled for tennis`);
            }
          } catch (aiError) {
            console.error(`🤖 AI opportunity error for match ${gameState.matchId}:`, aiError);
          }
        } catch (error) {
          console.error(`🎾 Error processing match ${gameState.matchId}:`, error);
        }
      }
    } catch (error) {
      console.error('🎾 Tennis monitoring error:', error);
    }
  }

  private getSettingKeyFromType(type: string): string {
    const typeMap: Record<string, string> = {
      'TENNIS_BREAK_POINT': 'breakPoint',
      'TENNIS_DOUBLE_BREAK_POINT': 'doubleBreakPoint', 
      'TENNIS_SET_POINT': 'setPoint',
      'TENNIS_MATCH_POINT': 'matchPoint',
      'TENNIS_TIEBREAK_START': 'tiebreakStart',
      'TENNIS_MOMENTUM_SURGE': 'momentumSurge',
      'TENNIS_AI_OPPORTUNITY': 'aiOpportunity'
    };
    return typeMap[type] || 'unknown';
  }

  private detectMomentumShift(state: TennisGameState): boolean {
    // Simple momentum detection - can be enhanced with more sophisticated logic
    const { gamesInSet, score } = state;
    
    // Close games (5-5, 4-4, etc.) with important points
    const isCloseSet = Math.abs(gamesInSet.home - gamesInSet.away) <= 1;
    const isImportantPoint = score.home === '40' || score.away === '40' || 
                            score.home === 'ADV' || score.away === 'ADV' ||
                            score.home === 'DEUCE';
    
    return isCloseSet && isImportantPoint;
  }

  // AI cooldown tracking
  private aiCooldown = new Map<string, number>(); // key = `${matchId}:${set}`

  async maybeEmitAIOpportunity(s: TennisGameState, settings: any) {
    console.log(`🤖 AI Entry: Match ${s.matchId}, Set ${s.currentSet}, Games ${s.gamesInSet?.home ?? 0}-${s.gamesInSet?.away ?? 0}, Score ${s.score?.home}-${s.score?.away}`);
    
    if (!settings?.bettingOppsEnabled) {
      console.log(`🤖 AI disabled: bettingOppsEnabled = ${settings?.bettingOppsEnabled}`);
      return;
    }

    // Per-match cooldown
    const k = `${s.matchId}:${s.currentSet}`;
    const now = Date.now();
    const last = this.aiCooldown.get(k) ?? 0;
    if (now - last < (settings.oppCooldownMs ?? 90000)) return;

    // Enhanced AI gate - focus on high-leverage situations
    const shouldProbeAI = (s: TennisGameState) => {
      const homeGames = s.gamesInSet?.home ?? 0;
      const awayGames = s.gamesInSet?.away ?? 0;
      const gMax = Math.max(homeGames, awayGames);
      const gDiff = Math.abs(homeGames - awayGames);
      
      // High-leverage scenarios:
      const lateInSet = gMax >= 4;                    // 4-4, 5-4, etc.
      const closeGames = gDiff <= 1;                  // Within 1 game
      const setPointScenario = gMax >= 5;             // 5-4, 6-5, etc.
      const criticalMoment = (gMax >= 4 && gDiff <= 2); // 4-2, 5-3, etc.
      
      const shouldTrigger = s.isTiebreak || setPointScenario || (lateInSet && closeGames) || criticalMoment;
      
      console.log(`🤖 AI Gate Check: ${homeGames}-${awayGames}, gMax=${gMax}, diff=${gDiff}, late=${lateInSet}, close=${closeGames}, setPoint=${setPointScenario}, critical=${criticalMoment}, tiebreak=${s.isTiebreak} → ${shouldTrigger}`);
      
      return shouldTrigger;
    };

    if (!shouldProbeAI(s)) {
      console.log(`🤖 AI Gate Failed: shouldProbeAI returned false for match ${s.matchId}`);
      return;
    }
    
    console.log(`🤖 AI Gate Passed: High-leverage situation detected for match ${s.matchId}`);

    // Compose dedup key on stable point id so escalations update in place
    const dedupKey = `${s.matchId}:TENNIS_AI_OPPORTUNITY:${stablePointKey(s)}`;

    if (!alertDeduplication.shouldAllow("TENNIS_AI_OPPORTUNITY", s.matchId, dedupKey, {
      escalationOnly: true, timeWindow: 20000
    })) return;

    // Generate rich AI insight with match details
    let text = "";
    let priority = settings.oppMinPriority ?? 88;
    let confidence = 0.75;

    try {
      const homePlayer = s.players?.home?.name || 'Player 1';
      const awayPlayer = s.players?.away?.name || 'Player 2';
      const homeGames = s.gamesInSet?.home ?? 0;
      const awayGames = s.gamesInSet?.away ?? 0;
      const gameScore = `${s.score?.home || '0'}-${s.score?.away || '0'}`;
      const setScore = `${homeGames}-${awayGames}`;
      
      // Determine situation context
      let situation = "";
      let insight = "";
      
      if (s.isTiebreak) {
        situation = `TIEBREAK ${gameScore}`;
        insight = "Every point crucial - momentum can shift instantly";
        priority = 95;
      } else if (Math.max(homeGames, awayGames) >= 5) {
        const leader = homeGames > awayGames ? homePlayer : awayPlayer;
        const difference = Math.abs(homeGames - awayGames);
        if (difference === 1) {
          situation = `SET POINT PRESSURE - ${setScore}`;
          insight = `${leader} serving for the set - break opportunity critical`;
          priority = 92;
        } else if (difference === 0) {
          situation = `CRUCIAL GAMES - ${setScore}`;
          insight = "Neck and neck - next service game could decide set";
          priority = 90;
        }
      } else if (Math.abs(homeGames - awayGames) <= 1 && Math.max(homeGames, awayGames) >= 4) {
        situation = `HIGH LEVERAGE - ${setScore}`;
        insight = "Close set building tension - watch for momentum shift";
        priority = 88;
      }
      
      text = `🎾 ${homePlayer} vs ${awayPlayer}
Set ${s.currentSet} | ${situation} | Score: ${gameScore}
${s.tournament || 'Tennis Match'} | ${s.surface || 'Hard'} Court

⚡ ${insight}
${s.serving === 'home' ? homePlayer : awayPlayer} serving`;
      
      console.log(`🤖 AI Alert Generated: ${homePlayer} vs ${awayPlayer}, ${situation}`);
    } catch (e) {
      console.error('AI tennis opportunity error:', e);
      return;
    }

    // Respect priority floor
    if (priority < (settings.oppMinPriority ?? 88)) return;

    const alert = {
      id: crypto.randomUUID(),
      type: "TENNIS_AI_OPPORTUNITY",
      title: "AI WATCH",
      description: text,
      priority,
      sport: "TENNIS",
      gameInfo: {
        matchId: s.matchId,
        set: s.currentSet,
        games: s.gamesInSet,
        points: s.isTiebreak ? s.tbPoints : s.score,
        isTiebreak: s.isTiebreak,
        server: s.serving
      },
      createdAt: new Date().toISOString(),
      sentToTelegram: false,
      seen: false,
      dedupHash: dedupKey
    };

    await storage.createAlert(alert);
    this.onAlert?.({ type: "alert", data: alert });   // WS broadcast
    try { await sendTelegramAlert(this.telegramCfg, alert); } catch {}

    this.aiCooldown.set(k, now);
    console.log(`🤖 AI Tennis Opportunity: ${text.split('\n')[0]} for ${s.players?.home?.name} vs ${s.players?.away?.name}`);
  }
}