#!/usr/bin/env node

/**
 * Codemod to fix the systemic bug where generateAlert() calls isTriggered() again
 * 
 * Problem: Every alert module calls isTriggered() in generateAlert(), but the engine
 * already calls isTriggered() before calling generateAlert(). This causes state issues
 * where the second call returns false and generateAlert() returns null.
 * 
 * Solution: Remove the duplicate isTriggered() guard from all generateAlert() methods.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function fixGenerateAlertMethod(content) {
  // Pattern to match the problematic guard statement in generateAlert methods
  const patterns = [
    // Standard patterns
    /(\s*)if\s*\(\s*!this\.isTriggered\s*\(\s*gameState\s*\)\s*\)\s*return\s+null\s*;?\s*\n/g,
    /(\s*)if\s*\(\s*!this\.isTriggered\s*\(\s*gameState\s*\)\s*\)\s*{\s*\n\s*return\s+null\s*;?\s*\n\s*}\s*\n/g,
    
    // With extra whitespace variations
    /(\s*)if\s*\(\s*!\s*this\s*\.\s*isTriggered\s*\(\s*gameState\s*\)\s*\)\s*return\s+null\s*;?\s*\n/g,
    /(\s*)if\s*\(\s*!\s*this\s*\.\s*isTriggered\s*\(\s*gameState\s*\)\s*\)\s*{\s*\n\s*return\s+null\s*;?\s*\n\s*}\s*\n/g,
  ];

  let modified = content;
  let hasChanges = false;

  for (const pattern of patterns) {
    const originalLength = modified.length;
    modified = modified.replace(pattern, '$1// isTriggered() already called by engine - removed duplicate check\n');
    if (modified.length !== originalLength) {
      hasChanges = true;
    }
  }

  return { content: modified, hasChanges };
}

function main() {
  console.log('🔧 Fixing generateAlert() duplicate isTriggered() calls...\n');

  const cylinders = glob.sync('server/services/engines/alert-cylinders/**/*-module.ts');
  
  let totalFixed = 0;
  const fixedFiles = [];

  for (const file of cylinders) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Only process files that have generateAlert method
      if (!content.includes('generateAlert(')) {
        continue;
      }

      const { content: fixedContent, hasChanges } = fixGenerateAlertMethod(content);
      
      if (hasChanges) {
        fs.writeFileSync(file, fixedContent);
        fixedFiles.push(file);
        totalFixed++;
        console.log(`✅ Fixed: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n🎉 Successfully fixed ${totalFixed} alert modules:`);
  fixedFiles.forEach(file => console.log(`   - ${file}`));
  
  console.log('\n📋 Summary:');
  console.log(`   - Total modules scanned: ${cylinders.length}`);
  console.log(`   - Modules fixed: ${totalFixed}`);
  console.log(`   - Modules unchanged: ${cylinders.length - totalFixed}`);
  
  if (totalFixed > 0) {
    console.log('\n🚀 Alert system should now generate alerts properly!');
    console.log('   Restart the application to see the fix in action.');
  } else {
    console.log('\n✨ No modules needed fixing - they may already be fixed.');
  }
}

if (require.main === module) {
  main();
}