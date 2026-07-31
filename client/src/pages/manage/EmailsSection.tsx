// Emails section wrapper - renders the email settings card.
import type { SectionProps } from "./types";
import { EmailSettingsCard } from "./EmailSettingsCard";

export function EmailsSection({ websiteId, accessToken }: SectionProps) {
  return <EmailSettingsCard websiteId={websiteId} accessToken={accessToken} />;
}
