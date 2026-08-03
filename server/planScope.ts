/**
 * Server-enforced scope for a plan step.
 *
 * The customer approves a numbered checklist. Approval is only meaningful if
 * step 4 ("Skriv ny tekst på forsiden") cannot delete the pricing page while
 * nobody is looking — so scope is checked HERE, on the server, against the
 * actual mutation, and not left to the model's good intentions.
 *
 * A refusal is returned to the agent as a tool error, exactly like a
 * validation error: the model reads it and corrects itself. It is recorded on
 * the step result either way, so the build report can say what was refused.
 */

import type { BuilderStateData } from "@shared/schema";
import type { BuilderMutation } from "@shared/aiBuilderSchema";
import {
  NEVER_AUTONOMOUS_ACTIONS,
  SCOPE_ANY_PAGE,
  SCOPE_NEW_PAGE,
  STEP_TYPE_ACTIONS,
  mutationComponentId,
  mutationPageId,
  type MutationAction,
  type PlanStep,
} from "@shared/assistantPlan";

export type ScopeVerdict = { ok: true } | { ok: false; reason: string };

/** Actions that create rather than target an existing page. */
const PAGE_CREATING_ACTIONS: readonly MutationAction[] = ["add_page"];

/** Actions that are site-wide and therefore have no page to check. */
const SITE_WIDE_ACTIONS: readonly MutationAction[] = [
  "update_global_styles",
  "apply_preset",
  "update_brand_guide",
  "add_custom_component",
  "update_custom_component",
];

export function validateStepScope(
  step: PlanStep,
  mutation: BuilderMutation,
  state: BuilderStateData
): ScopeVerdict {
  const action = mutation.action as MutationAction;

  // 1) The step type's action allowlist. This is what makes a copywriting
  //    step incapable of deleting anything.
  if (NEVER_AUTONOMOUS_ACTIONS.includes(action)) {
    return {
      ok: false,
      reason: `"${action}" kræver altid brugerens godkendelse og kan ikke køre som en del af en plan.`,
    };
  }
  const allowed = STEP_TYPE_ACTIONS[step.type];
  if (!allowed.includes(action)) {
    return {
      ok: false,
      reason:
        `Trin ${step.id} er et "${step.type}"-trin og må kun bruge: ${allowed.join(", ")}. ` +
        `"${action}" hører til et andet trin i planen.`,
    };
  }

  // 2) Page scope.
  const anyPage = step.scope.pageIds.includes(SCOPE_ANY_PAGE);
  if (PAGE_CREATING_ACTIONS.includes(action)) {
    // "*" means "any page that already exists" — it is NOT permission to add
    // pages. Creating a page is the one thing the plan has to say out loud,
    // because a page the customer never read about is a page they will not
    // find, maintain or expect to be indexed. Only SCOPE_NEW_PAGE authorises it.
    if (!step.scope.pageIds.includes(SCOPE_NEW_PAGE)) {
      return {
        ok: false,
        reason: `Trin ${step.id} må ikke oprette nye sider. Planen nævner ikke en ny side her.`,
      };
    }
  } else if (!SITE_WIDE_ACTIONS.includes(action)) {
    const pageId = mutationPageId(mutation);
    if (pageId && !anyPage && !step.scope.pageIds.includes(pageId)) {
      const page = state.pages.find((p) => p.id === pageId);
      const name = page?.name ?? pageId;
      return {
        ok: false,
        reason:
          `Trin ${step.id} omfatter ikke siden "${name}". ` +
          `Planen siger: ${describeScope(step, state)}.`,
      };
    }
  }

  // 3) Section scope, when the step named specific sections.
  const componentIds = step.scope.componentIds ?? [];
  if (componentIds.length > 0) {
    const componentId = mutationComponentId(mutation);
    // add_component has no target id yet — the page check above covers it.
    if (componentId && !componentIds.includes(componentId)) {
      return {
        ok: false,
        reason:
          `Trin ${step.id} omfatter kun sektionerne ${componentIds.join(", ")}. ` +
          `Sektion "${componentId}" er ikke en del af trinnet.`,
      };
    }
  }

  return { ok: true };
}

/** Danish description of what a step may touch — used in refusals and the UI. */
export function describeScope(step: PlanStep, state: BuilderStateData): string {
  const { pageIds } = step.scope;
  if (pageIds.includes(SCOPE_ANY_PAGE)) return "hele websitet";
  const names = pageIds.map((id) => {
    if (id === SCOPE_NEW_PAGE) return "en ny side";
    return state.pages.find((p) => p.id === id)?.name ?? id;
  });
  if (names.length === 1) return `siden "${names[0]}"`;
  return `siderne ${names.map((n) => `"${n}"`).join(", ")}`;
}

/**
 * Repair a scope the model wrote loosely.
 *
 * Plan mode asks the model for page ids; it sometimes answers with page
 * PATHS or names because those are what it just read. Rather than refusing
 * the whole plan over a formatting slip, map what we can onto real ids and
 * drop what we cannot — a scope that ends up empty falls back to "*", which
 * is what an unscoped step meant anyway.
 */
export function normalizeScope(
  scope: { pageIds: string[]; componentIds?: string[] },
  state: BuilderStateData
): { pageIds: string[]; componentIds?: string[] } {
  const known = new Map<string, string>();
  for (const page of state.pages) {
    known.set(page.id.toLowerCase(), page.id);
    known.set(page.path.toLowerCase(), page.id);
    known.set(page.name.toLowerCase(), page.id);
  }

  const resolved: string[] = [];
  for (const raw of scope.pageIds ?? []) {
    const value = String(raw).trim();
    if (!value) continue;
    if (value === SCOPE_ANY_PAGE || value === SCOPE_NEW_PAGE) {
      resolved.push(value);
      continue;
    }
    const match = known.get(value.toLowerCase());
    if (match) resolved.push(match);
  }

  const unique = Array.from(new Set(resolved));
  return {
    pageIds: unique.length > 0 ? unique : [SCOPE_ANY_PAGE],
    ...(scope.componentIds && scope.componentIds.length > 0
      ? { componentIds: Array.from(new Set(scope.componentIds.map(String))) }
      : {}),
  };
}
