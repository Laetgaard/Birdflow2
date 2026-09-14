/**
 * Creating a client's account on their behalf, from the admin panel.
 *
 * Until now a person could only exist in BirdFlow by signing up themselves
 * with a password. An administrator migrating a client's website needs the
 * account to exist before the client has ever heard of it — so the user is
 * created through Supabase's admin API with NO password. Nobody can sign in
 * as them: the client sets their own password from the invite link that is
 * sent only once the admin approves the finished site.
 *
 * The plan is granted without Stripe. It is marked `manual` so billing code
 * knows no subscription backs it, and it carries an end date so a comped
 * account does not stay comped by accident. Stripe's webhooks key on a
 * Stripe customer id, which a manual account does not have, so they cannot
 * overwrite this state.
 *
 * Everything here is server-only. None of it is reachable through the
 * customer's own profile endpoints, whose schema stays strict.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { storage } from "../storage";
import type { Profile } from "@shared/schema";

export type CreatedAccount = {
  userId: string;
  email: string;
  created: boolean;
  profile: Profile;
};

export class AccountExistsError extends Error {
  readonly userId?: string;
  constructor(message: string, userId?: string) {
    super(message);
    this.name = "AccountExistsError";
    this.userId = userId;
  }
}

export function supabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create accounts for clients");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Create the auth user and the profile. The account has no password and the
 * email is marked confirmed, so the recovery link sent at approval is the
 * one and only way in.
 */
export async function createClientAccount(input: {
  email: string;
  fullName: string;
  phone?: string;
  adminId: string;
}): Promise<CreatedAccount> {
  const email = input.email.trim().toLowerCase();
  const existingProfile = await storage.getProfileByEmail(email);
  if (existingProfile) {
    throw new AccountExistsError("En konto med den e-mail findes allerede.", existingProfile.id);
  }

  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, phone_number: input.phone ?? "" },
    app_metadata: { birdflowMigration: true, createdByAdmin: input.adminId },
  });
  if (error || !data.user) {
    const message = error?.message ?? "Kontoen kunne ikke oprettes";
    if (/already|exists|registered/i.test(message)) throw new AccountExistsError("En konto med den e-mail findes allerede.");
    throw new Error(message);
  }

  const profile = await storage.createProfile({
    id: data.user.id,
    email,
    fullName: input.fullName,
    phoneNumber: input.phone ?? "",
  });
  return { userId: data.user.id, email, created: true, profile };
}

/** Attach the migration to an account that already exists. */
export async function attachExistingAccount(userId: string): Promise<CreatedAccount> {
  const profile = await storage.getProfile(userId);
  if (!profile) throw new Error("Brugeren findes ikke.");
  const websites = await storage.getWebsitesByOwner(userId);
  if (websites.length > 0) {
    throw new Error("Brugeren har allerede en hjemmeside. Migrering kan kun knyttes til en tom konto.");
  }
  return { userId, email: profile.email, created: false, profile };
}

/** Grant a plan without Stripe: manual status plus an end date. */
export async function grantManualPlan(userId: string, input: { planSlug: string; months: number }): Promise<Profile | undefined> {
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, Math.min(24, Math.round(input.months))));
  return storage.setManualPlan(userId, { planSlug: input.planSlug, currentPeriodEnd: end });
}

/**
 * The client never goes through the self-service walkthrough: their site is
 * being built for them. Mark onboarding done and leave a session that says
 * who did it, so the decision screens know this customer was migrated.
 */
export async function markOnboardingHandled(userId: string, websiteId: string, jobId: string, sourceUrl: string): Promise<void> {
  await storage.completeOnboarding(userId);
  await storage.upsertOnboardingSession(userId, {
    websiteId,
    answers: { path: "import", clientMigration: { jobId, sourceUrl } },
  });
  await storage.setOnboardingStates(userId, { generationState: "complete", decisionState: "in_customisation" });
}

/**
 * A recovery link is the invite: the account has no password, so "reset"
 * is how the client chooses their first one. Returns the link for
 * environments that cannot send mail, so the admin can hand it over.
 */
export async function createInviteLink(email: string, redirectTo: string): Promise<{ link: string; expiresAt: Date }> {
  const supabase = supabaseAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) {
    throw new Error(error?.message ?? "Invitationslinket kunne ikke oprettes");
  }
  // Supabase's default OTP validity is one hour.
  return { link: data.properties.action_link, expiresAt: new Date(Date.now() + 60 * 60_000) };
}
