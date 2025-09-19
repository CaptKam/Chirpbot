import { db } from './db.js';
import { userAlertPreferences } from '../shared/schema.js';

async function checkPreferences() {
  console.log('🔍 Checking User Alert Preferences...\n');
  
  try {
    // Get all preferences
    const allPrefs = await db.select().from(userAlertPreferences);
    
    console.log(`📊 Total preferences in database: ${allPrefs.length}`);
    
    // Group by user
    const userMap = {};
    for (const pref of allPrefs) {
      if (!userMap[pref.userId]) {
        userMap[pref.userId] = [];
      }
      userMap[pref.userId].push(pref);
    }
    
    // Check each user's preferences
    for (const [userId, prefs] of Object.entries(userMap)) {
      console.log(`\n👤 User: ${userId.substring(0, 8)}...`);
      console.log(`   Total preferences: ${prefs.length}`);
      
      // Group by sport
      const sportMap = {};
      for (const pref of prefs) {
        if (!sportMap[pref.sport]) {
          sportMap[pref.sport] = [];
        }
        sportMap[pref.sport].push(pref);
      }
      
      for (const [sport, sportPrefs] of Object.entries(sportMap)) {
        console.log(`   📍 ${sport}: ${sportPrefs.length} preferences`);
        
        // Check enabled status
        const enabledCount = sportPrefs.filter(p => p.enabled === true).length;
        const disabledCount = sportPrefs.filter(p => p.enabled === false).length;
        const nullCount = sportPrefs.filter(p => p.enabled === null || p.enabled === undefined).length;
        const stringTrueCount = sportPrefs.filter(p => p.enabled === 'true').length;
        const stringFalseCount = sportPrefs.filter(p => p.enabled === 'false').length;
        
        console.log(`      ✅ Enabled (boolean true): ${enabledCount}`);
        console.log(`      ❌ Disabled (boolean false): ${disabledCount}`);
        console.log(`      ❓ Null/Undefined: ${nullCount}`);
        console.log(`      📝 String "true": ${stringTrueCount}`);
        console.log(`      📝 String "false": ${stringFalseCount}`);
        
        // Show sample preferences
        console.log(`      Sample preferences:`);
        sportPrefs.slice(0, 3).forEach(p => {
          console.log(`        - ${p.alertType}: enabled=${p.enabled} (type: ${typeof p.enabled})`);
        });
      }
    }
    
    // Check for data type issues
    console.log('\n🔍 Data Type Analysis:');
    const typeCounts = {};
    for (const pref of allPrefs) {
      const type = typeof pref.enabled;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`   ${type}: ${count} records`);
    }
    
    // Check for problematic alert types
    console.log('\n⚠️ Alert Type Format Check:');
    const doublePrefix = allPrefs.filter(p => p.alertType && p.alertType.includes('.'));
    if (doublePrefix.length > 0) {
      console.log(`   Found ${doublePrefix.length} alert types with dots (possible double prefixes):`);
      const samples = [...new Set(doublePrefix.map(p => p.alertType))].slice(0, 5);
      samples.forEach(s => console.log(`     - ${s}`));
    } else {
      console.log('   ✅ No double-prefixed alert types found');
    }
    
  } catch (error) {
    console.error('❌ Error checking preferences:', error);
  }
}

checkPreferences();