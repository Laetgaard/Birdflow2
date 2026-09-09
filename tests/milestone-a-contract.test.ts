import { describe, expect, it } from 'vitest';
import { SOFIE_INPUT, sofieContext } from './fixtures/sofiePractice';
import { sofieReferenceSite } from './fixtures/sofieSite';
import { prepareWebsiteBrief } from '../server/websiteBrief';
import { mergePracticeProfile } from '../shared/practiceProfile';
import { checkNativeBookingSetup, evaluateWebsiteReadiness, loadBookingSetupCheck } from '../server/websiteReadiness';
import { scopedOnboardingRepairs } from '../server/onboardingRepairScope';
import { validateGeneratedSection } from '../server/generatedSectionContract';
import { applySemanticEdit, type SemanticEdit, findPrimitiveNode } from '../shared/customComponents';
import { createHistory, pushHistory, undo, redo } from '../shared/builderHistory';
import { checkPublishParity } from '../server/publishParity';
import { onboardingStateFingerprint } from '../server/onboardingQuality';

describe('Milestone A contracts', () => {
  it('versions the brief only when its requirements change; fact ids survive insertions', () => {
    const before = prepareWebsiteBrief(SOFIE_INPUT, sofieContext());
    expect(prepareWebsiteBrief(structuredClone(SOFIE_INPUT), sofieContext(), before)).toEqual(before);
    const next = prepareWebsiteBrief({ ...SOFIE_INPUT, feeling: 'Tydeligere kontrast' }, sofieContext(), before);
    expect(next.revision).toBe(2);
    expect(next.fingerprint).not.toBe(before.fingerprint);
    expect(next.brief.facts.map(fact => fact.id)).toEqual(before.brief.facts.map(fact => fact.id));
  });

  it('removes a service and its relationships without keeping its old price', () => {
    const profile = mergePracticeProfile(SOFIE_INPUT.practice, {}, { serviceKeys: ['online'] });
    expect(profile.services?.map(service => service.key)).toEqual(['individual', 'intro']);
    expect(profile.practitioners?.[0].serviceKeys).not.toContain('online');
    expect(() => mergePracticeProfile(SOFIE_INPUT.practice, { services: [{ key: 'online', name: 'Changed' }] }, { serviceKeys: ['online'] })).toThrow();
    const brief = prepareWebsiteBrief({ ...SOFIE_INPUT, practice: profile }, { ...sofieContext(), practice: profile, facts: [] });
    expect(brief.brief.practice?.services).toHaveLength(2);
  });

  it('does not turn intake intent into working native booking', async () => {
    const state = sofieReferenceSite();
    const service = { id: 's', websiteId: 'sofie', name: 'Samtale', active: 'true', durationMinutes: 50, price: '1100', currency: 'DKK' } as any;
    expect(checkNativeBookingSetup('sofie', { services: [], availability: [], openSlots: [] }, '2026-09-09').status).toBe('needs_owner_input');
    const evidence = { services: [service], availability: [], openSlots: [] };
    expect(checkNativeBookingSetup('sofie', evidence, '2026-09-09').messages).toContain('booking.hours_missing:Samtale');
    const configured = { ...evidence, availability: [{ serviceId: 's', websiteId: 'sofie', dayOfWeek: 1, specificDate: null, startTime: '09:00', endTime: '16:00', isActive: true } as any] };
    expect(checkNativeBookingSetup('sofie', configured, '2026-09-09')).toEqual({ status: 'passed', messages: ['booking.setup_present_not_reservation_tested'] });
    expect(checkNativeBookingSetup('other-site', configured, '2026-09-09').status).toBe('needs_owner_input');
    expect((await loadBookingSetupCheck('sofie', state, { getBookingServices: async () => { throw Error('offline'); } } as any)).status).toBe('unavailable');
    const mismatch = await loadBookingSetupCheck('sofie', state, {
      getBookingServices: async () => [service],
      getServiceAvailability: async () => configured.availability,
      getOpenSlots: async () => [],
    });
    expect(mismatch.status).toBe('needs_owner_input');
    expect(mismatch.messages).toContain('booking.service_mismatch:Online samtale');
  });

  it('invalidates visual evidence after an edit even when an old score was high', () => {
    const state = sofieReferenceSite();
    const candidate = { fingerprint: onboardingStateFingerprint(state), visualReview: { ran: true, issues: [], warnings: [] } } as any;
    expect(evaluateWebsiteReadiness({ state, revision: 1, language: 'da', candidate, bookingSetup: { status: 'needs_owner_input', messages: [] } }).checks.visualReview.status).toBe('passed');
    state.pages[0].components[0].props.customTree!.children![0].children![0].styles = { gap: '30px' };
    expect(evaluateWebsiteReadiness({ state, revision: 2, language: 'da', candidate, bookingSetup: { status: 'needs_owner_input', messages: [] } }).checks.visualReview.status).toBe('unavailable');
  });

  it('rejects destructive or unrelated automatic repairs', () => {
    const result = scopedOnboardingRepairs([
      { action: 'update_component', pageId: 'home', componentId: 'broken', props: { title: 'Fixed' } },
      { action: 'update_component', pageId: 'home', componentId: 'approved', props: { title: 'Overwritten' } },
      { action: 'remove_page', pageId: 'home' },
      { action: 'update_brand_guide', patch: { colors: { primary: '#000000' } } } as any,
    ], [{ pageId: 'home', componentId: 'broken' }]);
    expect(result.allowed).toHaveLength(1);
    expect(result.rejected).toHaveLength(3);
  });

  it('refuses a section whose displayed content cannot be edited', () => {
    const component = sofieReferenceSite().pages[0].components[0];
    expect(() => validateGeneratedSection(component.props)).not.toThrow();
    expect(() => validateGeneratedSection({ ...component.props, customSchema: { version: 1, fields: [] } })).toThrow(/editable schema/);
    const tree = structuredClone(component.props.customTree!);
    tree.children!.push({ id: 'attack', type: 'button', label: 'Attack', href: 'javascript:alert(1)' });
    expect(() => validateGeneratedSection({ ...component.props, customTree: tree })).toThrow(/executable/);
  });

  it('round-trips content, image, link, colour, responsive spacing, repeater order, undo and emitted output', async () => {
    const before = sofieReferenceSite();
    const state = structuredClone(before);
    const hero = state.pages[0].components[0];
    const schema = hero.props.customSchema!;
    let tree = hero.props.customTree!;
    const edits: SemanticEdit[] = [
      { kind: 'set-text', target: { fieldKey: 'n-hero-title' }, value: 'En samtale med plads til dig.' },
      { kind: 'set-image', target: { fieldKey: 'n-hero-portrait' }, src: SOFIE_INPUT.ownImageUrls[0], alt: 'Nyt beskåret testportræt' },
      { kind: 'set-link', target: { fieldKey: 'n-hero-book-link' }, href: '/kontakt' },
      { kind: 'set-color', target: { fieldKey: 'n-sofie-hero-root-bg' }, value: '#f5f0e8' },
      { kind: 'set-style', target: { fieldKey: 'section-spacing' }, styleKey: 'padding', value: '40px 18px', device: 'mobileStyles' },
    ];
    for (const edit of edits) {
      const result = applySemanticEdit(tree, schema, edit);
      expect(result.ok).toBe(true);
      if (result.ok) tree = result.tree;
    }
    hero.props.customTree = tree;
    const first = state.pages[0].components[1];
    const moved = applySemanticEdit(first.props.customTree!, first.props.customSchema!, { kind: 'move-item', fieldKey: 'rep-first-cards', itemIndex: 2, direction: 'up' });
    expect(moved.ok).toBe(true);
    if (moved.ok) first.props.customTree = moved.tree;
    const saved = JSON.parse(JSON.stringify(state));
    expect(saved.pages[1]).toEqual(before.pages[1]);
    expect(findPrimitiveNode(saved.pages[0].components[0].props.customTree, 'hero-title')?.text).toBe('En samtale med plads til dig.');
    const history = pushHistory(createHistory(before), saved, 'Owner edits');
    const undone = undo(history);
    expect(undone.state).toEqual(before);
    expect(redo(undone.history).state).toEqual(saved);
    const parity = await checkPublishParity(saved, 'da');
    expect(parity.status, JSON.stringify(parity)).toBe('passed');
  });

  it('limits image presentation edits to the bound image and chosen device, with inheritance reset', () => {
    const hero = sofieReferenceSite().pages[0].components[0];
    const tree = hero.props.customTree!;
    const schema = hero.props.customSchema!;
    const target = { fieldKey: 'n-hero-portrait' };
    const before = findPrimitiveNode(tree, 'hero-portrait')!;
    const result = applySemanticEdit(tree, schema, { kind: 'set-image-presentation', target, property: 'objectPosition', value: '30% 25%', device: 'mobileStyles' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const image = findPrimitiveNode(result.tree, 'hero-portrait')!;
    expect(image.mobileStyles?.objectPosition).toBe('30% 25%');
    expect(image.styles).toEqual(before.styles);
    expect(image.src).toBe(before.src);
    expect(findPrimitiveNode(result.tree, 'hero-title')).toEqual(findPrimitiveNode(tree, 'hero-title'));
    const reset = applySemanticEdit(result.tree, schema, { kind: 'set-image-presentation', target, property: 'objectPosition', value: '', device: 'mobileStyles' });
    expect(reset.ok && findPrimitiveNode(reset.tree, 'hero-portrait')?.mobileStyles?.objectPosition).toBeUndefined();
    expect(applySemanticEdit(tree, schema, { kind: 'set-image-presentation', target: { fieldKey: 'n-hero-title' }, property: 'objectPosition', value: '30% 25%' }).ok).toBe(false);
  });
});
