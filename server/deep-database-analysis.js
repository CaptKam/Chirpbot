
/**
 * DEPRECATED: Deep Database Analysis Tool
 * 
 * This file is now a backward-compatible wrapper around the unified diagnostics system.
 * For new development, use: server/unified-diagnostics.ts
 * 
 * Original functionality preserved for backward compatibility.
 */

import { runDeepDiagnostics, generateCleanupSQL, toConsole } from './unified-diagnostics.js';
import { writeFileSync } from 'fs';

console.log('⚠️  DEPRECATION NOTICE: This tool has been superseded by unified-diagnostics.ts');
console.log('📝 For new features and better TypeScript support, use: node server/unified-diagnostics.ts --mode=deep');
console.log('');

console.log('🔍 DEEP DATABASE ANALYSIS - Starting comprehensive scan...\n');

async function analyzeDatabase() {
  try {
    // Use the unified diagnostics system for deep analysis
    const results = await runDeepDiagnostics();

    console.log('📊 PHASE 1: Basic Table Statistics');
    console.log('=====================================');
    
    console.log(`📈 Users: ${results.summary.users}`);
    console.log(`📈 Teams: ${results.summary.teams}`);
    console.log(`📈 User Monitored Teams: ${results.summary.userMonitoredTeams}`);
    console.log(`📈 User Alert Preferences: ${results.summary.userAlertPreferences}`);
    console.log(`📈 Global Alert Settings: ${results.summary.globalAlertSettings}\n`);

    console.log('🔍 PHASE 2: Duplicate Detection');
    console.log('================================');

    if (results.duplicates.length > 0) {
      console.log('❌ DUPLICATES FOUND:');
      results.duplicates.forEach(dup => {
        console.log(`   - ${dup.table}: ${dup.value} (${dup.count} entries)`);
      });
    } else {
      console.log('✅ No duplicates found');
    }

    console.log('\n🔍 PHASE 3: Orphaned Records Detection');
    console.log('======================================');

    if (results.orphans.length > 0) {
      console.log('❌ ORPHANED RECORDS FOUND:');
      results.orphans.forEach(orphan => {
        console.log(`   - ${orphan.table}: ${orphan.details}`);
      });
    } else {
      console.log('✅ No orphaned records found');
    }

    console.log('\n🔍 PHASE 4: Data Consistency Checks');
    console.log('===================================');

    if (results.inconsistencies.length > 0) {
      console.log('❌ DATA INCONSISTENCIES FOUND:');
      results.inconsistencies.forEach(inc => {
        console.log(`   - ${inc.table}: ${inc.details}`);
      });
    } else {
      console.log('✅ All data is consistent');
    }

    console.log('\n🔍 PHASE 5: Endpoint Impact Analysis');
    console.log('====================================');

    if (results.mismatches.length > 0) {
      console.log('❌ ENDPOINT MISMATCHES FOUND:');
      results.mismatches.forEach(mis => {
        console.log(`   - ${mis.endpoint}: ${mis.details}`);
      });
    } else {
      console.log('✅ No endpoint conflicts found');
    }

    console.log('\n📊 FINAL SUMMARY');
    console.log('================');
    
    const totalIssues = results.duplicates.length + results.orphans.length + 
                       results.inconsistencies.length + results.mismatches.length;
    
    console.log(`Total Issues Found: ${totalIssues}`);
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

// Auto-cleanup function (preserved original behavior)
async function generateCleanupSQLWrapper(results) {
  console.log('\n🛠️  CLEANUP RECOMMENDATIONS');
  console.log('============================');
  
  if (results.duplicates.length === 0 && results.orphans.length === 0) {
    console.log('✅ No cleanup required - database is clean!');
    return;
  }

  console.log('🧹 Generating cleanup SQL...');
  
  const cleanupSQL = generateCleanupSQL(results);
  writeFileSync('cleanup.sql', cleanupSQL);
  
  console.log('\n📝 Generated cleanup.sql with recommended fixes');
  console.log('💾 Saved cleanup commands to cleanup.sql');
  console.log('\n💡 TIP: Use "node server/unified-diagnostics.ts --mode=deep --cleanup-sql" for streamlined workflow');
}

// Run the analysis (preserved original behavior)
analyzeDatabase()
  .then(async (results) => {
    await generateCleanupSQLWrapper(results);
    console.log('\n✅ Deep database analysis complete!');
    console.log('📝 For JSON output or advanced options, use: node server/unified-diagnostics.ts --mode=deep --json');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    console.error('🔧 Try using the unified diagnostics tool: node server/unified-diagnostics.ts --mode=deep');
    process.exit(1);
  });
