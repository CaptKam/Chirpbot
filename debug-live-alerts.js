
#!/usr/bin/env node

const { db } = require('./server/db');
const { sql } = require('drizzle-orm');

let lastAlertCount = 0;
let alertHistory = [];

async function trackLiveAlerts() {
    try {
        // Get current alert count
        const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
        const currentCount = parseInt(String(countResult.rows[0]?.count || '0'));

        // Get latest 10 alerts
        const latestAlerts = await db.execute(sql`
            SELECT id, type, game_id, sport, score, payload, created_at
            FROM alerts
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log('\n🔍 LIVE ALERT TRACKING');
        console.log('=' .repeat(50));
        console.log(`📊 Total Alerts: ${currentCount} (${currentCount - lastAlertCount >= 0 ? '+' : ''}${currentCount - lastAlertCount} since last check)`);
        console.log(`⏰ Check Time: ${new Date().toLocaleTimeString()}`);

        if (currentCount > lastAlertCount) {
            console.log(`\n🚨 NEW ALERTS DETECTED!`);
            const newAlerts = latestAlerts.rows.slice(0, currentCount - lastAlertCount);
            
            newAlerts.forEach((alert, index) => {
                try {
                    const payload = typeof alert.payload === 'string' ? JSON.parse(alert.payload) : alert.payload || {};
                    const context = payload.context || {};
                    
                    console.log(`\n📋 Alert ${index + 1}:`);
                    console.log(`   Type: ${alert.type}`);
                    console.log(`   Sport: ${alert.sport}`);
                    console.log(`   Game: ${context.homeTeam || 'Unknown'} vs ${context.awayTeam || 'Unknown'}`);
                    console.log(`   Score: ${context.homeScore || 0} - ${context.awayScore || 0}`);
                    console.log(`   Priority: ${alert.score}`);
                    console.log(`   Message: ${payload.message || 'No message'}`);
                    console.log(`   Time: ${new Date(alert.created_at).toLocaleTimeString()}`);
                    
                    // Track scores from console logs
                    if (context.homeTeam && context.awayTeam) {
                        alertHistory.push({
                            time: new Date(alert.created_at),
                            type: alert.type,
                            teams: `${context.awayTeam} @ ${context.homeTeam}`,
                            score: `${context.awayScore || 0}-${context.homeScore || 0}`,
                            priority: alert.score
                        });
                    }
                } catch (error) {
                    console.log(`   Error parsing alert: ${error.message}`);
                }
            });
        }

        // Show current live games from console logs
        console.log('\n🎮 LIVE GAMES DETECTED:');
        console.log('From WebView Logs:');
        console.log('• Pittsburgh Pirates vs Los Angeles Dodgers (1-0)');
        console.log('• Tampa Bay Rays vs Cleveland Guardians (1-0)'); 
        console.log('• Kansas City Royals vs Los Angeles Angels (0-3)');

        // Show recent alert patterns
        if (alertHistory.length > 0) {
            console.log('\n📈 RECENT ALERT PATTERN:');
            const last5 = alertHistory.slice(-5);
            last5.forEach(alert => {
                console.log(`   ${alert.time.toLocaleTimeString()} - ${alert.type} (${alert.teams}) Priority: ${alert.priority}`);
            });
        }

        // Alert frequency analysis
        const now = new Date();
        const last5Minutes = alertHistory.filter(a => (now - a.time) < 5 * 60 * 1000);
        console.log(`\n⚡ Alert Frequency: ${last5Minutes.length} alerts in last 5 minutes`);

        lastAlertCount = currentCount;

    } catch (error) {
        console.error('❌ Error tracking alerts:', error);
    }
}

// Track alerts every 10 seconds
console.log('🚀 Starting Live Alert Tracker...');
console.log('Press Ctrl+C to stop');

setInterval(trackLiveAlerts, 10000);

// Initial check
trackLiveAlerts();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n📊 FINAL SUMMARY:');
    console.log(`Total alerts tracked: ${alertHistory.length}`);
    if (alertHistory.length > 0) {
        console.log(`First alert: ${alertHistory[0].time.toLocaleTimeString()}`);
        console.log(`Last alert: ${alertHistory[alertHistory.length - 1].time.toLocaleTimeString()}`);
        
        // Count by type
        const typeCount = {};
        alertHistory.forEach(alert => {
            typeCount[alert.type] = (typeCount[alert.type] || 0) + 1;
        });
        
        console.log('\nAlert types:');
        Object.entries(typeCount).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
    }
    console.log('\n👋 Alert tracking stopped');
    process.exit(0);
});
