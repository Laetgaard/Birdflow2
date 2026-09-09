import type { BuilderStateData, BookingService, ServiceAvailability, BookingOpenSlot } from '@shared/schema';
import type { OnboardingDirectionCandidate } from '@shared/onboardingDirections';
import type { ReadinessCheck, WebsiteReadiness } from '@shared/websiteReadiness';
import { evaluateOnboardingQuality, onboardingStateFingerprint } from './onboardingQuality';

type BookingEvidence = {
  services: BookingService[];
  availability: ServiceAvailability[];
  openSlots: BookingOpenSlot[];
};

/** Only checks setup. Does not claim a reservation, email or payment was tested. */
export function checkNativeBookingSetup(websiteId: string, evidence: BookingEvidence, today: string): ReadinessCheck {
  const services = evidence.services.filter(service => service.websiteId === websiteId && service.active === 'true');
  if (!services.length) return { status: 'needs_owner_input', messages: ['booking.services_missing'] };
  const messages: string[] = [];
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  for (const service of services) {
    if (!service.name.trim() || service.durationMinutes <= 0 || !Number.isFinite(Number(service.price)) || Number(service.price) < 0 || !service.currency) {
      messages.push(`booking.service_invalid:${service.name}`);
      continue;
    }
    const scheduled = evidence.availability.some(row => row.websiteId === websiteId && row.serviceId === service.id && row.isActive &&
      ((row.dayOfWeek !== null && row.dayOfWeek >= 0 && row.dayOfWeek <= 6) || (!!row.specificDate && row.specificDate >= today)) &&
      time.test(row.startTime) && time.test(row.endTime) && minutes(row.endTime) - minutes(row.startTime) >= service.durationMinutes);
    const open = evidence.openSlots.some(row => row.websiteId === websiteId && (!row.serviceId || row.serviceId === service.id) &&
      row.status === 'open' && row.date >= today && time.test(row.time) && row.durationMinutes >= service.durationMinutes);
    if (!scheduled && !open) messages.push(`booking.hours_missing:${service.name}`);
  }
  return { status: messages.length ? 'needs_owner_input' : 'passed', messages: messages.length ? messages : ['booking.setup_present_not_reservation_tested'] };
}

export function evaluateWebsiteReadiness(args: {
  state: BuilderStateData;
  revision: number;
  language: 'da' | 'en';
  candidate?: OnboardingDirectionCandidate;
  bookingSetup: ReadinessCheck;
}): WebsiteReadiness {
  const fingerprint = onboardingStateFingerprint(args.state);
  const quality = evaluateOnboardingQuality(args.state, { language: args.language, customerAssetUrls: args.state.websiteBrief?.brief.assets.map(asset => asset.url) });
  const currentReview = args.candidate?.fingerprint === fingerprint ? args.candidate.visualReview : undefined;
  const blockers = currentReview?.issues.filter(issue => ['high', 'critical'].includes(issue.severity)) ?? [];
  return {
    builderRevision: args.revision,
    fingerprint,
    briefRevision: args.state.websiteBrief?.revision ?? null,
    checks: {
      content: { status: quality.ready ? 'passed' : 'needs_repair', messages: quality.issues.map(issue => issue.message) },
      visualReview: !currentReview?.ran
        ? { status: 'unavailable', messages: ['visual.current_review_missing'] }
        : { status: blockers.length ? 'needs_repair' : 'passed', messages: blockers.map(issue => issue.description) },
      bookingSetup: args.bookingSetup,
    },
  };
}

export async function loadBookingSetupCheck(websiteId: string, state: BuilderStateData, repository: {
  getBookingServices(websiteId: string): Promise<BookingService[]>;
  getServiceAvailability(serviceId: string): Promise<ServiceAvailability[]>;
  getOpenSlots(websiteId: string): Promise<BookingOpenSlot[]>;
}): Promise<ReadinessCheck> {
  const practice = state.businessContext?.practice ?? state.websiteBrief?.brief.practice;
  const mode = practice?.bookingMode;
  // Also recognise an inserted native widget, including a nested capability.
  const usesNative = mode === 'native' || /"(?:type|capability)":"booking"/.test(JSON.stringify({ pages: state.pages, chrome: state.siteChrome }));
  if (!usesNative) return { status: 'not_applicable', messages: [mode === 'external' ? 'booking.external_not_checked' : 'booking.native_not_requested'] };
  try {
    const services = (await repository.getBookingServices(websiteId)).filter(service => service.websiteId === websiteId && service.active === 'true');
    const [availability, openSlots] = await Promise.all([
      Promise.all(services.map(service => repository.getServiceAvailability(service.id))),
      repository.getOpenSlots(websiteId),
    ]);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());
    const setup = checkNativeBookingSetup(websiteId, { services, availability: availability.flat(), openSlots }, today);
    const normalize = (value: string) => value.trim().toLocaleLowerCase('da-DK').replace(/\s+/g, ' ');
    const mismatches = (practice?.services ?? []).filter(expected => !services.some(actual =>
      normalize(actual.name) === normalize(expected.name) &&
      (expected.durationMinutes === undefined || expected.durationMinutes === actual.durationMinutes) &&
      (expected.priceMinor === undefined || (actual.currency === 'DKK' && expected.priceMinor === Math.round(Number(actual.price) * 100)))
    )).map(service => 'booking.service_mismatch:' + service.name);
    if (mismatches.length) return { status: 'needs_owner_input', messages: [...setup.messages.filter(message => message !== 'booking.setup_present_not_reservation_tested'), ...mismatches] };
    return setup;
  } catch {
    return { status: 'unavailable', messages: ['booking.setup_check_unavailable'] };
  }
}
