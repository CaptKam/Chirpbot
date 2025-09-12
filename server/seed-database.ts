import { db } from './db';
import { settings, users } from '@shared/schema';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  // Create default demo user if none exists
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
  }
  
  console.log('✅ Database seeding completed successfully!');
}