import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// Websites table
export const websites = pgTable("websites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  setupType: text("setup_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsiteSchema = createInsertSchema(websites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type Website = typeof websites.$inferSelect;

// Website inputs table (for customized setup data)
export const websiteInputs = pgTable("website_inputs", {
  id: serial("id").primaryKey(),
  websiteId: varchar("website_id").notNull(),
  businessDescription: text("business_description"),
  pages: jsonb("pages").$type<Array<{ name: string; description: string; images: string[] }>>(),
  features: jsonb("features").$type<string[]>(),
  designPreset: text("design_preset"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsiteInputsSchema = createInsertSchema(websiteInputs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsiteInputs = z.infer<typeof insertWebsiteInputsSchema>;
export type WebsiteInputs = typeof websiteInputs.$inferSelect;

// Builder element types
export type BuilderElement = {
  id: string;
  type: 'header' | 'section' | 'text' | 'image' | 'button' | 'footer' | 'nav' | 'grid';
  content?: string;
  children?: BuilderElement[];
  styles?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    fontWeight?: string;
    padding?: string;
    margin?: string;
    textAlign?: string;
    borderRadius?: string;
    width?: string;
    height?: string;
  };
  props?: Record<string, any>;
};

export type BuilderPage = {
  id: string;
  name: string;
  path: string;
  elements: BuilderElement[];
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles?: {
    primaryColor?: string;
    fontFamily?: string;
    backgroundColor?: string;
  };
};

// Builder state table
export const builderState = pgTable("builder_state", {
  id: serial("id").primaryKey(),
  websiteId: varchar("website_id").notNull().unique(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Manual insert schema to avoid circular reference issues with nested types
export const insertBuilderStateSchema = z.object({
  websiteId: z.string(),
  state: z.any(),
});

export type InsertBuilderState = {
  websiteId: string;
  state: BuilderStateData;
};

export type BuilderState = {
  id: number;
  websiteId: string;
  state: BuilderStateData;
  createdAt: Date;
  updatedAt: Date;
};
