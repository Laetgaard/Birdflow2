/**
 * Cap semantics for AI image generation (ai:// markers).
 *
 * The cap is on UNIQUE (aspect, description) generated assets per request —
 * repeating an admitted marker reuses one generated image across fields at no
 * extra cost. Only fields that would require a NEW asset beyond the cap are
 * skipped.
 */
import { describe, it, expect } from "vitest";
import {
  planImageJobs,
  imageJobKey,
  MAX_AI_IMAGES_PER_REQUEST,
  type ImageAspect,
} from "./aiImages";

const slot = (description: string, aspect: ImageAspect = "landscape") => ({ description, aspect });

describe("planImageJobs", () => {
  it("deduplicates identical markers into one job", () => {
    const { jobs, skippedSlots } = planImageJobs([
      slot("nordisk kystlinje"),
      slot("nordisk kystlinje"),
      slot("nordisk kystlinje"),
      slot("nordisk kystlinje"),
      slot("nordisk kystlinje"),
    ]);
    expect(jobs.size).toBe(1);
    expect(skippedSlots).toBe(0);
  });

  it("does not charge budget for repeats of admitted markers", () => {
    // Exactly MAX_AI_IMAGES_PER_REQUEST unique descriptions, with many
    // repeats of one of them — repeats must not consume extra budget slots.
    const slots = [
      slot("a"),
      slot("b"),
      slot("c"),
      slot("d"),
      slot("e"),
      ...Array.from({ length: 10 }, () => slot("a")),
    ];
    const { jobs, skippedSlots } = planImageJobs(slots);
    expect(jobs.size).toBe(MAX_AI_IMAGES_PER_REQUEST);
    expect(skippedSlots).toBe(0);
  });

  it("skips every FIELD that needs a new asset beyond the cap", () => {
    // Use MAX+1 unique descriptions so the last one overflows the cap.
    // a–e are admitted (5 = current cap); f is the 6th unique and is
    // skipped along with its two duplicates → skippedSlots = 3.
    const { jobs, skippedSlots } = planImageJobs([
      slot("a"),
      slot("b"),
      slot("c"),
      slot("d"),
      slot("e"),
      slot("f"), // 6th unique — exceeds cap
      slot("f"),
      slot("f"),
    ]);
    expect(jobs.size).toBe(MAX_AI_IMAGES_PER_REQUEST);
    expect(skippedSlots).toBe(3);
    expect(jobs.has(imageJobKey(slot("f")))).toBe(false);
  });

  it("treats the same description in different aspects as distinct assets", () => {
    const { jobs, skippedSlots } = planImageJobs([
      slot("logo mønster", "square"),
      slot("logo mønster", "landscape"),
    ]);
    expect(jobs.size).toBe(2);
    expect(skippedSlots).toBe(0);
  });

  it("admitted jobs stay resolvable for every duplicate slot", () => {
    const slots = [slot("hero"), slot("hero"), slot("galleri", "square")];
    const { jobs } = planImageJobs(slots);
    for (const s of slots) {
      expect(jobs.has(imageJobKey(s))).toBe(true);
    }
  });
});
