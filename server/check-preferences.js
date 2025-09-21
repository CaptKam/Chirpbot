const { db } = require('./db');
const { userAlertPreferences } = require('../shared/schema');

async function checkUserPreferences() {
  try {
    console.log('🔍 Checking user alert preferences...');

    const preferences = await db.select().from(userAlertPreferences);
    console.log(`Found ${preferences.length} user preferences`);

    for (const pref of preferences) {
      console.log(`User ${pref.userId}: ${pref.sport} ${pref.alertType} = ${pref.enabled}`);
    }

  } catch (error) {
    console.error('❌ Error checking preferences:', error);
  }
}

if (require.main === module) {
  checkUserPreferences().then(() => {
    console.log('✅ Preference check complete');
    process.exit(0);
  });
}

module.exports = { checkUserPreferences };