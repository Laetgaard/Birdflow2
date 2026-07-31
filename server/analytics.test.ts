import { describe, it, expect } from "vitest";
import {
  classifyTrafficSource,
  extractUtmSource,
  fillDailySeries,
  copenhagenDayRange,
  copenhagenDateString,
} from "./analytics";

describe("classifyTrafficSource", () => {
  it("returns direct when there is no referrer and no utm", () => {
    expect(classifyTrafficSource({ referrer: "" })).toBe("direct");
    expect(classifyTrafficSource({ referrer: null })).toBe("direct");
    expect(classifyTrafficSource({})).toBe("direct");
  });

  it("classifies common referrer hosts", () => {
    expect(classifyTrafficSource({ referrer: "https://www.google.com/search?q=x" })).toBe("google");
    expect(classifyTrafficSource({ referrer: "https://google.dk/" })).toBe("google");
    expect(classifyTrafficSource({ referrer: "https://m.facebook.com/story" })).toBe("facebook");
    expect(classifyTrafficSource({ referrer: "https://l.instagram.com/?u=x" })).toBe("instagram");
    expect(classifyTrafficSource({ referrer: "https://t.co/abc" })).toBe("twitter");
    expect(classifyTrafficSource({ referrer: "https://www.linkedin.com/feed" })).toBe("linkedin");
    expect(classifyTrafficSource({ referrer: "https://youtu.be/xyz" })).toBe("youtube");
    expect(classifyTrafficSource({ referrer: "https://www.tiktok.com/@user" })).toBe("tiktok");
    expect(classifyTrafficSource({ referrer: "https://www.bing.com/search" })).toBe("bing");
    expect(classifyTrafficSource({ referrer: "https://mail.google.com/mail/u/0" })).toBe("email");
  });

  it("returns referral for unknown hosts and malformed referrers", () => {
    expect(classifyTrafficSource({ referrer: "https://someblog.dk/artikel" })).toBe("referral");
    expect(classifyTrafficSource({ referrer: "not a url" })).toBe("referral");
  });

  it("treats same-site referrers as direct", () => {
    expect(
      classifyTrafficSource({
        referrer: "https://www.minbutik.dk/produkter",
        pageHost: "minbutik.dk",
      })
    ).toBe("direct");
    expect(
      classifyTrafficSource({
        referrer: "https://shop.minbutik.dk/kurv",
        pageHost: "minbutik.dk",
      })
    ).toBe("direct");
  });

  it("prioritizes utm_source over referrer", () => {
    expect(
      classifyTrafficSource({ referrer: "https://www.google.com/", utmSource: "newsletter" })
    ).toBe("email");
    expect(classifyTrafficSource({ utmSource: "fb" })).toBe("facebook");
    expect(classifyTrafficSource({ utmSource: "IG" })).toBe("instagram");
    expect(classifyTrafficSource({ utmSource: "tiktok" })).toBe("tiktok");
    expect(classifyTrafficSource({ utmSource: "min-kampagne" })).toBe("referral");
  });
});

describe("extractUtmSource", () => {
  it("reads utm_source from absolute and relative urls", () => {
    expect(extractUtmSource("https://site.dk/?utm_source=facebook")).toBe("facebook");
    expect(extractUtmSource("/produkter?utm_source=google&utm_medium=cpc")).toBe("google");
  });

  it("returns null when absent or invalid", () => {
    expect(extractUtmSource("/produkter")).toBeNull();
    expect(extractUtmSource(null)).toBeNull();
    expect(extractUtmSource(undefined)).toBeNull();
  });
});

const HOUR = 60 * 60 * 1000;

function cphClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

describe("copenhagenDayRange", () => {
  it("starts at Copenhagen midnight and ends at the next local midnight", () => {
    const { start, end } = copenhagenDayRange(new Date("2026-07-15T10:00:00Z"));
    expect(cphClock(start)).toBe("00:00");
    expect(cphClock(end)).toBe("00:00");
    expect(copenhagenDateString(start)).toBe("2026-07-15");
    expect(copenhagenDateString(end)).toBe("2026-07-16");
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR);
  });

  it("handles late-evening UTC times that are already tomorrow in Copenhagen", () => {
    // 23:30 UTC on July 14 is 01:30 on July 15 in Copenhagen (UTC+2)
    const { start } = copenhagenDayRange(new Date("2026-07-14T23:30:00Z"));
    expect(copenhagenDateString(start)).toBe("2026-07-15");
  });

  it("spring-forward day is 23 hours (30 Mar 2026 DST start ... 29 Mar)", () => {
    // DST starts Sunday 29 March 2026 at 02:00 CET -> 03:00 CEST
    const { start, end } = copenhagenDayRange(new Date("2026-03-29T10:00:00Z"));
    expect(copenhagenDateString(start)).toBe("2026-03-29");
    expect(copenhagenDateString(end)).toBe("2026-03-30");
    expect(cphClock(start)).toBe("00:00");
    expect(cphClock(end)).toBe("00:00");
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR);
  });

  it("fall-back day is 25 hours (25 Oct 2026 DST end)", () => {
    // DST ends Sunday 25 October 2026 at 03:00 CEST -> 02:00 CET
    const { start, end } = copenhagenDayRange(new Date("2026-10-25T12:00:00Z"));
    expect(copenhagenDateString(start)).toBe("2026-10-25");
    expect(copenhagenDateString(end)).toBe("2026-10-26");
    expect(cphClock(start)).toBe("00:00");
    expect(cphClock(end)).toBe("00:00");
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR);
  });
});

describe("fillDailySeries", () => {
  it("fills missing days with zeroes across the range", () => {
    const start = new Date("2026-07-10T06:00:00Z");
    const end = new Date("2026-07-13T06:00:00Z");
    const points = fillDailySeries(
      [{ date: "2026-07-11", pageViews: 5, visitors: 2 }],
      start,
      end
    );
    expect(points.map(p => p.date)).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
    ]);
    expect(points[1]).toEqual({ date: "2026-07-11", pageViews: 5, visitors: 2 });
    expect(points[0]).toEqual({ date: "2026-07-10", pageViews: 0, visitors: 0 });
  });

  it("iterates calendar days across the spring DST transition", () => {
    const points = fillDailySeries(
      [],
      new Date("2026-03-28T10:00:00Z"),
      new Date("2026-03-31T10:00:00Z")
    );
    expect(points.map(p => p.date)).toEqual([
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
    ]);
  });

  it("does not duplicate a date across the autumn DST transition", () => {
    // 22:30 UTC on Oct 24 is already Oct 25 in Copenhagen (CEST). Stepping a
    // timestamp by 24h from here would land on Oct 25 23:30 CET = Oct 25
    // again - the calendar iteration must yield each date exactly once.
    const points = fillDailySeries(
      [],
      new Date("2026-10-24T22:30:00Z"),
      new Date("2026-10-27T12:00:00Z")
    );
    expect(points.map(p => p.date)).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });
});
