import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Shield, Zap, Smartphone, ArrowRight } from 'lucide-react';
import { parseISO } from 'date-fns';

// ─── Utilities ───────────────────────────────────────────────

const formatTimeAgo = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    const now = new Date();
    const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  } catch { return 'Unknown'; }
};

const removeNcaafMascot = (teamName: string, sport?: string) => {
  if (!teamName || sport !== 'NCAAF') return teamName;
  const mascots = [
    'Tigers','Bulldogs','Crimson Tide','Volunteers','Gators','Wildcats','Aggies','Longhorns','Sooners',
    'Trojans','Bruins','Cardinal','Fighting Irish','Seminoles','Hurricanes','Cavaliers','Yellow Jackets',
    'Blue Devils','Demon Deacons','Tar Heels','Wolfpack','Orange','Eagles','Panthers','Cardinals',
    'Badgers','Hawkeyes','Cornhuskers','Wolverines','Buckeyes','Nittany Lions','Spartans','Hoosiers',
    'Boilermakers','Terrapins','Scarlet Knights','Golden Gophers','Illini','Horned Frogs','Red Raiders',
    'Mountaineers','Cowboys','Jayhawks','Cyclones','Bears','Ducks','Beavers','Huskies','Cougars',
    'Sun Devils','Utes','Buffaloes','Knights','Bulls','Bearcats','Rebels','Rainbow Warriors','Aztecs',
    'Broncos','Mustangs','Mean Green','Owls','Golden Panthers','Blazers','Roadrunners'
  ];
  for (const m of mascots) if (teamName.endsWith(m)) return teamName.replace(m, '').trim();
  return teamName;
};

const getTeamAbbr = (name: string): string => {
  if (!name) return '???';
  const map: Record<string,string> = {
    'New York Yankees':'NYY','Boston Red Sox':'BOS','Los Angeles Dodgers':'LAD','San Francisco Giants':'SF',
    'Houston Astros':'HOU','Texas Rangers':'TEX','Chicago Cubs':'CHC','St. Louis Cardinals':'STL',
    'Atlanta Braves':'ATL','Philadelphia Phillies':'PHI','San Diego Padres':'SD','Los Angeles Angels':'LAA',
    'Seattle Mariners':'SEA','Toronto Blue Jays':'TOR','Tampa Bay Rays':'TB','Baltimore Orioles':'BAL',
    'Minnesota Twins':'MIN','Cleveland Guardians':'CLE','Detroit Tigers':'DET','Chicago White Sox':'CWS',
    'Kansas City Royals':'KC','Milwaukee Brewers':'MIL','Pittsburgh Pirates':'PIT','Cincinnati Reds':'CIN',
    'Arizona Diamondbacks':'ARI','Colorado Rockies':'COL','Miami Marlins':'MIA','Washington Nationals':'WSH',
    'New York Mets':'NYM','Oakland Athletics':'OAK',
    'Kansas City Chiefs':'KC','Buffalo Bills':'BUF','Philadelphia Eagles':'PHI','Dallas Cowboys':'DAL',
    'San Francisco 49ers':'SF','Green Bay Packers':'GB','Baltimore Ravens':'BAL','Cincinnati Bengals':'CIN',
    'Miami Dolphins':'MIA','New England Patriots':'NE','Los Angeles Rams':'LAR','Los Angeles Chargers':'LAC',
    'Denver Broncos':'DEN','Pittsburgh Steelers':'PIT','Cleveland Browns':'CLE','Detroit Lions':'DET',
    'Minnesota Vikings':'MIN','Chicago Bears':'CHI','Jacksonville Jaguars':'JAX','Tennessee Titans':'TEN',
    'Indianapolis Colts':'IND','Houston Texans':'HOU','New York Giants':'NYG','New York Jets':'NYJ',
    'Washington Commanders':'WAS','Carolina Panthers':'CAR','Tampa Bay Buccaneers':'TB',
    'New Orleans Saints':'NO','Atlanta Falcons':'ATL','Seattle Seahawks':'SEA','Arizona Cardinals':'ARI',
    'Las Vegas Raiders':'LV',
    'Los Angeles Lakers':'LAL','Golden State Warriors':'GSW','Boston Celtics':'BOS','Miami Heat':'MIA',
    'Milwaukee Bucks':'MIL','Denver Nuggets':'DEN','Phoenix Suns':'PHX','Philadelphia 76ers':'PHI',
    'Brooklyn Nets':'BKN','New York Knicks':'NYK','Dallas Mavericks':'DAL','Memphis Grizzlies':'MEM',
    'Sacramento Kings':'SAC','Cleveland Cavaliers':'CLE','Toronto Raptors':'TOR','Chicago Bulls':'CHI',
    'Atlanta Hawks':'ATL','Minnesota Timberwolves':'MIN','Oklahoma City Thunder':'OKC',
    'New Orleans Pelicans':'NOP','Indiana Pacers':'IND','Portland Trail Blazers':'POR',
    'San Antonio Spurs':'SAS','Utah Jazz':'UTA','Orlando Magic':'ORL','Washington Wizards':'WAS',
    'Charlotte Hornets':'CHA','Houston Rockets':'HOU','Detroit Pistons':'DET','Los Angeles Clippers':'LAC',
  };
  return map[name] || name.split(' ').pop()?.substring(0,3).toUpperCase() || name.substring(0,3).toUpperCase();
};

const ord = (n: number) => {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
};

// ─── Sport Design Tokens ─────────────────────────────────────

interface SportToken {
  accent: string;       // Primary accent color
  accentRgb: string;    // RGB values for rgba()
  textClass: string;    // Tailwind text class
  icon: string;         // Sport emoji
}

const sportTokens: Record<string, SportToken> = {
  MLB:   { accent: '#22C55E', accentRgb: '34,197,94',   textClass: 'text-green-400',  icon: '\u26be' },
  NFL:   { accent: '#F97316', accentRgb: '249,115,22',  textClass: 'text-orange-400', icon: '\ud83c\udfc8' },
  NBA:   { accent: '#A855F7', accentRgb: '168,85,247',  textClass: 'text-purple-400', icon: '\ud83c\udfc0' },
  NHL:   { accent: '#06B6D4', accentRgb: '6,182,212',   textClass: 'text-cyan-400',   icon: '\ud83c\udfd2' },
  NCAAF: { accent: '#3B82F6', accentRgb: '59,130,246',  textClass: 'text-blue-400',   icon: '\ud83c\udfc8' },
  WNBA:  { accent: '#EC4899', accentRgb: '236,72,153',  textClass: 'text-pink-400',   icon: '\ud83c\udfc0' },
  CFL:   { accent: '#EF4444', accentRgb: '239,68,68',   textClass: 'text-red-400',    icon: '\ud83c\udfc8' },
};
const defaultToken: SportToken = { accent: '#94A3B8', accentRgb: '148,163,184', textClass: 'text-slate-400', icon: '\u2b50' };

// Computed style helpers using RGB
const bg = (rgb: string, a: number) => `rgba(${rgb},${a})`;

// ─── Team Logo ───────────────────────────────────────────────
// Large circle with gradient ring in sport accent color + inner gradient

function TeamLogo({ name, rgb, size = 64 }: { name: string; rgb: string; size?: number }) {
  const abbr = getTeamAbbr(name);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `conic-gradient(from 180deg, ${bg(rgb,0.4)}, ${bg(rgb,0.1)}, ${bg(rgb,0.4)})`,
        padding: 2,
      }}>
        <div className="w-full h-full rounded-full" style={{
          background: 'linear-gradient(145deg, #1A2030, #0F1520)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: size * 0.22,
            fontWeight: 700,
            color: '#CBD5E1',
            letterSpacing: '0.05em',
          }}>{abbr}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Baseball Diamond SVG ────────────────────────────────────

function DiamondVisual({ first, second, third }: { first?: boolean; second?: boolean; third?: boolean }) {
  const S = 80, M = S/2, D = 11;
  const on = '#22C55E', onB = '#16A34A', off = 'rgba(255,255,255,0.04)', offB = 'rgba(255,255,255,0.18)';
  const base = (x: number, y: number, active?: boolean) => (
    <rect x={x-D/2} y={y-D/2} width={D} height={D}
      fill={active ? on : off} stroke={active ? onB : offB} strokeWidth={active ? 2 : 1.2}
      transform={`rotate(45 ${x} ${y})`} rx={1} />
  );
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
      {/* Field lines */}
      <line x1={M} y1={10} x2={S-10} y2={M} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      <line x1={S-10} y1={M} x2={M} y2={S-10} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      <line x1={M} y1={S-10} x2={10} y2={M} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      <line x1={10} y1={M} x2={M} y2={10} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      {/* Bases */}
      {base(M, S-10)}        {/* Home */}
      {base(S-10, M, first)} {/* 1st */}
      {base(M, 10, second)}  {/* 2nd */}
      {base(10, M, third)}   {/* 3rd */}
    </svg>
  );
}

// ─── Outs Circles ────────────────────────────────────────────

function OutsCircles({ count }: { count: number }) {
  return (
    <div className="flex gap-2">
      {[0,1,2].map(i => (
        <div key={i} className="transition-all duration-300" style={{
          width: 12, height: 12, borderRadius: '50%',
          background: i < count ? '#22C55E' : 'transparent',
          border: `2px solid ${i < count ? '#22C55E' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: i < count ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─── Interface ───────────────────────────────────────────────

interface UniversalAlertProps {
  id: string; type: string; message: string; gameId: string; sport: string;
  homeTeam: string; awayTeam: string; confidence: number; priority: number;
  createdAt: string; homeScore?: number; awayScore?: number; context?: any;
  sentToTelegram?: boolean; weather?: any; gameInfo?: any;
  gamblingInsights?: { structuredTemplate?: string; bullets?: string[]; confidence?: number; tags?: string[] };
  hasComposerEnhancement?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL ALERT CARD
// ═══════════════════════════════════════════════════════════════

export function UniversalAlertCard({ alert }: { alert: UniversalAlertProps; showEnhancements?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const tk = sportTokens[alert.sport] || defaultToken;
  const rgb = tk.accentRgb;
  const isHot = alert.priority > 80;

  // Data extraction
  const ctx = alert.context || {};
  const presentation = ctx.presentation;
  const displayTitle = presentation?.title || alert.message;
  const displayBody = presentation?.body;
  const rawConf = presentation?.confidence || alert.gamblingInsights?.confidence || alert.confidence || 0;
  const confPct = rawConf > 1 ? Math.min(100, Math.round(rawConf)) : Math.round(rawConf * 100);
  const insights = ctx.aiInsights || [];
  const aiTitle = ctx.aiTitle;
  const scoringProb = ctx.scoringProbability;

  const away = removeNcaafMascot(alert.awayTeam, alert.sport);
  const home = removeNcaafMascot(alert.homeTeam, alert.sport);
  const awayAbbr = getTeamAbbr(away);
  const homeAbbr = getTeamAbbr(home);
  const hasScore = alert.awayScore !== undefined && alert.homeScore !== undefined;

  // Runners
  const runners: string[] = [];
  if (ctx.hasFirst) runners.push('1st');
  if (ctx.hasSecond) runners.push('2nd');
  if (ctx.hasThird) runners.push('3rd');
  const runnerText = runners.length === 3 ? 'Bases Loaded' : runners.length > 0 ? `Runners on ${runners.join(' & ')}` : null;

  // Period
  const period = (() => {
    if (alert.sport === 'MLB' && ctx.inning) return `${ctx.isTopInning ? 'Top' : 'Bottom'} ${ord(ctx.inning)}`;
    if (['NFL','NCAAF','CFL','NBA','WNBA'].includes(alert.sport) && ctx.quarter) return `Q${ctx.quarter}${ctx.timeRemaining ? ' \u00b7 ' + ctx.timeRemaining : ''}`;
    if (alert.sport === 'NHL' && ctx.period) return `P${ctx.period}${ctx.timeRemaining ? ' \u00b7 ' + ctx.timeRemaining : ''}`;
    return null;
  })();

  const hasInsightPanel = insights.length > 0 || scoringProb || confPct > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={`rounded-[20px] overflow-hidden ${isHot ? 'animate-glow-pulse' : ''}`}
        style={{
          background: '#0B1018',
          border: `1.5px solid ${bg(rgb, 0.30)}`,
          boxShadow: `0 0 40px ${bg(rgb, 0.10)}, 0 0 80px ${bg(rgb, 0.04)}, 0 4px 24px rgba(0,0,0,0.5)`,
        }}
      >
        {/* ═══ Top accent line — thin gradient bar ═══ */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${tk.accent}, transparent)`,
          opacity: 0.6,
        }} />

        {/* ═══ Header Row ═══ */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
              style={{ background: bg(rgb, 0.12), border: `1px solid ${bg(rgb, 0.20)}` }}>
              {tk.icon}
            </div>
            <span className={`font-display text-xs font-bold uppercase tracking-[0.10em] ${tk.textClass}`}>
              {alert.sport} Live Alert
            </span>
          </div>
          <div className="flex items-center gap-2">
            {alert.sentToTelegram && <Smartphone className="w-3.5 h-3.5 text-blue-400/40" />}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <span className="animate-live-pulse w-[6px] h-[6px] rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              <span className="text-[10px] font-extrabold text-red-400 font-display tracking-widest">LIVE</span>
            </div>
          </div>
        </div>

        {/* ═══ Scoreboard ═══ */}
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center justify-between">
            {/* Away */}
            <div className="flex flex-col items-center gap-2 w-[90px]">
              <TeamLogo name={away} rgb={rgb} size={64} />
              <span className="font-display text-[15px] font-extrabold text-white tracking-wide">{awayAbbr}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-2 flex-1">
              {hasScore ? (
                <>
                  <div className="flex items-baseline gap-4">
                    <span className="animate-roll-up" style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 800,
                      color: '#F8FAFC', letterSpacing: '-0.04em', lineHeight: 1,
                    }}>{alert.awayScore}</span>
                    <span style={{ fontSize: 20, color: '#334155', fontWeight: 300, marginBottom: 4 }}>-</span>
                    <span className="animate-roll-up" style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 800,
                      color: '#F8FAFC', letterSpacing: '-0.04em', lineHeight: 1,
                    }}>{alert.homeScore}</span>
                  </div>
                  {period && (
                    <div className="px-4 py-1.5 rounded-full" style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <span className="font-display text-[11px] font-bold text-slate-400 uppercase tracking-wider">{period}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="font-display text-2xl text-slate-600 font-light">vs</span>
              )}
            </div>

            {/* Home */}
            <div className="flex flex-col items-center gap-2 w-[90px]">
              <TeamLogo name={home} rgb={rgb} size={64} />
              <span className="font-display text-[15px] font-extrabold text-white tracking-wide">{homeAbbr}</span>
            </div>
          </div>
        </div>

        {/* ═══ MLB Diamond Section ═══ */}
        {alert.sport === 'MLB' && (ctx.hasFirst || ctx.hasSecond || ctx.hasThird || ctx.outs !== undefined) && (
          <div className="mx-5 mb-4 rounded-2xl px-5 py-4" style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div className="flex items-center gap-6">
              <DiamondVisual first={ctx.hasFirst} second={ctx.hasSecond} third={ctx.hasThird} />
              <div className="flex flex-col gap-2.5 flex-1">
                {ctx.outs !== undefined && (
                  <div className="flex items-center gap-3">
                    <OutsCircles count={ctx.outs} />
                    <span className="text-[13px] text-slate-400 font-display font-medium">{ctx.outs} Outs</span>
                  </div>
                )}
                {runnerText && (
                  <span className="text-[15px] font-bold text-white font-display leading-tight">{runnerText}</span>
                )}
                {(ctx.balls !== undefined || ctx.strikes !== undefined) && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#34D399', fontWeight: 600 }}>
                    Count: {ctx.balls ?? 0}-{ctx.strikes ?? 0}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ NFL Down & Distance ═══ */}
        {['NFL','NCAAF','CFL'].includes(alert.sport) && ctx.down && (
          <div className="mx-5 mb-4 rounded-2xl px-5 py-3 flex items-center justify-center gap-4 flex-wrap"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="font-display text-sm font-bold text-white px-3 py-1.5 rounded-lg"
              style={{ background: bg(rgb, 0.12), border: `1px solid ${bg(rgb, 0.20)}` }}>
              {ctx.down}{ctx.down===1?'st':ctx.down===2?'nd':ctx.down===3?'rd':'th'} & {ctx.yardsToGo}
            </span>
            {ctx.fieldPosition && (
              <span className="text-sm text-slate-400 font-display font-medium">at {ctx.fieldPosition}</span>
            )}
          </div>
        )}

        {/* ═══ Gambling Insight Panel ═══ */}
        {hasInsightPanel && (
          <div className="mx-5 mb-4 rounded-2xl overflow-hidden" style={{
            border: `1px solid ${bg(rgb, 0.20)}`,
            background: `linear-gradient(180deg, ${bg(rgb, 0.06)}, ${bg(rgb, 0.02)})`,
          }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-2">
              <Shield className={`w-[18px] h-[18px] ${tk.textClass}`} style={{ filter: `drop-shadow(0 0 4px ${bg(rgb, 0.4)})` }} />
              <span className={`font-display text-xs font-extrabold uppercase tracking-[0.12em] ${tk.textClass}`}>
                Gambling Insight
              </span>
            </div>

            {/* Stats */}
            <div className="px-5 pb-3 space-y-2.5">
              {scoringProb && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[13px] text-slate-300 font-display">RE24 Run Expectancy</span>
                  <span className={`${tk.textClass} font-bold`} style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                  }}>+{(scoringProb * 1.69).toFixed(2)} runs</span>
                </div>
              )}
              {confPct > 0 && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[13px] text-slate-300 font-display">Win Probability ({awayAbbr})</span>
                  <span className={`${tk.textClass} font-bold`} style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 15,
                  }}>{confPct}%</span>
                </div>
              )}
              {/* AI bullet insights */}
              {insights.slice(0, expanded ? undefined : 2).map((ins: string, i: number) => (
                <div key={i} className="flex items-start gap-2.5 py-0.5">
                  <Zap className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tk.textClass}`}
                    style={{ filter: `drop-shadow(0 0 3px ${bg(rgb, 0.3)})` }} />
                  <span className="text-[12px] text-slate-300 leading-relaxed font-display">{ins}</span>
                </div>
              ))}
            </div>

            {/* CTA Button — full-width, rounded bottom, gradient */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-3.5 flex items-center justify-center gap-2 font-display text-[14px] font-bold btn-haptic
                         transition-all duration-200 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${tk.accent}, ${bg(rgb, 0.8)})`,
                color: '#fff',
                borderTop: `1px solid ${bg(rgb, 0.3)}`,
                textShadow: `0 1px 2px rgba(0,0,0,0.3)`,
                boxShadow: `0 -1px 0 ${bg(rgb, 0.1)} inset`,
              }}
            >
              {expanded ? 'Hide Details' : 'View Live Odds'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ═══ Expanded Details ═══ */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="px-5 pb-4"
            >
              {ctx.aiCallToAction && (
                <div className="rounded-xl px-4 py-3 text-center mb-3" style={{
                  background: bg(rgb, 0.08), border: `1px solid ${bg(rgb, 0.15)}`,
                }}>
                  <span className={`font-display text-[13px] font-bold ${tk.textClass}`}>
                    {ctx.aiCallToAction}
                  </span>
                </div>
              )}
              {ctx.currentBatter && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-slate-500 font-display">At Bat:</span>
                  <span className="text-[12px] font-bold text-white font-display">{ctx.currentBatter}</span>
                </div>
              )}
              {ctx.currentPitcher && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-display">Pitching:</span>
                  <span className="text-[12px] font-bold text-white font-display">{ctx.currentPitcher}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ Alert Message ═══ */}
        <div className="px-5 pb-4">
          {aiTitle && (
            <div className={`text-[10px] font-extrabold uppercase tracking-[0.10em] ${tk.textClass} font-display mb-1.5`}
              style={{ textShadow: `0 0 12px ${bg(rgb, 0.3)}` }}>
              {aiTitle}
            </div>
          )}
          <div className="text-[14px] font-medium text-slate-200 leading-[1.6] font-display">
            {displayTitle}
          </div>
          {displayBody && (
            <div className="text-[12px] text-slate-400 leading-relaxed mt-1.5 font-display">{displayBody}</div>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <div className="flex items-center justify-between px-5 py-3" style={{
          background: 'rgba(255,255,255,0.015)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] text-slate-500 font-display font-medium">{formatTimeAgo(alert.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {(presentation?.tags || alert.gamblingInsights?.tags || []).slice(0, 2).map((tag: string, idx: number) => (
              <span key={idx} className="text-[9px] text-slate-500 px-2 py-0.5 rounded-full font-display font-medium"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {tag}
              </span>
            ))}
            <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full font-display tracking-wider"
              style={{ background: bg(rgb, 0.10), border: `1px solid ${bg(rgb, 0.18)}`, color: tk.accent }}>
              {alert.sport}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
