import express from "express";
import { storage } from "./storage";
import { z } from "zod";

const router = express.Router();

// Login schema
const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Auth Routes
router.post("/api/auth/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = loginSchema.parse(req.body);
    
    const user = await storage.getUserByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await storage.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Store user in session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    res.json({ 
      user: req.session.user,
      message: "Login successful" 
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/register", async (req, res) => {
  try {
    const userData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsernameOrEmail(userData.username);
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingEmail = await storage.getUserByUsernameOrEmail(userData.email);
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const user = await storage.createUser(userData);
    
    // Store user in session
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    res.status(201).json({ 
      user: req.session.user,
      message: "Registration successful" 
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out" });
    }
    res.json({ message: "Logout successful" });
  });
});

router.get("/api/auth/user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.session.user });
});

// Health check
router.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;