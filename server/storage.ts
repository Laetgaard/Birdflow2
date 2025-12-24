import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and } from "drizzle-orm";
import { 
  profiles, type Profile, type InsertProfile,
  websites, type Website, type InsertWebsite,
  websiteInputs, type WebsiteInputs, type InsertWebsiteInputs,
  builderState, type BuilderState, type InsertBuilderState, type BuilderStateData
} from "@shared/schema";

// Use Supabase database as primary storage
// Try SUPABASE_DB_URL first (pooled), then fallback to SUPABASE_DATABASE_URL
const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;

if (!supabaseDbUrl) {
  console.error("SUPABASE_DB_URL or SUPABASE_DATABASE_URL is not set. Database operations will fail.");
}

const pool = new Pool({
  connectionString: supabaseDbUrl,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

// Default builder state for new websites
const defaultBuilderState: BuilderStateData = {
  pages: [
    {
      id: 'home',
      name: 'Home',
      path: '/',
      elements: [
        {
          id: 'header-1',
          type: 'header',
          children: [
            {
              id: 'nav-1',
              type: 'nav',
              content: 'Navigation',
              styles: {
                padding: '16px 24px',
                backgroundColor: '#ffffff',
              }
            }
          ],
          styles: {
            backgroundColor: '#ffffff',
          }
        },
        {
          id: 'section-hero',
          type: 'section',
          children: [
            {
              id: 'text-hero-title',
              type: 'text',
              content: 'Welcome to Your Website',
              styles: {
                fontSize: '48px',
                fontWeight: '700',
                textAlign: 'center',
                color: '#1a1a1a',
                margin: '0 0 16px 0'
              }
            },
            {
              id: 'text-hero-subtitle',
              type: 'text',
              content: 'Build something amazing with our website builder.',
              styles: {
                fontSize: '20px',
                textAlign: 'center',
                color: '#666666',
                margin: '0 0 32px 0'
              }
            },
            {
              id: 'button-cta',
              type: 'button',
              content: 'Get Started',
              styles: {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500'
              }
            }
          ],
          styles: {
            padding: '80px 24px',
            textAlign: 'center',
            backgroundColor: '#f8fafc'
          }
        },
        {
          id: 'section-features',
          type: 'section',
          children: [
            {
              id: 'text-features-title',
              type: 'text',
              content: 'Features',
              styles: {
                fontSize: '32px',
                fontWeight: '600',
                textAlign: 'center',
                color: '#1a1a1a',
                margin: '0 0 48px 0'
              }
            },
            {
              id: 'grid-features',
              type: 'grid',
              children: [
                {
                  id: 'text-feature-1',
                  type: 'text',
                  content: 'Feature One',
                  styles: {
                    fontSize: '18px',
                    fontWeight: '500',
                    textAlign: 'center'
                  }
                },
                {
                  id: 'text-feature-2',
                  type: 'text',
                  content: 'Feature Two',
                  styles: {
                    fontSize: '18px',
                    fontWeight: '500',
                    textAlign: 'center'
                  }
                },
                {
                  id: 'text-feature-3',
                  type: 'text',
                  content: 'Feature Three',
                  styles: {
                    fontSize: '18px',
                    fontWeight: '500',
                    textAlign: 'center'
                  }
                }
              ],
              styles: {
                padding: '24px'
              }
            }
          ],
          styles: {
            padding: '80px 24px',
            backgroundColor: '#ffffff'
          }
        },
        {
          id: 'footer-1',
          type: 'footer',
          children: [
            {
              id: 'text-footer',
              type: 'text',
              content: '© 2025 Your Company. All rights reserved.',
              styles: {
                fontSize: '14px',
                textAlign: 'center',
                color: '#666666'
              }
            }
          ],
          styles: {
            padding: '32px 24px',
            backgroundColor: '#1a1a1a',
            color: '#ffffff'
          }
        }
      ]
    }
  ],
  activePage: 'home',
  globalStyles: {
    primaryColor: '#3b82f6',
    fontFamily: 'Inter, sans-serif',
    backgroundColor: '#ffffff'
  }
};

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
  
  // Builder state methods
  getBuilderState(websiteId: string): Promise<BuilderState | undefined>;
  createBuilderState(websiteId: string, state?: BuilderStateData): Promise<BuilderState>;
  updateBuilderState(websiteId: string, state: BuilderStateData): Promise<BuilderState | undefined>;
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

  // Builder state methods
  async getBuilderState(websiteId: string): Promise<BuilderState | undefined> {
    const result = await db
      .select()
      .from(builderState)
      .where(eq(builderState.websiteId, websiteId))
      .limit(1);
    return result[0] as BuilderState | undefined;
  }

  async createBuilderState(websiteId: string, state?: BuilderStateData): Promise<BuilderState> {
    const result = await db
      .insert(builderState)
      .values({
        websiteId,
        state: state || defaultBuilderState,
      } as any)
      .returning();
    return result[0] as BuilderState;
  }

  async updateBuilderState(websiteId: string, state: BuilderStateData): Promise<BuilderState | undefined> {
    const result = await db
      .update(builderState)
      .set({ state, updatedAt: new Date() } as any)
      .where(eq(builderState.websiteId, websiteId))
      .returning();
    return result[0] as BuilderState | undefined;
  }
}

export const storage = new DatabaseStorage();
