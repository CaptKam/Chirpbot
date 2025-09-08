
import { storage } from './storage.ts';

async function verifyAllUserAlerts() {
  try {
    console.log('🔍 VERIFYING ALL USER ALERT PREFERENCES');
    console.log('=====================================\n');
    
    const allUsers = await storage.getAllUsers();
    const issues = [];
    
    for (const user of allUsers) {
      console.log(`👤 Checking ${user.username}...`);
      
      // Check MLB preferences
      const mlbPrefs = await storage.getUserAlertPreferencesBySport(user.id, 'MLB');
      const enabledMLB = mlbPrefs.filter(p => p.enabled);
      
      if (enabledMLB.length < 9) {
        issues.push({
          user: user.username,
          sport: 'MLB',
          expected: 9,
          actual: enabledMLB.length,
          missing: 9 - enabledMLB.length
        });
      }
      
      // Check NFL preferences
      const nflPrefs = await storage.getUserAlertPreferencesBySport(user.id, 'NFL');
      const enabledNFL = nflPrefs.filter(p => p.enabled);
      
      // Check NCAAF preferences
      const ncaafPrefs = await storage.getUserAlertPreferencesBySport(user.id, 'NCAAF');
      const enabledNCAAF = ncaafPrefs.filter(p => p.enabled);
      
      // Check WNBA preferences
      const wnbaPrefs = await storage.getUserAlertPreferencesBySport(user.id, 'WNBA');
      const enabledWNBA = wnbaPrefs.filter(p => p.enabled);
      
      console.log(`  📊 MLB: ${enabledMLB.length}/9, NFL: ${enabledNFL.length}, NCAAF: ${enabledNCAAF.length}, WNBA: ${enabledWNBA.length}`);
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️ ISSUES FOUND:');
      issues.forEach(issue => {
        console.log(`  ❌ ${issue.user}: ${issue.sport} has ${issue.actual}/${issue.expected} alerts (missing ${issue.missing})`);
      });
      
      console.log('\n🔧 RUN THIS TO FIX: node enable-kameronfrisby-alerts.js');
    } else {
      console.log('\n✅ ALL USERS HAVE CONSISTENT ALERT PREFERENCES');
    }
    
  } catch (error) {
    console.error('❌ Error verifying user alerts:', error);
  }
  
  process.exit(0);
}

verifyAllUserAlerts();
