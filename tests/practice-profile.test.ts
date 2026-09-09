import { describe, it, expect } from 'vitest';
import { practiceProfileSchema, mergePracticeProfile, practiceProfileFacts } from '../shared/practiceProfile';
import { businessContextSchema, buildBusinessContextPrompt, deriveBusinessContext } from '../shared/businessContext';

describe('mental healthcare intake survives the builder context', () => {
  it.each(['da', 'en'] as const)('keeps a new solo practice honest in %s', language => {
    const practice = practiceProfileSchema.parse({ type: 'solo', lifecycle: 'new', bookingMode: 'contact', practitioners: [{ key: 'owner', name: 'Fictional Anna' }], services: [{ key: 'individual', name: 'Individual therapy' }] });
    const context = businessContextSchema.parse({ language, practice });
    const restored = deriveBusinessContext({ existing: JSON.parse(JSON.stringify(context)) });
    expect(restored.practice).toEqual(practice);
    const prompt = buildBusinessContextPrompt(restored, language);
    expect(prompt).toContain('Fictional Anna');
    expect(prompt).toContain('Missing fees, credentials and availability remain unknown');
    expect(practiceProfileFacts(practice).map(f => f.text)).toEqual(['Fictional Anna', 'Individual therapy']);
  });

  it('keeps qualifications scoped to their practitioner when a clinic supplies another answer', () => {
    const previous = practiceProfileSchema.parse({ type: 'clinic', practitioners: [{ key: 'anna', name: 'Fictional Anna', qualifications: ['Supplied qualification A'] }, { key: 'bo', name: 'Fictional Bo' }], services: [{ key: 'therapy', name: 'Therapy', durationMinutes: 50 }] });
    const merged = mergePracticeProfile(previous, { practitioners: [{ key: 'bo', name: 'Fictional Bo', serviceKeys: ['therapy'] }], services: [{ key: 'therapy', name: 'Therapy', priceMinor: 120000 }] });
    expect(merged.practitioners).toHaveLength(2);
    expect(merged.services).toEqual([{ key: 'therapy', name: 'Therapy', durationMinutes: 50, priceMinor: 120000 }]);
    const facts = practiceProfileFacts(merged);
    expect(facts.find(f => f.id === 'practice-person-anna')?.text).toContain('qualification A');
    expect(facts.find(f => f.id === 'practice-person-bo')?.text).not.toContain('qualification A');
    expect(previous.services?.[0].priceMinor).toBeUndefined();
  });

  it('preserves explicit free services and rejects malformed money or duplicate identities', () => {
    expect(practiceProfileFacts({ services: [{ key: 'intro', name: 'Intro', priceMinor: 0 }] })[0].text).toContain('0,00');
    expect(practiceProfileSchema.safeParse({ services: [{ key: 'intro', name: 'Intro', priceMinor: -1 }] }).success).toBe(false);
    expect(practiceProfileSchema.safeParse({ practitioners: [{ key: 'same', name: 'A' }, { key: 'same', name: 'B' }] }).success).toBe(false);
  });

  it('validates the combined profile limit, not only individual incoming answers', () => {
    const practitioners = Array.from({ length: 8 }, (_, i) => ({ key: `p${i}`, name: `Fictional person ${i}` }));
    expect(() => mergePracticeProfile({ practitioners }, { practitioners: [{ key: 'extra', name: 'Extra' }] })).toThrow();
  });
});
