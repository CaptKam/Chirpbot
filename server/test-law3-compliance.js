
const { storage } = require('./storage');
const { sendTelegramAlert } = require('./services/telegram');

async function testLaw3Compliance() {
  console.log('⚖️  LAW #3 COMPLIANCE TEST');
  console.log('Testing: Same messages on alerts page are sent to Telegram');
  console.log('=' .repeat(60));
  
  try {
    // 1. Get recent alerts from database (what appears on alerts page)
    const alertsPageAlerts = await storage.db.execute(`
      SELECT id, type, sport, payload, created_at
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📄 ALERTS PAGE - Recent alerts: ${alertsPageAlerts.rows.length}`);
    alertsPageAlerts.rows.forEach((alert, i) => {
      const payload = JSON.parse(alert.payload);
      console.log(`${i+1}. ${alert.type} - "${payload.message}" (${alert.created_at})`);
    });
    
    // 2. Test Telegram sending for each alert
    console.log(`\n📱 TELEGRAM TEST - Sending same alerts:`);
    
    const testUser = await storage.db.execute(`
      SELECT * FROM users 
      WHERE telegram_enabled = true 
      AND telegram_bot_token IS NOT NULL 
      AND telegram_chat_id IS NOT NULL
      LIMIT 1
    `);
    
    if (testUser.rows.length === 0) {
      console.log('❌ No users with Telegram configured for testing');
      return;
    }
    
    const user = testUser.rows[0];
    console.log(`Testing with user: ${user.username}`);
    
    // Send first 3 alerts to Telegram to test
    for (let i = 0; i < Math.min(3, alertsPageAlerts.rows.length); i++) {
      const alert = alertsPageAlerts.rows[i];
      const payload = JSON.parse(alert.payload);
      
      const telegramConfig = {
        botToken: user.telegram_bot_token,
        chatId: user.telegram_chat_id
      };
      
      const telegramAlert = {
        type: alert.type,
        title: `${alert.type} Alert Test`,
        description: payload.message,
        gameInfo: {
          homeTeam: payload.context?.homeTeam || 'Test Home',
          awayTeam: payload.context?.awayTeam || 'Test Away',
          score: { 
            home: payload.context?.homeScore || 0, 
            away: payload.context?.awayScore || 0 
          },
          inning: payload.context?.inning || 1,
          inningState: payload.context?.isTopInning ? 'top' : 'bottom',
          outs: payload.context?.outs || 0,
          runners: {
            first: payload.context?.hasFirst || false,
            second: payload.context?.hasSecond || false,
            third: payload.context?.hasThird || false
          }
        }
      };
      
      console.log(`\n${i+1}. Sending ${alert.type} alert to Telegram...`);
      console.log(`   Message: "${payload.message}"`);
      
      try {
        const sent = await sendTelegramAlert(telegramConfig, telegramAlert);
        console.log(`   Result: ${sent ? '✅ SENT' : '❌ FAILED'}`);
      } catch (error) {
        console.log(`   Result: ❌ ERROR - ${error.message}`);
      }
      
      // Wait 1 second between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n⚖️  LAW #3 SUMMARY:`);
    console.log(`- Alerts on page: ${alertsPageAlerts.rows.length}`);
    console.log(`- Telegram tests: ${Math.min(3, alertsPageAlerts.rows.length)}`);
    console.log(`- Both should have identical messages`);
    
  } catch (error) {
    console.error('❌ Law #3 test failed:', error);
  }
}

testLaw3Compliance();
