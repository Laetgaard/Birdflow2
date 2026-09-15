/**
 * What the migration agent is told, in one place.
 *
 * The build pass and the corrective pass are the same agent doing the same
 * job at two moments, and their instructions drifted apart while they lived
 * inside two different files. Keeping them here means a rule added for one
 * is a rule the other keeps too.
 */

/** The standing rules: only the tools, only the customer's own words and pictures. */
export const MIGRATION_AGENT_SYSTEM_PROMPT =
  "You are BirdFlow's migration agent rebuilding a customer's page on a new platform. Use only the tools. Use only text and images already present on the page or supplied to you; never invent copy, never fetch anything, never use stock photography. Call finish when done.";

/** The same agent, later: the page exists and something about it is wrong. */
export const MIGRATION_CORRECTION_PROMPT =
  `${MIGRATION_AGENT_SYSTEM_PROMPT} This page is already built: change what is listed and leave the rest alone. Lines marked "measured" are facts about what the rebuild lacks, not opinions — put each one back.`;
