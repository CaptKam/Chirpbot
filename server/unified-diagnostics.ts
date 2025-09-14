/**
 * Unified Database Diagnostics System
 * 
 * Consolidates database-diagnostics.js, deep-database-analysis.js, and environment-detector.js
 * into a single TypeScript system with three layers:
 * 
 * Layer 1 - Core Collectors (pure functions, no side effects)
 * Layer 2 - Formatters (console and JSON output)
 * Layer 3 - Adapters (CLI, Express router, library functions)
 */

import { pool, db } from './db.ts';
import { sql } from 'drizzle-orm';
import express from 'express';
import { writeFileSync } from 'fs';

// ========================================
// TYPES AND INTERFACES
// ========================================

export interface DiagnosticsEnv {
  NODE_ENV: string;
  REPL_ID: string;
  DATABASE_URL_EXISTS: boolean;
  PORT: string;
  SESSION_SECRET_EXISTS: boolean;
}

export interface DiagnosticsDb {
  connected: boolean;
  error?: string;
  name?: string;
  version?: string;
  userCount: number;
  tableCount: number;
  alertPreferences: number;
  monitoredTeams: number;
  perTableCounts?: Record<string, number>;
}

export interface BasicStats extends DiagnosticsDb {
  tables: Array<{ name: string; count: number; error?: string }>;
  users: Array<{
    id: string;
    username?: string;
    email?: string;
    role: string;
    authMethod: string;
    createdAt: Date;
  }>;
}

export interface DuplicateIssue {
  table: string;
  type: string;
  value: string;
  count: number;
}

export interface OrphanIssue {
  table: string;
  type: string;
  id: string;
  details: string;
}

export interface InconsistencyIssue {
  table: string;
  type: string;
  id: string;
  details: string;
}

export interface MismatchIssue {
  endpoint: string;
  issue: string;
  details: string;
}

export interface DeepAnalysisResult {
  duplicates: DuplicateIssue[];
  orphans: OrphanIssue[];
  inconsistencies: InconsistencyIssue[];
  mismatches: MismatchIssue[];
  summary: {
    users: number;
    teams: number;
    userMonitoredTeams: number;
    userAlertPreferences: number;
    globalAlertSettings: number;
  };
}

export interface SessionInfo {
  authenticated: boolean;
  sessionId: string;
  user?: any;
}

export interface UnifiedDiagnosticsResult {
  timestamp: string;
  environment: DiagnosticsEnv;
  database: DiagnosticsDb;
  session?: SessionInfo;
  basicStats?: BasicStats;
  deepAnalysis?: DeepAnalysisResult;
  analysis?: {
    likelyEnvironment: string;
    hasUserData: boolean;
    sessionWorking: boolean;
    issueDetected: boolean;
    recommendations: string[];
  };
}

export interface DiagnosticsOptions {
  includeBasicStats?: boolean;
  includeDeepAnalysis?: boolean;
  includeSession?: boolean;
  includeAnalysis?: boolean;
}

export interface FormatOptions {
  showTimestamp?: boolean;
  showRecommendations?: boolean;
  verboseOutput?: boolean;
  sanitizeSecrets?: boolean;
}

export type DiagnosticMode = 'basic' | 'deep' | 'env' | 'all';

export class DiagnosticError extends Error {
  constructor(
    message: string,
    public code: string,
    public safeMessage: string
  ) {
    super(message);
    this.name = 'DiagnosticError';
  }
}

// ========================================
// LAYER 1 - CORE COLLECTORS (Pure Functions)
// ========================================

/**
 * Get environment information (no side effects)
 */
export function getEnvironmentInfo(): DiagnosticsEnv {
  return {
    NODE_ENV: process.env.NODE_ENV || 'not set (defaults to development)',
    REPL_ID: process.env.REPL_ID ? 'set' : 'not set',
    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
    PORT: process.env.PORT || '5000',
    SESSION_SECRET_EXISTS: !!process.env.SESSION_SECRET,
  };
}

/**
 * Test database connection and get basic info
 */
export async function testDbConnection(): Promise<DiagnosticsDb> {
  const result: DiagnosticsDb = {
    connected: false,
    userCount: 0,
    tableCount: 0,
    alertPreferences: 0,
    monitoredTeams: 0,
  };

  try {
    const client = await pool.connect();
    result.connected = true;

    try {
      // Get database name and version
      const dbInfo = await client.query('SELECT current_database(), version()');
      result.name = dbInfo.rows[0].current_database;
      result.version = `${dbInfo.rows[0].version.split(' ')[0]} ${dbInfo.rows[0].version.split(' ')[1]}`;

      // Get basic counts
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      result.userCount = parseInt(userCount.rows[0].count);

      const tableCount = await client.query(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
      );
      result.tableCount = parseInt(tableCount.rows[0].count);

      const alertPrefs = await client.query('SELECT COUNT(*) FROM user_alert_preferences');
      result.alertPreferences = parseInt(alertPrefs.rows[0].count);

      const monitoredTeams = await client.query('SELECT COUNT(*) FROM user_monitored_teams');
      result.monitoredTeams = parseInt(monitoredTeams.rows[0].count);

    } catch (queryError: any) {
      result.error = queryError.message;
    } finally {
      client.release();
    }
  } catch (connError: any) {
    result.error = connError.message;
  }

  return result;
}

/**
 * Get comprehensive database statistics
 */
export async function getBasicDbStats(): Promise<BasicStats> {
  const baseInfo = await testDbConnection();
  
  const result: BasicStats = {
    ...baseInfo,
    tables: [],
    users: [],
  };

  if (!result.connected) {
    return result;
  }

  try {
    const client = await pool.connect();

    try {
      // Get all tables with counts
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      const tables = await client.query(tablesQuery);

      for (const table of tables.rows) {
        const tableName = table.table_name;
        try {
          const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
          result.tables.push({
            name: tableName,
            count: parseInt(count.rows[0].count),
          });
        } catch (err: any) {
          result.tables.push({
            name: tableName,
            count: 0,
            error: err.message,
          });
        }
      }

      // Get user details
      const users = await client.query(
        'SELECT id, username, email, role, "authMethod", "createdAt" FROM users ORDER BY "createdAt"'
      );
      result.users = users.rows.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        authMethod: user.authMethod,
        createdAt: user.createdAt,
      }));

    } finally {
      client.release();
    }
  } catch (error: any) {
    throw new DiagnosticError(
      `Failed to get database stats: ${error.message}`,
      'DB_STATS_ERROR',
      'Database statistics collection failed'
    );
  }

  return result;
}

/**
 * Run comprehensive deep analysis for duplicates, orphans, and inconsistencies
 */
export async function runDeepAnalysis(): Promise<DeepAnalysisResult> {
  const results: DeepAnalysisResult = {
    duplicates: [],
    orphans: [],
    mismatches: [],
    inconsistencies: [],
    summary: {
      users: 0,
      teams: 0,
      userMonitoredTeams: 0,
      userAlertPreferences: 0,
      globalAlertSettings: 0,
    },
  };

  try {
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
      globalAlertSettings: parseInt(globalCount.rows[0]?.count || 0),
    };

    // Check for duplicate users
    const duplicateUsers = await db.execute(sql`
      SELECT username, email, COUNT(*) as count 
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);

    duplicateUsers.rows.forEach((row: any) => {
      results.duplicates.push({
        table: 'users',
        type: 'username/email',
        value: `${row.username || 'NULL'} / ${row.email || 'NULL'}`,
        count: row.count,
      });
    });

    // Check for duplicate teams
    const duplicateTeams = await db.execute(sql`
      SELECT name, sport, external_id, COUNT(*) as count 
      FROM teams 
      GROUP BY name, sport, external_id 
      HAVING COUNT(*) > 1
    `);

    duplicateTeams.rows.forEach((row: any) => {
      results.duplicates.push({
        table: 'teams',
        type: 'name/sport/external_id',
        value: `${row.name} (${row.sport}) [${row.external_id}]`,
        count: row.count,
      });
    });

    // Check for duplicate user monitored teams
    const duplicateMonitored = await db.execute(sql`
      SELECT user_id, game_id, sport, COUNT(*) as count 
      FROM user_monitored_teams 
      GROUP BY user_id, game_id, sport 
      HAVING COUNT(*) > 1
    `);

    duplicateMonitored.rows.forEach((row: any) => {
      results.duplicates.push({
        table: 'user_monitored_teams',
        type: 'user_id/game_id/sport',
        value: `User ${row.user_id} -> Game ${row.game_id} (${row.sport})`,
        count: row.count,
      });
    });

    // Check for duplicate alert preferences
    const duplicatePrefs = await db.execute(sql`
      SELECT user_id, sport, alert_type, COUNT(*) as count 
      FROM user_alert_preferences 
      GROUP BY user_id, sport, alert_type 
      HAVING COUNT(*) > 1
    `);

    duplicatePrefs.rows.forEach((row: any) => {
      results.duplicates.push({
        table: 'user_alert_preferences',
        type: 'user_id/sport/alert_type',
        value: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`,
        count: row.count,
      });
    });

    // Check for orphaned user_monitored_teams
    const orphanedMonitored = await db.execute(sql`
      SELECT umt.id, umt.user_id, umt.game_id 
      FROM user_monitored_teams umt
      LEFT JOIN users u ON umt.user_id = u.id
      WHERE u.id IS NULL
    `);

    orphanedMonitored.rows.forEach((row: any) => {
      results.orphans.push({
        table: 'user_monitored_teams',
        type: 'missing_user',
        id: row.id,
        details: `User ${row.user_id} -> Game ${row.game_id}`,
      });
    });

    // Check for orphaned user_alert_preferences
    const orphanedPrefs = await db.execute(sql`
      SELECT uap.id, uap.user_id, uap.sport, uap.alert_type 
      FROM user_alert_preferences uap
      LEFT JOIN users u ON uap.user_id = u.id
      WHERE u.id IS NULL
    `);

    orphanedPrefs.rows.forEach((row: any) => {
      results.orphans.push({
        table: 'user_alert_preferences',
        type: 'missing_user',
        id: row.id,
        details: `User ${row.user_id} -> ${row.sport}.${row.alert_type}`,
      });
    });

    // Check for users with invalid roles
    const invalidRoles = await db.execute(sql`
      SELECT id, username, role 
      FROM users 
      WHERE role NOT IN ('admin', 'manager', 'analyst', 'user')
    `);

    invalidRoles.rows.forEach((row: any) => {
      results.inconsistencies.push({
        table: 'users',
        type: 'invalid_role',
        id: row.id,
        details: `${row.username}: "${row.role}"`,
      });
    });

    // Check for teams with invalid sports
    const invalidSports = await db.execute(sql`
      SELECT id, name, sport 
      FROM teams 
      WHERE sport NOT IN ('MLB', 'NFL', 'NBA', 'NHL', 'NCAAF', 'WNBA', 'CFL')
    `);

    invalidSports.rows.forEach((row: any) => {
      results.inconsistencies.push({
        table: 'teams',
        type: 'invalid_sport',
        id: row.id,
        details: `${row.name}: "${row.sport}"`,
      });
    });

    // Check alert preferences with invalid sports
    const invalidPrefSports = await db.execute(sql`
      SELECT id, user_id, sport, alert_type 
      FROM user_alert_preferences 
      WHERE sport NOT IN ('mlb', 'nfl', 'nba', 'nhl', 'ncaaf', 'wnba', 'cfl')
    `);

    invalidPrefSports.rows.forEach((row: any) => {
      results.inconsistencies.push({
        table: 'user_alert_preferences',
        type: 'invalid_sport',
        id: row.id,
        details: `User ${row.user_id}: "${row.sport}.${row.alert_type}"`,
      });
    });

    // Check for potential endpoint conflicts
    const userLoginConflicts = await db.execute(sql`
      SELECT username, email, COUNT(*) as count, array_agg(id) as user_ids
      FROM users 
      WHERE username IS NOT NULL OR email IS NOT NULL
      GROUP BY username, email 
      HAVING COUNT(*) > 1
    `);

    userLoginConflicts.rows.forEach((row: any) => {
      results.mismatches.push({
        endpoint: '/api/auth/login',
        issue: 'duplicate_credentials',
        details: `${row.username || 'NULL'} / ${row.email || 'NULL'}: IDs ${JSON.stringify(row.user_ids)}`,
      });
    });

    // Check for null/empty critical fields
    const nullUsers = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE username IS NULL AND email IS NULL
    `);

    if (parseInt(nullUsers.rows[0]?.count || 0) > 0) {
      results.mismatches.push({
        endpoint: '/api/auth/*',
        issue: 'null_credentials',
        details: `${nullUsers.rows[0].count} users with no username or email`,
      });
    }

  } catch (error: any) {
    throw new DiagnosticError(
      `Deep analysis failed: ${error.message}`,
      'DEEP_ANALYSIS_ERROR',
      'Deep database analysis failed'
    );
  }

  return results;
}

/**
 * Generate cleanup SQL from deep analysis results
 */
export function generateCleanupSQL(results: DeepAnalysisResult): string {
  const cleanupSQL: string[] = [];

  if (results.duplicates.length > 0) {
    cleanupSQL.push('-- DUPLICATE CLEANUP');
    cleanupSQL.push('-- WARNING: Review these queries carefully before executing');
    cleanupSQL.push('');

    results.duplicates.forEach((dup) => {
      if (dup.table === 'user_alert_preferences') {
        cleanupSQL.push(`-- Remove duplicate alert preferences for ${dup.value}`);
        cleanupSQL.push(`DELETE FROM user_alert_preferences WHERE id NOT IN (`);
        cleanupSQL.push(`  SELECT MIN(id) FROM user_alert_preferences`);
        cleanupSQL.push(`  GROUP BY user_id, sport, alert_type`);
        cleanupSQL.push(`);`);
        cleanupSQL.push('');
      }
    });
  }

  if (results.orphans.length > 0) {
    cleanupSQL.push('-- ORPHANED RECORDS CLEANUP');
    cleanupSQL.push('-- WARNING: This will permanently delete orphaned data');
    cleanupSQL.push('');

    results.orphans.forEach((orphan) => {
      cleanupSQL.push(`-- Remove orphaned ${orphan.table} record: ${orphan.details}`);
      cleanupSQL.push(`DELETE FROM ${orphan.table} WHERE id = '${orphan.id}';`);
    });
  }

  if (cleanupSQL.length === 0) {
    cleanupSQL.push('-- No cleanup required - database is clean!');
  }

  return cleanupSQL.join('\n');
}

// ========================================
// LAYER 2 - FORMATTERS
// ========================================

/**
 * Sanitize sensitive information from output
 */
function sanitizeSecrets(obj: any): any {
  const sanitized = { ...obj };
  
  if (typeof sanitized === 'object' && sanitized !== null) {
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeSecrets(sanitized[key]);
      } else if (typeof sanitized[key] === 'string') {
        if (key.toLowerCase().includes('database_url') || 
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret')) {
          sanitized[key] = '[REDACTED]';
        }
      }
    });
  }
  
  return sanitized;
}

/**
 * Format diagnostics result to console output
 */
export function toConsole(result: UnifiedDiagnosticsResult, options: FormatOptions = {}): string {
  const lines: string[] = [];
  const { showTimestamp = true, showRecommendations = true, verboseOutput = false } = options;

  lines.push('🔍 Database and Environment Diagnostics');
  lines.push('='.repeat(50));

  if (showTimestamp) {
    lines.push(`⏰ Timestamp: ${result.timestamp}`);
    lines.push('');
  }

  // Environment Status
  lines.push('📊 ENVIRONMENT STATUS:');
  lines.push(`NODE_ENV: ${result.environment.NODE_ENV}`);
  lines.push(`REPL_ID: ${result.environment.REPL_ID}`);
  lines.push(`DATABASE_URL: ${result.environment.DATABASE_URL_EXISTS ? 'set' : 'not set'}`);
  lines.push(`PORT: ${result.environment.PORT}`);
  lines.push(`SESSION_SECRET: ${result.environment.SESSION_SECRET_EXISTS ? 'set' : 'not set'}`);

  if (result.analysis) {
    lines.push('');
    lines.push(`🎯 LIKELY ENVIRONMENT: ${result.analysis.likelyEnvironment}`);
    const isReplit = result.environment.REPL_ID === 'set';
    lines.push(`🏢 Platform: ${isReplit ? 'Replit' : 'Unknown'}`);
  }

  // Database Status
  lines.push('');
  lines.push('🔌 DATABASE CONNECTION:');
  if (result.database.connected) {
    lines.push('✅ Database connection successful');
    if (result.database.name && result.database.version) {
      lines.push(`📊 Database: ${result.database.name}`);
      lines.push(`🔧 Version: ${result.database.version}`);
    }
  } else {
    lines.push('❌ Database connection failed');
    if (result.database.error) {
      lines.push(`   Error: ${result.database.error}`);
    }
  }

  // Basic Stats
  if (result.basicStats && result.database.connected) {
    lines.push('');
    lines.push('📋 DATABASE CONTENT ANALYSIS:');
    lines.push(`📊 Tables found: ${result.basicStats.tableCount}`);

    if (verboseOutput && result.basicStats.tables) {
      result.basicStats.tables.forEach(table => {
        if (table.error) {
          lines.push(`  📄 ${table.name}: Error counting (${table.error})`);
        } else {
          lines.push(`  📄 ${table.name}: ${table.count} records`);
        }
      });
    }

    lines.push('');
    lines.push('👤 USER ANALYSIS:');
    lines.push(`Total users: ${result.basicStats.users.length}`);

    if (result.basicStats.users.length > 0) {
      if (verboseOutput) {
        lines.push('User details:');
        result.basicStats.users.forEach((user, index) => {
          const identifier = user.username || user.email || user.id;
          lines.push(`  ${index + 1}. ${identifier} (${user.role}) - ${user.authMethod} - Created: ${user.createdAt}`);
        });
      }
    } else {
      lines.push('⚠️  NO USERS FOUND - This suggests empty production database');
    }

    lines.push('');
    lines.push('⚙️ USER ALERT PREFERENCES:');
    lines.push(`Alert preferences: ${result.database.alertPreferences} records`);

    lines.push('');
    lines.push('🎯 MONITORED TEAMS:');
    lines.push(`Monitored teams: ${result.database.monitoredTeams} records`);
  }

  // Deep Analysis Results
  if (result.deepAnalysis) {
    lines.push('');
    lines.push('🔍 DEEP ANALYSIS RESULTS:');
    lines.push('='.repeat(30));

    const { duplicates, orphans, inconsistencies, mismatches } = result.deepAnalysis;
    const totalIssues = duplicates.length + orphans.length + inconsistencies.length + mismatches.length;

    if (totalIssues === 0) {
      lines.push('✅ No issues found - database is healthy!');
    } else {
      lines.push(`Total Issues Found: ${totalIssues}`);
      lines.push(`- Duplicates: ${duplicates.length}`);
      lines.push(`- Orphaned Records: ${orphans.length}`);
      lines.push(`- Data Inconsistencies: ${inconsistencies.length}`);
      lines.push(`- Endpoint Mismatches: ${mismatches.length}`);

      if (verboseOutput) {
        if (duplicates.length > 0) {
          lines.push('');
          lines.push('❌ DUPLICATES:');
          duplicates.forEach(dup => {
            lines.push(`   - ${dup.table}: ${dup.value} (${dup.count} entries)`);
          });
        }

        if (orphans.length > 0) {
          lines.push('');
          lines.push('❌ ORPHANED RECORDS:');
          orphans.forEach(orphan => {
            lines.push(`   - ${orphan.table}: ${orphan.details}`);
          });
        }

        if (inconsistencies.length > 0) {
          lines.push('');
          lines.push('❌ INCONSISTENCIES:');
          inconsistencies.forEach(inc => {
            lines.push(`   - ${inc.table}: ${inc.details}`);
          });
        }

        if (mismatches.length > 0) {
          lines.push('');
          lines.push('❌ ENDPOINT MISMATCHES:');
          mismatches.forEach(mis => {
            lines.push(`   - ${mis.endpoint}: ${mis.details}`);
          });
        }
      }
    }
  }

  // Recommendations
  if (showRecommendations && result.analysis?.recommendations.length) {
    lines.push('');
    lines.push('🎯 RECOMMENDATIONS:');
    result.analysis.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format diagnostics result to JSON
 */
export function toJSON(result: UnifiedDiagnosticsResult, options: FormatOptions = {}): string {
  const { sanitizeSecrets: shouldSanitize = true } = options;
  const output = shouldSanitize ? sanitizeSecrets(result) : result;
  return JSON.stringify(output, null, 2);
}

// ========================================
// LAYER 3 - ADAPTERS
// ========================================

/**
 * Generate analysis recommendations based on diagnostic results
 */
function generateAnalysis(
  env: DiagnosticsEnv,
  db: DiagnosticsDb,
  session?: SessionInfo,
  deepAnalysis?: DeepAnalysisResult
): UnifiedDiagnosticsResult['analysis'] {
  const recommendations: string[] = [];
  const isProduction = env.NODE_ENV.includes('production');
  const hasUsers = db.userCount > 0;
  const likelyEnvironment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT';

  if (!db.connected) {
    recommendations.push('Database connection failed - check DATABASE_URL');
  }

  if (db.userCount === 0) {
    recommendations.push('No users found - likely empty production database');
    recommendations.push('Consider data migration from development to production');
  }

  if (session && !session.authenticated) {
    recommendations.push('User not authenticated - check session/login status');
  }

  if (db.userCount > 0 && session && !session.authenticated) {
    recommendations.push('Users exist but session not working - check session configuration');
  }

  if (deepAnalysis) {
    const totalIssues = deepAnalysis.duplicates.length + deepAnalysis.orphans.length + 
                       deepAnalysis.inconsistencies.length + deepAnalysis.mismatches.length;
    
    if (totalIssues > 0) {
      recommendations.push(`Database integrity issues found: ${totalIssues} total`);
      recommendations.push('Run with --cleanup-sql flag to generate cleanup commands');
    }
  }

  return {
    likelyEnvironment,
    hasUserData: hasUsers,
    sessionWorking: session?.authenticated || false,
    issueDetected: !hasUsers || !db.connected,
    recommendations,
  };
}

/**
 * CLI Adapter - Run diagnostics from command line
 */
export async function runCLI(args: string[]): Promise<void> {
  try {
    // Parse CLI arguments
    const flags = {
      mode: 'basic' as DiagnosticMode,
      json: false,
      cleanupSql: false,
      verbose: false,
      help: false,
    };

    for (const arg of args) {
      if (arg.startsWith('--mode=')) {
        flags.mode = arg.split('=')[1] as DiagnosticMode;
      } else if (arg === '--json') {
        flags.json = true;
      } else if (arg === '--cleanup-sql') {
        flags.cleanupSql = true;
      } else if (arg === '--verbose') {
        flags.verbose = true;
      } else if (arg === '--help' || arg === '-h') {
        flags.help = true;
      }
    }

    if (flags.help) {
      console.log(`
🔍 Unified Database Diagnostics Tool

Usage: node unified-diagnostics.js [options]

Options:
  --mode=<type>     Diagnostic mode: basic, deep, env, all (default: basic)
  --json           Output as JSON instead of console format
  --cleanup-sql    Generate cleanup SQL file (requires deep mode)
  --verbose        Show detailed output
  --help, -h       Show this help message

Examples:
  node unified-diagnostics.js --mode=basic
  node unified-diagnostics.js --mode=deep --cleanup-sql
  node unified-diagnostics.js --mode=all --json
      `);
      return;
    }

    // Run diagnostics based on mode
    const options: DiagnosticsOptions = {
      includeBasicStats: flags.mode === 'basic' || flags.mode === 'all',
      includeDeepAnalysis: flags.mode === 'deep' || flags.mode === 'all',
      includeSession: false, // Not available in CLI mode
      includeAnalysis: true,
    };

    const result = await runUnifiedDiagnostics(options);

    // Output results
    if (flags.json) {
      console.log(toJSON(result, { sanitizeSecrets: true }));
    } else {
      console.log(toConsole(result, { 
        verboseOutput: flags.verbose,
        showRecommendations: true,
        showTimestamp: true 
      }));
    }

    // Generate cleanup SQL if requested
    if (flags.cleanupSql && result.deepAnalysis) {
      const cleanupSQL = generateCleanupSQL(result.deepAnalysis);
      writeFileSync('cleanup.sql', cleanupSQL);
      console.log('\n💾 Cleanup SQL saved to cleanup.sql');
    }

  } catch (error: any) {
    if (error instanceof DiagnosticError) {
      console.error(`❌ ${error.safeMessage}`);
      process.exit(1);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
      process.exit(1);
    }
  }
}

/**
 * Express Router Adapter - Create API endpoints
 */
export function createDiagnosticsRouter(): express.Router {
  const router = express.Router();

  router.get('/environment-status', async (req, res) => {
    try {
      const options: DiagnosticsOptions = {
        includeBasicStats: true,
        includeDeepAnalysis: false,
        includeSession: true,
        includeAnalysis: true,
      };

      const session: SessionInfo = {
        authenticated: !!req.session?.userId,
        sessionId: req.sessionID ? 'present' : 'missing',
        user: req.session?.user || null,
      };

      const result = await runUnifiedDiagnostics(options, session);

      res.json(sanitizeSecrets(result));
    } catch (error: any) {
      if (error instanceof DiagnosticError) {
        res.status(500).json({
          error: 'Diagnostic failed',
          message: error.safeMessage,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'Diagnostic failed',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  router.get('/deep-analysis', async (req, res) => {
    try {
      const options: DiagnosticsOptions = {
        includeBasicStats: false,
        includeDeepAnalysis: true,
        includeSession: false,
        includeAnalysis: false,
      };

      const result = await runUnifiedDiagnostics(options);

      if (req.query.cleanup === 'true' && result.deepAnalysis) {
        const cleanupSQL = generateCleanupSQL(result.deepAnalysis);
        res.json({
          ...sanitizeSecrets(result),
          cleanupSQL,
        });
      } else {
        res.json(sanitizeSecrets(result));
      }
    } catch (error: any) {
      if (error instanceof DiagnosticError) {
        res.status(500).json({
          error: 'Deep analysis failed',
          message: error.safeMessage,
          code: error.code,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'Deep analysis failed',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  return router;
}

/**
 * Library Functions for Direct Use
 */

/**
 * Run basic diagnostics (compatible with old database-diagnostics.js)
 */
export async function runBasicDiagnostics(): Promise<UnifiedDiagnosticsResult> {
  const options: DiagnosticsOptions = {
    includeBasicStats: true,
    includeDeepAnalysis: false,
    includeSession: false,
    includeAnalysis: true,
  };

  return runUnifiedDiagnostics(options);
}

/**
 * Run deep analysis (compatible with old deep-database-analysis.js)
 */
export async function runDeepDiagnostics(): Promise<DeepAnalysisResult> {
  const result = await runDeepAnalysis();
  return result;
}

/**
 * Log environment status to console (compatible with old environment-detector.js)
 */
export async function logEnvironmentStatus(): Promise<void> {
  try {
    const result = await runBasicDiagnostics();
    console.log(toConsole(result, { verboseOutput: false, showRecommendations: false }));
  } catch (error: any) {
    if (error instanceof DiagnosticError) {
      console.error(`❌ ${error.safeMessage}`);
    } else {
      console.error(`❌ Environment status check failed: ${error.message}`);
    }
  }
}

/**
 * Main unified diagnostics function
 */
export async function runUnifiedDiagnostics(
  options: DiagnosticsOptions = {},
  session?: SessionInfo
): Promise<UnifiedDiagnosticsResult> {
  const {
    includeBasicStats = false,
    includeDeepAnalysis = false,
    includeSession = false,
    includeAnalysis = true,
  } = options;

  const result: UnifiedDiagnosticsResult = {
    timestamp: new Date().toISOString(),
    environment: getEnvironmentInfo(),
    database: await testDbConnection(),
  };

  if (includeSession && session) {
    result.session = session;
  }

  if (includeBasicStats && result.database.connected) {
    try {
      result.basicStats = await getBasicDbStats();
    } catch (error: any) {
      // Continue without basic stats if they fail
      if (!(error instanceof DiagnosticError)) {
        throw error;
      }
    }
  }

  if (includeDeepAnalysis && result.database.connected) {
    try {
      result.deepAnalysis = await runDeepAnalysis();
    } catch (error: any) {
      // Continue without deep analysis if it fails
      if (!(error instanceof DiagnosticError)) {
        throw error;
      }
    }
  }

  if (includeAnalysis) {
    result.analysis = generateAnalysis(
      result.environment,
      result.database,
      result.session,
      result.deepAnalysis
    );
  }

  return result;
}

// CLI entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(process.argv.slice(2));
}