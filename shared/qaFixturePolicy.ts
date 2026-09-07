/**
 * The only persistent QA identities. Keep this deliberately small and exact:
 * QA labelling must never be inferred from a customer's name or email text.
 */
export const QA_FIXTURE_USERS = {
  scratch: {
    email: "qa-onboarding-scratch@fixtures.birdflow.invalid",
    fullName: "[QA FIXTURE] Scratch onboarding — Psykolog Roskilde",
    siteName: "[QA FIXTURE] Psykolog Roskilde (scratch)",
    slug: "qa-fixture-psykolog-roskilde-scratch",
  },
  import: {
    email: "qa-onboarding-import@fixtures.birdflow.invalid",
    fullName: "[QA FIXTURE] Import onboarding — Amalie Veber",
    siteName: "[QA FIXTURE] Amalie Veber import",
    slug: "qa-fixture-amalie-veber-import",
  },
} as const;

const qaEmails = new Set<string>(Object.values(QA_FIXTURE_USERS).map((fixture) => fixture.email));

export function isReservedQaFixtureEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && qaEmails.has(email);
}