import type { BuilderMutation } from '@shared/aiBuilderSchema';

/** Enforce the scope of a repair, independently of the model's instructions. */
export function scopedOnboardingRepairs(mutations: BuilderMutation[], findings: Array<{ pageId?: string; componentId?: string }>) {
  const targets = new Set(findings.filter(item => item.pageId && item.componentId).map(item => item.pageId + ':' + item.componentId));
  const thinPages = new Set(findings.filter(item => item.pageId && !item.componentId).map(item => item.pageId));
  const allowed: BuilderMutation[] = [];
  const rejected: string[] = [];
  for (const mutation of mutations) {
    const targeted = 'componentId' in mutation && 'pageId' in mutation && targets.has(mutation.pageId + ':' + mutation.componentId);
    const addsContent = ['add_component', 'add_custom_component'].includes(mutation.action) && 'pageId' in mutation && thinPages.has(mutation.pageId);
    if ((targeted && ['update_component', 'update_custom_component', 'move_component'].includes(mutation.action)) || addsContent) allowed.push(mutation);
    else rejected.push(mutation.action + ': outside the reported repair scope');
  }
  return { allowed, rejected };
}
