import type { AlertCandidate } from '../models/contracts';

export async function generateAiNote(alert: AlertCandidate): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('OpenAI API key not configured, skipping AI note generation');
      return null;
    }

    const prompt = buildPromptForAlert(alert);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a sports analytics expert. Provide concise, insightful analysis of game situations in 1-2 sentences. Focus on strategic implications and context that enhances understanding for sports fans.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const aiNote = data.choices?.[0]?.message?.content?.trim();
    
    if (!aiNote) {
      console.warn('No AI note generated from OpenAI response');
      return null;
    }

    console.log(`Generated AI note for ${alert.type}: ${aiNote.substring(0, 50)}...`);
    return aiNote;
    
  } catch (error) {
    console.error('Failed to generate AI note:', error);
    return null;
  }
}

function buildPromptForAlert(alert: AlertCandidate): string {
  const { sport, type, context, phase, situation } = alert;
  
  let prompt = `Analyze this ${sport} alert:\n`;
  prompt += `Type: ${type}\n`;
  prompt += `Phase: ${phase}\n`;
  prompt += `Situation: ${situation}\n`;
  
  if (sport === 'MLB') {
    const { outs, runners, scoreline, inning, batterId, batterOps } = context;
    prompt += `Context: `;
    if (scoreline) prompt += `Score ${scoreline.away}-${scoreline.home}, `;
    if (inning) prompt += `${inning} inning, `;
    if (outs !== undefined) prompt += `${outs} outs, `;
    if (runners) prompt += `runners: ${runners}, `;
    if (batterOps) prompt += `batter OPS: ${batterOps}`;
    
    switch (type) {
      case 'HIGH_SCORING_OPP':
        prompt += `\nWhy is this a high scoring opportunity? What factors make this situation favorable for the offense?`;
        break;
      case 'HOME_RUN':
        prompt += `\nAnalyze the significance of this home run in the current game context.`;
        break;
      case 'BASES_LOADED':
        prompt += `\nWhat are the strategic implications of having bases loaded in this situation?`;
        break;
      default:
        prompt += `\nProvide strategic context for this baseball situation.`;
    }
  }
  
  if (sport === 'NCAAF') {
    const { down, toGo, yardline, scoreline, quarter, timeRemaining } = context;
    prompt += `Context: `;
    if (scoreline) prompt += `Score ${scoreline.away}-${scoreline.home}, `;
    if (quarter) prompt += `Q${quarter}, `;
    if (timeRemaining) prompt += `${timeRemaining} remaining, `;
    if (down && toGo) prompt += `${down} & ${toGo}, `;
    if (yardline) prompt += `at ${yardline} yard line`;
    
    switch (type) {
      case 'RED_ZONE':
        prompt += `\nAnalyze the red zone opportunity and what makes this situation critical.`;
        break;
      case 'TOUCHDOWN':
        prompt += `\nEvaluate the impact of this touchdown on game momentum and strategy.`;
        break;
      case 'TWO_MINUTE_WARNING':
        prompt += `\nWhat are the strategic considerations in this two-minute drill situation?`;
        break;
      default:
        prompt += `\nProvide strategic context for this football situation.`;
    }
  }
  
  if (alert.weatherBucket && alert.weatherBucket !== 'CALM') {
    prompt += `\nWeather: ${alert.weatherBucket}`;
  }
  
  return prompt;
}

export function formatAlertMessage(alert: AlertCandidate): string {
  const { sport, type, context } = alert;
  
  switch (type) {
    case 'HIGH_SCORING_OPP':
      return formatHighScoringOpp(sport, context);
    case 'RED_ZONE':
      return formatRedZone(sport, context);
    case 'HOME_RUN':
      return formatHomeRun(sport, context);
    case 'TOUCHDOWN':
      return formatTouchdown(sport, context);
    case 'BASES_LOADED':
      return formatBasesLoaded(sport, context);
    case 'CLOSE_GAME':
      return formatCloseGame(sport, context);
    default:
      return `${sport} ${type} alert`;
  }
}

function formatHighScoringOpp(sport: string, context: any): string {
  if (sport === 'MLB') {
    const runners = context.runners || 'bases loaded';
    const outs = context.outs !== undefined ? `${context.outs} outs` : '';
    return `High scoring opportunity: ${runners}${outs ? ` with ${outs}` : ''}`;
  }
  return 'High scoring opportunity detected';
}

function formatRedZone(sport: string, context: any): string {
  if (sport === 'NCAAF') {
    const yardline = context.yardline || 'red zone';
    const down = context.down && context.toGo ? ` on ${context.down} & ${context.toGo}` : '';
    return `Red zone opportunity at ${yardline} yard line${down}`;
  }
  return 'Red zone opportunity';
}

function formatHomeRun(sport: string, context: any): string {
  if (context.grandSlam) {
    return 'Grand slam home run!';
  }
  const runners = context.runnersScored;
  if (runners > 1) {
    return `${runners}-run home run`;
  }
  return 'Home run';
}

function formatTouchdown(sport: string, context: any): string {
  const scoringTeam = context.scoringTeam || 'Team';
  return `${scoringTeam} touchdown`;
}

function formatBasesLoaded(sport: string, context: any): string {
  const outs = context.outs !== undefined ? ` with ${context.outs} outs` : '';
  return `Bases loaded${outs}`;
}

function formatCloseGame(sport: string, context: any): string {
  const scoreDiff = context.scoreDiff;
  const timeRemaining = context.timeRemaining || 'late in game';
  return `Close game: ${scoreDiff}-point difference, ${timeRemaining}`;
}