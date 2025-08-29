import { db } from './db';
import { masterAlertControls, settings, users, aiSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  // 1. Seed Master Alert Controls
  const masterControls = [
    // MLB Alert Controls (21 total)
    { sport: 'MLB', alertKey: 'risp', displayName: 'RISP Alert', description: 'Runners in scoring position', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'basesLoaded', displayName: 'Bases Loaded', description: 'Maximum scoring opportunity - all bases occupied', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'runnersOnBase', displayName: 'Runners On Base', description: 'Any base runner situations', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'closeGame', displayName: 'Close Game Alert', description: '1-run games in late innings', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'lateInning', displayName: 'Late Inning Alert', description: '8th+ inning crucial moments', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'extraInnings', displayName: 'Extra Innings', description: 'Game extends beyond 9th inning', category: 'Game Situations', enabled: true },
    { sport: 'MLB', alertKey: 'homeRun', displayName: 'Home Run Situations', description: 'High home run probability moments', category: 'Scoring Events', enabled: true },
    { sport: 'MLB', alertKey: 'homeRunAlert', displayName: 'Home Run Alerts', description: 'Actual home run notifications', category: 'Scoring Events', enabled: true },
    { sport: 'MLB', alertKey: 'hits', displayName: 'Hit Alerts', description: 'Base hit notifications', category: 'Scoring Events', enabled: true },
    { sport: 'MLB', alertKey: 'scoring', displayName: 'Scoring Plays', description: 'RBI and run-scoring events', category: 'Scoring Events', enabled: true },
    { sport: 'MLB', alertKey: 'inningChange', displayName: 'Inning Changes', description: 'New inning momentum shifts', category: 'Game Flow', enabled: true },
    { sport: 'MLB', alertKey: 'strikeouts', displayName: 'Strikeout Alerts', description: 'Pitcher strikeout notifications', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'powerHitter', displayName: 'Power Hitter Alert', description: 'Advanced HR probability analysis', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'powerHitterOnDeck', displayName: 'Power Hitter On Deck', description: 'Tier A power bats on deck - Pre-alert for next at-bat', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'starBatter', displayName: 'Star Batter Alert', description: '.300+ AVG, 20+ HR, or .900+ OPS hitters', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'eliteClutch', displayName: 'Elite Clutch Hitter', description: 'High OPS batters in pressure situations', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'avgHitter', displayName: '.300+ Hitter Alert', description: 'Premium contact hitters at bat', category: 'Player Performance', enabled: true },
    { sport: 'MLB', alertKey: 'rbiMachine', displayName: 'RBI Machine Alert', description: '80+ RBI producers with scoring chances', category: 'Player Performance', enabled: true },
    // RE24 System removed
    
    // NFL Alert Controls
    { sport: 'NFL', alertKey: 'redZone', displayName: 'Red Zone Alert', description: 'Team driving inside the 20-yard line', category: 'Scoring Opportunities', enabled: true },
    { sport: 'NFL', alertKey: 'nflCloseGame', displayName: 'Close Game Alert', description: 'One-score games in final quarter', category: 'Game Situations', enabled: true },
    { sport: 'NFL', alertKey: 'fourthDown', displayName: 'Fourth Down Alert', description: 'Critical fourth down decisions', category: 'Critical Plays', enabled: true },
    { sport: 'NFL', alertKey: 'twoMinuteWarning', displayName: 'Two Minute Warning', description: 'Game-deciding final drives', category: 'Game Situations', enabled: true },
    
    // NBA Alert Controls
    { sport: 'NBA', alertKey: 'clutchTime', displayName: 'Clutch Time Alert', description: 'Final 2 minutes of close games', category: 'Game Situations', enabled: true },
    { sport: 'NBA', alertKey: 'nbaCloseGame', displayName: 'Close Game Alert', description: 'Single-digit games in 4th quarter', category: 'Game Situations', enabled: true },
    { sport: 'NBA', alertKey: 'overtime', displayName: 'Overtime Alert', description: 'Extra period situations', category: 'Special Events', enabled: true },
    
    // NHL Alert Controls
    { sport: 'NHL', alertKey: 'powerPlay', displayName: 'Power Play Alert', description: 'Man advantage situations', category: 'Special Situations', enabled: true },
    { sport: 'NHL', alertKey: 'nhlCloseGame', displayName: 'Close Game Alert', description: 'One-goal games in final period', category: 'Game Situations', enabled: true },
    { sport: 'NHL', alertKey: 'emptyNet', displayName: 'Empty Net Alert', description: 'Goalie pulled for extra attacker', category: 'Special Situations', enabled: true },
  ];

  for (const control of masterControls) {
    const existing = await db.select().from(masterAlertControls)
      .where(and(
        eq(masterAlertControls.sport, control.sport),
        eq(masterAlertControls.alertKey, control.alertKey)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(masterAlertControls).values({
        ...control,
        id: randomUUID(),
        updatedAt: new Date(),
      });
      console.log(`✅ Created master control: ${control.sport} - ${control.alertKey}`);
    }
  }
  
  // 2. Create default demo user if none exists
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const demoUserId = randomUUID();
    
    await db.insert(users).values({
      id: demoUserId,
      username: 'demo',
      email: 'demo@chirpbot.ai',
      password: hashedPassword,
      authMethod: 'local',
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    console.log('✅ Created demo user (username: demo, password: demo123)');
    
    // 3. Create default settings for demo user
    const defaultAlertTypes = {
      // MLB - Enable key alerts by default
      risp: true,
      basesLoaded: true,
      runnersOnBase: false,
      closeGame: false,
      lateInning: true,
      extraInnings: true,
      homeRun: true,
      homeRunAlert: true,
      hits: false,
      scoring: true,
      inningChange: false,
      strikeouts: false,
      powerHitter: true,
      powerHitterOnDeck: true,
      starBatter: true,
      eliteClutch: true,
      avgHitter: false,
      rbiMachine: true,
      // RE24 System removed
      // NFL
      redZone: true,
      nflCloseGame: true,
      fourthDown: true,
      twoMinuteWarning: true,
      // NBA
      clutchTime: true,
      nbaCloseGame: true,
      overtime: true,
      // NHL
      powerPlay: true,
      nhlCloseGame: true,
      emptyNet: true,
    };
    
    await db.insert(settings).values({
      id: randomUUID(),
      sport: 'ALL',
      alertTypes: defaultAlertTypes,
      telegramEnabled: false,
      pushNotificationsEnabled: false,
      aiEnabled: false,
    });
    
    console.log('✅ Created default settings for demo user');
  }
  
  // 4. Create default AI settings for each sport
  const sports = ['MLB', 'NFL', 'NBA', 'NHL'];
  for (const sport of sports) {
    const existing = await db.select().from(aiSettings)
      .where(eq(aiSettings.sport, sport))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(aiSettings).values({
        id: randomUUID(),
        sport,
        enabled: false,
        dryRun: true,
        rateLimitMs: 30000,
        minProbability: 65,
        inningThreshold: 6,
        allowTypes: [],
        redactPii: true,
        model: 'gpt-4o-mini',
        maxTokens: 500,
        temperature: 70,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Created AI settings for ${sport}`);
    }
  }
  
  console.log('✅ Database seeding completed successfully!');
}