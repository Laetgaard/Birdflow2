/**
 * Saving the website without losing somebody else's work.
 *
 * Every writer that reads the builder state, spends time thinking, and then
 * writes it back is racing the canvas autosave (every two seconds) and any
 * running build. Whoever writes last used to win, and the other person's
 * change was gone with no trace — which for a structural edit means a page
 * order, a menu or a shared header quietly reverting.
 *
 * The row carries a monotonic revision. A writer passes the revision it read
 * and the write only lands if nothing has moved since. This module is the one
 * place that turns "it moved" into an answer the caller can act on, so the
 * message the customer sees is the same wherever the collision happened.
 */

import type { BuilderStateData } from "@shared/schema";
import { storage } from "./storage";

/** What the customer is told when two writers collided. Danish, one wording. */
export const BUILDER_CONFLICT_MESSAGE =
  "Websitet blev ændret et andet sted, mens der blev arbejdet på det. " +
  "Genindlæs editoren, så du arbejder videre på den nyeste version, og prøv igen.";

export type GuardedSave =
  | { ok: true; revision: number }
  | {
      ok: false;
      /** The revision that is actually in the database now. */
      revision: number;
      /** The state that won, so a client can adopt it instead of guessing. */
      state: BuilderStateData | null;
      message: string;
    };

/**
 * Write the state back, but only if nobody else has written since `expectedRevision`.
 *
 * Callers pass the revision they read at the start of their work. Nothing is
 * retried here on purpose: the new state was computed from the old one, so
 * replaying it against a changed site would reintroduce exactly the overwrite
 * this guard exists to prevent. The caller reports the conflict instead.
 */
export async function saveBuilderStateGuarded(
  websiteId: string,
  newState: BuilderStateData,
  expectedRevision: number | undefined
): Promise<GuardedSave> {
  const saved = await storage.updateBuilderState(websiteId, newState, expectedRevision);
  if (saved) return { ok: true, revision: saved.revision };

  const current = await storage.getBuilderState(websiteId);
  return {
    ok: false,
    revision: current?.revision ?? 0,
    state: (current?.state as BuilderStateData | undefined) ?? null,
    message: BUILDER_CONFLICT_MESSAGE,
  };
}
