import type { OnboardingGenInput } from '../../server/onboardingGenerator';
import { deriveBusinessContext } from '../../shared/businessContext';
import { practiceProfileFacts } from '../../shared/practiceProfile';

/** Fictional QA data. Never provision this practice in a production tenant. */
export const SOFIE_INPUT: OnboardingGenInput = {
  language: 'da',
  business: {
    name: 'Sofie Lund',
    industry: 'Psykologpraksis',
    description: 'Sofie Lund er psykolog og starter en solopraksis i København. Hun tilbyder samtaler til voksne med angst og stress, fysisk og online.',
  },
  wishes: {
    goals: ['Forstå mulighederne for en samtale', 'Book en tid'],
    notes: 'Fiktiv testpraksis. Kun tre ydelser: individuel samtale (50 minutter, 1100 kr.), online samtale (50 minutter, 1100 kr.) og indledende samtale (25 minutter, 550 kr.). Ingen påstande om autorisation, erfaring, henvisning, tilskud eller behandlingsresultater. Adresse, telefon og åbningstider er endnu ukendte. Email: sofie@example.com. Native booking skal opsættes særskilt.',
  },
  feeling: 'Rolig, varm og skandinavisk. God luft, læsbar typografi, ingen salgspres. En personlig introduktion og en enkel forklaring af den første samtale.',
  palette: { id: 'sofie-calm', name: 'Varm ro', description: 'Fiktivt designvalg til pilot', colors: { primary: '#35594e', secondary: '#b88e71', accent: '#b88e71', background: '#f8f5ef', surface: '#ffffff', text: '#25342f' } },
  fontPair: { id: 'sofie-type', name: 'Lora og Inter', heading: 'Lora', body: 'Inter', scale: 'editorial', description: 'Rolige overskrifter, letlæselig brødtekst' },
  inspirationUrls: [],
  ownImageUrls: ['/attached_assets/generated_images/qa-therapist-hero.jpg'],
  practice: {
    type: 'solo', lifecycle: 'new', audience: 'Voksne med angst eller stress', location: 'København', bookingMode: 'native',
    services: [
      { key: 'individual', name: 'Individuel samtale', durationMinutes: 50, priceMinor: 110000, delivery: 'in_person' },
      { key: 'online', name: 'Online samtale', durationMinutes: 50, priceMinor: 110000, delivery: 'online' },
      { key: 'intro', name: 'Indledende samtale', durationMinutes: 25, priceMinor: 55000, delivery: 'both' },
    ],
    practitioners: [{ key: 'sofie', name: 'Sofie Lund', title: 'Psykolog', serviceKeys: ['individual', 'online', 'intro'] }],
  },
};

export function sofieContext() {
  return {
    ...deriveBusinessContext({ businessName: SOFIE_INPUT.business.name, industry: SOFIE_INPUT.business.industry, description: SOFIE_INPUT.business.description, language: 'da' }),
    practice: structuredClone(SOFIE_INPUT.practice),
    facts: [
      ...practiceProfileFacts(SOFIE_INPUT.practice, 'da'),
      { id: 'fixture-email', text: 'Email: sofie@example.com' },
    ],
  };
}
