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
  deploymentUrl: text("deployment_url"),
  deploymentId: text("deployment_id"),
  lastPublishedAt: timestamp("last_published_at"),
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

// Builder component types - re-exported from componentRegistry for consistency
export type { 
  ComponentType,
  BuilderComponentData as BuilderComponent,
  ComponentProps,
  ComponentStyles,
  ComponentItem,
} from './componentRegistry';

export type BuilderPage = {
  id: string;
  name: string;
  path: string;
  components: import('./componentRegistry').BuilderComponentData[];
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    backgroundColor: string;
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

// Orders table (for ecommerce)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("pending"),
  total: text("total").notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  items: jsonb("items").$type<Array<{ id: string; name: string; quantity: number; price: number }>>(),
  shippingAddress: jsonb("shipping_address").$type<{ street: string; city: string; state: string; zip: string; country: string }>(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Bookings table (for appointments/services)
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  service: text("service").notNull(),
  date: timestamp("date").notNull(),
  duration: text("duration"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Form submissions table
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  formName: text("form_name").notNull(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  read: text("read").notNull().default("false"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  totalOrders: text("total_orders").notNull().default("0"),
  totalSpent: text("total_spent").notNull().default("0"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Products table (for product catalog)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price").notNull().default("0"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
