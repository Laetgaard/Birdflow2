import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and } from "drizzle-orm";
import { 
  profiles, type Profile, type InsertProfile,
  websites, type Website, type InsertWebsite,
  websiteInputs, type WebsiteInputs, type InsertWebsiteInputs
} from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle(pool);

export interface IStorage {
  // Profile methods
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile & { id: string }): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Website methods
  getWebsite(id: string): Promise<Website | undefined>;
  getWebsitesByOwner(ownerId: string): Promise<Website[]>;
  createWebsite(website: InsertWebsite): Promise<Website>;
  updateWebsite(id: string, ownerId: string, data: Partial<InsertWebsite>): Promise<Website | undefined>;
  deleteWebsite(id: string, ownerId: string): Promise<boolean>;
  
  // Website inputs methods
  getWebsiteInputs(websiteId: string): Promise<WebsiteInputs | undefined>;
  createWebsiteInputs(inputs: InsertWebsiteInputs): Promise<WebsiteInputs>;
  updateWebsiteInputs(websiteId: string, data: Partial<InsertWebsiteInputs>): Promise<WebsiteInputs | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Profile methods
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

  // Website methods
  async getWebsite(id: string): Promise<Website | undefined> {
    const result = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return result[0];
  }

  async getWebsitesByOwner(ownerId: string): Promise<Website[]> {
    return await db.select().from(websites).where(eq(websites.ownerId, ownerId));
  }

  async createWebsite(website: InsertWebsite): Promise<Website> {
    const result = await db.insert(websites).values(website).returning();
    return result[0];
  }

  async updateWebsite(id: string, ownerId: string, data: Partial<InsertWebsite>): Promise<Website | undefined> {
    const result = await db
      .update(websites)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(websites.id, id), eq(websites.ownerId, ownerId)))
      .returning();
    return result[0];
  }

  async deleteWebsite(id: string, ownerId: string): Promise<boolean> {
    const result = await db
      .delete(websites)
      .where(and(eq(websites.id, id), eq(websites.ownerId, ownerId)))
      .returning();
    return result.length > 0;
  }

  // Website inputs methods
  async getWebsiteInputs(websiteId: string): Promise<WebsiteInputs | undefined> {
    const result = await db
      .select()
      .from(websiteInputs)
      .where(eq(websiteInputs.websiteId, websiteId))
      .limit(1);
    return result[0];
  }

  async createWebsiteInputs(inputs: InsertWebsiteInputs): Promise<WebsiteInputs> {
    const result = await db.insert(websiteInputs).values(inputs as any).returning();
    return result[0];
  }

  async updateWebsiteInputs(websiteId: string, data: Partial<InsertWebsiteInputs>): Promise<WebsiteInputs | undefined> {
    const result = await db
      .update(websiteInputs)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(websiteInputs.websiteId, websiteId))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
