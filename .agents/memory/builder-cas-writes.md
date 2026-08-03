---
name: Builder CAS writes & revision propagation
description: Guarded builder-state saves — who passes which revision, why conflicts never retry, and why every save response must return the new revision.
---

# Guarded builder-state writes

- Every long-thinking writer (AI agent SSE tail, /ai/apply, architect build, design-interview finalize, GET-load migration persist) saves through a guarded CAS write, passing the revision it READ at the start of its work. Conflicts return the winning revision+state and are never retried — replaying a stale computation would reintroduce the very overwrite the guard prevents.
- **Every server-side save must return the revision it wrote, and every client path that adopts the returned state must adopt that revision too.** Otherwise the editor's next 2s autosave submits the old revision and gets a spurious 409: the AI change persisted, but the customer sees a conflict. This bit once — SSE result events and JSON responses carried `newState` but not `revision`, while the editor only updates its revision bookkeeping when one is supplied.
- **Why:** CAS is only as strong as revision bookkeeping on BOTH ends; the server half alone converts silent overwrites into loud false conflicts.
- **How to apply:** any new server-side save path → include `revision` in its response/event; any new client consumer → feed it into the editor's revision/last-saved refs before autosave can run. Grep for the guarded-save helper to find the pattern.
- Onboarding generation still writes unguarded by deliberate decision (fresh, single-flight-claimed sites; a conflict there would strand the never-stranded pipeline). Revisit only if customers gain builder access during generation.
