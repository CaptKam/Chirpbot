import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, insertUserSchema, type InsertUser, type User } from "../shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User management
  createUser(user: InsertUser): Promise<User>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsernameOrEmail(usernameOrEmail: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<void>;
  verifyPassword(user: User, password: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createUser(userData: InsertUser): Promise<User> {
    const validated = insertUserSchema.parse(userData);
    
    // Hash password if provided
    if (validated.password) {
      validated.password = await bcrypt.hash(validated.password, 10);
    }

    const [user] = await db.insert(users).values(validated).returning();
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user[0];
  }

  async getUserByUsernameOrEmail(usernameOrEmail: string): Promise<User | undefined> {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, usernameOrEmail))
      .limit(1);
    
    if (user[0]) return user[0];

    const userByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, usernameOrEmail))
      .limit(1);
    
    return userByEmail[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<void> {
    await db.update(users).set(updates).where(eq(users.id, id));
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false;
    return await bcrypt.compare(password, user.password);
  }
}

// In-memory storage for development/testing
export class MemStorage implements IStorage {
  private users: User[] = [];
  private nextId = 1;

  async createUser(userData: InsertUser): Promise<User> {
    const validated = insertUserSchema.parse(userData);
    
    const user: User = {
      id: String(this.nextId++),
      username: validated.username || null,
      email: validated.email || null,
      password: validated.password ? await bcrypt.hash(validated.password, 10) : null,
      firstName: validated.firstName || null,
      lastName: validated.lastName || null,
      profileImage: validated.profileImage || null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.push(user);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsernameOrEmail(usernameOrEmail: string): Promise<User | undefined> {
    return this.users.find(u => 
      u.username === usernameOrEmail || u.email === usernameOrEmail
    );
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<void> {
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      this.users[userIndex] = { ...this.users[userIndex], ...updates, updatedAt: new Date() };
    }
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false;
    return await bcrypt.compare(password, user.password);
  }
}

// Export storage instance
export const storage: IStorage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();