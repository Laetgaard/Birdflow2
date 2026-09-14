/**
 * Telling the client their site is ready — only once the admin has said so.
 *
 * The invite is a recovery link: the account was created without a password
 * and this is how the client chooses their first. Outside production the
 * mail transport has no credentials, so the link is returned to the admin
 * instead of pretending a mail went out.
 */

import { storage } from "../storage";
import { emailService } from "../email/service";
import { resolveAppOrigin } from "../stripeConnect";
import { createInviteLink } from "./adminAccounts";

export type InviteOutcome = {
  link: string;
  expiresAt: Date;
  emailSent: boolean;
  emailSkipped: string | null;
};

export async function sendClientInvite(args: { clientUserId: string; websiteId: string; sourceUrl: string; requestHost?: string }): Promise<InviteOutcome> {
  const profile = await storage.getProfile(args.clientUserId);
  if (!profile?.email) throw new Error("Kunden har ingen e-mailadresse.");
  const website = await storage.getWebsite(args.websiteId);
  const origin = resolveAppOrigin(args.requestHost);
  const { link, expiresAt } = await createInviteLink(profile.email, `${origin}/reset-password`);

  let emailSent = false;
  let emailSkipped: string | null = null;
  if (process.env.NODE_ENV !== "production") {
    emailSkipped = "development";
  } else {
    try {
      emailSent = await emailService.sendMigrationInvite(profile.email, args.websiteId, {
        customerName: profile.fullName || profile.email.split("@")[0],
        websiteName: website?.name || "din hjemmeside",
        sourceHost: safeHost(args.sourceUrl),
        inviteUrl: link,
      });
      if (!emailSent) emailSkipped = "send-failed";
    } catch (error) {
      emailSkipped = "send-failed";
      console.error("[ClientMigration] invite email failed:", error);
    }
  }
  return { link, expiresAt, emailSent, emailSkipped };
}

export function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
