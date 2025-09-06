
const { NFLApiService } = require('./services/nfl-api.ts');
const { NCAAFApiService } = require('./services/ncaaf-api.ts'); 
const { WNBAApiService } = require('./services/wnba-api.ts');
const { CFLApiService } = require('./services/cfl-api.ts');
const { storage } = require('./storage.ts');

async function testAllSportsEndpoints() {
  console.log('🔍 Testing all sports API endpoints...\n');

  // Test NFL API
  console.log('🏈 Testing NFL API...');
  try {
    const nflApi = new NFLApiService();
    const nflGames = await nflApi.getTodaysGames();
    console.log(`✅ NFL API working - Found ${nflGames.length} games`);
    if (nflGames.length > 0) {
      console.log('   Sample game:', nflGames[0].homeTeam.name, 'vs', nflGames[0].awayTeam.name);
    }
  } catch (error) {
    console.log('❌ NFL API error:', error.message);
  }

  // Test NCAAF API
  console.log('\n🏈 Testing NCAAF API...');
  try {
    const ncaafApi = new NCAAFApiService();
    const ncaafGames = await ncaafApi.getTodaysGames();
    console.log(`✅ NCAAF API working - Found ${ncaafGames.length} games`);
    if (ncaafGames.length > 0) {
      console.log('   Sample game:', ncaafGames[0].homeTeam.name, 'vs', ncaafGames[0].awayTeam.name);
    }
  } catch (error) {
    console.log('❌ NCAAF API error:', error.message);
  }

  // Test WNBA API
  console.log('\n🏀 Testing WNBA API...');
  try {
    const wnbaApi = new WNBAApiService();
    const wnbaGames = await wnbaApi.getTodaysGames();
    console.log(`✅ WNBA API working - Found ${wnbaGames.length} games`);
    if (wnbaGames.length > 0) {
      console.log('   Sample game:', wnbaGames[0].homeTeam.name, 'vs', wnbaGames[0].awayTeam.name);
    }
  } catch (error) {
    console.log('❌ WNBA API error:', error.message);
  }

  // Test CFL API
  console.log('\n🏈 Testing CFL API...');
  try {
    const cflApi = new CFLApiService();
    const cflGames = await cflApi.getTodaysGames();
    console.log(`✅ CFL API working - Found ${cflGames.length} games`);
    if (cflGames.length > 0) {
      console.log('   Sample game:', cflGames[0].homeTeam.name, 'vs', cflGames[0].awayTeam.name);
    }
  } catch (error) {
    console.log('❌ CFL API error:', error.message);
  }

  // Test Global Settings
  console.log('\n⚙️ Testing Global Alert Settings...');
  try {
    const sports = ['NFL', 'NCAAF', 'WNBA', 'CFL'];
    for (const sport of sports) {
      const settings = await storage.getGlobalAlertSettings(sport);
      const enabledCount = Object.values(settings).filter(Boolean).length;
      console.log(`   ${sport}: ${enabledCount} alert types globally enabled`);
    }
  } catch (error) {
    console.log('❌ Global settings error:', error.message);
  }

  // Test User Alert Preferences
  console.log('\n👥 Testing User Alert Preferences...');
  try {
    const users = await storage.getAllUsers();
    console.log(`Found ${users.length} users`);
    
    for (const user of users.slice(0, 2)) { // Test first 2 users
      console.log(`\n   User: ${user.username} (${user.id})`);
      
      const sports = ['NFL', 'NCAAF', 'WNBA', 'CFL'];
      for (const sport of sports) {
        const prefs = await storage.getUserAlertPreferencesBySport(user.id, sport);
        const enabledPrefs = prefs.filter(pref => pref.enabled);
        console.log(`     ${sport}: ${enabledPrefs.length} alert types enabled by user`);
        if (enabledPrefs.length > 0) {
          console.log(`       Types: ${enabledPrefs.map(p => p.alertType).join(', ')}`);
        }
      }
    }
  } catch (error) {
    console.log('❌ User preferences error:', error.message);
  }

  console.log('\n🏁 Sports endpoint test complete!');
}

testAllSportsEndpoints().catch(console.error);
