import bcrypt from 'bcryptjs';
import { storage } from './storage';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Create demo user if not exists
  const demoUser = await storage.getUserByUsername('demo');
  if (!demoUser) {
    console.log('📝 Creating demo user...');
    const hashedPassword = await bcrypt.hash('demo123', 10);
    await storage.createUser({
      username: 'demo',
      email: 'demo@chirpbot.local',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      authMethod: 'local',
      role: 'user'
    });
    console.log('✅ Demo user created (username: demo, password: demo123)');
  } else {
    // Update password in case it was corrupted
    const hashedPassword = await bcrypt.hash('demo123', 10);
    await storage.updateUser(demoUser.id, { password: hashedPassword });
    console.log('✅ Demo user exists - password reset to demo123');
  }

  console.log('✅ Database seeding completed successfully!');
}