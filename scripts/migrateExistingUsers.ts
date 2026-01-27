import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, isNull } from "drizzle-orm";
import * as schema from "../shared/schema";
import type { PlatformPlanSlug } from "../shared/schema";

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Database connection string not found");
}

const neonClient = neon(connectionString);
const db = drizzle(neonClient, { schema });

async function migrateExistingUsers() {
  console.log("Starting migration of existing users to subscription system...\n");
  
  const existingProfiles = await db.select()
    .from(schema.profiles)
    .where(isNull(schema.profiles.planSlug));
  
  console.log(`Found ${existingProfiles.length} users without a subscription plan.\n`);
  
  if (existingProfiles.length === 0) {
    console.log("No users need migration. All users have subscription plans assigned.");
    return;
  }
  
  const gracePeriodDays = 14;
  const graceEndDate = new Date();
  graceEndDate.setDate(graceEndDate.getDate() + gracePeriodDays);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const profile of existingProfiles) {
    try {
      const userWebsites = await db.select()
        .from(schema.websites)
        .where(eq(schema.websites.ownerId, profile.id));
      
      let assignedPlan: PlatformPlanSlug | null;
      let subscriptionStatus: string | null = null;
      let trialEndsAt: Date | null = null;
      let currentPeriodEnd: Date | null = null;
      
      if (userWebsites.length >= 5) {
        assignedPlan = 'professional';
        subscriptionStatus = 'trialing';
        trialEndsAt = graceEndDate;
        currentPeriodEnd = graceEndDate;
      } else {
        assignedPlan = 'starter';
        subscriptionStatus = 'trialing';
        trialEndsAt = graceEndDate;
        currentPeriodEnd = graceEndDate;
      }
      
      await db.update(schema.profiles)
        .set({
          planSlug: assignedPlan,
          subscriptionStatus,
          trialEndsAt,
          currentPeriodEnd,
        })
        .where(eq(schema.profiles.id, profile.id));
      
      const planLabel = assignedPlan || 'starter';
      console.log(`✓ Migrated user ${profile.email}: assigned "${planLabel}" plan (${userWebsites.length} websites)`);
      successCount++;
      
    } catch (error: any) {
      console.error(`✗ Failed to migrate user ${profile.email}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log("\n=== Migration Summary ===");
  console.log(`Total users processed: ${existingProfiles.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Failed migrations: ${errorCount}`);
  console.log(`Grace period ends: ${graceEndDate.toLocaleDateString('da-DK')}`);
  
  if (successCount > 0) {
    console.log("\n⚠️  IMPORTANT: Users on trial plans have 14 days to select a paid subscription.");
    console.log("   After the grace period, their subscriptions will need to be activated via Stripe.");
  }
}

migrateExistingUsers()
  .then(() => {
    console.log("\nMigration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exit(1);
  });
