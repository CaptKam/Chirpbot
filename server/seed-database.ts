
import bcrypt from 'bcryptjs';
import { storage } from './storage';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Create or update demo user with known credentials
  const demoUser = await storage.getUserByUsername('demo');
  const hashedPassword = await bcrypt.hash('demo123', 10);
  
  if (!demoUser) {
    console.log('📝 Creating demo user...');
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
    // Always reset password to ensure it's correct
    await storage.updateUser(demoUser.id, { password: hashedPassword });
    console.log('✅ Demo user password reset to: demo123');
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('🔑 LOGIN CREDENTIALS:');
  console.log('   Username: demo');
  console.log('   Password: demo123');
  console.log('');
}
