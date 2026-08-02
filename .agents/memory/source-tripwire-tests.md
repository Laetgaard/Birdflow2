---
name: Source-tripwire tests
description: Some tests in this project assert on the TEXT of server source files; refactors break them and the fix is to re-point the tripwire, not to revert.
---

# Source-tripwire tests

Several suites read a server or client source file with `readFileSync` and
assert that specific substrings appear in it — the agent loop's `while` header,
the route registration line, the order of the save tail, the presence of a
rate-limit call. They are grouped under describe blocks named
"(source tripwires)".

**Why they exist:** they guard invariants that have no runtime seam — that a
route is permission-gated, that the loop is bounded, that self-check runs before
sanitise runs before save. A behavioural test would need a database and a live
model; the tripwire catches the regression at zero cost.

**How to apply:** when a refactor renames a variable or moves a budget into a
shared module, the tripwire fails even though the invariant still holds. Update
the tripwire to point at the new expression **and keep it just as specific** —
do not weaken it to a vague substring and do not delete it. Add a comment saying
what the invariant is, so the next person renaming things knows what the test is
actually protecting.

Corollary: extracting shared logic out of a big server file is not free. Grep
the test directory for the old identifier before assuming a rename is internal.
