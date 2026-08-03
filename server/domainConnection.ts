// Single source of truth for connecting custom domains to published sites.
// Every path (manual add, purchase auto-connect, the user's "check now"
// button, and the server-side verification loop) goes through these helpers
// so a domain is only ever reported "active" after real verification:
//
//   pending   = user still needs to change DNS (or complete the ownership TXT
//               challenge Vercel requires when a domain is claimed elsewhere)
//   verifying = Vercel sees correct DNS; certificate/edge activation pending
//   active    = the domain actually serves over HTTPS (verifiedAt recorded)
//   error     = Vercel rejected the domain
//
// Vercel semantics worth remembering (confirmed against the live API):
// - Project-domain `verified` means OWNERSHIP only. Unclaimed domains are
//   `verified: true` immediately, with zero DNS configured. Treating it as
//   "connected" is exactly the bug that showed domains as active while dead.
// - DNS truth (misconfigured flag + the records Vercel actually wants) comes
//   from GET /v6/domains/:domain/config.
import {
  addCustomDomain,
  removeCustomDomain,
  getProjectDomain,
  getDomainDnsConfig,
  verifyProjectDomain,
  getProductionAliasUrl,
  type VercelConfig,
  type ProjectDomainStatus,
  type DomainDnsConfig,
  type VercelVerificationChallenge,
} from "./publisher/vercel";
import type { CustomDomain, DnsInstruction, DomainStatus } from "@shared/schema";
import { storage } from "./storage";

export function getVercelConfig(): VercelConfig | null {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  return { token, teamId: process.env.VERCEL_TEAM_ID };
}

// Canonical Vercel project name for a website. Must match publisher/index.ts.
export function projectNameForWebsite(websiteId: string): string {
  return `site-${websiteId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

// The www/apex twin we attach automatically so both hosts work when an apex
// domain is connected. Deeper subdomains (shop.example.com) have no twin.
export function counterpartOf(domain: string, apexName: string): string | null {
  if (domain === apexName) return `www.${domain}`;
  if (domain === `www.${apexName}`) return apexName;
  return null;
}

function bestApexGuess(domain: string): string {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

function firstRecommendedIPv4(cfg: DomainDnsConfig): string | null {
  const ranked = (cfg.recommendedIPv4 || []).slice().sort((a, b) => a.rank - b.rank);
  return ranked[0]?.value?.[0] ?? null;
}

function firstRecommendedCNAME(cfg: DomainDnsConfig): string | null {
  const ranked = (cfg.recommendedCNAME || []).slice().sort((a, b) => a.rank - b.rank);
  const value = ranked[0]?.value;
  return value ? value.replace(/\.$/, "") : null;
}

// Build the DNS records to show the user — always from Vercel's own config
// response (recommendedIPv4/recommendedCNAME + ownership challenges), never
// from locally invented defaults. Exported for tests.
export function buildDnsInstructions(params: {
  domain: string;
  apexName: string;
  counterpart: string | null;
  dnsConfig: DomainDnsConfig;
  verification?: VercelVerificationChallenge[] | null;
  ownershipVerified: boolean;
}): DnsInstruction[] {
  const { domain, apexName, counterpart, dnsConfig, verification, ownershipVerified } = params;
  const records: DnsInstruction[] = [];

  // 1) Ownership TXT challenge — required first when Vercel demands it.
  if (!ownershipVerified && verification && verification.length > 0) {
    for (const challenge of verification) {
      if ((challenge.type || "").toUpperCase() !== "TXT") continue;
      const host = challenge.domain || `_vercel.${apexName}`;
      const name = host.endsWith(`.${apexName}`) ? host.slice(0, -(apexName.length + 1)) : host;
      records.push({ type: "TXT", name, value: challenge.value, purpose: "ownership", required: true });
    }
  }

  // 2) Routing record for the submitted host.
  const aValue = firstRecommendedIPv4(dnsConfig);
  const cnameValue = firstRecommendedCNAME(dnsConfig);
  if (domain === apexName) {
    if (aValue) {
      records.push({ type: "A", name: "@", value: aValue, purpose: "routing", required: true });
    }
  } else {
    const sub = domain.endsWith(`.${apexName}`) ? domain.slice(0, -(apexName.length + 1)) : domain;
    if (cnameValue) {
      records.push({ type: "CNAME", name: sub, value: cnameValue, purpose: "routing", required: true });
    }
  }

  // 3) Record for the automatically attached www/apex twin (recommended so
  // both hosts resolve; the twin redirects to the submitted host).
  if (counterpart) {
    if (counterpart === apexName) {
      if (aValue) {
        records.push({ type: "A", name: "@", value: aValue, purpose: "counterpart", required: false });
      }
    } else if (cnameValue) {
      records.push({ type: "CNAME", name: "www", value: cnameValue, purpose: "counterpart", required: false });
    }
  }

  return records;
}

// Truthful status derivation. Exported for tests.
export function deriveDomainStatus(params: {
  ownershipVerified: boolean;
  dnsConfigured: boolean;
  serves: boolean;
  previousStatus?: string | null;
}): DomainStatus {
  const { ownershipVerified, dnsConfigured, serves, previousStatus } = params;
  if (!ownershipVerified || !dnsConfigured) return "pending";
  if (serves) return "active";
  // Ownership + DNS are right; only certificate/edge activation can be in
  // flight. Never downgrade an already-active domain on a transient probe
  // failure — Vercel's misconfigured flag (handled above) is what demotes.
  return previousStatus === "active" ? "active" : "verifying";
}

// Any completed HTTPS response proves DNS + TLS + routing reach a live edge.
export async function probeHttps(domain: string, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`https://${domain}/`, { redirect: "follow", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type AttachResult = {
  success: boolean;
  error?: string;
  domainStatus?: ProjectDomainStatus;
  counterpart: string | null;
};

// Attach a domain to the project, plus its www/apex twin as a redirect so
// both hosts work. The twin is best-effort and never attached over another
// customer's domain row.
export async function attachDomainPair(
  projectName: string,
  domain: string,
  config: VercelConfig
): Promise<AttachResult> {
  let domainStatus: ProjectDomainStatus | undefined;

  const added = await addCustomDomain(projectName, domain, config);
  if (added.success) {
    domainStatus = added.domainStatus;
  } else {
    // "Already in use" by THIS project is fine — treat as attached.
    const existing = await getProjectDomain(projectName, domain, config);
    if (!existing.ok || !existing.status) {
      return { success: false, error: added.error || "Failed to add domain", counterpart: null };
    }
    domainStatus = existing.status;
  }

  const apexName = domainStatus?.apexName || bestApexGuess(domain);
  const twin = counterpartOf(domain, apexName);
  if (twin) {
    try {
      // Never convert a domain another website row owns into a redirect.
      const twinRow = await storage.getCustomDomainByDomain(twin);
      if (!twinRow) {
        const twinAdd = await addCustomDomain(projectName, twin, config, {
          redirect: domain,
          redirectStatusCode: 308,
        });
        if (!twinAdd.success) {
          console.log(`[Domains] Counterpart ${twin} not attached (${twinAdd.error || "unknown"}) — continuing`);
        }
      }
    } catch (err) {
      console.error(`[Domains] Counterpart attach failed for ${twin}:`, err);
    }
  }

  return { success: true, domainStatus, counterpart: twin };
}

// The www/apex twin hostname of a stored domain. With Vercel's authoritative
// apexName this is exact; without it, a conservative string heuristic only
// pairs 2-label apexes with their www forms — deep subdomains and ambiguous
// multi-part TLDs (example.co.uk) get NO twin rather than a wrong one.
export function twinHostOf(domain: string, apexName?: string | null): string | null {
  if (apexName) return counterpartOf(domain, apexName);
  if (domain.startsWith("www.")) {
    const rest = domain.slice(4);
    return rest.split(".").length === 2 ? rest : null;
  }
  return domain.split(".").length === 2 ? `www.${domain}` : null;
}

// Resolve the twin via Vercel's apexName when reachable, falling back to the
// conservative heuristic. Never throws.
export async function resolveTwinHost(
  projectName: string,
  domain: string,
  config: VercelConfig
): Promise<string | null> {
  try {
    const projectDomain = await getProjectDomain(projectName, domain, config);
    if (projectDomain.ok && projectDomain.status?.apexName) {
      return counterpartOf(domain, projectDomain.status.apexName);
    }
  } catch {
    /* fall through to heuristic */
  }
  return twinHostOf(domain);
}

// Pure decision: which hostnames to remove from the Vercel project when a
// stored domain row is deleted. The auto-attached twin is removed only when
// no other custom-domain row owns that hostname. Exported for tests.
export function planDomainDetach(
  domain: string,
  twinHost: string | null,
  twinRowExists: boolean
): string[] {
  const hosts = [domain];
  if (twinHost && !twinRowExists) hosts.push(twinHost);
  return hosts;
}

// Remove a domain and (when safe) its auto-attached twin from the Vercel
// project. IMPORTANT: callers must resolve `twinHost`/`twinRowExists` BEFORE
// deleting the primary row, so the protection decision never races the
// deletion and a hostname represented by another database row is never
// detached.
export async function detachDomainPair(
  projectName: string,
  domain: string,
  config: VercelConfig,
  opts: { twinHost: string | null; twinRowExists: boolean }
): Promise<void> {
  for (const host of planDomainDetach(domain, opts.twinHost, opts.twinRowExists)) {
    try {
      await removeCustomDomain(projectName, host, config);
    } catch (err) {
      console.error(`[Domains] Failed to detach ${host} from ${projectName}:`, err);
    }
  }
}

export type DomainCheckResult = {
  status: DomainStatus;
  // null = fresh truth unavailable (transient Vercel/API failure); keep
  // whatever records are already stored.
  dnsRecords: DnsInstruction[] | null;
  errorMessage: string | null;
  ownershipVerified: boolean;
  dnsConfigured: boolean;
  serves: boolean;
  checkFailed?: boolean;
};

// Query Vercel for the truthful state of a domain and the exact DNS records
// it requires right now.
export async function checkDomain(
  projectName: string,
  domain: string,
  config: VercelConfig,
  opts?: {
    previousStatus?: string | null;
    reattach?: boolean;
    probe?: (domain: string) => Promise<boolean>;
  }
): Promise<DomainCheckResult> {
  const previousStatus = opts?.previousStatus ?? null;
  const keepPrevious = (checkFailed: boolean, errorMessage: string | null): DomainCheckResult => ({
    status: (previousStatus as DomainStatus) || "pending",
    dnsRecords: null,
    errorMessage,
    ownershipVerified: false,
    dnsConfigured: false,
    serves: false,
    checkFailed,
  });

  // 1) Attachment + ownership state on the project.
  let projectDomain = await getProjectDomain(projectName, domain, config);
  if (projectDomain.notFound && opts?.reattach !== false) {
    const attach = await attachDomainPair(projectName, domain, config);
    if (!attach.success) {
      return {
        status: "error",
        dnsRecords: null,
        errorMessage: attach.error || "Domænet kunne ikke tilføjes hos hosting-tjenesten",
        ownershipVerified: false,
        dnsConfigured: false,
        serves: false,
      };
    }
    projectDomain = { ok: true, status: attach.domainStatus };
  }
  if (!projectDomain.ok || !projectDomain.status) {
    // Transient API failure — don't guess, keep the previous state.
    return keepPrevious(true, null);
  }

  let ownershipVerified = projectDomain.status.verified === true;
  let verification = projectDomain.status.verification ?? null;

  // 2) If ownership is unverified, ask Vercel to re-check the TXT challenge.
  if (!ownershipVerified) {
    const verifyResult = await verifyProjectDomain(projectName, domain, config);
    if (verifyResult.success || verifyResult.verification) {
      ownershipVerified = verifyResult.ownershipVerified;
      verification = verifyResult.verification ?? verification;
    }
  }

  // 3) DNS truth for the submitted host.
  const dnsConfig = await getDomainDnsConfig(domain, config);
  if (!dnsConfig) {
    return keepPrevious(true, null);
  }
  const dnsConfigured = dnsConfig.misconfigured === false;

  // 4) Only probe when the domain could be live; "active" additionally means
  // the site really serves over HTTPS.
  let serves = false;
  if (ownershipVerified && dnsConfigured) {
    serves = await (opts?.probe ?? probeHttps)(domain);
  }

  const status = deriveDomainStatus({ ownershipVerified, dnsConfigured, serves, previousStatus });
  const apexName = projectDomain.status.apexName || bestApexGuess(domain);
  const dnsRecords = buildDnsInstructions({
    domain,
    apexName,
    counterpart: counterpartOf(domain, apexName),
    dnsConfig,
    verification,
    ownershipVerified,
  });

  return { status, dnsRecords, errorMessage: null, ownershipVerified, dnsConfigured, serves };
}

// Run a truthful check for a stored domain row and persist the outcome:
// status transitions, Vercel's current DNS records, verifiedAt on the first
// real activation, and the website's deployment URL once live.
export async function refreshDomainState(
  row: CustomDomain,
  config: VercelConfig
): Promise<{ row: CustomDomain; check: DomainCheckResult }> {
  const projectName = row.vercelProjectId || projectNameForWebsite(row.websiteId);
  const check = await checkDomain(projectName, row.domain, config, { previousStatus: row.status });

  const updates: Partial<CustomDomain> = {
    status: check.status,
    lastCheckedAt: new Date(),
  };

  if (check.dnsRecords) {
    updates.dnsRecords = check.dnsRecords;
    const primary = check.dnsRecords.find((r) => r.purpose === "routing") ?? check.dnsRecords[0];
    if (primary) {
      updates.dnsType = primary.type;
      updates.dnsName = primary.name;
      updates.dnsValue = primary.value;
    }
  }

  if (check.status === "error") {
    updates.errorMessage = check.errorMessage || "Ukendt fejl";
  } else if (!check.checkFailed) {
    updates.errorMessage = null;
  }

  const becameActive = check.status === "active" && row.status !== "active";
  if (check.status === "active" && !row.verifiedAt) {
    updates.verifiedAt = new Date();
  }

  const updated = await storage.updateCustomDomain(row.id, row.websiteId, updates);

  if (becameActive) {
    try {
      const website = await storage.getWebsite(row.websiteId);
      if (website) {
        await storage.setWebsiteDeploymentUrl(row.websiteId, `https://${row.domain}`);
        console.log(`[Domains] ${row.domain} is live — deployment_url updated for website ${row.websiteId}`);
      }
    } catch (err) {
      console.error(`[Domains] Failed to update deployment_url for ${row.domain}:`, err);
    }
  }

  return { row: updated ?? ({ ...row, ...updates } as CustomDomain), check };
}

// After deleting a domain, point the website back at its stable *.vercel.app
// alias when the deployment URL referenced the deleted domain.
export async function restoreDeploymentUrlAfterDelete(
  websiteId: string,
  deletedDomain: string,
  vercelProjectId: string | null,
  config: VercelConfig | null
): Promise<void> {
  try {
    const website = await storage.getWebsite(websiteId);
    if (!website?.deploymentUrl) return;
    const url = website.deploymentUrl.toLowerCase();
    const affected =
      url === `https://${deletedDomain}` ||
      url === `https://www.${deletedDomain}` ||
      url === `https://${bestApexGuess(deletedDomain)}`;
    if (!affected) return;

    const alias =
      config && vercelProjectId ? await getProductionAliasUrl(vercelProjectId, config) : null;
    if (alias) {
      await storage.setWebsiteDeploymentUrl(websiteId, alias);
      console.log(`[Domains] Restored deployment_url to ${alias} after deleting ${deletedDomain}`);
    } else {
      console.warn(
        `[Domains] Could not resolve stable alias for website ${websiteId} after deleting ${deletedDomain}; deployment_url left unchanged`
      );
    }
  } catch (err) {
    console.error(`[Domains] Failed to restore deployment_url after deleting ${deletedDomain}:`, err);
  }
}
