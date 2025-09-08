
import { db } from './db.js';
import { sql } from 'drizzle-orm';
import { users, teams, userMonitoredTeams, userAlertPreferences, globalAlertSettings } from '../shared/schema.js';

console.log('🔍 DEEP DATABASE ANALYSIS - Starting comprehensive scan...\n');

async function analyzeDatabase() {
  const results = {
    duplicates: [],
    orphans: [],
    mismatches: [],
    inconsistencies: [],
    summary: {}
  };

  try {
    console.log('📊 PHASE 1: Basic Table Statistics');
    console.log('=====================================');
    
    // Get basic counts
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const teamCount = await db.execute(sql`SELECT COUNT(*) as count FROM teams`);
    const monitoredCount = await db.execute(sql`SELECT COUNT(*) as count FROM user_monitored_teams`);
    const prefsCount = await db.execute(sql`SELECT COUNT(*) as count FROM user_alert_preferences`);
    const globalCount = await db.execute(sql`SELECT COUNT(*) as count FROM global_alert_settings`);
    
    results.summary = {
      users: parseInt(userCount.rows[0]?.count || 0),
      teams: parseInt(teamCount.rows[0]?.count || 0),
      userMonitoredTeams: parseInt(monitoredCount.rows[0]?.count || 0),
      userAlertPreferences: parseInt(prefsCount.rows[0]?.count || 0),
      globalAlertSettings: parseInt(globalCount.rows[0]?.count || 0)
    };
    
    console.log(`📈 Users: ${results.summary.users}`);
    console.log(`📈 Teams: ${results.summary.teams}`);
    console.log(`📈 User Monitored Teams: ${results.summary.userMonitoredTeams}`);
    console.log(`📈 User Alert Preferences: ${results.summary.userAlertPreferences}`);
    console.log(`📈 Global Alert Settings: ${results.summary.globalAlertSettings}\n`);

    console.log('🔍 PHASE 2: Duplicate Detection');
    console.log('================================');

    // Check for duplicate users
    const duplicateUsers = await db.execute(sql`
      SELECT username, email, COUNT(*) as count 
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateUsers.rows.length > 0) {
      console.log('❌ DUPLICATE USERS FOUND:');
      duplicateUsers.rows.forEach(row => {
        console.log(`   - ${row.username || 'NULL'} / ${row.email || 'NULL'} (${row.count} entries)`);
        results.duplicates.push({
          table: 'users',
          type: 'username/email',
          value: `${row.username || 'NULL'} / ${row.email || 'NULL'}`,
          count: row.count
        });
      });
    } else {
      console.log('✅ No duplicate users found');
    }

    // Check for duplicate teams
    const duplicateTeams = await db.execute(sql`
      SELECT name, sport, external_id, COUNT(*) as count 
      FROM teams 
      GROUP BY name, sport, external_id 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateTeams.rows.length > 0) {
      console.log('❌ DUPLICATE TEAMS FOUND:');
      duplicateTeams.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.sport}) [${row.external_id}] (${row.count} entries)`);
        results.duplicates.push({
          table: 'teams',
          type: 'name/sport/external_id',
          value: `${row.name} (${row.sport}) [${row.external_id}]`,
          count: row.count
        });
      });
    } else {
      console.log('✅ No duplicate teams found');
    }

    // Check for duplicate user monitored teams
    const duplicateMonitored = await db.execute(sql`
      SELECT user_id, game_id, sport, COUNT(*) as count 
      FROM user_monitored_teams 
      GROUP BY user_id, game_id, sport 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateMonitored.rows.length > 0) {
      console.log('❌ DUPLICATE MONITORED TEAMS FOUND:');
      duplicateMonitored.rows.forEach(row => {
        console.log(`   - User ${row.user_id} -> Game ${row.game_id} (${row.sport}) (${row.count} entries)`);
        results.duplicates.push({
          table: 'user_monitored_teams',
          type: 'user_id/game_id/sport',
          value: `User ${row.user_id} -> Game ${row.game_id} (${row.sport})`,
          count: row.count
        });
      });
    } else {
      console.log('✅ No duplicate monitored teams found');
    }

    // Check for duplicate alert preferences
    const duplicatePrefs = await db.execute(sql`
      SELECT user_id, sport, alert_type, COUNT(*) as count 
      FROM user_alert_preferences 
      GROUP BY user_id, sport, alert_type 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatePrefs.rows.length > 0) {
      console.log('❌ DUPLICATE ALERT PREFERENCES FOUND:');
      duplicatePrefs.rows.forEach(row => {
        console.log(`   - User ${row.user_id} -> ${row.sport}.${row.alert_type} (${row.count} entries)`);
        results.duplicates.push({
          table: 'user_alert_preferences',
          type: 'user_id/sport/alert_type',
          value: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`,
          count: row.count
        });
      });
    } else {
      console.log('✅ No duplicate alert preferences found');
    }

    console.log('\n🔍 PHASE 3: Orphaned Records Detection');
    console.log('======================================');

    // Check for orphaned user_monitored_teams
    const orphanedMonitored = await db.execute(sql`
      SELECT umt.id, umt.user_id, umt.game_id 
      FROM user_monitored_teams umt
      LEFT JOIN users u ON umt.user_id = u.id
      WHERE u.id IS NULL
    `);
    
    if (orphanedMonitored.rows.length > 0) {
      console.log('❌ ORPHANED MONITORED TEAMS (no matching user):');
      orphanedMonitored.rows.forEach(row => {
        console.log(`   - ID ${row.id}: User ${row.user_id} -> Game ${row.game_id}`);
        results.orphans.push({
          table: 'user_monitored_teams',
          type: 'missing_user',
          id: row.id,
          details: `User ${row.user_id} -> Game ${row.game_id}`
        });
      });
    } else {
      console.log('✅ No orphaned monitored teams found');
    }

    // Check for orphaned user_alert_preferences
    const orphanedPrefs = await db.execute(sql`
      SELECT uap.id, uap.user_id, uap.sport, uap.alert_type 
      FROM user_alert_preferences uap
      LEFT JOIN users u ON uap.user_id = u.id
      WHERE u.id IS NULL
    `);
    
    if (orphanedPrefs.rows.length > 0) {
      console.log('❌ ORPHANED ALERT PREFERENCES (no matching user):');
      orphanedPrefs.rows.forEach(row => {
        console.log(`   - ID ${row.id}: User ${row.user_id} -> ${row.sport}.${row.alert_type}`);
        results.orphans.push({
          table: 'user_alert_preferences',
          type: 'missing_user',
          id: row.id,
          details: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`
        });
      });
    } else {
      console.log('✅ No orphaned alert preferences found');
    }

    console.log('\n🔍 PHASE 4: Data Consistency Checks');
    console.log('===================================');

    // Check for users with invalid roles
    const invalidRoles = await db.execute(sql`
      SELECT id, username, role 
      FROM users 
      WHERE role NOT IN ('admin', 'manager', 'analyst', 'user')
    `);
    
    if (invalidRoles.rows.length > 0) {
      console.log('❌ USERS WITH INVALID ROLES:');
      invalidRoles.rows.forEach(row => {
        console.log(`   - ${row.username} (${row.id}): "${row.role}"`);
        results.inconsistencies.push({
          table: 'users',
          type: 'invalid_role',
          id: row.id,
          details: `${row.username}: "${row.role}"`
        });
      });
    } else {
      console.log('✅ All user roles are valid');
    }

    // Check for teams with invalid sports
    const validSports = ['MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL'];
    const invalidSports = await db.execute(sql`
      SELECT id, name, sport 
      FROM teams 
      WHERE sport NOT IN ('MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL')
    `);
    
    if (invalidSports.rows.length > 0) {
      console.log('❌ TEAMS WITH INVALID SPORTS:');
      invalidSports.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.id}): "${row.sport}"`);
        results.inconsistencies.push({
          table: 'teams',
          type: 'invalid_sport',
          id: row.id,
          details: `${row.name}: "${row.sport}"`
        });
      });
    } else {
      console.log('✅ All team sports are valid');
    }

    // Check alert preferences with invalid sports
    const invalidPrefSports = await db.execute(sql`
      SELECT id, user_id, sport, alert_type 
      FROM user_alert_preferences 
      WHERE sport NOT IN ('mlb', 'nfl', 'nba', 'nhl', 'ncaaf', 'wnba', 'cfl')
    `);
    
    if (invalidPrefSports.rows.length > 0) {
      console.log('❌ ALERT PREFERENCES WITH INVALID SPORTS:');
      invalidPrefSports.rows.forEach(row => {
        console.log(`   - User ${row.user_id} (${row.id}): "${row.sport}.${row.alert_type}"`);
        results.inconsistencies.push({
          table: 'user_alert_preferences',
          type: 'invalid_sport',
          id: row.id,
          details: `User ${row.user_id}: "${row.sport}.${row.alert_type}"`
        });
      });
    } else {
      console.log('✅ All alert preference sports are valid');
    }

    console.log('\n🔍 PHASE 5: Endpoint Impact Analysis');
    console.log('====================================');

    // Check for potential endpoint conflicts
    const userLoginConflicts = await db.execute(sql`
      SELECT username, email, COUNT(*) as count, array_agg(id) as user_ids
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);

    if (userLoginConflicts.rows.length > 0) {
      console.log('❌ LOGIN ENDPOINT CONFLICTS (duplicate username/email):');
      userLoginConflicts.rows.forEach(row => {
        console.log(`   - ${row.username || 'NULL'} / ${row.email || 'NULL'}: IDs ${JSON.stringify(row.user_ids)}`);
        results.mismatches.push({
          endpoint: '/api/auth/login',
          issue: 'duplicate_credentials',
          details: `${row.username || 'NULL'} / ${row.email || 'NULL'}: IDs ${JSON.stringify(row.user_ids)}`
        });
      });
    } else {
      console.log('✅ No login conflicts found');
    }

    // Check for null/empty critical fields
    const nullUsers = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE username IS NULL AND email IS NULL
    `);
    
    if (parseInt(nullUsers.rows[0]?.count || 0) > 0) {
      console.log(`❌ USERS WITH NULL CREDENTIALS: ${nullUsers.rows[0].count}`);
      results.mismatches.push({
        endpoint: '/api/auth/*',
        issue: 'null_credentials',
        details: `${nullUsers.rows[0].count} users with no username or email`
      });
    } else {
      console.log('✅ No users with null credentials');
    }

    console.log('\n📊 FINAL SUMMARY');
    console.log('================');
    console.log(`Total Issues Found: ${results.duplicates.length + results.orphans.length + results.inconsistencies.length + results.mismatches.length}`);
    console.log(`- Duplicates: ${results.duplicates.length}`);
    console.log(`- Orphaned Records: ${results.orphans.length}`);
    console.log(`- Data Inconsistencies: ${results.inconsistencies.length}`);
    console.log(`- Endpoint Mismatches: ${results.mismatches.length}`);

    return results;

  } catch (error) {
    console.error('❌ Database analysis failed:', error);
    throw error;
  }
}

// Auto-cleanup function
async function generateCleanupSQL(results) {
  console.log('\n🛠️  CLEANUP RECOMMENDATIONS');
  console.log('============================');
  
  const cleanupSQL = [];
  
  // Generate cleanup for duplicates
  if (results.duplicates.length > 0) {
    console.log('🧹 SQL to remove duplicates:');
    results.duplicates.forEach(dup => {
      if (dup.table === 'user_alert_preferences') {
        cleanupSQL.push(`-- Remove duplicate alert preferences for ${dup.value}`);
        cleanupSQL.push(`DELETE FROM user_alert_preferences WHERE id NOT IN (
          SELECT MIN(id) FROM user_alert_preferences 
          GROUP BY user_id, sport, alert_type
        );`);
      }
      // Add more duplicate cleanup logic as needed
    });
  }
  
  // Generate cleanup for orphans
  if (results.orphans.length > 0) {
    console.log('🧹 SQL to remove orphaned records:');
    results.orphans.forEach(orphan => {
      cleanupSQL.push(`-- Remove orphaned ${orphan.table} record: ${orphan.details}`);
      cleanupSQL.push(`DELETE FROM ${orphan.table} WHERE id = '${orphan.id}';`);
    });
  }
  
  if (cleanupSQL.length > 0) {
    const sqlContent = cleanupSQL.join('\n');
    console.log('\n📝 Generated cleanup.sql with recommended fixes');
    
    // Write to file
    const fs = await import('fs');
    fs.writeFileSync('cleanup.sql', sqlContent);
    console.log('💾 Saved cleanup commands to cleanup.sql');
  }
}

// Run the analysis
analyzeDatabase()
  .then(async (results) => {
    await generateCleanupSQL(results);
    console.log('\n✅ Deep database analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
