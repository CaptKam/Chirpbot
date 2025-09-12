import { db } from './db';
import { settings, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  let demoUserId: string;
  
  // Create default demo user if none exists
  const existingUsers = await db.select().from(users).where(eq(users.username, 'demo')).limit(1);
  if (existingUsers.length === 0) {
    const hashedPassword = await bcrypt.hash('demo123', 10);
    demoUserId = randomUUID();
    
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
    
    // Create default settings for demo user
    const defaultPreferences = {
      notifications: true,
      theme: 'light',
    };
    
    await db.insert(settings).values({
      sport: 'ALL',
      preferences: defaultPreferences,
      telegramEnabled: false,
      pushNotificationsEnabled: false,
    });
    
    console.log('✅ Created default settings for demo user');
  } else {
    demoUserId = existingUsers[0].id;
    console.log('✅ Demo user already exists');
  }

  // 5. Seed demo alerts for demo user only
  console.log('🌱 Seeding demo alerts...');
  try {
    const { DemoAlertGenerator } = await import('./services/demo-alert-generator');
    const demoAlertGen = new DemoAlertGenerator(demoUserId);
    await demoAlertGen.generateAllDemoAlerts();
    console.log('✅ Demo alerts seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding demo alerts:', error);
    // Don't throw error so seeding can continue - demo alerts are not critical
  }
  
  console.log('✅ Database seeding completed successfully!');
}