import { DEFAULT_SITE_LANGUAGE, type SiteLanguage } from "../../shared/siteLanguage";

export type DefaultEmailTemplate = {
  subject: string;
  heading: string;
  bodyText: string;
  buttonText?: string;
};

export type DefaultEmailTemplates = Record<string, DefaultEmailTemplate>;

/**
 * The wording BirdFlow falls back to when a website has no edited template of
 * its own. Chosen by the recipient website's language, so a Danish customer
 * never receives an English confirmation and vice versa.
 *
 * `platform_meeting_notification` is BirdFlow talking to itself about its own
 * calendar - it stays Danish in both records on purpose.
 */
const DANISH_TEMPLATES: DefaultEmailTemplates = {
  order_confirmation: {
    subject: "Ordrebekræftelse - #{{orderId}}",
    heading: "Tak for din ordre!",
    bodyText:
      "Vi har modtaget din ordre og er i gang med at behandle den. Du får en ny mail, så snart ordren er sendt afsted.",
    buttonText: "Se ordre",
  },
  order_shipped: {
    subject: "Din ordre er på vej - #{{orderId}}",
    heading: "Din ordre er afsendt!",
    bodyText:
      "Din ordre er nu på vej til dig. Forventet levering: {{deliveryDate}}. {{trackingLine}}",
  },
  booking_confirmation: {
    subject: "Bekræftelse af booking - {{serviceName}}",
    heading: "Din booking er bekræftet!",
    bodyText: "Vi glæder os til at se dig til din aftale.",
    buttonText: "Se booking",
  },
  booking_updated: {
    subject: "Booking opdateret - {{serviceName}}",
    heading: "Din booking er blevet opdateret",
    bodyText:
      "Detaljerne i din booking er ændret. Se de opdaterede oplysninger nedenfor.",
    buttonText: "Se booking",
  },
  booking_cancelled: {
    subject: "Booking aflyst - {{serviceName}}",
    heading: "Din booking er aflyst",
    bodyText:
      "Din booking er blevet aflyst som ønsket. Har du spørgsmål, er du meget velkommen til at kontakte os.",
  },
  booking_reminder: {
    subject: "Påmindelse: {{serviceName}} den {{date}}",
    heading: "Din aftale nærmer sig",
    bodyText:
      "Dette er en venlig påmindelse om din kommende aftale. Vi glæder os til at se dig!",
  },
  booking_followup: {
    subject: "Tak for besøget - {{serviceName}}",
    heading: "Tak fordi du besøgte os!",
    bodyText:
      "Vi håber, du var glad for din aftale. Vi ser dig gerne igen — book din næste tid, når det passer dig.",
  },
  platform_meeting_notification: {
    subject: "Nyt forbedringsmøde booket - {{date}} {{time}}",
    heading: "Der er booket et nyt møde",
    bodyText: "En kunde har booket et forbedringsmøde. Detaljerne står nedenfor.",
  },
  onboarding_ready_for_review: {
    subject: "Din opdaterede hjemmeside er klar",
    heading: "Din opdaterede hjemmeside er klar",
    bodyText:
      "Hej {{customerName}}. Vi har arbejdet videre på {{websiteName}} efter vores møde. Log ind og se den opdaterede version — godkender du den, går vi videre til betaling.",
    buttonText: "Se din hjemmeside",
  },
  website_published: {
    subject: "Din hjemmeside er live!",
    heading: "Tillykke! Din hjemmeside er publiceret",
    bodyText:
      "Din hjemmeside er nu live og tilgængelig for alle. Klik nedenfor for at besøge den.",
    buttonText: "Besøg hjemmesiden",
  },
};

const ENGLISH_TEMPLATES: DefaultEmailTemplates = {
  order_confirmation: {
    subject: "Order Confirmation - #{{orderId}}",
    heading: "Thank you for your order!",
    bodyText:
      "We have received your order and are processing it. You will receive another email when your order ships.",
    buttonText: "View Order",
  },
  order_shipped: {
    subject: "Your order is on its way - #{{orderId}}",
    heading: "Your order has shipped!",
    bodyText:
      "Your order is on its way to you. Expected delivery: {{deliveryDate}}. {{trackingLine}}",
  },
  booking_confirmation: {
    subject: "Booking Confirmation - {{serviceName}}",
    heading: "Your booking is confirmed!",
    bodyText: "We look forward to seeing you at your scheduled appointment.",
    buttonText: "View Booking",
  },
  booking_updated: {
    subject: "Booking Updated - {{serviceName}}",
    heading: "Your booking has been updated",
    bodyText:
      "The details of your booking have been modified. Please review the updated information below.",
    buttonText: "View Booking",
  },
  booking_cancelled: {
    subject: "Booking Cancelled - {{serviceName}}",
    heading: "Your booking has been cancelled",
    bodyText:
      "Your booking has been cancelled as requested. If you have any questions, please contact us.",
  },
  booking_reminder: {
    subject: "Reminder: {{serviceName}} on {{date}}",
    heading: "Your appointment is coming up",
    bodyText:
      "This is a friendly reminder about your upcoming appointment. We look forward to seeing you!",
  },
  booking_followup: {
    subject: "Thank you for your visit - {{serviceName}}",
    heading: "Thank you for visiting us!",
    bodyText:
      "We hope you enjoyed your appointment. We would love to see you again - book your next appointment anytime.",
  },
  // Internal BirdFlow notification - deliberately Danish in every language.
  platform_meeting_notification: DANISH_TEMPLATES.platform_meeting_notification,
  onboarding_ready_for_review: {
    subject: "Your updated website is ready",
    heading: "Your updated website is ready",
    bodyText:
      "Hi {{customerName}}. We have kept working on {{websiteName}} since our meeting. Sign in to see the updated version — approve it and we'll move on to payment.",
    buttonText: "View your website",
  },
  website_published: {
    subject: "Your website is now live!",
    heading: "Congratulations! Your website is published",
    bodyText:
      "Your website is now live and accessible to the world. Click below to visit your site.",
    buttonText: "Visit Website",
  },
};

export const DEFAULT_EMAIL_TEMPLATES: Record<SiteLanguage, DefaultEmailTemplates> = {
  da: DANISH_TEMPLATES,
  en: ENGLISH_TEMPLATES,
};

export function defaultEmailTemplates(
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE
): DefaultEmailTemplates {
  return DEFAULT_EMAIL_TEMPLATES[lang] ?? DANISH_TEMPLATES;
}

/**
 * The types every website gets a row for when its templates are first seeded.
 * Internal and onboarding mails are excluded - they are never customer-edited.
 */
export const SEEDED_TEMPLATE_TYPES = [
  "order_confirmation",
  "booking_confirmation",
  "booking_updated",
  "booking_cancelled",
  "booking_reminder",
  "booking_followup",
  "website_published",
] as const;

/** Labels for the key/value detail table rendered under the email body. */
export const EMAIL_LABELS: Record<SiteLanguage, Record<string, string>> = {
  da: {
    total: "I alt",
    status: "Status",
    customerName: "Navn",
    customerEmail: "E-mail",
    customerPhone: "Telefon",
    date: "Dato",
    time: "Tidspunkt",
    place: "Sted",
    deliveryDate: "Forventet levering",
    trackingNumber: "Track & trace",
    carrier: "Fragtfirma",
    trackingLine: "Track & trace",
    notes: "Bemærkninger",
    website: "Hjemmeside",
  },
  en: {
    total: "Total",
    status: "Status",
    customerName: "Name",
    customerEmail: "Email",
    customerPhone: "Phone",
    date: "Date",
    time: "Time",
    place: "Location",
    deliveryDate: "Expected delivery",
    trackingNumber: "Tracking",
    carrier: "Carrier",
    trackingLine: "Tracking",
    notes: "Notes",
    website: "Website",
  },
};
