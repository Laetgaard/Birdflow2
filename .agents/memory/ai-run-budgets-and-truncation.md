---
name: AI run budgets & truncated answers
description: Why every model call goes through one metered wrapper, and what recovery of a cut-off answer is allowed to do.
---

# One metered door

Every model call goes through a single wrapper that applies the role's
configuration and charges the run's meter. A budget nobody has to remember
is not a budget: scattered call sites drift back to their own model names
and no ceiling at all.

**Why:** the runs-per-window limiter answers "how often", never "how much".

**How to apply:**
- Ceilings belong to one unit of customer intent (a plan round, a build
  including its resumes, an onboarding conversation), not to one call.
- Check the meter before the call as well as after it — a shared meter is
  usually already over when the next step starts.
- Absent `usage` must be charged at an assumed full budget, and an unpriced
  model at the most expensive rate. A gap must never read as free.
- Keep a tripwire test that no other module reaches the SDK directly, over
  the whole server tree — unused vendor sample routes spend real money too.
- A run that outlives a process restart must rebuild its meter from a spend
  total it persisted itself. Inferring it from progress (steps done ÷ steps
  planned) is not conservative: one step can eat the whole ceiling. Work with
  no recorded total counts as fully spent.
- Keys must be stable for the WHOLE intent. Keying an onboarding meter on the
  website hands out a second ceiling the moment the draft site is created;
  key on the customer.
- Hitting the ceiling must be a loud outcome. A stopped loop with no
  mutations looks exactly like "nothing needed changing", and that reads as a
  completed step — the plan then ticks itself off unbuilt.
- Check-then-charge is a race when calls fan out (images generate several at
  once): reserve the worst case in the same step as the check, then swap the
  reservation for the real cost — and give it back if the call never happened.
- A refused call arrives as an exception, and an exception reads as "the
  provider is down" — which is retryable. Carry the ceiling reason through
  the loop or the caller will retry a call that can never succeed.
- Preflight the WORST CASE of the imminent call, not "am I over yet". Cents
  left is still enough to start a long completion and land far past the
  ceiling in one call. Keep every ceiling comfortably above one such call, or
  the role can never call at all.
- Every exit door needs the ceiling translated: HTTP routes (a cost stop is
  not a 500 — that invites the retry that cannot work), streaming outcomes,
  and multi-phase pipelines, which must stop the remaining phases rather than
  let each one fail its own way into a silent fallback.
- "Cannot afford the next call" is a ceiling outcome as much as "spent out",
  and needs the same explicit message; a meter that only speaks once it is
  empty leaves the earlier stop looking like an unexplained halt.

# Recovering a cut-off answer

Rewinding truncated JSON is for reading and for delivering a plan. Never
feed recovered arguments to a mutating tool.

**Why:** half of a change is not a smaller change, it is a different one.
All-or-nothing parsing was silently protecting writes; adding recovery to a
shared loop removes that protection unless it is gated on the tool's own
mutates flag.

# Notes the customer approves

Warnings (a dropped step, a truncated plan, a shortened description) are
must-say; the model's own remarks are optional. Order must-say first, then
cap — at every layer that merges notes, via one shared helper.

**Why:** the customer approves what they read. Otherwise a chatty model can
push "this plan is missing steps" out of the list, and the build then does
less than what was approved.
