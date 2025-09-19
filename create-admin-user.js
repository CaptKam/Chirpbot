
const { storage } = require('./server/storage.ts');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername('admin');
    if (existingAdmin) {
      console.log('✅ Admin user already exists with username "admin"');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await storage.createUser({
      username: 'admin',
      email: 'admin@chirpbot.local',
      password: hashedPassword,
      role: 'admin',
      authMethod: 'local'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Please change this password after first login.');
    console.log('Admin panel URL: /admin-panel');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

createAdminUser();
