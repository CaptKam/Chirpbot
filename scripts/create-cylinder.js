import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

class CylinderCreator {
  constructor(sport, alertName, description) {
    this.sport = sport.toUpperCase();
    this.sportLower = sport.toLowerCase();
    this.alertName = alertName.toUpperCase().replace(/\s+/g, '_');
    this.alertKey = `${this.sport}_${this.alertName}`;
    this.fileName = alertName.toLowerCase().replace(/\s+/g, '-');
    this.description = description;
    this.moduleFileName = `${this.fileName}-module.ts`;
  }

  // 1. Create the cylinder module file
  createCylinderModule() {
    const cylinderDir = join(rootDir, `server/services/engines/alert-cylinders/${this.sportLower}`);

    if (!existsSync(cylinderDir)) {
      mkdirSync(cylinderDir, { recursive: true });
      console.log(`✅ Created cylinder directory: ${cylinderDir}`);
    }

    const moduleFile = join(cylinderDir, this.moduleFileName);

    if (existsSync(moduleFile)) {
      throw new Error(`❌ Module already exists: ${moduleFile}`);
    }

    const moduleContent = `import { BaseAlertModule, GameState, AlertResult } from '../base-engine';

export default class ${this.alertName.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join('')}Module extends BaseAlertModule {
  alertType = '${this.alertKey}';
  sport = '${this.sport}';

  isTriggered(gameState: GameState): boolean {
    // TODO: Implement your detection logic here
    // Example: return gameState.someCondition === true;
    return false;
  }

  generateAlert(gameState: GameState): AlertResult | null {
    if (!this.isTriggered(gameState)) {
      return null;
    }

    return {
      alertKey: \`\${gameState.gameId}_${this.alertKey}\`,
      type: this.alertType,
      message: \`🚨 ${this.description}: \${gameState.awayTeam} @ \${gameState.homeTeam}\`,
      context: {
        gameId: gameState.gameId,
        sport: gameState.sport,
        homeTeam: gameState.homeTeam,
        awayTeam: gameState.awayTeam,
        homeScore: gameState.homeScore,
        awayScore: gameState.awayScore,
        // TODO: Add any specific context data for this alert
      },
      priority: 75 // TODO: Adjust priority (1-100)
    };
  }

  calculateProbability(gameState: GameState): number {
    // TODO: Return probability percentage (0-100) that this alert will trigger
    return 0;
  }
}
`;

    writeFileSync(moduleFile, moduleContent);
    console.log(`✅ Created cylinder module: ${moduleFile}`);
  }

  // 2. Update the sport engine
  updateEngine() {
    const engineFile = join(rootDir, `server/services/engines/${this.sportLower}-engine.ts`);

    if (!existsSync(engineFile)) {
      throw new Error(`❌ Engine file not found: ${engineFile}`);
    }

    let engineContent = readFileSync(engineFile, 'utf8');

    // Find and update the moduleMap
    const moduleMapMatch = engineContent.match(/moduleMap:\s*Record<string,\s*string>\s*=\s*{([^}]+)}/s);

    if (!moduleMapMatch) {
      throw new Error(`❌ Could not find moduleMap in ${engineFile}`);
    }

    const newMapping = `        '${this.alertKey}': './alert-cylinders/${this.sportLower}/${this.moduleFileName}',`;
    const updatedModuleMap = moduleMapMatch[1].trim() + ',\n' + newMapping;

    engineContent = engineContent.replace(
      moduleMapMatch[0],
      `moduleMap: Record<string, string> = {\n${updatedModuleMap}\n      }`
    );

    writeFileSync(engineFile, engineContent);
    console.log(`✅ Updated engine: ${engineFile}`);
  }

  // 3. Update storage defaults
  updateStorageDefaults() {
    const storageFile = join(rootDir, 'server/storage.ts');

    if (!existsSync(storageFile)) {
      throw new Error(`❌ Storage file not found: ${storageFile}`);
    }

    let storageContent = readFileSync(storageFile, 'utf8');

    // Find the sport's default settings
    const defaultsPattern = new RegExp(`(${this.sport}:\\s*{[^}]+})(})`);
    const match = storageContent.match(defaultsPattern);

    if (!match) {
      throw new Error(`❌ Could not find ${this.sport} defaults in storage.ts`);
    }

    const newDefault = `    '${this.alertKey}': true,`;
    const updatedDefaults = match[1] + '\n' + newDefault + '\n  ' + match[2];

    storageContent = storageContent.replace(match[0], updatedDefaults);

    writeFileSync(storageFile, storageContent);
    console.log(`✅ Updated storage defaults: ${storageFile}`);
  }

  // 4. Create the cylinder
  async createCylinder() {
    console.log(`🔧 Creating new alert cylinder: ${this.alertKey}`);
    console.log(`📝 Description: ${this.description}`);
    console.log(`🏈 Sport: ${this.sport}`);
    console.log();

    try {
      this.createCylinderModule();
      this.updateEngine();
      this.updateStorageDefaults();

      console.log(`\n🎉 SUCCESS! Created cylinder: ${this.alertKey}`);
      console.log(`\n📋 TODO List:`);
      console.log(`   1. Implement detection logic in isTriggered() method`);
      console.log(`   2. Adjust alert priority (currently 75)`);
      console.log(`   3. Add specific context data to generateAlert()`);
      console.log(`   4. Implement calculateProbability() method`);
      console.log(`   5. Add to admin dashboard configuration`);
      console.log(`   6. Add to user settings ALERT_TYPE_CONFIG`);
      console.log(`   7. Run validation: npm run validate-cylinders`);

    } catch (error) {
      console.error(`❌ Error creating cylinder: ${error.message}`);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.log('Usage: npm run create-cylinder <sport> <alert_name> <description>');
  console.log('Example: npm run create-cylinder MLB "Home Run" "When a home run is hit"');
  process.exit(1);
}

const [sport, alertName, description] = args;
const creator = new CylinderCreator(sport, alertName, description);
creator.createCylinder().catch(console.error);