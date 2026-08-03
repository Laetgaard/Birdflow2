/**
 * Every string the onboarding walkthrough renders, in both languages.
 *
 * The customer picks their language on the second screen, right after the
 * AI-vs-DIY fork, and from that moment this record decides what the
 * walkthrough says. Danish is the default and its wording is unchanged from
 * before the choice existed, so a customer who never touches the question
 * sees exactly the flow they saw before.
 *
 * The sentences under `say` are not labels — they are messages the client
 * sends *into* the conversation on the customer's behalf when they click a
 * card. They have to be in the customer's language for the same reason the
 * agent's questions do: the model reads the transcript back.
 */
import type { SiteLanguage } from "@shared/siteLanguage";

export type OnboardingUiCopy = {
  /** Progress rail across the top. */
  rail: string[];
  /** The build checklist, in pipeline order. Ids must match GEN_PHASES. */
  genPhases: string[];

  languageStepTitle: string;
  languageStepHint: string;
  languageDanish: string;
  languageDanishHint: string;
  languageEnglish: string;
  languageEnglishHint: string;

  welcome: (name: string) => string;
  forkAi: string;
  forkDiy: string;

  composerPlaceholder: string;
  thinking: string;
  errorPrefix: string;

  reportCreated: string;
  reportChanged: string;
  reportChecks: string;
  reportMore: (n: number) => string;

  fontSampleHeading: string;
  fontSampleBody: (heading: string, body: string) => string;

  uploadLogoTitle: string;
  uploadLogoHint: string;
  uploadImagesTitle: string;
  uploadImagesHint: string;
  uploadInspirationTitle: string;
  uploadInspirationHint: string;
  uploadPickOne: string;
  uploadPickMany: string;
  logoCaption: string;

  templatePickerTitle: string;
  templateNamePlaceholder: string;
  templateContinue: string;

  generatingTitle: string;
  generatingHint: string;
  stalledTitle: string;
  stalledButton: string;
  retryButton: string;

  paidHeading: string;
  previewHeading: string;

  paidSubhead: string;
  previewSubhead: string;
  awaitingWebhook: string;
  fallbackNotice: string;
  /** The build stopped because it reached its cost ceiling. */
  spendLimitNotice: string;
  reportEmpty: string;
  adjustTitle: string;
  adjustHint: string;
  adjusting: string;
  adjustPlaceholder: string;
  domainTitle: string;
  domainHint: string;
  domainPlaceholder: string;
  domainCheck: string;
  domainAvailable: (domain: string, price: string) => string;
  domainTaken: (domain: string) => string;
  domainPricePerYear: (price: number) => string;
  websiteMissing: string;
  goToDashboard: string;

  adjustDone: string;
  adjustNoop: string;
  adjustNeededApproval: string;
  domainCheckFailed: string;
  domainCheckFailedTitle: string;
  bookingOpenFailed: string;

  errorToastTitle: string;
  saveFailed: string;
  createFailed: string;
  uploadFailedTitle: string;
  waitTitle: string;
  waitBody: string;

  say: {
    aiPath: string;
    palette: (name: string) => string;
    fontPair: (name: string) => string;
    logoUploaded: string;
    imagesUploaded: (n: number) => string;
    inspirationUploaded: (n: number) => string;
    restart: string;
  };
};

export const ONBOARDING_UI_COPY: Record<SiteLanguage, OnboardingUiCopy> = {
  da: {
    rail: ["Virksomhed", "Ønsker", "Materiale", "Design", "AI bygger", "Godkend"],
    genPhases: [
      "Skaber din brandguide",
      "Planlægger dit website",
      "Bygger sider og indhold på dansk",
      "Designer unikke komponenter og billeder",
      "Kvalitetstjek: links, kontrast og mobilvisning",
    ],

    languageStepTitle: "Hvilket sprog skal din hjemmeside være på?",
    languageStepHint:
      "Jeg skriver hele hjemmesiden på det sprog, du vælger — og vi fortsætter samtalen der.",
    languageDanish: "Dansk",
    languageDanishHint: "Hjemmeside, samtale og e-mails på dansk",
    languageEnglish: "English",
    languageEnglishHint: "Website, conversation and emails in English",

    welcome: (name) =>
      `Hej${name ? ` ${name}` : ""}! Jeg er din AI-guide hos Birdflow. Sammen bygger vi din hjemmeside — jeg spørger, du svarer, og til sidst bygger jeg det hele for dig. Vil du have, at jeg bygger den, eller vil du hellere selv bygge ud fra en skabelon?`,
    forkAi: "AI bygger den",
    forkDiy: "Jeg bygger selv",

    composerPlaceholder: "Skriv dit svar…",
    thinking: "Tænker…",
    errorPrefix: "Beklager, noget gik galt",

    reportCreated: "Oprettet",
    reportChanged: "Ændret",
    reportChecks: "Tjek",
    reportMore: (n) => `+ ${n} mere...`,

    fontSampleHeading: "Overskrift der fanger",
    fontSampleBody: (heading, body) =>
      `Brødtekst som er behagelig at læse — ${heading} + ${body}`,

    uploadLogoTitle: "Upload dit logo",
    uploadLogoHint: "PNG/SVG/JPG — det bedste du har",
    uploadImagesTitle: "Upload egne billeder",
    uploadImagesHint: "Op til 4 billeder af jer, jeres produkter eller arbejde",
    uploadInspirationTitle: "Upload inspirationsbilleder",
    uploadInspirationHint: "Op til 3 screenshots af sider du kan lide",
    uploadPickOne: "Vælg fil",
    uploadPickMany: "Vælg filer",
    logoCaption: "Dit nye logo — gemt i mediebiblioteket",

    templatePickerTitle: "Vælg en skabelon at bygge videre på",
    templateNamePlaceholder: "Hvad skal din hjemmeside hedde?",
    templateContinue: "Fortsæt",

    generatingTitle: "Jeg bygger din hjemmeside",
    generatingHint: "Det tager typisk et par minutter — bliv endelig på siden.",
    stalledTitle: "Opbygningen ser ud til at være afbrudt (serveren kan være genstartet).",
    stalledButton: "Genstart opbygningen",
    retryButton: "Prøv igen",

    paidHeading: "Tak — din hjemmeside er din",
    previewHeading: "Sådan ser din hjemmeside ud",

    paidSubhead: "Betalingen er registreret. Du kan nu arbejde videre i dit kontrolpanel.",
    previewSubhead:
      "Se den igennem, hent din brandguide — og vælg så, om vi skal sætte den i luften, eller om du vil have den tilpasset først.",
    awaitingWebhook: "Vi bekræfter din betaling hos Stripe…",
    fallbackNotice:
      "AI'en kunne ikke nå hele vejen denne gang, så vi har bygget en solid startside ud fra dine svar. AI-assistenten i editoren kender din brandguide og kan bygge videre.",
    spendLimitNotice:
      "Opbygningen nåede sit omkostningsloft, så AI'en stoppede undervejs. Det, der nåede at blive bygget, er gemt — kontakt os, hvis resten skal bygges færdigt.",
    reportEmpty: "Dit website er bygget og gemt. Du finder alle detaljer i editoren.",
    adjustTitle: "Skal vi justere noget med det samme?",
    adjustHint: 'Fx "gør forsiden mere rolig", "tilføj et afsnit om priser" eller "flyt kontakt op".',
    adjusting: "Justerer…",
    adjustPlaceholder: "Beskriv din justering…",
    domainTitle: "Skal siden have sit eget domæne?",
    domainHint:
      'Tjek om det er ledigt nu — du køber eller forbinder det under "Indstillinger", når dit abonnement er aktivt.',
    domainPlaceholder: "fx dinvirksomhed.dk",
    domainCheck: "Tjek",
    domainAvailable: (domain, price) => `${domain} er ledigt${price} — gemt som dit ønske.`,
    domainTaken: (domain) =>
      `${domain} er optaget — du kan forbinde et domæne, du ejer, under Indstillinger.`,
    domainPricePerYear: (price) => ` (~$${price}/år)`,
    websiteMissing: "Vi kunne ikke finde din hjemmeside. Prøv at genindlæse siden.",
    goToDashboard: "Gå til kontrolpanelet",

    adjustDone: "Ændringerne er gennemført!",
    adjustNoop: "Ingen ændringer var nødvendige.",
    adjustNeededApproval:
      "Ændringen krævede godkendelse og blev sprunget over — brug editoren bagefter.",
    domainCheckFailed: "Kunne ikke tjekke domænet",
    domainCheckFailedTitle: "Domænetjek fejlede",
    bookingOpenFailed: "Kunne ikke åbne booking.",

    errorToastTitle: "Fejl",
    saveFailed: "Kunne ikke gemme dit valg",
    createFailed: "Kunne ikke oprette hjemmesiden",
    uploadFailedTitle: "Upload fejlede",
    waitTitle: "Vent et øjeblik",
    waitBody: "Fortæl mig først hvad din virksomhed hedder, så jeg kan oprette dit projekt.",

    say: {
      aiPath: "Jeg vil gerne have, at AI'en bygger min hjemmeside sammen med mig.",
      palette: (name) => `Jeg vælger farvepaletten "${name}".`,
      fontPair: (name) => `Jeg vælger skrifttyperne "${name}".`,
      logoUploaded: "Jeg har uploadet mit logo.",
      imagesUploaded: (n) => `Jeg har uploadet ${n} af mine egne billeder.`,
      inspirationUploaded: (n) => `Jeg har uploadet ${n} inspirationsbilleder.`,
      restart: "Serveren genstartede — fortsæt med at bygge min hjemmeside, tak.",
    },
  },

  en: {
    rail: ["Business", "Goals", "Material", "Design", "AI builds", "Approve"],
    genPhases: [
      "Creating your brand guide",
      "Planning your website",
      "Building pages and copy in English",
      "Designing unique components and images",
      "Quality check: links, contrast and mobile layout",
    ],

    languageStepTitle: "What language should your website be in?",
    languageStepHint:
      "I'll write the whole website in the language you pick — and we'll carry on the conversation there.",
    languageDanish: "Dansk",
    languageDanishHint: "Hjemmeside, samtale og e-mails på dansk",
    languageEnglish: "English",
    languageEnglishHint: "Website, conversation and emails in English",

    welcome: (name) =>
      `Hi${name ? ` ${name}` : ""}! I'm your AI guide at Birdflow. We'll build your website together — I ask, you answer, and then I build the whole thing for you. Would you like me to build it, or would you rather start from a template yourself?`,
    forkAi: "Let the AI build it",
    forkDiy: "I'll build it myself",

    composerPlaceholder: "Write your answer…",
    thinking: "Thinking…",
    errorPrefix: "Sorry, something went wrong",

    reportCreated: "Created",
    reportChanged: "Changed",
    reportChecks: "Checks",
    reportMore: (n) => `+ ${n} more...`,

    fontSampleHeading: "A headline that lands",
    fontSampleBody: (heading, body) =>
      `Body text that is comfortable to read — ${heading} + ${body}`,

    uploadLogoTitle: "Upload your logo",
    uploadLogoHint: "PNG/SVG/JPG — the best version you have",
    uploadImagesTitle: "Upload your own photos",
    uploadImagesHint: "Up to 4 photos of you, your products or your work",
    uploadInspirationTitle: "Upload inspiration",
    uploadInspirationHint: "Up to 3 screenshots of sites you like",
    uploadPickOne: "Choose file",
    uploadPickMany: "Choose files",
    logoCaption: "Your new logo — saved to the media library",

    templatePickerTitle: "Pick a template to build on",
    templateNamePlaceholder: "What should your website be called?",
    templateContinue: "Continue",

    generatingTitle: "I'm building your website",
    generatingHint: "This usually takes a couple of minutes — please stay on the page.",
    stalledTitle: "The build looks like it was interrupted (the server may have restarted).",
    stalledButton: "Restart the build",
    retryButton: "Try again",

    paidHeading: "Thank you — your website is yours",
    previewHeading: "Here's your website",

    paidSubhead: "Your payment is registered. You can carry on in your dashboard.",
    previewSubhead:
      "Look it over, download your brand guide — then choose whether we put it live, or whether you want it adjusted first.",
    awaitingWebhook: "We're confirming your payment with Stripe…",
    fallbackNotice:
      "The AI couldn't make it all the way this time, so we've built a solid starting page from your answers. The AI assistant in the editor knows your brand guide and can carry on from here.",
    spendLimitNotice:
      "The build reached its cost limit, so the AI stopped part way through. Everything it managed to build is saved — get in touch if you want the rest finished.",
    reportEmpty: "Your website is built and saved. You'll find all the details in the editor.",
    adjustTitle: "Anything you want adjusted right away?",
    adjustHint: 'For example "make the front page calmer", "add a pricing section" or "move contact up".',
    adjusting: "Adjusting…",
    adjustPlaceholder: "Describe your adjustment…",
    domainTitle: "Should the site have its own domain?",
    domainHint:
      'Check whether it is free now — you buy or connect it under "Settings" once your subscription is active.',
    domainPlaceholder: "e.g. yourbusiness.com",
    domainCheck: "Check",
    domainAvailable: (domain, price) => `${domain} is available${price} — saved as your wish.`,
    domainTaken: (domain) => `${domain} is taken — you can connect a domain you own under Settings.`,
    domainPricePerYear: (price) => ` (~$${price}/yr)`,
    websiteMissing: "We couldn't find your website. Try reloading the page.",
    goToDashboard: "Go to the dashboard",

    adjustDone: "The changes are done!",
    adjustNoop: "No changes were needed.",
    adjustNeededApproval:
      "That change needed approval and was skipped — use the editor afterwards.",
    domainCheckFailed: "We couldn't check that domain",
    domainCheckFailedTitle: "Domain check failed",
    bookingOpenFailed: "We couldn't open the booking step.",

    errorToastTitle: "Error",
    saveFailed: "We couldn't save your choice",
    createFailed: "We couldn't create the website",
    uploadFailedTitle: "Upload failed",
    waitTitle: "One moment",
    waitBody: "Tell me your business name first, so I can create your project.",

    say: {
      aiPath: "I'd like the AI to build my website with me.",
      palette: (name) => `I'll go with the "${name}" colour palette.`,
      fontPair: (name) => `I'll go with the "${name}" typefaces.`,
      logoUploaded: "I've uploaded my logo.",
      imagesUploaded: (n) => `I've uploaded ${n} of my own photos.`,
      inspirationUploaded: (n) => `I've uploaded ${n} inspiration images.`,
      restart: "The server restarted — please carry on building my website.",
    },
  },
};
