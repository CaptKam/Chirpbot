#!/usr/bin/env node

// Check status of all disabled systems
import fs from 'fs';
import path from 'path';
import { storage } from './storage.ts';

async function checkSystemStatus() {
  console.log('🔍 SYSTEM STATUS CHECK');
  console.log('====================\n');

  // Check disable flags file
  try {
    const disableFlagsPath = path.join(__dirname, '.disable-flags');
    console.log(`📁 Disable flags path: ${disableFlagsPath}`);
    
    if (fs.existsSync(disableFlagsPath)) {
      const flags = JSON.parse(fs.readFileSync(disableFlagsPath, 'utf8'));
      console.log('🚫 DISABLE FLAGS FOUND:');
      console.log(`   Weather disabled: ${flags.weather_disabled}`);
      console.log(`   AI disabled: ${flags.ai_disabled}`);
      console.log(`   Timestamp: ${flags.timestamp}\n`);
    } else {
      console.log('❌ No disable flags file found\n');
    }
  } catch (error) {
    console.log('❌ Error reading disable flags:', error.message, '\n');
  }

  // Check alert system status
  try {
    console.log('📊 ALERT SYSTEM STATUS:');
    const allUsers = await storage.getAllUsers();
    console.log(`   Total users: ${allUsers.length}`);
    
    for (const user of allUsers) {
      const settings = await storage.getSettingsBySport('MLB');
      const userAlerts = await storage.getUserAlertSettings(user.id, 'MLB');
      const enabledAlerts = userAlerts.filter(a => a.enabled).length;
      console.log(`   ${user.username}: ${enabledAlerts} MLB alerts enabled`);
    }
    
    // Check global settings
    const globalMLB = await storage.getGlobalAlertSettings('MLB');
    const enabledGlobalMLB = globalMLB.filter(g => g.enabled).length;
    console.log(`   Global MLB alerts enabled: ${enabledGlobalMLB}/${globalMLB.length}\n`);
    
  } catch (error) {
    console.log('❌ Error checking alert status:', error.message, '\n');
  }

  // Check environment variables
  console.log('🔧 ENVIRONMENT VARIABLES:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET (hidden)' : 'NOT SET'}`);
  console.log(`   OPENWEATHERMAP_API_KEY: ${process.env.OPENWEATHERMAP_API_KEY ? 'SET (hidden)' : 'NOT SET'}`);
  
  console.log('\n✅ SYSTEM STATUS CHECK COMPLETE');
}

checkSystemStatus();