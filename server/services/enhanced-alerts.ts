// Enhanced Alert Generator - Professional Sports Alert Format
// Creates detailed alerts matching the professional format from your example

interface BatterProfile {
  name: string;
  homeRuns: number;
  battingAverage: number;
  clutchRating: number;
  profile: 'Power Hitter' | 'Clutch Performer' | 'Contact Hitter' | 'Veteran Leader' | 'Rising Star' | 'Regular Player';
}

interface EnhancedGameContext {
  sport: string;
  awayTeam: string;
  homeTeam: string;
  inning?: number;
  score: { away: number; home: number };
  runnersOn: string[];
  outs: number;
  currentBatter?: BatterProfile;
  situation: string;
  clutchFactor: number;
}

const SAMPLE_BATTERS: BatterProfile[] = [
  { name: 'Shea Langeliers', homeRuns: 25, battingAverage: 0.248, clutchRating: 0.72, profile: 'Power Hitter' },
  { name: 'Mike Trout', homeRuns: 35, battingAverage: 0.285, clutchRating: 0.88, profile: 'Clutch Performer' },
  { name: 'Freddie Freeman', homeRuns: 22, battingAverage: 0.295, clutchRating: 0.75, profile: 'Veteran Leader' },
  { name: 'Ronald Acuña Jr.', homeRuns: 28, battingAverage: 0.275, clutchRating: 0.82, profile: 'Rising Star' },
  { name: 'Jose Altuve', homeRuns: 15, battingAverage: 0.310, clutchRating: 0.68, profile: 'Contact Hitter' },
  { name: 'Vladimir Guerrero Jr.', homeRuns: 30, battingAverage: 0.272, clutchRating: 0.76, profile: 'Power Hitter' },
  { name: 'Trea Turner', homeRuns: 18, battingAverage: 0.298, clutchRating: 0.70, profile: 'Contact Hitter' },
  { name: 'Aaron Judge', homeRuns: 42, battingAverage: 0.267, clutchRating: 0.85, profile: 'Power Hitter' }
];

export function generateEnhancedAlert(gameContext: EnhancedGameContext): {
  title: string;
  description: string;
  aiContext: string;
  type: string;
} | null {
  const { awayTeam, homeTeam, inning = 8, runnersOn, outs, score } = gameContext;
  
  // Only generate RISP alerts when there are actually runners in scoring position
  const hasRISP = runnersOn.includes('2B') || runnersOn.includes('3B');
  if (!hasRISP) {
    return null;
  }

  // Select a random batter for this alert
  const currentBatter = SAMPLE_BATTERS[Math.floor(Math.random() * SAMPLE_BATTERS.length)];
  
  // Check if this is a high-leverage situation (7th+ inning)
  if (inning < 7) {
    return null;
  }

  // Generate the professional alert format
  const title = `${awayTeam} @ ${homeTeam}`;
  
  let description = '';
  let alertType = 'RISP Alert';

  if (currentBatter.profile === 'Power Hitter' && currentBatter.homeRuns >= 20) {
    description = `⚡️ Power Hitter + RISP in ${inning}${inning === 8 ? 'th' : inning === 9 ? 'th' : 'th'}+ Inning!\n`;
    description += `${currentBatter.name} (${currentBatter.homeRuns} HRs) COMING UP with RISP in inning ${inning}!\n`;
    description += `🚨 HIGH clutch situation!`;
    alertType = 'Power + RISP';
  } else if (currentBatter.clutchRating >= 0.75) {
    description = `🎯 Clutch Performer + RISP in ${inning}${inning === 8 ? 'th' : 'th'}+ Inning!\n`;
    description += `${currentBatter.name} (.${Math.round(currentBatter.battingAverage * 1000)}, ${Math.round(currentBatter.clutchRating * 100)}% clutch) at bat with RISP!\n`;
    description += `⚡ PRIME scoring opportunity!`;
    alertType = 'Clutch + RISP';
  } else {
    description = `⚾ ${currentBatter.profile} + RISP in ${inning}${inning === 8 ? 'th' : 'th'}+ Inning!\n`;
    description += `${currentBatter.name} (.${Math.round(currentBatter.battingAverage * 1000)}, ${currentBatter.homeRuns} HR) up with runners in scoring position!\n`;
    description += `📈 Good scoring chance!`;
    alertType = 'RISP Alert';
  }

  // Generate AI analysis context
  let aiContext = '';
  if (currentBatter.clutchRating >= 0.80) {
    aiContext = `🔮 Clutch Analysis: ${currentBatter.name} excels in high-pressure situations with an ${Math.round(currentBatter.clutchRating * 100)}% clutch rating. Likely delivers a productive at-bat, advancing runner or reaching base.`;
  } else if (currentBatter.homeRuns >= 25) {
    aiContext = `🔮 Power Analysis: ${currentBatter.name} is a proven power threat with ${currentBatter.homeRuns} home runs this season. Strong chance for extra-base hit or RBI opportunity in this situation.`;
  } else if (currentBatter.battingAverage >= 0.290) {
    aiContext = `🔮 Contact Analysis: ${currentBatter.name} has excellent contact skills (.${Math.round(currentBatter.battingAverage * 1000)} avg). High probability of putting ball in play and advancing runners.`;
  } else {
    aiContext = `🔮 Situation Analysis: Late-inning RISP situation with ${currentBatter.name} at the plate. Moderate scoring probability based on game context and batter profile.`;
  }

  return {
    title,
    description,
    aiContext,
    type: alertType
  };
}

export function generateRandomEnhancedGameContext(): EnhancedGameContext {
  const teams = [
    'Los Angeles Angels', 'Athletics', 'Chicago Cubs', 'Milwaukee Brewers',
    'New York Yankees', 'Boston Red Sox', 'Houston Astros', 'Seattle Mariners',
    'Atlanta Braves', 'Philadelphia Phillies', 'Los Angeles Dodgers', 'San Francisco Giants'
  ];
  
  const awayTeam = teams[Math.floor(Math.random() * teams.length)];
  let homeTeam = teams[Math.floor(Math.random() * teams.length)];
  while (homeTeam === awayTeam) {
    homeTeam = teams[Math.floor(Math.random() * teams.length)];
  }

  // Generate realistic late-inning scenarios
  const inning = Math.random() < 0.7 ? 8 : 9; // Favor 8th inning
  
  // Create RISP situations
  const runnersOn = [];
  if (Math.random() < 0.6) runnersOn.push('2B'); // 60% chance of runner on 2nd
  if (Math.random() < 0.4) runnersOn.push('3B'); // 40% chance of runner on 3rd
  if (Math.random() < 0.3) runnersOn.push('1B'); // 30% chance of runner on 1st

  return {
    sport: 'MLB',
    awayTeam,
    homeTeam,
    inning,
    score: {
      away: Math.floor(Math.random() * 6),
      home: Math.floor(Math.random() * 6)
    },
    runnersOn,
    outs: Math.floor(Math.random() * 3),
    situation: 'Late Inning RISP',
    clutchFactor: Math.random() * 0.4 + 0.6 // 0.6 to 1.0
  };
}