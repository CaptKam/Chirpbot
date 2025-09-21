// Test file for GamblingInsightsComposer
import { gamblingInsightsComposer } from './services/gambling-insights-composer';
import { AlertResult } from '../shared/schema';

// Test data for each sport
const testAlerts = {
  MLB: {
    alertKey: 'test_mlb_alert',
    type: 'MLB_FIRST_AND_THIRD_ONE_OUT',
    message: 'Test MLB alert',
    context: {},
    priority: 80
  } as AlertResult,
  
  NFL: {
    alertKey: 'test_nfl_alert',
    type: 'NFL_RED_ZONE',
    message: 'Test NFL alert',
    context: {},
    priority: 85
  } as AlertResult,
  
  NBA: {
    alertKey: 'test_nba_alert',
    type: 'NBA_CLUTCH_PERFORMANCE',
    message: 'Test NBA alert',
    context: {},
    priority: 90
  } as AlertResult,
  
  CFL: {
    alertKey: 'test_cfl_alert',
    type: 'CFL_ROUGE_OPPORTUNITY',
    message: 'Test CFL alert',
    context: {},
    priority: 82
  } as AlertResult
};

const testGameStates = {
  MLB: {
    sport: 'MLB',
    gameId: 'test_mlb_game',
    homeTeam: 'Yankees',
    awayTeam: 'Red Sox',
    homeScore: 4,
    awayScore: 3,
    status: 'live',
    isLive: true,
    inning: 7,
    isTopInning: false,
    hasFirst: true,
    hasSecond: false,
    hasThird: true,
    outs: 1,
    balls: 2,
    strikes: 1,
    currentBatter: 'Aaron Judge',
    onDeckBatter: 'Giancarlo Stanton',
    currentPitcher: 'Chris Sale',
    pitchCount: 95,
    weatherContext: {
      windSpeed: 15,
      windDirection: 'out to center',
      temperature: 72,
      conditions: 'clear'
    }
  },
  
  NFL: {
    sport: 'NFL',
    gameId: 'test_nfl_game',
    homeTeam: 'Chiefs',
    awayTeam: 'Patriots',
    homeScore: 21,
    awayScore: 17,
    status: 'live',
    isLive: true,
    quarter: 4,
    down: 3,
    yardsToGo: 7,
    fieldPosition: 15,
    timeRemaining: '2:47',
    possession: 'Patriots',
    turnovers: { home: 1, away: 0, differential: -1 },
    weatherContext: {
      windSpeed: 18,
      windDirection: 'crosswind',
      temperature: 38,
      conditions: 'light snow'
    }
  },
  
  NBA: {
    sport: 'NBA',
    gameId: 'test_nba_game',
    homeTeam: 'Lakers',
    awayTeam: 'Celtics',
    homeScore: 108,
    awayScore: 105,
    status: 'live',
    isLive: true,
    quarter: 4,
    timeRemaining: '1:23',
    fouls: { home: 6, away: 4 },
    timeouts: { home: 1, away: 2 },
    recentScoring: { home: 8, away: 2, timeframe: 'last 3 minutes' },
    starPlayers: [
      { name: 'LeBron James', position: 'F', performance: 'triple-double watch' },
      { name: 'Jayson Tatum', position: 'F', performance: '32 points' }
    ]
  },
  
  CFL: {
    sport: 'CFL',
    gameId: 'test_cfl_game',
    homeTeam: 'Argonauts',
    awayTeam: 'Alouettes',
    homeScore: 24,
    awayScore: 21,
    status: 'live',
    isLive: true,
    quarter: 4,
    down: 3,
    yardsToGo: 12,
    fieldPosition: 38,
    timeRemaining: '4:15',
    possession: 'Alouettes'
  }
};

const testWeatherData = {
  windSpeed: 22,
  windDirection: 'strong crosswind',
  temperature: 45,
  conditions: 'heavy rain',
  severity: 'high' as const
};

// Run tests
async function testGamblingInsightsComposer() {
  console.log('🧪 Testing GamblingInsightsComposer Service...\n');
  
  for (const [sport, alert] of Object.entries(testAlerts)) {
    console.log(`🏈 Testing ${sport} Insights:`);
    console.log('=====================================');
    
    try {
      const gameState = testGameStates[sport as keyof typeof testGameStates];
      const weather = sport === 'NFL' ? testWeatherData : undefined;
      
      const insights = gamblingInsightsComposer.compose(alert, gameState, weather);
      
      console.log(`✅ Sport: ${sport}`);
      console.log(`📋 Bullets (${insights.bullets?.length || 0}):`);
      insights.bullets?.forEach((bullet, index) => {
        const wordCount = bullet.split(' ').length;
        console.log(`   ${index + 1}. ${bullet} [${wordCount} words]`);
      });
      
      console.log(`🎯 Confidence: ${Math.round((insights.confidence || 0) * 100)}%`);
      console.log(`🏷️ Tags: ${insights.tags?.join(', ') || 'none'}`);
      
      if (insights.situation) {
        console.log(`📍 Situation: ${insights.situation.context}`);
        console.log(`⚡ Significance: ${insights.situation.significance}`);
        console.log(`⏰ Timing: ${insights.situation.timing}`);
      }
      
      if (insights.weather) {
        console.log(`🌧️ Weather Impact: ${insights.weather.impact}`);
        console.log(`🌤️ Conditions: ${insights.weather.conditions}`);
        console.log(`⚠️ Severity: ${insights.weather.severity}`);
      }
      
      console.log('\n');
      
    } catch (error) {
      console.error(`❌ Error testing ${sport}:`, error);
      console.log('\n');
    }
  }
  
  // Test fallback scenario
  console.log('🔄 Testing Fallback Scenario:');
  console.log('=====================================');
  
  try {
    const unknownSportAlert = {
      alertKey: 'test_unknown_alert',
      type: 'UNKNOWN_SPORT_ALERT',
      message: 'Test unknown sport alert',
      context: {},
      priority: 70
    } as AlertResult;
    
    const unknownGameState = {
      sport: 'HOCKEY', // Not supported
      gameId: 'test_hockey_game',
      homeTeam: 'Rangers',
      awayTeam: 'Bruins',
      homeScore: 2,
      awayScore: 1,
      status: 'live',
      isLive: true
    };
    
    const fallbackInsights = gamblingInsightsComposer.compose(unknownSportAlert, unknownGameState);
    
    console.log(`✅ Fallback test completed`);
    console.log(`📋 Bullets: ${fallbackInsights.bullets?.length || 0}`);
    console.log(`🎯 Confidence: ${Math.round((fallbackInsights.confidence || 0) * 100)}%`);
    console.log(`🏷️ Tags: ${fallbackInsights.tags?.join(', ') || 'none'}`);
    
  } catch (error) {
    console.error(`❌ Error testing fallback:`, error);
  }
  
  console.log('\n🎉 GamblingInsightsComposer tests completed!');
}

// Export for potential use
export { testGamblingInsightsComposer };

// Run tests immediately
testGamblingInsightsComposer().catch(console.error);