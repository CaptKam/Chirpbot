/**
 * DEPRECATED: Environment Detection Utility
 * 
 * This file is now a backward-compatible wrapper around the unified diagnostics system.
 * For new development, use: server/unified-diagnostics.ts
 * 
 * Original functionality preserved for backward compatibility.
 */

import express from 'express';
import { createDiagnosticsRouter, logEnvironmentStatus as unifiedLogEnvironmentStatus } from './unified-diagnostics.js';

export async function createEnvironmentDetector() {
  console.log('⚠️  DEPRECATION NOTICE: createEnvironmentDetector() has been superseded by unified-diagnostics.ts');
  console.log('📝 For new features and better TypeScript support, use createDiagnosticsRouter() from unified-diagnostics.ts');
  
  // Return the unified diagnostics router which provides the same endpoints
  return createDiagnosticsRouter();
}

// Standalone function for server-side diagnostics (preserved original interface)
export async function logEnvironmentStatus() {
  console.log('⚠️  DEPRECATION NOTICE: This function has been superseded by unified-diagnostics.ts');
  console.log('📝 For new features and better TypeScript support, use logEnvironmentStatus() from unified-diagnostics.ts');
  console.log('');

  try {
    // Use the unified diagnostics system
    await unifiedLogEnvironmentStatus();
    console.log('\n💡 TIP: Use "node server/unified-diagnostics.ts --mode=env" for enhanced environment diagnostics');
  } catch (error) {
    console.error('❌ Environment status check failed:', error.message);
    console.error('🔧 Try using the unified diagnostics tool: node server/unified-diagnostics.ts --mode=env');
  }
}