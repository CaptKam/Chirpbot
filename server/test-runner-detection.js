
// Test script to verify runner detection logic works correctly
const testRunnerDetection = () => {
  console.log('🧪 Testing Runner Detection Logic\n');

  // Test Case 1: Situation API provides runner data
  const testCase1 = {
    liveData: {
      situation: {
        isRunnerOnFirst: true,
        isRunnerOnSecond: false,
        isRunnerOnThird: true
      },
      plays: { currentPlay: null },
      linescore: {}
    }
  };

  // Test Case 2: Current play provides runner data
  const testCase2 = {
    liveData: {
      situation: null,
      plays: {
        currentPlay: {
          runners: [
            { movement: { start: '1B', end: '2B', isOut: false } },
            { movement: { start: null, end: '1B', isOut: false } }
          ]
        }
      },
      linescore: {}
    }
  };

  // Test Case 3: Linescore offense provides runner data
  const testCase3 = {
    liveData: {
      situation: null,
      plays: { currentPlay: null },
      linescore: {
        offense: {
          first: true,
          second: true,
          third: false
        }
      }
    }
  };

  const extractRunners = (gameData) => {
    const runners = { first: false, second: false, third: false };
    const liveData = gameData.liveData || {};

    // Method 1: Situation flags
    const situation = liveData.situation;
    if (situation) {
      if (situation.isRunnerOnFirst) runners.first = true;
      if (situation.isRunnerOnSecond) runners.second = true;
      if (situation.isRunnerOnThird) runners.third = true;
      console.log('   Used situation flags');
    }

    // Method 2: Current play runners
    const currentPlay = liveData.plays?.currentPlay;
    if (!situation && currentPlay?.runners) {
      currentPlay.runners.forEach(runner => {
        if (!runner.movement?.isOut) {
          const currentBase = runner.movement?.end || runner.movement?.start;
          if (currentBase === '1B') runners.first = true;
          if (currentBase === '2B') runners.second = true;
          if (currentBase === '3B') runners.third = true;
        }
      });
      console.log('   Used current play runners');
    }

    // Method 3: Linescore offense
    const offense = liveData.linescore?.offense;
    if (!situation && !currentPlay?.runners && offense) {
      if (offense.first) runners.first = true;
      if (offense.second) runners.second = true;
      if (offense.third) runners.third = true;
      console.log('   Used linescore offense');
    }

    return runners;
  };

  console.log('Test 1 - Situation API:');
  console.log('  Expected: 1st=true, 2nd=false, 3rd=true');
  console.log('  Result:', extractRunners(testCase1));

  console.log('\nTest 2 - Current Play:');
  console.log('  Expected: 1st=true, 2nd=true, 3rd=false');
  console.log('  Result:', extractRunners(testCase2));

  console.log('\nTest 3 - Linescore Offense:');
  console.log('  Expected: 1st=true, 2nd=true, 3rd=false');  
  console.log('  Result:', extractRunners(testCase3));
};

// Run the test
testRunnerDetection();
