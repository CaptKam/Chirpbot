/**
 * Demo test for the new alert system
 * Run with: npx tsx server/alerts-core/test-demo.ts
 */

import { processFrame } from './index';
import type { Frame } from './types';

console.log('🧪 Testing New Alert System\n');

// Test Case 1: Bases Loaded
const basesLoadedFrame: Frame = {
  gamePk: 12345,
  inning: 7,
  half: 'bottom',
  outs: 2,
  runners: { first: true, second: true, third: true },
  score: { home: 4, away: 3 },
  batterId: null,
  onDeckId: null,
};

console.log('📊 Test 1: Bases Loaded in 7th Inning');
console.log('Input:', JSON.stringify(basesLoadedFrame, null, 2));
const events1 = processFrame(basesLoadedFrame);
console.log('Generated Alerts:', events1.map(e => ({
  type: e.kind,
  title: e.title,
  priority: e.priority
})));
console.log('');

// Test Case 2: Close Game Late Innings
const closeGameFrame: Frame = {
  gamePk: 12346,
  inning: 9,
  half: 'top',
  outs: 0,
  runners: { first: false, second: true, third: false },
  score: { home: 5, away: 4 },
  batterId: null,
  onDeckId: null,
};

console.log('📊 Test 2: Close Game in 9th Inning');
console.log('Input:', JSON.stringify(closeGameFrame, null, 2));
const events2 = processFrame(closeGameFrame);
console.log('Generated Alerts:', events2.map(e => ({
  type: e.kind,
  title: e.title,
  priority: e.priority
})));
console.log('');

// Test Case 3: Blowout (shouldn't generate alerts)
const blowoutFrame: Frame = {
  gamePk: 12347,
  inning: 5,
  half: 'top',
  outs: 1,
  runners: { first: false, second: false, third: false },
  score: { home: 10, away: 2 },
  batterId: null,
  onDeckId: null,
};

console.log('📊 Test 3: Blowout Game (should be quiet)');
console.log('Input:', JSON.stringify(blowoutFrame, null, 2));
const events3 = processFrame(blowoutFrame);
console.log('Generated Alerts:', events3.length === 0 ? 'None (as expected for blowout)' : events3);
console.log('');

// Test Case 4: Deduplication Test (same frame twice)
console.log('📊 Test 4: Deduplication (processing same frame twice)');
const events4a = processFrame(basesLoadedFrame);
const events4b = processFrame(basesLoadedFrame);
console.log('First call alerts:', events4a.length);
console.log('Second call alerts:', events4b.length, '(should be 0 due to deduplication)');

console.log('\n✅ Test Demo Complete!');