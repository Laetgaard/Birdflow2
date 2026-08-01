// Tests for the truthful custom-domain state machine (task: custom domains
// must connect truthfully end to end). Pure functions only — no network.
import { describe, it, expect } from "vitest";
import {
  deriveDomainStatus,
  buildDnsInstructions,
  counterpartOf,
  twinHostOf,
  planDomainDetach,
  projectNameForWebsite,
} from "./domainConnection";
import type { DomainDnsConfig } from "./publisher/vercel";

// Shape mirrors real /v6/domains/:domain/config responses (rank 1 = current
// recommendation, rank 2 = legacy values).
const dnsConfig: DomainDnsConfig = {
  misconfigured: true,
  recommendedIPv4: [
    { rank: 2, value: ["76.76.21.21"] },
    { rank: 1, value: ["216.198.79.1", "64.29.17.1"] },
  ],
  recommendedCNAME: [
    { rank: 2, value: "cname.vercel-dns.com" },
    { rank: 1, value: "808f944a2ca231be.vercel-dns-017.com." },
  ],
};

describe("deriveDomainStatus", () => {
  it("never reports active when DNS is not configured, even if Vercel says verified (cocio.com regression)", () => {
    // Vercel returns verified:true for unclaimed domains instantly — that is
    // ownership only. With misconfigured DNS the domain must stay pending.
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: false, serves: false })
    ).toBe("pending");
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: false, serves: false, previousStatus: "verifying" })
    ).toBe("pending");
  });

  it("stays pending while ownership is unverified even with correct DNS", () => {
    expect(
      deriveDomainStatus({ ownershipVerified: false, dnsConfigured: true, serves: false })
    ).toBe("pending");
  });

  it("is verifying when DNS is right but the site does not serve yet (cert issuance)", () => {
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: true, serves: false })
    ).toBe("verifying");
  });

  it("is active only when the domain actually serves", () => {
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: true, serves: true })
    ).toBe("active");
  });

  it("does not flap an active domain to verifying on a transient probe failure", () => {
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: true, serves: false, previousStatus: "active" })
    ).toBe("active");
  });

  it("demotes an active domain when Vercel reports DNS broken", () => {
    expect(
      deriveDomainStatus({ ownershipVerified: true, dnsConfigured: false, serves: false, previousStatus: "active" })
    ).toBe("pending");
  });
});

describe("counterpartOf", () => {
  it("pairs apex with www and www with apex; deeper subdomains have no twin", () => {
    expect(counterpartOf("example.com", "example.com")).toBe("www.example.com");
    expect(counterpartOf("www.example.com", "example.com")).toBe("example.com");
    expect(counterpartOf("shop.example.com", "example.com")).toBeNull();
  });
});

describe("buildDnsInstructions", () => {
  it("apex domain: required A record from Vercel rank-1 recommendation + recommended www CNAME", () => {
    const records = buildDnsInstructions({
      domain: "example.com",
      apexName: "example.com",
      counterpart: "www.example.com",
      dnsConfig,
      verification: null,
      ownershipVerified: true,
    });
    expect(records).toEqual([
      { type: "A", name: "@", value: "216.198.79.1", purpose: "routing", required: true },
      { type: "CNAME", name: "www", value: "808f944a2ca231be.vercel-dns-017.com", purpose: "counterpart", required: false },
    ]);
  });

  it("www domain: required CNAME (trailing dot stripped) + recommended apex A record", () => {
    const records = buildDnsInstructions({
      domain: "www.example.com",
      apexName: "example.com",
      counterpart: "example.com",
      dnsConfig,
      verification: null,
      ownershipVerified: true,
    });
    expect(records).toEqual([
      { type: "CNAME", name: "www", value: "808f944a2ca231be.vercel-dns-017.com", purpose: "routing", required: true },
      { type: "A", name: "@", value: "216.198.79.1", purpose: "counterpart", required: false },
    ]);
  });

  it("deep subdomain: single required CNAME, no counterpart", () => {
    const records = buildDnsInstructions({
      domain: "shop.example.com",
      apexName: "example.com",
      counterpart: null,
      dnsConfig,
      verification: null,
      ownershipVerified: true,
    });
    expect(records).toEqual([
      { type: "CNAME", name: "shop", value: "808f944a2ca231be.vercel-dns-017.com", purpose: "routing", required: true },
    ]);
  });

  it("puts Vercel's ownership TXT challenge first (relative name) while unverified", () => {
    const records = buildDnsInstructions({
      domain: "example.com",
      apexName: "example.com",
      counterpart: "www.example.com",
      dnsConfig,
      verification: [
        { type: "TXT", domain: "_vercel.example.com", value: "vc-domain-verify=example.com,abc123", reason: "pending_domain_verification" },
      ],
      ownershipVerified: false,
    });
    expect(records[0]).toEqual({
      type: "TXT",
      name: "_vercel",
      value: "vc-domain-verify=example.com,abc123",
      purpose: "ownership",
      required: true,
    });
    expect(records.filter((r) => r.purpose === "routing")).toHaveLength(1);
  });

  it("omits the TXT challenge once ownership is verified", () => {
    const records = buildDnsInstructions({
      domain: "example.com",
      apexName: "example.com",
      counterpart: "www.example.com",
      dnsConfig,
      verification: [
        { type: "TXT", domain: "_vercel.example.com", value: "vc-domain-verify=stale", reason: "stale" },
      ],
      ownershipVerified: true,
    });
    expect(records.some((r) => r.purpose === "ownership")).toBe(false);
  });

  it("never invents records when Vercel returns no recommendations", () => {
    const records = buildDnsInstructions({
      domain: "example.com",
      apexName: "example.com",
      counterpart: "www.example.com",
      dnsConfig: { misconfigured: true },
      verification: null,
      ownershipVerified: true,
    });
    expect(records).toEqual([]);
  });
});

describe("twinHostOf", () => {
  it("pairs apex and www forms", () => {
    expect(twinHostOf("example.com")).toBe("www.example.com");
    expect(twinHostOf("www.example.com")).toBe("example.com");
  });

  it("gives deep subdomains no twin (heuristic without apex info)", () => {
    expect(twinHostOf("shop.example.com")).toBeNull();
    expect(twinHostOf("www.shop.example.com")).toBeNull();
    // Ambiguous multi-part TLD without apexName: conservatively no twin
    expect(twinHostOf("example.co.uk")).toBeNull();
  });

  it("is exact when Vercel's apexName is provided", () => {
    expect(twinHostOf("example.co.uk", "example.co.uk")).toBe("www.example.co.uk");
    expect(twinHostOf("www.example.co.uk", "example.co.uk")).toBe("example.co.uk");
    expect(twinHostOf("shop.example.com", "example.com")).toBeNull();
  });
});

describe("planDomainDetach (deleting a domain never detaches a hostname another row owns)", () => {
  it("deleting apex while a www row exists removes only the apex from Vercel", () => {
    expect(planDomainDetach("example.com", "www.example.com", true)).toEqual(["example.com"]);
  });

  it("deleting www while an apex row exists removes only www from Vercel", () => {
    expect(planDomainDetach("www.example.com", "example.com", true)).toEqual(["www.example.com"]);
  });

  it("deleting apex with no www row also removes the auto-attached www twin", () => {
    expect(planDomainDetach("example.com", "www.example.com", false)).toEqual(["example.com", "www.example.com"]);
  });

  it("deleting www with no apex row also removes the auto-attached apex twin", () => {
    expect(planDomainDetach("www.example.com", "example.com", false)).toEqual(["www.example.com", "example.com"]);
  });

  it("deep subdomains detach only themselves", () => {
    expect(planDomainDetach("shop.example.com", twinHostOf("shop.example.com"), false)).toEqual(["shop.example.com"]);
  });
});

describe("projectNameForWebsite", () => {
  it("matches the publish-time convention", () => {
    expect(projectNameForWebsite("ABC-123")).toBe("site-abc-123");
  });
});
