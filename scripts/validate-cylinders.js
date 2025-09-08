

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Define all sports and their expected structure
const SPORTS = ['mlb', 'nfl', 'ncaaf', 'wnba', 'cfl', 'nba', 'nhl'];

// Required files that must reference new cylinders
const REQUIRED_INTEGRATIONS = {
  'admin-dashboard': 'public/admin/dashboard.js',
  'user-settings': 'client/src/pages/settings.tsx',
  'backend-storage': 'server/storage.ts',
  'alert-generator': 'server/services/alert-generator.ts'
};

class CylinderValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.foundCylinders = new Map(); // sport -> [cylinders]
  }

  // 1. Scan all cylinder directories
  scanCylinders() {
    console.log('🔍 Scanning alert cylinders...');
    
    for (const sport of SPORTS) {
      const cylinderDir = join(rootDir, 'server/services/engines/alert-cylinders', sport);
      
      if (!existsSync(cylinderDir)) {
        this.warnings.push(`⚠️  No cylinder directory for ${sport.toUpperCase()}`);
        continue;
      }

      const files = readdirSync(cylinderDir).filter(f => f.endsWith('-module.ts'));
      const cylinders = files.map(f => {
        const name = f.replace('-module.ts', '').replace(/-/g, '_').toUpperCase();
        return `${sport.toUpperCase()}_${name}`;
      });

      this.foundCylinders.set(sport.toUpperCase(), cylinders);
      console.log(`✅ ${sport.toUpperCase()}: Found ${cylinders.length} cylinders: ${cylinders.join(', ')}`);
    }
  }

  // 2. Validate engine integration
  validateEngines() {
    console.log('\n🔧 Validating engine integration...');
    
    for (const [sport, cylinders] of this.foundCylinders) {
      const engineFile = join(rootDir, `server/services/engines/${sport.toLowerCase()}-engine.ts`);
      
      if (!existsSync(engineFile)) {
        this.errors.push(`❌ Missing engine file: ${sport.toLowerCase()}-engine.ts`);
        continue;
      }

      const engineContent = readFileSync(engineFile, 'utf8');
      
      // Check if engine has loadAlertModule method
      if (!engineContent.includes('loadAlertModule')) {
        this.errors.push(`❌ ${sport} engine missing loadAlertModule method`);
      }

      // Check if engine has initializeUserAlertModules method
      if (!engineContent.includes('initializeUserAlertModules')) {
        this.errors.push(`❌ ${sport} engine missing initializeUserAlertModules method`);
      }

      // Check if engine maps all found cylinders
      for (const cylinder of cylinders) {
        const moduleMap = engineContent.match(/moduleMap:\s*Record<string,\s*string>\s*=\s*{([^}]+)}/s);
        if (moduleMap && !moduleMap[1].includes(`'${cylinder}'`)) {
          this.errors.push(`❌ ${sport} engine missing mapping for ${cylinder}`);
        }
      }

      console.log(`✅ ${sport} engine validation complete`);
    }
  }

  // 3. Validate admin dashboard integration
  validateAdminDashboard() {
    console.log('\n🎛️  Validating admin dashboard...');
    
    const dashboardFile = join(rootDir, REQUIRED_INTEGRATIONS['admin-dashboard']);
    if (!existsSync(dashboardFile)) {
      this.errors.push(`❌ Missing admin dashboard file`);
      return;
    }

    const dashboardContent = readFileSync(dashboardFile, 'utf8');
    
    for (const [sport, cylinders] of this.foundCylinders) {
      for (const cylinder of cylinders) {
        if (!dashboardContent.includes(cylinder)) {
          this.warnings.push(`⚠️  Admin dashboard missing ${cylinder} reference`);
        }
      }
    }

    console.log(`✅ Admin dashboard validation complete`);
  }

  // 4. Validate user settings integration
  validateUserSettings() {
    console.log('\n👤 Validating user settings...');
    
    const settingsFile = join(rootDir, REQUIRED_INTEGRATIONS['user-settings']);
    if (!existsSync(settingsFile)) {
      this.errors.push(`❌ Missing user settings file`);
      return;
    }

    const settingsContent = readFileSync(settingsFile, 'utf8');
    
    // Check if ALERT_TYPE_CONFIG exists and is populated
    if (!settingsContent.includes('ALERT_TYPE_CONFIG')) {
      this.errors.push(`❌ User settings missing ALERT_TYPE_CONFIG`);
    }

    console.log(`✅ User settings validation complete`);
  }

  // 5. Validate backend storage defaults
  validateStorageDefaults() {
    console.log('\n💾 Validating storage defaults...');
    
    const storageFile = join(rootDir, REQUIRED_INTEGRATIONS['backend-storage']);
    if (!existsSync(storageFile)) {
      this.errors.push(`❌ Missing storage file`);
      return;
    }

    const storageContent = readFileSync(storageFile, 'utf8');
    
    for (const [sport, cylinders] of this.foundCylinders) {
      const defaultsPattern = new RegExp(`${sport}.*defaultSettings.*{([^}]+)}`, 's');
      const match = storageContent.match(defaultsPattern);
      
      if (!match) {
        this.errors.push(`❌ Storage missing default settings for ${sport}`);
        continue;
      }

      for (const cylinder of cylinders) {
        if (!match[1].includes(`'${cylinder}'`)) {
          this.warnings.push(`⚠️  Storage defaults missing ${cylinder}`);
        }
      }
    }

    console.log(`✅ Storage defaults validation complete`);
  }

  // 6. Validate alert generator integration
  validateAlertGenerator() {
    console.log('\n⚡ Validating alert generator...');
    
    const generatorFile = join(rootDir, REQUIRED_INTEGRATIONS['alert-generator']);
    if (!existsSync(generatorFile)) {
      this.errors.push(`❌ Missing alert generator file`);
      return;
    }

    const generatorContent = readFileSync(generatorFile, 'utf8');
    
    // Check if all sport engines are imported and initialized
    for (const sport of SPORTS) {
      const engineImport = `${sport.charAt(0).toUpperCase() + sport.slice(1)}Engine`;
      if (!generatorContent.includes(engineImport)) {
        this.warnings.push(`⚠️  Alert generator missing ${sport.toUpperCase()} engine import`);
      }

      if (!generatorContent.includes(`this.sportEngines.set('${sport.toUpperCase()}'`)) {
        this.warnings.push(`⚠️  Alert generator missing ${sport.toUpperCase()} engine initialization`);
      }
    }

    console.log(`✅ Alert generator validation complete`);
  }

  // 7. Check for orphaned cylinders (cylinders without engine support)
  validateOrphanedCylinders() {
    console.log('\n🚨 Checking for orphaned cylinders...');
    
    for (const [sport, cylinders] of this.foundCylinders) {
      const engineFile = join(rootDir, `server/services/engines/${sport.toLowerCase()}-engine.ts`);
      
      if (!existsSync(engineFile)) {
        this.errors.push(`❌ Orphaned cylinders in ${sport}: No engine file exists`);
        continue;
      }

      const engineContent = readFileSync(engineFile, 'utf8');
      
      for (const cylinder of cylinders) {
        if (!engineContent.includes(cylinder)) {
          this.errors.push(`❌ Orphaned cylinder: ${cylinder} not referenced in ${sport} engine`);
        }
      }
    }

    console.log(`✅ Orphaned cylinder check complete`);
  }

  // 8. Run all validations
  async runValidation() {
    console.log('🛡️  ALERT CYLINDER INTEGRITY VALIDATION\n');
    
    this.scanCylinders();
    this.validateEngines();
    this.validateAdminDashboard();
    this.validateUserSettings();
    this.validateStorageDefaults();
    this.validateAlertGenerator();
    this.validateOrphanedCylinders();
    
    this.generateReport();
  }

  // 9. Generate validation report
  generateReport() {
    console.log('\n📊 VALIDATION REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n✅ Found ${Array.from(this.foundCylinders.values()).flat().length} total cylinders across ${this.foundCylinders.size} sports`);
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n🎉 ALL VALIDATIONS PASSED! Your cylinder system is properly integrated.');
      process.exit(0);
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ CRITICAL ERRORS (${this.errors.length}):`);
      this.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    console.log('\n💡 Fix all CRITICAL ERRORS before deploying. Warnings should be addressed when possible.');
    
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }
}

// Run validation
const validator = new CylinderValidator();
validator.runValidation().catch(console.error);
