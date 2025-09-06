import { storage } from './storage.js';

async function testLaw3Compliance() {
  try {
    console.log('⚖️ LAW #3 COMPLIANCE TEST');
    console.log('========================\n');
    console.log('Law #3: Same messages on alerts page MUST be sent to Telegram\n');

    // Get recent alerts from database (what appears on alerts page)
    const alertsPageAlerts = await storage.db.execute(`
      SELECT type, COUNT(*) as count, 
             MIN(created_at) as first_seen,
             MAX(created_at) as last_seen
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '2 hours'
      GROUP BY type
      ORDER BY count DESC
    `);

    console.log('📊 ALERTS APPEARING ON ALERTS PAGE (Last 2 hours):');
    console.log('--------------------------------------------------');

    if (alertsPageAlerts.rows.length === 0) {
      console.log('ℹ️ No alerts found in the last 2 hours');
      return;
    }

    // Get global settings to check what's being blocked
    const globalSettings = await storage.getGlobalAlertSettings('MLB');

    let violations = 0;
    let compliant = 0;

    for (const alert of alertsPageAlerts.rows) {
      const alertType = alert.type;
      const alertCount = alert.count;
      const isEnabled = globalSettings[alertType];

      if (isEnabled) {
        console.log(`✅ ${alertType}: ${alertCount} alerts - COMPLIANT (will send to Telegram)`);
        compliant++;
      } else {
        console.log(`❌ ${alertType}: ${alertCount} alerts - VIOLATION (blocked from Telegram)`);
        violations++;
      }
    }

    console.log('\n📈 COMPLIANCE SUMMARY:');
    console.log(`✅ Compliant alert types: ${compliant}`);
    console.log(`❌ Violating alert types: ${violations}`);
    console.log(`📊 Total alert types: ${alertsPageAlerts.rows.length}`);

    const complianceRate = Math.round((compliant / alertsPageAlerts.rows.length) * 100);
    console.log(`🎯 Compliance Rate: ${complianceRate}%`);

    if (violations > 0) {
      console.log('\n⚠️ LAW #3 VIOLATIONS DETECTED!');
      console.log('These alert types appear on the alerts page but are blocked from Telegram.');
      console.log('Run enable-critical-alerts.js to fix these violations.');
    } else {
      console.log('\n🎉 LAW #3 COMPLIANCE: PERFECT!');
      console.log('All alerts appearing on the alerts page are being sent to Telegram.');
    }

  } catch (error) {
    console.error('❌ Law #3 compliance test failed:', error);
  }
}

testLaw3Compliance();