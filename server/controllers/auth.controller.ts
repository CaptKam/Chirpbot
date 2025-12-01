import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { requireAdminAuth } from "../middleware/auth";
import { generateCSRFToken, validateCSRF } from "../middleware/csrf";

const router = Router();

router.get('/api/auth/user', async (req: Request, res: Response) => {
  try {
    if (req.session?.userId) {
      const user = await storage.getUserById(req.session.userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      }
    }

    if (req.session?.adminUserId) {
      const admin = await storage.getUserById(req.session.adminUserId);
      if (admin && admin.role === 'admin') {
        const { password, ...adminWithoutPassword } = admin;
        return res.json(adminWithoutPassword);
      }
    }

    res.status(401).json({ message: 'Not authenticated' });
  } catch (error) {
    console.error('Error checking authentication:', error);
    res.status(500).json({ message: 'Authentication check failed' });
  }
});

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    let user = await storage.getUserByUsername(usernameOrEmail);
    if (!user) {
      user = await storage.getUserByEmail(usernameOrEmail);
    }

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user.id;

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: 'Login successful', user: userWithoutPassword });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

router.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { username, email, password, usernameOrEmail, firstName, lastName } = req.body;

    let finalUsername = username;
    let finalEmail = email;

    if (usernameOrEmail && !username && !email) {
      if (usernameOrEmail.includes('@')) {
        finalEmail = usernameOrEmail;
        finalUsername = usernameOrEmail.split('@')[0];
      } else {
        finalUsername = usernameOrEmail;
        finalEmail = `${usernameOrEmail}@chirpbot.local`;
      }
    }

    if (!finalUsername || !finalEmail || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUserByUsername = await storage.getUserByUsername(finalUsername);
    if (existingUserByUsername) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const existingUserByEmail = await storage.getUserByEmail(finalEmail);
    if (existingUserByEmail) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await storage.createUser({
      username: finalUsername,
      email: finalEmail,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      authMethod: 'local',
      role: 'user'
    });

    req.session.userId = newUser.id;

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ message: 'Account created successfully', user: userWithoutPassword });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ message: 'Signup failed' });
  }
});

router.get('/api/auth/demo-check', async (req: Request, res: Response) => {
  try {
    const demoUser = await storage.getUserByUsername('demo');
    res.json({
      demoUserExists: !!demoUser,
      canLogin: !!demoUser?.password,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking demo user:', error);
    res.status(500).json({ message: 'Demo check failed' });
  }
});

router.post('/api/admin-auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await storage.getUserByUsername(username);
    if (!user || !user.password || user.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid credentials or not an admin' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.adminUserId = user.id;

    const { password: _, ...adminWithoutPassword } = user;
    res.json({ message: 'Admin login successful', user: adminWithoutPassword });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ message: 'Admin login failed' });
  }
});

router.get('/api/admin-auth/csrf-token', requireAdminAuth, generateCSRFToken, (req: Request, res: Response) => {
  res.json({
    csrfToken: req.csrfToken,
    timestamp: new Date().toISOString()
  });
});

router.get('/api/admin-auth/verify', async (req: Request, res: Response) => {
  try {
    if (req.session?.adminUserId) {
      const admin = await storage.getUserById(req.session.adminUserId);
      if (admin && admin.role === 'admin') {
        const { password, ...adminWithoutPassword } = admin;
        return res.json({
          authenticated: true,
          user: adminWithoutPassword
        });
      }
    }
    res.status(401).json({ authenticated: false, message: 'Not authenticated as admin' });
  } catch (error) {
    console.error('Error verifying admin:', error);
    res.status(500).json({ message: 'Admin verification failed' });
  }
});

router.post('/api/admin/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.json({ message: 'Admin logged out successfully' });
});

router.post('/api/admin-auth/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.json({ message: 'Admin logged out successfully' });
});

router.get('/api/admin-auth/check', async (req: Request, res: Response) => {
  try {
    if (req.session?.adminUserId) {
      const admin = await storage.getUserById(req.session.adminUserId);
      if (admin && admin.role === 'admin') {
        return res.json({ authenticated: true, role: 'admin' });
      }
    }
    res.json({ authenticated: false });
  } catch (error) {
    res.status(500).json({ message: 'Check failed' });
  }
});

router.get('/api/admin-auth/debug', async (req: Request, res: Response) => {
  res.json({
    hasSession: !!req.session,
    hasAdminUserId: !!req.session?.adminUserId,
    adminUserId: req.session?.adminUserId || null,
    sessionId: req.sessionID,
    timestamp: new Date().toISOString()
  });
});

export default router;
