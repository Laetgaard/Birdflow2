import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import { profiles, type Profile, type InsertProfile } from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle(pool);

export interface IStorage {
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile & { id: string }): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return result[0];
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    return result[0];
  }

  async createProfile(profile: InsertProfile & { id: string }): Promise<Profile> {
    const result = await db.insert(profiles).values(profile).returning();
    return result[0];
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const result = await db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
