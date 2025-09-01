// Mock feed script that fires simulated MLB + NCAAF ticks through the pipeline
import { processRawTick } from '../server/engines/engine-coordinator.js';

// Mock MLB game data
const mockMLBTick = {
  gamePk: 12345,
  status: 'Live',
  homeScore: 3,
  awayScore: 2,
  inning: { half: 'T', num: 7 },
  outs: 1,
  on1: false,
  on2: true,
  on3: true,
  batterId: 'player_123',
  batterHrRate: 0.045,
  batterOps: 0.892,
  venue: {
    lat: 40.8296,
    lon: -73.9262,
    roof: 'OPEN'
  },
  weatherBucket: 'OUT_TO_CF_10_15'
};

// Mock NCAAF game data
const mockNCAAFTick = {
  id: 67890,
  status: 'Live',
  home: 21,
  away: 14,
  period: 4,
  clock: '02:15',
  poss: 'HOME',
  yardline: 18,
  side: 'AWAY',
  down: 3,
  toGo: 5,
  venue: {
    lat: 35.2078,
    lon: -101.8313,
    roof: 'OPEN'
  }
};

async function runMockFeed() {
  console.log('🎮 Starting mock feed...');

  try {
    // Process MLB tick
    console.log('📊 Processing MLB tick...');
    await processRawTick('MLB', '12345', mockMLBTick);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Process NCAAF tick
    console.log('🏈 Processing NCAAF tick...');
    await processRawTick('NCAAF', '67890', mockNCAAFTick);
    
    console.log('✅ Mock feed completed successfully');
  } catch (error) {
    console.error('❌ Mock feed failed:', error);
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runMockFeed().catch(console.error);
}

export { runMockFeed };