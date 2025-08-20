
// Lightweight High-Scoring Situation (HSS) gate

export type Hand = 'L'|'R';
export type Level = 1|2|3;

export type Ctx = {
  inning: number; 
  half: 'top'|'bot'; 
  outs: 0|1|2;
  runners: { first: boolean; second: boolean; third: boolean };
  lead: number;                 // batting team lead (+ ahead, - behind)
  li?: number;                  // leverage index (approx ok)
  batter: { id:number; iso:number; hr:number; hand:Hand };
  onDeck: { id:number; iso:number; hr:number; hand:Hand };
  pitcher: { throws:Hand; pitchCount:number; timesThrough:1|2|3|4 };
  wind?: { mph:number; toOF:boolean; toCF:boolean; dirDeg?:number };
  parkHR?: number;              // 100 neutral
  balls?: 0|1|2|3;
  strikes?: 0|1|2;
};

const clamp = (x:number, lo=0, hi=1)=> Math.max(lo, Math.min(hi, x));
const bool = (b:boolean)=> b?1:0;

function baseOutScore(r:Ctx['runners'], outs:0|1|2): number {
  // Tiny proxy for RE24. Tune as needed.
  const f=r.first,s=r.second,t=r.third;
  if (s && t && outs===0) return 1.00;
  if (s && t && outs===1) return 0.85;
  if (f && s && t && outs===1) return 0.90;
  if (t && outs===1 && !f && !s) return 0.70;
  // light defaults
  let v = 0.20;
  if (t) v = Math.max(v, 0.60 - 0.15*outs);
  if (s) v = Math.max(v, 0.45 - 0.10*outs);
  if (f) v = Math.max(v, 0.25 - 0.10*outs);
  return clamp(v);
}

function approxLI(ctx: Ctx): number {
  // If you don't have true LI, approximate.
  const risp = ctx.runners.second || ctx.runners.third;
  const late = ctx.inning >= 7;
  const tight = Math.abs(ctx.lead) <= 1 ? 1.3 : (Math.abs(ctx.lead) === 2 ? 1.1 : 0.9);
  const bo = (ctx.runners.first && ctx.runners.second && ctx.runners.third) ? 1.6 :
             (risp ? 1.2 : 1.0);
  const inningM = late ? 1.4 : 1.0;
  return clamp(bo * tight * inningM, 0.8, 3.0);
}

function powerFlag(ctx: Ctx): boolean {
  const batterPow = ctx.batter.hr >= 25 || ctx.batter.iso >= 0.230;
  const deckPow   = ctx.onDeck.hr >= 20 || ctx.onDeck.iso >= 0.210;
  return batterPow || deckPow;
}

function weatherBoost(ctx: Ctx): {boost:number, favorable:boolean} {
  const wind = ctx.wind ?? { mph:0, toOF:false, toCF:false };
  const toward = wind.toCF || wind.toOF;
  const boost = toward ? clamp(wind.mph / 12, 0, 1) : 0; // ~12 mph → strong effect
  return { boost, favorable: toward && wind.mph >= 8 };
}

function parkBoost(ctx: Ctx): number {
  const park = ctx.parkHR ?? 100; // 100 neutral
  return clamp(park / 110, 0.5, 1); // small nudge
}

export const LEVEL_CFG = {
  thresholds: {
    // Score thresholds for each level
    1: 0.55, // HSS only
    2: 0.58, // HSS + power (score includes power)
    3: 0.60, // HSS + power + weather
  },
  require: {
    1: { power:false, favorableWeather:false },
    2: { power:true,  favorableWeather:false },
    3: { power:true,  favorableWeather:false }, // set to true if you want hard weather gate
  }
};

export function hssScoreByLevel(ctx: Ctx, level: Level): number {
  const li = clamp((ctx.li ?? approxLI(ctx)) / 3, 0, 1);
  const scoreTight = (Math.abs(ctx.lead)<=1)?1:(Math.abs(ctx.lead)===2?0.7:0.2);
  const baseOut = baseOutScore(ctx.runners, ctx.outs);

  // Base features (all levels)
  let score = 0;
  score += 0.30 * baseOut;
  score += 0.15 * li;
  score += 0.10 * scoreTight;

  // Level 2+: power
  if (level >= 2) {
    const batterPower = Math.max(ctx.batter.hr>=25?1:0, clamp(ctx.batter.iso/0.25, 0, 1));
    const onDeckPower = Math.max(ctx.onDeck.hr>=20?1:0, clamp(ctx.onDeck.iso/0.22, 0, 1));
    score += 0.12 * batterPower;
    score += 0.08 * onDeckPower;
    // small leverage nudge if power is up in a good count
    const goodCount = (ctx.balls ?? 0) >= 2 && (ctx.strikes ?? 0) <= 1 ? 0.03 : 0;
    score += goodCount;
  }

  // Level 3: weather + park
  if (level >= 3) {
    const w = weatherBoost(ctx);
    score += 0.10 * w.boost;
    score += 0.03 * parkBoost(ctx);
  }

  // universal small factors (kept cheap)
  const platoon = (ctx.batter.hand !== ctx.pitcher.throws) ? 1 : 0.5;
  const fatigue = clamp((ctx.pitcher.timesThrough>=3?1:0)*0.6 + (ctx.pitcher.pitchCount/100)*0.4);
  score += 0.05 * platoon;
  score += 0.04 * fatigue;

  return clamp(score, 0, 1);
}

export function meetsLevel(level: Level, ctx: Ctx) {
  const sc = hssScoreByLevel(ctx, level);
  const t = LEVEL_CFG.thresholds[level];
  const req = LEVEL_CFG.require[level];
  const weather = weatherBoost(ctx);

  const conditions = {
    hss: true, // baked into score via baseOut + LI + tightness
    power: !req.power || powerFlag(ctx),
    favorableWeather: !req.favorableWeather || weather.favorable,
    thresholdHit: sc >= t
  };

  return {
    ok: conditions.power && conditions.favorableWeather && conditions.thresholdHit,
    score: sc,
    conditions
  };
}

// OPTIONAL: build a compact assistant/system prompt so GPT "understands" the level
export function buildAssistantInstruction(level: Level, ctx: Ctx, score: number): string {
  const lines = [
    `You are an MLB live-innings assistant operating at Level ${level}.`,
    `Only analyze what's in-scope for this level:`,
    level===1
      ? "- Consider base–out state, inning context, leverage/tight score only. Ignore hitter and weather."
      : level===2
      ? "- Consider L1 + current batter and on-deck power (HR totals, ISO, platoon). Ignore weather."
      : "- Consider L2 + weather (wind to OF/CF, strength) and park factors.",
    "",
    "Game snapshot JSON (fields truncated to level scope):",
    JSON.stringify({
      level,
      inning: ctx.inning, half: ctx.half, outs: ctx.outs,
      runners: ctx.runners, lead: ctx.lead, li: ctx.li,
      ...(level>=2 ? { batter: { hr: ctx.batter.hr, iso: ctx.batter.iso, hand: ctx.batter.hand },
                     onDeck: { hr: ctx.onDeck.hr, iso: ctx.onDeck.iso, hand: ctx.onDeck.hand },
                     pitcher: { throws: ctx.pitcher.throws } } : {}),
      ...(level>=3 ? { weather: ctx.wind, parkHR: ctx.parkHR } : {})
    }),
    "",
    "Output a single JSON object: { alert: boolean, priority: number(0-100), title: string, reason: string, factors: string[] }.",
    "Be concise. If alert=false, give the single top reason."
  ];
  return lines.join("\n");
}
