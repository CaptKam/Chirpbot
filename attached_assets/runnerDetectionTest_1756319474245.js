/*
 * Test script to verify runner detection logic in the MLB engine.
 * This script defines a simplified version of the runner detection
 * algorithm from the patched `mlb-engine.ts` and runs it against
 * several synthetic game states to ensure that runners on base are
 * correctly identified regardless of which data source provides the
 * information. Run this script with `node runnerDetectionTest.js`.
 */

// Simplified runner detection function based on the patched logic
function detectRunners(gameData) {
  const runners = { first: false, second: false, third: false };
  const liveData = gameData.liveData || {};
  const currentPlay = liveData.plays ? liveData.plays.currentPlay : null;

  // situation may contain primary runner flags
  const situation = liveData.situation;
  if (situation) {
    if (situation.isRunnerOnFirst) runners.first = true;
    if (situation.isRunnerOnSecond) runners.second = true;
    if (situation.isRunnerOnThird) runners.third = true;
  }

  // current play runners (start or end positions)
  const currentPlayRunners = currentPlay && currentPlay.runners ? currentPlay.runners : [];
  if (Array.isArray(currentPlayRunners) && currentPlayRunners.length > 0) {
    currentPlayRunners.forEach(runner => {
      if (runner.movement?.start === '1B' || runner.movement?.end === '1B') {
        if (!runner.movement?.isOut) runners.first = true;
      }
      if (runner.movement?.start === '2B' || runner.movement?.end === '2B') {
        if (!runner.movement?.isOut) runners.second = true;
      }
      if (runner.movement?.start === '3B' || runner.movement?.end === '3B') {
        if (!runner.movement?.isOut) runners.third = true;
      }
    });
  }

  // recent plays from allPlays (look at movements)
  const allPlays = liveData.plays && Array.isArray(liveData.plays.allPlays)
    ? liveData.plays.allPlays : [];
  if (allPlays.length > 0) {
    const recentPlays = allPlays.slice(-5);
    recentPlays.forEach(play => {
      if (play.runners && play.runners.length > 0) {
        play.runners.forEach(runner => {
          if (runner.movement?.end === '1B' && !runner.movement?.isOut) runners.first = true;
          if (runner.movement?.end === '2B' && !runner.movement?.isOut) runners.second = true;
          if (runner.movement?.end === '3B' && !runner.movement?.isOut) runners.third = true;
        });
      }
    });
  }

  // linescore offense data
  const offense = liveData.linescore ? liveData.linescore.offense : null;
  if (offense) {
    if (offense.first) runners.first = true;
    if (offense.second) runners.second = true;
    if (offense.third) runners.third = true;
  }

  // parse play description for phrases like "runner on first" or "runners on base"
  if (currentPlay && currentPlay.result && currentPlay.result.description) {
    const desc = currentPlay.result.description.toLowerCase();
    if (desc.includes('runner') || desc.includes('on base')) {
      if (desc.includes('first') || desc.includes('1st')) runners.first = true;
      if (desc.includes('second') || desc.includes('2nd')) runners.second = true;
      if (desc.includes('third') || desc.includes('3rd')) runners.third = true;
    }
  }

  return runners;
}

// Test cases
const testCases = [
  {
    name: 'Situation indicates runner on first',
    input: {
      liveData: {
        situation: { isRunnerOnFirst: true, isRunnerOnSecond: false, isRunnerOnThird: false },
        plays: { currentPlay: null },
        linescore: {},
      },
    },
    expected: { first: true, second: false, third: false },
  },
  {
    name: 'Situation false but currentPlay runner start on 1B',
    input: {
      liveData: {
        situation: { isRunnerOnFirst: false, isRunnerOnSecond: false, isRunnerOnThird: false },
        plays: {
          currentPlay: {
            runners: [ { movement: { start: '1B', end: '2B', isOut: false } } ],
            result: { description: '' },
          },
        },
        linescore: {},
      },
    },
    expected: { first: true, second: true, third: false },
  },
  {
    name: 'Situation undefined but linescore offense indicates first and second',
    input: {
      liveData: {
        plays: { currentPlay: null },
        linescore: { offense: { first: true, second: true, third: false } },
      },
    },
    expected: { first: true, second: true, third: false },
  },
  {
    name: 'Description mentions runner on first',
    input: {
      liveData: {
        situation: { isRunnerOnFirst: false, isRunnerOnSecond: false, isRunnerOnThird: false },
        plays: {
          currentPlay: {
            runners: [],
            result: { description: 'Runner on first advances to second on wild pitch' },
          },
        },
        linescore: {},
      },
    },
    expected: { first: true, second: true, third: false },
  },
  {
    name: 'No runners anywhere',
    input: {
      liveData: {
        situation: { isRunnerOnFirst: false, isRunnerOnSecond: false, isRunnerOnThird: false },
        plays: { currentPlay: null },
        linescore: {},
      },
    },
    expected: { first: false, second: false, third: false },
  },
];

// Execute tests
console.log('Runner detection test results:');
testCases.forEach((test, idx) => {
  const result = detectRunners(test.input);
  const match = JSON.stringify(result) === JSON.stringify(test.expected);
  console.log(`${idx + 1}. ${test.name}`);
  console.log('   Input:', JSON.stringify(test.input, null, 2));
  console.log('   Detected:', result);
  console.log('   Expected:', test.expected);
  console.log('   Match:', match ? 'PASS' : 'FAIL');
});