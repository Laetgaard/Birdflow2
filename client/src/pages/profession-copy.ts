import { PROFESSION_ROUTES, type FaqItem, type ProfessionSlug } from "@shared/marketingSeo";
import type { Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   Body copy for the six profession pages (/psykolog, /psykoterapeut,
   /psykiater, /terapeut, /healer, /klinik).

   Danish is canonical. The Danish FAQ comes straight from
   shared/marketingSeo.ts — the same objects that feed the FAQPage
   JSON-LD — so structured data and visible content cannot drift.
   English FAQ items below are translations of those entries.

   Content-safety rules (tests enforce the phrasing):
   - Practitioners are never collectively presented as healthcare
     professionals; psychiatrists are medical specialists, psychologists
     may hold authorization, healers/coaches work under other conditions.
   - Titles, credentials and memberships are always described as shown
     "exactly as you state them" — BirdFlow never invents them.
   - Healer/alternative copy speaks of tilgang/session/forløb/velvære/
     balance and NEVER promises effect (no "helbreder", "kurerer",
     "fjerner angst", "dokumenteret effekt" or treatment claims).
   - Clinic copy only claims what /services documents today: staff in
     booking, practitioner profile pages, central administration.
     No locations, no roles/permissions.
   ───────────────────────────────────────────────────────────── */

export type ProfessionCopy = {
  kicker: string;
  h1: string;
  h1Em: string;
  lead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  painsTitle: string;
  painsIntro: string;
  pains: Array<{ title: string; body: string }>;
  featuresTitle: string;
  featuresIntro: string;
  features: Array<{ title: string; body: string }>;
  stepsTitle: string;
  steps: Array<{ title: string; body: string }>;
  faqTitle: string;
  faq: FaqItem[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  otherHeading: string;
};

function faqDa(slug: ProfessionSlug): FaqItem[] {
  const route = PROFESSION_ROUTES.find((r) => r.path === `/${slug}`);
  return route?.faq ?? [];
}

const SHARED_DA = {
  ctaPrimary: "Kom i gang",
  ctaSecondary: "Se priser",
  painsTitle: "Kender du det?",
  featuresTitle: "Det får du med BirdFlow",
  stepsTitle: "Sådan kommer du i gang",
  faqTitle: "Ofte stillede spørgsmål",
  otherHeading: "BirdFlow bruges også af",
};

const SHARED_EN = {
  ctaPrimary: "Get started",
  ctaSecondary: "See pricing",
  painsTitle: "Sound familiar?",
  featuresTitle: "What you get with BirdFlow",
  stepsTitle: "How to get started",
  faqTitle: "Frequently asked questions",
  otherHeading: "BirdFlow is also used by",
};

const STEPS_DA: Array<{ title: string; body: string }> = [
  {
    title: "Fortæl om din praksis",
    body: "Hvem hjælper du, hvilke ydelser tilbyder du, og hvilken stemning skal siden have? Det tager få minutter.",
  },
  {
    title: "Gennemgå første udkast",
    body: "BirdFlow bygger et komplet udkast med struktur, tekster og farver — og du retter til, indtil det passer.",
  },
  {
    title: "Godkend og gå live",
    body: "Dit domæne kobles på, bookingen åbner, og du redigerer selv siden fremover. Intet går live, før du siger god for det.",
  },
];

const STEPS_EN: Array<{ title: string; body: string }> = [
  {
    title: "Tell us about your practice",
    body: "Who do you help, which services do you offer, and what mood should the site have? It takes a few minutes.",
  },
  {
    title: "Review the first draft",
    body: "BirdFlow builds a complete draft with structure, copy and colours — and you adjust it until it fits.",
  },
  {
    title: "Approve and go live",
    body: "Your domain is connected, booking opens, and you edit the site yourself from then on. Nothing goes live until you say so.",
  },
];

export const PROFESSION_COPY: Record<ProfessionSlug, Record<Lang, ProfessionCopy>> = {
  psykolog: {
    da: {
      ...SHARED_DA,
      kicker: "Til psykologer",
      h1: "Hjemmeside til psykolog",
      h1Em: "— med booking og ro i det praktiske.",
      lead: "Din hjemmeside er ofte det første møde med en ny klient. BirdFlow samler professionel hjemmeside, online booking og administration ét sted — udviklet til psykologer og private praksisser.",
      painsIntro: "De fleste psykologer står med de samme tre udfordringer, når praksissen skal online.",
      pains: [
        {
          title: "Siden skal skabe tryghed fra første klik",
          body: "Nye klienter beslutter sig hurtigt. Et roligt, professionelt design og en klar præsentation af din profil og dine arbejdsområder gør det nemt at vælge dig til.",
        },
        {
          title: "Henvendelser ligger spredt",
          body: "Telefonbeskeder, mails og kontaktformularer i hver sin indbakke gør det svært at følge op. I BirdFlow samles henvendelser og bookinger ét sted.",
        },
        {
          title: "Teknikken stjæler tiden",
          body: "Plugins, opdateringer og hosting hører ikke hjemme i en psykologpraksis. I BirdFlow er drift, domæne og vedligeholdelse en del af abonnementet.",
        },
      ],
      featuresIntro: "Alt det, en psykologpraksis skal bruge online — uden at du skal samle det af enkeltdele.",
      features: [
        {
          title: "Professionelt webdesign til psykologer",
          body: "AI-assistenten bygger første udkast ud fra din beskrivelse af praksissen — struktur, tekster og farver. Du retter selv til, og intet går live, før du godkender det.",
        },
        {
          title: "Online booking til din praksis",
          body: "Klienten vælger ydelse og tidspunkt direkte på siden. Bekræftelser og påmindelser sendes automatisk, og du styrer selv, hvilke tider der er åbne.",
        },
        {
          title: "Din faglige profil — som du selv beskriver den",
          body: "Titler, autorisation, specialer og medlemskaber vises præcis, som du angiver dem. BirdFlow opdigter aldrig kvalifikationer på dine vegne.",
        },
        {
          title: "Priser, forløb og praktisk information",
          body: "Sider til dine ydelser, priser og praktiske oplysninger — for eksempel ventetid, lokation og online samtaler — som du selv kan opdatere løbende.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("psykolog"),
      ctaTitle: "Få en hjemmeside, der passer til din praksis",
      ctaBody: "Opret en konto og fortæl om din praksis — så bygger BirdFlow det første udkast til din hjemmeside.",
      ctaButton: "Få din hjemmeside",
    },
    en: {
      ...SHARED_EN,
      kicker: "For psychologists",
      h1: "Website for psychologists",
      h1Em: "— with booking and calm in the practical work.",
      lead: "Your website is often the first meeting with a new client. BirdFlow brings a professional website, online booking and administration together in one place — built for psychologists and private practices.",
      painsIntro: "Most psychologists face the same three challenges when their practice goes online.",
      pains: [
        {
          title: "The site has to build trust from the first click",
          body: "New clients decide quickly. A calm, professional design and a clear presentation of your profile and areas of work make it easy to choose you.",
        },
        {
          title: "Enquiries are scattered",
          body: "Phone messages, emails and contact forms in separate inboxes make follow-up hard. In BirdFlow, enquiries and bookings live in one place.",
        },
        {
          title: "The tech steals your time",
          body: "Plugins, updates and hosting don't belong in a psychology practice. With BirdFlow, operations, domain and maintenance are part of the subscription.",
        },
      ],
      featuresIntro: "Everything a psychology practice needs online — without assembling it from parts.",
      features: [
        {
          title: "Professional web design for psychologists",
          body: "The AI assistant builds the first draft from your description of the practice — structure, copy and colours. You adjust it yourself, and nothing goes live until you approve it.",
        },
        {
          title: "Online booking for your practice",
          body: "The client picks a service and time directly on the site. Confirmations and reminders are sent automatically, and you control which times are open.",
        },
        {
          title: "Your professional profile — as you describe it",
          body: "Titles, authorization, specialities and memberships appear exactly as you state them. BirdFlow never invents qualifications on your behalf.",
        },
        {
          title: "Prices, programmes and practical information",
          body: "Pages for your services, prices and practical details — waiting time, location, online sessions — that you can keep updated yourself.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "What does a website for a psychologist cost?",
          a: "BirdFlow is one combined subscription — see the current packages on the pricing page. Hosting, connecting your own domain and maintenance are included, so the price doesn't grow with technical add-ons.",
        },
        {
          q: "Can my clients book directly on the website?",
          a: "Yes. The client picks a service and time on your site, the booking lands in your BirdFlow calendar, and the confirmation is sent automatically. You control which times are open.",
        },
        {
          q: "I already have a website — can I move it to BirdFlow?",
          a: "Yes. Your content can move across, and your existing domain is connected. Many psychologists come from an older WordPress setup that has become heavy to maintain.",
        },
        {
          q: "Does BirdFlow make up text about my authorization or methods?",
          a: "No. Your profile and pages only show the titles, education and descriptions you provide — no invented qualifications or treatment promises.",
        },
      ],
      ctaTitle: "Get a website that fits your practice",
      ctaBody: "Create an account and tell us about your practice — and BirdFlow builds the first draft of your website.",
      ctaButton: "Get your website",
    },
  },

  psykoterapeut: {
    da: {
      ...SHARED_DA,
      kicker: "Til psykoterapeuter",
      h1: "Hjemmeside til psykoterapeut",
      h1Em: "— der formidler din tilgang og gør det nemt at tage kontakt.",
      lead: "Som psykoterapeut vælger klienter dig på tilliden til din tilgang. BirdFlow giver dig en hjemmeside, der formidler din måde at arbejde på — med booking og henvendelser samlet ét sted.",
      painsIntro: "En psykoterapeutisk praksis stiller sine egne krav til hjemmesiden.",
      pains: [
        {
          title: "Din tilgang skal kunne mærkes",
          body: "Kognitiv, eksistentiel, kropsorienteret eller noget helt fjerde — nye klienter leder efter en terapeut, der passer til dem. Siden skal formidle din tilgang med dine egne ord.",
        },
        {
          title: "Baggrund og rammer skal stå klart",
          body: "Uddannelse, erfaring og rammerne for et forløb er ofte det, klienter sammenligner. BirdFlow viser din baggrund, præcis som du beskriver den — uden at standardisere titler.",
        },
        {
          title: "Første skridt skal være let",
          body: "Nogle vil booke med det samme, andre vil skrive først. Din side kan tilbyde begge dele, og alle henvendelser samles i BirdFlow.",
        },
      ],
      featuresIntro: "En hjemmeside, der arbejder for din praksis — fra første besøg til booket samtale.",
      features: [
        {
          title: "Sider til tilgang, metoder og forløb",
          body: "Forklar hvad du arbejder med, hvordan et forløb ser ud, og hvad en session koster — struktureret, roligt og med dine egne formuleringer.",
        },
        {
          title: "Booking eller kontakt — du vælger",
          body: "Online booking med automatiske bekræftelser, en kontaktformular eller begge dele. Du bestemmer, hvordan nye klienter tager første skridt.",
        },
        {
          title: "Et udtryk der passer til din praksis",
          body: "Brand guiden holder farver, skrifter og tone ens på hele siden — fra forsiden til bookingen — så helheden føles gennemarbejdet.",
        },
        {
          title: "Redigér selv — uden teknik",
          body: "Ret tekster og sider direkte i BirdFlow, når din praksis udvikler sig. Hosting, domæne og vedligeholdelse er med i abonnementet.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("psykoterapeut"),
      ctaTitle: "En hjemmeside, der lyder som dig",
      ctaBody: "Fortæl om din praksis og din tilgang — så bygger BirdFlow det første udkast, som du selv retter til.",
      ctaButton: "Få din hjemmeside",
    },
    en: {
      ...SHARED_EN,
      kicker: "For psychotherapists",
      h1: "Website for psychotherapists",
      h1Em: "— that conveys your approach and makes contact easy.",
      lead: "As a psychotherapist, clients choose you on trust in your approach. BirdFlow gives you a website that conveys the way you work — with booking and enquiries gathered in one place.",
      painsIntro: "A psychotherapy practice makes its own demands of a website.",
      pains: [
        {
          title: "Your approach has to come through",
          body: "Cognitive, existential, body-oriented or something else entirely — new clients look for a therapist who fits them. The site should convey your approach in your own words.",
        },
        {
          title: "Background and framing must be clear",
          body: "Education, experience and the framing of a programme are often what clients compare. BirdFlow shows your background exactly as you describe it — without standardizing titles.",
        },
        {
          title: "The first step must be easy",
          body: "Some want to book straight away, others want to write first. Your site can offer both, and every enquiry is gathered in BirdFlow.",
        },
      ],
      featuresIntro: "A website that works for your practice — from first visit to booked session.",
      features: [
        {
          title: "Pages for approach, methods and programmes",
          body: "Explain what you work with, what a programme looks like and what a session costs — structured, calm and in your own words.",
        },
        {
          title: "Booking or contact — you choose",
          body: "Online booking with automatic confirmations, a contact form, or both. You decide how new clients take the first step.",
        },
        {
          title: "A look that fits your practice",
          body: "The brand guide keeps colours, fonts and tone consistent across the site — from the front page to the booking flow.",
        },
        {
          title: "Edit it yourself — no tech required",
          body: "Adjust copy and pages directly in BirdFlow as your practice evolves. Hosting, domain and maintenance are part of the subscription.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "How do I show my therapeutic approach on the site?",
          a: "Your website gets room to explain your approach, your methods and the framing of a programme — in your own words. The AI assistant drafts it from what you tell it, and you adjust before anything goes live.",
        },
        {
          q: "Can new clients both book and write to me?",
          a: "Yes. You choose whether the site offers online booking, a contact form or both. Enquiries and bookings are gathered in BirdFlow, and confirmations are sent automatically.",
        },
        {
          q: "How are my education and experience presented?",
          a: "Exactly as you describe them. BirdFlow doesn't standardize titles and doesn't invent certifications — you decide what is said about your background.",
        },
        {
          q: "What does a website for a psychotherapist cost?",
          a: "You pay one subscription covering website, booking, hosting and maintenance. See the packages on the pricing page.",
        },
      ],
      ctaTitle: "A website that sounds like you",
      ctaBody: "Tell us about your practice and your approach — and BirdFlow builds the first draft for you to adjust.",
      ctaButton: "Get your website",
    },
  },

  psykiater: {
    da: {
      ...SHARED_DA,
      kicker: "Til psykiatere",
      h1: "Hjemmeside til psykiater",
      h1Em: "— overskuelig information til patienter og henvisere.",
      lead: "Som speciallæge i psykiatri handler din hjemmeside om klarhed: hvem du er, hvad klinikken tilbyder, og hvordan man kommer i gang som patient. BirdFlow samler det hele — og gør det nemt at holde opdateret.",
      painsIntro: "En psykiatrisk klinik har andre behov end en klassisk profilside.",
      pains: [
        {
          title: "Patienter leder efter praktisk afklaring",
          body: "Henvisningskrav, ventetid, priser og forberedelse. En overskuelig side sparer telefonopkald og misforståelser — for både patienter og henvisende læger.",
        },
        {
          title: "Informationen ændrer sig",
          body: "Ventetid og tilgang af nye patienter skifter. Med BirdFlow opdaterer du selv siden på få minutter — uden at vente på et webbureau.",
        },
        {
          title: "Tilliden skal være på plads",
          body: "En rolig, professionel side med korrekt information om din baggrund og klinikkens tilbud — vist præcis som du angiver det, uden tilføjede påstande.",
        },
      ],
      featuresIntro: "Det, en privat psykiatrisk praksis skal bruge — hverken mere eller mindre.",
      features: [
        {
          title: "Klinikside med praktisk information",
          body: "Henvisning, ventetid, priser og praktiske krav — samlet, struktureret og let at finde for patienter og henvisere.",
        },
        {
          title: "Booking eller kontakt efter klinikkens behov",
          body: "Åbn for online booking på udvalgte ydelser, eller vis kontaktoplysninger og en formular i stedet. Du bestemmer, hvad der passer til klinikken.",
        },
        {
          title: "Automatiske bekræftelser",
          body: "Når der bookes, sendes bekræftelse og påmindelse automatisk — og aftalen ligger i klinikkens kalender i BirdFlow.",
        },
        {
          title: "Ikke et journalsystem — med vilje",
          body: "BirdFlow håndterer hjemmeside, booking og henvendelser. Journaler og kliniske systemer beholder du der, hvor de er i dag.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("psykiater"),
      ctaTitle: "En klinikside, der er nem at holde korrekt",
      ctaBody: "Fortæl om klinikken og dens tilbud — så bygger BirdFlow det første udkast, du kan rette til og godkende.",
      ctaButton: "Kom i gang",
    },
    en: {
      ...SHARED_EN,
      kicker: "For psychiatrists",
      h1: "Website for psychiatrists",
      h1Em: "— clear information for patients and referrers.",
      lead: "As a medical specialist in psychiatry, your website is about clarity: who you are, what the clinic offers, and how to get started as a patient. BirdFlow brings it together — and makes it easy to keep current.",
      painsIntro: "A psychiatric clinic has different needs than a classic profile site.",
      pains: [
        {
          title: "Patients look for practical clarity",
          body: "Referral requirements, waiting time, prices and preparation. A clear page saves phone calls and misunderstandings — for patients and referring doctors alike.",
        },
        {
          title: "The information keeps changing",
          body: "Waiting times and intake of new patients shift. With BirdFlow you update the site yourself in minutes — without waiting for an agency.",
        },
        {
          title: "Trust must be in place",
          body: "A calm, professional page with correct information about your background and the clinic's services — shown exactly as you state it, with no added claims.",
        },
      ],
      featuresIntro: "What a private psychiatric practice needs — no more, no less.",
      features: [
        {
          title: "A clinic page with practical information",
          body: "Referrals, waiting time, prices and practical requirements — gathered, structured and easy to find for patients and referrers.",
        },
        {
          title: "Booking or contact, as the clinic prefers",
          body: "Open online booking for selected services, or show contact details and a form instead. You decide what fits the clinic.",
        },
        {
          title: "Automatic confirmations",
          body: "When a booking is made, the confirmation and reminder are sent automatically — and the appointment sits in the clinic's BirdFlow calendar.",
        },
        {
          title: "Not a medical record system — on purpose",
          body: "BirdFlow handles the website, booking and enquiries. Records and clinical systems stay where they are today.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "Does BirdFlow fit a private psychiatric practice?",
          a: "Yes. The site gathers what patients and referring doctors look for: practical information, referral requirements, waiting time, prices and contact — presented calmly and clearly.",
        },
        {
          q: "Can I show referral and waiting-time information?",
          a: "Yes, and you can keep it updated yourself without going through an agency — for example when the waiting time changes or you close intake of new patients.",
        },
        {
          q: "Is BirdFlow a medical record system?",
          a: "No. BirdFlow handles your website, booking and enquiries. Records and clinical systems stay in the systems you use for that today.",
        },
        {
          q: "Can the clinic have both online booking and phone contact?",
          a: "Yes. You decide whether patients can book selected services online, or whether the site should show contact details and a form instead.",
        },
      ],
      ctaTitle: "A clinic page that is easy to keep correct",
      ctaBody: "Tell us about the clinic and its services — and BirdFlow builds the first draft for you to adjust and approve.",
      ctaButton: "Get started",
    },
  },

  terapeut: {
    da: {
      ...SHARED_DA,
      kicker: "Til terapeuter",
      h1: "Hjemmeside til terapeut",
      h1Em: "— uanset om du arbejder med par, familier, stress eller traumer.",
      lead: "Parterapeut, familieterapeut, stress- eller traumeterapeut: BirdFlow giver dig en hjemmeside, der forklarer, hvem du hjælper og hvordan — med online booking og administration samlet ét sted.",
      painsIntro: "Terapeuter dækker mange arbejdsområder — hjemmesiden skal kunne rumme dem.",
      pains: [
        {
          title: "Klienter skal kunne se sig selv i din side",
          body: "Den, der søger parterapi, leder efter noget andet end den, der er ramt af stress. Din side kan præsentere hvert område for sig — med egne tekster og priser.",
        },
        {
          title: "Flere ydelser, flere formater",
          body: "Forskellige sessionstyper, varigheder og priser skal stå klart, så klienten ved præcis, hvad der bookes — også når du tilbyder både fysiske og online sessioner.",
        },
        {
          title: "Administrationen vokser med praksissen",
          body: "Bekræftelser, påmindelser og opfølgning tager tid, du kunne bruge med klienter. BirdFlow sender de automatiske mails for dig.",
        },
      ],
      featuresIntro: "Én platform til hele terapipraksissen — hjemmeside, booking og overblik.",
      features: [
        {
          title: "Ydelsessider til hvert område",
          body: "Parterapi, familieterapi, individuelle forløb — hver ydelse med sin egen beskrivelse, varighed og pris, formuleret med dine ord.",
        },
        {
          title: "Online booking med regler, du styrer",
          body: "Klienten booker den ydelse og tid, der passer. Dobbeltbooking spærres automatisk, og du styrer selv åbne tider og pauser.",
        },
        {
          title: "Fysisk og online",
          body: "Vis hvor du holder til, og hvilke sessioner der kan foregå online — med de praktiske rammer beskrevet, så klienten er forberedt.",
        },
        {
          title: "Tekster, du selv kan ændre",
          body: "Justér beskrivelser, priser og sider direkte i BirdFlow, når dit tilbud udvikler sig — uden kode og uden webbureau.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("terapeut"),
      ctaTitle: "Saml din terapipraksis ét sted",
      ctaBody: "Fortæl om dine ydelser og din måde at arbejde på — så bygger BirdFlow det første udkast til din hjemmeside.",
      ctaButton: "Få din hjemmeside",
    },
    en: {
      ...SHARED_EN,
      kicker: "For therapists",
      h1: "Website for therapists",
      h1Em: "— whether you work with couples, families, stress or trauma.",
      lead: "Couples therapist, family therapist, stress or trauma therapist: BirdFlow gives you a website that explains who you help and how — with online booking and administration in one place.",
      painsIntro: "Therapists cover many areas of work — the website has to hold them all.",
      pains: [
        {
          title: "Clients need to see themselves in your site",
          body: "Someone seeking couples therapy is looking for something different than someone hit by stress. Your site can present each area separately — with its own copy and prices.",
        },
        {
          title: "Several services, several formats",
          body: "Different session types, durations and prices must be clear, so the client knows exactly what is being booked — including when you offer both in-person and online sessions.",
        },
        {
          title: "Admin grows with the practice",
          body: "Confirmations, reminders and follow-up take time you could spend with clients. BirdFlow sends the automatic emails for you.",
        },
      ],
      featuresIntro: "One platform for the whole therapy practice — website, booking and overview.",
      features: [
        {
          title: "Service pages for each area",
          body: "Couples therapy, family therapy, individual programmes — each service with its own description, duration and price, in your words.",
        },
        {
          title: "Online booking with rules you control",
          body: "The client books the service and time that fits. Double-booking is blocked automatically, and you control open times and breaks.",
        },
        {
          title: "In person and online",
          body: "Show where you are based and which sessions can happen online — with the practical framing described so the client is prepared.",
        },
        {
          title: "Copy you can change yourself",
          body: "Adjust descriptions, prices and pages directly in BirdFlow as your offer evolves — no code, no agency.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "Can I show several types of programmes — e.g. couples therapy and stress programmes?",
          a: "Yes. You create your services with their own description, duration and price — for example couples therapy, family therapy or individual programmes — and the client chooses what to book.",
        },
        {
          q: "Does it work if I offer online sessions?",
          a: "Yes. You can present both in-person and online sessions and describe the practical framing on the site, so the client knows what applies before the conversation.",
        },
        {
          q: "Can I use my own domain?",
          a: "Yes. Your domain is connected to the website, HTTPS included. You keep owning the domain with your current provider.",
        },
        {
          q: "What does a website for a therapist cost?",
          a: "One subscription covers website, booking and administration — see the packages on the pricing page. There are no technical add-ons for hosting or updates.",
        },
      ],
      ctaTitle: "Bring your therapy practice together",
      ctaBody: "Tell us about your services and the way you work — and BirdFlow builds the first draft of your website.",
      ctaButton: "Get your website",
    },
  },

  healer: {
    da: {
      ...SHARED_DA,
      kicker: "Til healere og holistiske behandlere",
      h1: "Hjemmeside til healer og alternativ behandler",
      h1Em: "— med et udtryk, der passer til din praksis.",
      lead: "Din praksis har sin egen stemning — det skal din hjemmeside også have. BirdFlow lader dig præsentere din tilgang, dine sessioner og priser med et roligt, personligt udtryk og booking direkte på siden.",
      painsIntro: "Alternative og holistiske praksisser løber ofte ind i de samme tre ting.",
      pains: [
        {
          title: "Udtrykket betyder noget",
          body: "Standardskabeloner ligner ofte kontorer. Med brand guiden får din side farver, skrifter og en tone, der matcher stemningen i din praksis — ro, balance og nærvær.",
        },
        {
          title: "Din tilgang skal formidles med dine ord",
          body: "Healing, klangmassage, meditation eller kropslige forløb — du beskriver selv, hvad en session indeholder, og hvad klienter kan opleve. BirdFlow opdigter aldrig løfter om virkning.",
        },
        {
          title: "Det praktiske skal bare køre",
          body: "Booking, bekræftelser og betaling for produkter og forløb — samlet ét sted, så du kan bruge tiden på dine klienter i stedet for administration.",
        },
      ],
      featuresIntro: "En hjemmeside, der understøtter din praksis — uden at lave den om.",
      features: [
        {
          title: "Et personligt visuelt udtryk",
          body: "Farver, typografi og billeder sat sammen omkring din praksis og dens stemning — ikke en kontorskabelon med nye farver.",
        },
        {
          title: "Sessionstyper og forløb",
          body: "Præsentér dine sessioner, forløb og priser overskueligt — med plads til at forklare din tilgang og det, klienter kan opleve.",
        },
        {
          title: "Online booking",
          body: "Klienter vælger session og tidspunkt direkte på siden, og bekræftelsen sendes automatisk. Du styrer selv kalenderen.",
        },
        {
          title: "Salg af produkter og forløb",
          body: "Webshoppen kan sælge produkter og forløb med betaling via Stripe — hvis din praksis har brug for det.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("healer"),
      ctaTitle: "En hjemmeside med din praksis' stemning",
      ctaBody: "Fortæl om din tilgang og dine sessioner — så bygger BirdFlow det første udkast, som du selv retter til.",
      ctaButton: "Få din hjemmeside",
    },
    en: {
      ...SHARED_EN,
      kicker: "For healers and holistic practitioners",
      h1: "Website for healers and holistic practitioners",
      h1Em: "— with a look that fits your practice.",
      lead: "Your practice has its own atmosphere — your website should too. BirdFlow lets you present your approach, your sessions and prices with a calm, personal look and booking directly on the site.",
      painsIntro: "Holistic and alternative practices often run into the same three things.",
      pains: [
        {
          title: "The look matters",
          body: "Standard templates often look like offices. With the brand guide, your site gets colours, fonts and a tone that match the atmosphere of your practice — calm, balance and presence.",
        },
        {
          title: "Your approach must be told in your words",
          body: "Healing, sound massage, meditation or body-oriented programmes — you describe what a session contains and what clients may experience. BirdFlow never invents promises of effect.",
        },
        {
          title: "The practical side should just run",
          body: "Booking, confirmations and payment for products and programmes — in one place, so your time goes to clients instead of admin.",
        },
      ],
      featuresIntro: "A website that supports your practice — without reshaping it.",
      features: [
        {
          title: "A personal visual identity",
          body: "Colours, typography and imagery arranged around your practice and its atmosphere — not an office template with new colours.",
        },
        {
          title: "Session types and programmes",
          body: "Present your sessions, programmes and prices clearly — with room to explain your approach and what clients may experience.",
        },
        {
          title: "Online booking",
          body: "Clients pick a session and time directly on the site, and the confirmation is sent automatically. You control the calendar.",
        },
        {
          title: "Selling products and programmes",
          body: "The shop can sell products and programmes with payment via Stripe — if your practice needs it.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "Does BirdFlow fit my practice if I work alternatively or holistically?",
          a: "Yes. You describe your own approach, sessions and programmes — and the site's look can be made softer and more personal, so it fits the atmosphere of your practice.",
        },
        {
          q: "Can I show prices and programmes on the site?",
          a: "Yes. Session types, programmes and prices are presented clearly, and clients can book directly on the site if you open for it.",
        },
        {
          q: "Does BirdFlow write promises about effect on my behalf?",
          a: "No. Your copy describes your approach and what clients may experience in a session — in your own words and without invented promises of results.",
        },
        {
          q: "Can I also sell products or programmes online?",
          a: "Yes. The shop can sell products and programmes with payment via Stripe, if your practice needs it.",
        },
      ],
      ctaTitle: "A website with your practice's atmosphere",
      ctaBody: "Tell us about your approach and your sessions — and BirdFlow builds the first draft for you to adjust.",
      ctaButton: "Get your website",
    },
  },

  klinik: {
    da: {
      ...SHARED_DA,
      kicker: "Til klinikker",
      h1: "Hjemmeside og booking til klinikker",
      h1Em: "— med flere behandlere samlet ét sted.",
      lead: "Én fælles hjemmeside, en profil til hver behandler og online booking, hvor klienten kan vælge behandler. BirdFlow samler klinikkens digitale hverdag — fra første besøg til bekræftet booking.",
      painsIntro: "Klinikker med flere behandlere kender udfordringerne.",
      pains: [
        {
          title: "Én klinik, mange profiler",
          body: "Klinikkens side skal både formidle det fælles tilbud og gøre hver behandler synlig — med baggrund, arbejdsområder og de titler, der faktisk gælder.",
        },
        {
          title: "Booking på tværs af behandlere",
          body: "Klienter skal kunne vælge den rette behandler og tid — uden dobbeltbookinger og uden manuelle kalendere ved siden af.",
        },
        {
          title: "Indholdet skal styres samlet",
          body: "Tekster, henvendelser og bookinger ét sted, så klinikken ikke drukner i spredte systemer og halvgamle sider.",
        },
      ],
      featuresIntro: "Det, en klinik skal bruge for at samle behandlere og booking på én platform.",
      features: [
        {
          title: "Fælles klinikside med behandlerprofiler",
          body: "Hver behandler præsenteres med sin egen side — billede, baggrund og arbejdsområder, beskrevet med jeres egne ord og faktiske titler.",
        },
        {
          title: "Online booking med personale",
          body: "Bookingen understøtter personale, så klienten kan vælge behandler ved bookingen — og dobbeltbooking spærres automatisk.",
        },
        {
          title: "Samlet administration",
          body: "Indhold, henvendelser og bookinger administreres ét sted i BirdFlow — med automatiske bekræftelser og påmindelser.",
        },
        {
          title: "Ét fælles udtryk",
          body: "Brand guiden holder farver, skrifter og tone ens på tværs af siderne — også når flere hænder opdaterer indholdet.",
        },
      ],
      steps: STEPS_DA,
      faq: faqDa("klinik"),
      ctaTitle: "Saml klinikken på én platform",
      ctaBody: "Fortæl om klinikken og jeres behandlere — så bygger BirdFlow det første udkast til jeres fælles side.",
      ctaButton: "Kom i gang",
    },
    en: {
      ...SHARED_EN,
      kicker: "For clinics",
      h1: "Website and booking for clinics",
      h1Em: "— with several practitioners in one place.",
      lead: "One shared website, a profile for each practitioner and online booking where the client can choose their practitioner. BirdFlow gathers the clinic's digital day — from first visit to confirmed booking.",
      painsIntro: "Clinics with several practitioners know the challenges.",
      pains: [
        {
          title: "One clinic, many profiles",
          body: "The clinic's site must convey the shared offer and make each practitioner visible — with background, areas of work and the titles that actually apply.",
        },
        {
          title: "Booking across practitioners",
          body: "Clients must be able to choose the right practitioner and time — without double-bookings and without manual calendars on the side.",
        },
        {
          title: "Content managed together",
          body: "Copy, enquiries and bookings in one place, so the clinic doesn't drown in scattered systems and half-old pages.",
        },
      ],
      featuresIntro: "What a clinic needs to bring practitioners and booking onto one platform.",
      features: [
        {
          title: "A shared clinic site with practitioner profiles",
          body: "Each practitioner is presented with their own page — photo, background and areas of work, described in your own words and actual titles.",
        },
        {
          title: "Online booking with staff",
          body: "Booking supports staff, so the client can choose a practitioner when booking — and double-booking is blocked automatically.",
        },
        {
          title: "Administration in one place",
          body: "Content, enquiries and bookings are managed in one place in BirdFlow — with automatic confirmations and reminders.",
        },
        {
          title: "One shared look",
          body: "The brand guide keeps colours, fonts and tone consistent across pages — even when several hands update the content.",
        },
      ],
      steps: STEPS_EN,
      faq: [
        {
          q: "Can clients choose a specific practitioner when booking?",
          a: "Yes. Booking supports staff, so the client can choose a practitioner when booking — and double-bookings are blocked automatically, online and manually.",
        },
        {
          q: "How are our practitioners presented?",
          a: "Each practitioner can have their own profile page with photo, background and the areas they work with — described in your own words and actual titles.",
        },
        {
          q: "Can we manage the website together?",
          a: "Yes. Content, enquiries and bookings are managed in one place, and a shared brand guide keeps colours, fonts and tone consistent across pages.",
        },
        {
          q: "Does BirdFlow fit a multidisciplinary clinic?",
          a: "Yes. Clinics with different professions — for example psychologists, therapists and other practitioners — can present each profile with the background and titles that actually apply.",
        },
      ],
      ctaTitle: "Bring the clinic onto one platform",
      ctaBody: "Tell us about the clinic and your practitioners — and BirdFlow builds the first draft of your shared site.",
      ctaButton: "Get started",
    },
  },
};
