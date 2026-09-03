/**
 * The language a customer's website is written in.
 *
 * One choice, made once near the start of onboarding, is the single source of
 * truth for that customer: the onboarding screens, the language the AI writes
 * their website in, the strings baked into the published site, and the
 * transactional emails BirdFlow sends them.
 *
 * Danish is the default everywhere. A customer who never sees the question —
 * an older session, a DIY site, a website row written before this column
 * existed — gets exactly the Danish experience they got before.
 *
 * Deliberately only two languages: adding a third means auditing every
 * `Record<SiteLanguage, T>` below, and the compiler will point at each one.
 */

export const SITE_LANGUAGES = ["da", "en"] as const;

export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

export const DEFAULT_SITE_LANGUAGE: SiteLanguage = "da";

/**
 * Coerce anything (a database column, a request body, an undefined) into a
 * language. Unknown values fall back to Danish rather than throwing — a bad
 * value must never be able to strand a customer mid-onboarding.
 */
export function normalizeSiteLanguage(value: unknown): SiteLanguage {
  return value === "en" ? "en" : DEFAULT_SITE_LANGUAGE;
}

/** BCP-47 locale, for `<html lang>` and Intl date/number formatting. */
export const SITE_LOCALE: Record<SiteLanguage, string> = {
  da: "da-DK",
  en: "en-US",
};

/** Endonym, for showing the choice to the person making it. */
export const SITE_LANGUAGE_LABEL: Record<SiteLanguage, string> = {
  da: "Dansk",
  en: "English",
};

/** Pick the active variant out of a `{ da, en }` record. */
export function pickLang<T>(record: Record<SiteLanguage, T>, lang: SiteLanguage): T {
  return record[lang] ?? record.da;
}

/* ─────────────────────────────────────────────────────────────
   Prompt fragments.

   Every AI prompt that produces customer-facing copy states the
   target language explicitly. Kept here so "the site is English but
   the hero is Danish" can only ever be one bug, not seven.
   ───────────────────────────────────────────────────────────── */

/** English name of the language, for use inside English-language prompts. */
export const LANGUAGE_NAME_EN: Record<SiteLanguage, string> = {
  da: "Danish",
  en: "English",
};

/** One instruction line to drop into any copywriting prompt. */
export function copyLanguageInstruction(lang: SiteLanguage): string {
  return lang === "da"
    ? "ALL website copy must be in Danish (da-DK) — headlines, body text, buttons, navigation, form labels, page names and the footer."
    : "ALL website copy must be in English (en-US) — headlines, body text, buttons, navigation, form labels, page names and the footer.";
}

/* ─────────────────────────────────────────────────────────────
   Strings baked into a published website.

   These are the parts of a generated site that the AI never writes:
   the cart drawer, the booking wizard, the checkout, the cookie
   banner and the legal pages. They ship as literal text inside the
   generated Next.js project, so they are resolved at publish time
   from the website's language.
   ───────────────────────────────────────────────────────────── */

export type PublishedSiteStrings = {
  // Cart
  cartTitle: string;
  cartClose: string;
  cartEach: string;
  cartEmpty: string;
  cartEmptyHint: string;
  cartRemove: string;
  cartTotal: string;
  cartCheckout: string;
  // Contact form
  contactTitle: string;
  contactThanks: string;
  contactName: string;
  contactEmail: string;
  contactMessage: string;
  contactSending: string;
  contactSend: string;
  contactError: string;
  // Booking
  bookingBadge: string;
  bookingTitle: string;
  bookingConfirmed: string;
  bookingConfirmedBody: string;
  bookingAnother: string;
  bookingNoServices: string;
  bookingChooseService: string;
  bookingChoosePerson: string;
  bookingChooseDateTime: string;
  bookingYourDetails: string;
  bookingLoadingAvailability: string;
  bookingUnavailable: string;
  bookingAvailableTimesFor: string;
  bookingNoTimes: string;
  bookingService: string;
  bookingDateTime: string;
  bookingWith: string;
  bookingAt: string;
  bookingFullName: string;
  bookingEmail: string;
  bookingPhone: string;
  bookingNotes: string;
  bookingNamePlaceholder: string;
  bookingEmailPlaceholder: string;
  bookingPhonePlaceholder: string;
  bookingNotesPlaceholder: string;
  bookingSubmitting: string;
  bookingSubmit: string;
  bookingBack: string;
  bookingContinue: string;
  bookingErrorRequired: string;
  bookingErrorMemberConflict: string;
  bookingErrorSlotTaken: string;
  bookingErrorGeneric: string;
  bookingAnyone: string;
  bookingLoadingTimes: string;
  bookingOpenSlot: string;
  bookingLegendAvailable: string;
  bookingLegendBlocked: string;
  /** Sentence before the "privacy policy" link on the booking form details step. */
  bookingDataNoticePre: string;
  // Products
  productsTitle: string;
  productsLoading: string;
  productsError: string;
  productsEmpty: string;
  productsFrom: string;
  productAddToCart: string;
  productAdded: string;
  productSelectOptions: string;
  productOutOfStock: string;
  productInStock: string;
  productOnlyLeft: (n: number) => string;
  productOnlyLeftPrefix: string;
  productOnlyLeftSuffix: string;
  productLoading: string;
  productNotFound: string;
  productNotFoundBody: string;
  productSale: string;
  productRelatedTitle: string;
  productRelatedSubtitle: string;
  productSectionDetails: string;
  productSectionShipping: string;
  productSectionCare: string;
  productSectionSize: string;
  productCloseViewer: string;
  productPreviousImage: string;
  productNextImage: string;
  navToggleMenu: string;
  comparisonFeature: string;
  productPaymentSuccess: string;
  productBackHome: string;
  productBackToProducts: string;
  productFreeShipping: string;
  productSecureCheckout: string;
  productEasyReturns: string;
  productWhyTitle: string;
  productWhySubtitle: string;
  productWhyQuality: string;
  productWhyQualityBody: string;
  productWhyReturns: string;
  productWhyReturnsBody: string;
  productWhyDelivery: string;
  productWhyDeliveryBody: string;
  productWhySupport: string;
  productWhySupportBody: string;
  // Checkout
  checkoutTitle: string;
  checkoutLoading: string;
  checkoutYourDetails: string;
  checkoutFullName: string;
  checkoutEmail: string;
  checkoutShippingAddress: string;
  checkoutAddress: string;
  checkoutCity: string;
  checkoutPostalCode: string;
  checkoutNamePlaceholder: string;
  checkoutEmailPlaceholder: string;
  checkoutAddressPlaceholder: string;
  checkoutCityPlaceholder: string;
  checkoutPostalCodePlaceholder: string;
  checkoutSubmitting: string;
  checkoutSubmit: string;
  checkoutSummary: string;
  checkoutSubtotal: string;
  checkoutShipping: string;
  checkoutShippingMethod: string;
  checkoutFree: string;
  checkoutTotal: string;
  checkoutEmptyTitle: string;
  checkoutEmptyBody: string;
  checkoutConfirmedTitle: string;
  checkoutConfirmedBody: string;
  checkoutConfirmationEmail: string;
  checkoutErrorRequired: string;
  checkoutErrorProcess: string;
  checkoutErrorEmptyCart: string;
  checkoutErrorGeneric: string;
  checkoutOutOfStock: string;
  /** Split into parts so the publisher can interpolate live quantities. */
  checkoutOutOfStockDetail: [string, string, string];
  checkoutOrderId: string;
  checkoutContinueShopping: string;
  checkoutBrowseProducts: string;
  checkoutBackToShopping: string;
  checkoutQty: string;
  checkoutLoadingShipping: string;
  // Cookie banner
  cookieText: string;
  cookieAccept: string;
  cookieReject: string;
  cookiePrivacyPolicy: string;
  newsletterButton: string;
  newsletterSuccess: string;
  newsletterPlaceholder: string;
  formSubmit: string;
  formSuccessTitle: string;
  formSuccessBody: string;
  ssrProductsEmpty: string;

  // Legal / footer
  legalTerms: string;
  legalPrivacy: string;
  legalHome: string;
  legalRightsReserved: string;
  legalLastUpdated: string;
};

export const PUBLISHED_SITE_STRINGS: Record<SiteLanguage, PublishedSiteStrings> = {
  da: {
    cartTitle: "Din kurv",
    cartClose: "Luk kurven",
    cartEach: " pr. stk.",
    cartEmpty: "Din kurv er tom",
    cartEmptyHint: "Læg et par varer i kurven for at komme i gang!",
    cartRemove: "Fjern",
    cartTotal: "I alt",
    cartCheckout: "Gå til kassen",

    contactTitle: "Kontakt os",
    contactThanks: "Tak! Vi vender tilbage hurtigst muligt.",
    contactName: "Dit navn",
    contactEmail: "Din e-mail",
    contactMessage: "Din besked",
    contactSending: "Sender…",
    contactSend: "Send besked",
    contactError: "Noget gik galt. Prøv venligst igen.",

    bookingBadge: "Book en tid",
    bookingTitle: "Book en tid",
    bookingConfirmed: "Din booking er bekræftet!",
    bookingConfirmedBody: "Vi har sendt en bekræftelse til din e-mail.",
    bookingAnother: "Book en tid mere",
    bookingNoServices: "Der er ingen ydelser til booking lige nu",
    bookingChooseService: "Vælg en ydelse",
    bookingChoosePerson: "Vælg en person",
    bookingChooseDateTime: "Vælg dato og tid",
    bookingYourDetails: "Dine oplysninger",
    bookingLoadingAvailability: "Henter ledige tider…",
    bookingUnavailable: "Ikke ledig",
    bookingAvailableTimesFor: "Ledige tider",
    bookingNoTimes: "Der er ingen ledige tider denne dag",
    bookingService: "Ydelse:",
    bookingDateTime: "Dato og tid:",
    bookingWith: "Hos:",
    bookingAt: "kl.",
    bookingFullName: "Fulde navn *",
    bookingEmail: "E-mail *",
    bookingPhone: "Telefon (valgfrit)",
    bookingNotes: "Bemærkninger (valgfrit)",
    bookingNamePlaceholder: "Anne Jensen",
    bookingEmailPlaceholder: "anne@eksempel.dk",
    bookingPhonePlaceholder: "+45 12 34 56 78",
    bookingNotesPlaceholder: "Særlige ønsker…",
    bookingSubmitting: "Booker…",
    bookingSubmit: "Bekræft booking",
    bookingBack: "Tilbage",
    bookingContinue: "Fortsæt",
    bookingErrorRequired: "Udfyld venligst alle påkrævede felter og prøv igen.",
    bookingErrorMemberConflict: "Den valgte person er ikke ledig på dette tidspunkt.",
    bookingErrorSlotTaken: "Tidspunktet er ikke længere ledigt. Vælg venligst et andet.",
    bookingErrorGeneric: "Noget gik galt. Prøv venligst igen.",
    bookingAnyone: "Hvem som helst",
    bookingLoadingTimes: "Henter tider…",
    bookingOpenSlot: "Åben tid",
    bookingLegendAvailable: "Ledig",
    bookingLegendBlocked: "Lukket",
    bookingDataNoticePre: "Dine oplysninger bruges kun til at håndtere din booking – se vores",

    productsTitle: "Produkter",
    productsLoading: "Henter produkter…",
    productsError: "Produkterne kunne ikke hentes. Prøv igen om lidt.",
    productsEmpty: "Der er ingen produkter lige nu.",
    productsFrom: "Fra ",
    productAddToCart: "Læg i kurv",
    productAdded: "Lagt i kurven",
    productSelectOptions: "Vælg variant",
    productOutOfStock: "Udsolgt",
    productInStock: "På lager",
    productOnlyLeft: (n: number) => `Kun ${n} tilbage!`,
    productOnlyLeftPrefix: "Kun ",
    productOnlyLeftSuffix: " tilbage!",
    productLoading: "Henter produkt…",
    productNotFound: "Produktet blev ikke fundet",
    productNotFoundBody: "Produktet, du leder efter, findes ikke længere.",
    productSale: "Tilbud",
    productRelatedTitle: "Du kunne også kunne lide",
    productRelatedSubtitle: "Se flere produkter fra vores sortiment",
    productSectionDetails: "Produktdetaljer",
    productSectionShipping: "Levering og retur",
    productSectionCare: "Vaskeanvisning",
    productSectionSize: "Størrelsesguide",
    productCloseViewer: "Luk billedvisning",
    productPreviousImage: "Forrige billede",
    productNextImage: "Næste billede",
    navToggleMenu: "Åbn eller luk menuen",
    comparisonFeature: "Funktion",
    productPaymentSuccess: "Betalingen gik igennem! Din ordre er registreret.",
    productBackHome: "Tilbage til forsiden",
    productBackToProducts: "Tilbage til produkter",
    productFreeShipping: "Fri fragt",
    productSecureCheckout: "Sikker betaling",
    productEasyReturns: "Nem returnering",
    productWhyTitle: "Derfor skal du vælge os",
    productWhySubtitle: "Vi gør alt for at give dig den bedste oplevelse",
    productWhyQuality: "Høj kvalitet",
    productWhyQualityBody: "Fremstillet af de bedste materialer",
    productWhyReturns: "Nem returnering",
    productWhyReturnsBody: "30 dages fri returret",
    productWhyDelivery: "Hurtig levering",
    productWhyDeliveryBody: "Levering på 2-5 hverdage",
    productWhySupport: "Support 24/7",
    productWhySupportBody: "Vi står altid klar til at hjælpe",

    checkoutTitle: "Kassen",
    checkoutLoading: "Henter…",
    checkoutYourDetails: "Dine oplysninger",
    checkoutFullName: "Fulde navn *",
    checkoutEmail: "E-mailadresse *",
    checkoutShippingAddress: "Leveringsadresse",
    checkoutAddress: "Adresse *",
    checkoutCity: "By *",
    checkoutPostalCode: "Postnummer *",
    checkoutNamePlaceholder: "Anne Jensen",
    checkoutEmailPlaceholder: "anne@eksempel.dk",
    checkoutAddressPlaceholder: "Vejnavn 123",
    checkoutCityPlaceholder: "København",
    checkoutPostalCodePlaceholder: "2100",
    checkoutSubmitting: "Behandler ordre…",
    checkoutSubmit: "Bekræft ordre",
    checkoutSummary: "Ordreoversigt",
    checkoutSubtotal: "Subtotal",
    checkoutShipping: "Fragt",
    checkoutShippingMethod: "Leveringsmetode",
    checkoutFree: "Gratis",
    checkoutTotal: "I alt",
    checkoutEmptyTitle: "Din kurv er tom",
    checkoutEmptyBody: "Læg varer i kurven for at gå til kassen.",
    checkoutConfirmedTitle: "Ordren er bekræftet!",
    checkoutConfirmedBody: "Tak for din ordre.",
    checkoutConfirmationEmail: "Vi sender en bekræftelse til",
    checkoutErrorRequired: "Udfyld venligst alle påkrævede felter",
    checkoutErrorProcess: "Ordren kunne ikke behandles. Prøv venligst igen.",
    checkoutErrorEmptyCart: "Din kurv er tom",
    checkoutErrorGeneric: "Der opstod en fejl",
    checkoutOutOfStock: "Udsolgt",
    checkoutOutOfStockDetail: ["Kun ", " på lager (du bad om ", ")"],
    checkoutOrderId: "Ordrenummer:",
    checkoutContinueShopping: "Fortsæt med at handle",
    checkoutBrowseProducts: "Se produkter",
    checkoutBackToShopping: "Tilbage til butikken",
    checkoutQty: "Antal:",
    checkoutLoadingShipping: "Henter leveringsmuligheder…",

    cookieText: "Vi bruger cookies til at forbedre din oplevelse og analysere trafikken på siden.",
    cookieAccept: "Accepter",
    cookieReject: "Afvis",
    cookiePrivacyPolicy: "Privatlivspolitik",

    newsletterButton: "Tilmeld",
    newsletterSuccess: "Tak for din tilmelding!",
    newsletterPlaceholder: "Indtast din e-mailadresse",
    formSubmit: "Send besked",
    formSuccessTitle: "Tak for din besked!",
    formSuccessBody: "Vi vender tilbage hurtigst muligt.",
    ssrProductsEmpty: "Der er ingen produkter lige nu.",

    legalTerms: "Handelsbetingelser",
    legalPrivacy: "Privatlivspolitik",
    legalHome: "Hjem",
    legalRightsReserved: "Alle rettigheder forbeholdes.",
    legalLastUpdated: "Senest opdateret",
  },
  en: {
    cartTitle: "Your cart",
    cartClose: "Close cart",
    cartEach: " each",
    cartEmpty: "Your cart is empty",
    cartEmptyHint: "Add some products to get started!",
    cartRemove: "Remove",
    cartTotal: "Total",
    cartCheckout: "Proceed to Checkout",

    contactTitle: "Contact Us",
    contactThanks: "Thank you! We'll get back to you soon.",
    contactName: "Your Name",
    contactEmail: "Your Email",
    contactMessage: "Your Message",
    contactSending: "Sending…",
    contactSend: "Send Message",
    contactError: "Something went wrong. Please try again.",

    bookingBadge: "Book Your Appointment",
    bookingTitle: "Schedule a Visit",
    bookingConfirmed: "Booking Confirmed!",
    bookingConfirmedBody: "We've sent a confirmation to your email.",
    bookingAnother: "Book Another Appointment",
    bookingNoServices: "No services available right now",
    bookingChooseService: "Choose a Service",
    bookingChoosePerson: "Choose a Person",
    bookingChooseDateTime: "Select Date & Time",
    bookingYourDetails: "Your Details",
    bookingLoadingAvailability: "Loading availability…",
    bookingUnavailable: "Unavailable",
    bookingAvailableTimesFor: "Available Times for",
    bookingNoTimes: "No times available on this day",
    bookingService: "Service:",
    bookingDateTime: "Date & Time:",
    bookingWith: "With:",
    bookingAt: "at",
    bookingFullName: "Full Name *",
    bookingEmail: "Email *",
    bookingPhone: "Phone (optional)",
    bookingNotes: "Notes (optional)",
    bookingNamePlaceholder: "John Smith",
    bookingEmailPlaceholder: "john@example.com",
    bookingPhonePlaceholder: "+1 (555) 123-4567",
    bookingNotesPlaceholder: "Any special requests…",
    bookingSubmitting: "Booking…",
    bookingSubmit: "Confirm Booking",
    bookingBack: "Back",
    bookingContinue: "Continue",
    bookingErrorRequired: "Please fill in all required fields and try again.",
    bookingErrorMemberConflict: "The selected person is not available at this time.",
    bookingErrorSlotTaken: "This time slot is no longer available. Please select a different time.",
    bookingErrorGeneric: "Something went wrong. Please try again.",
    bookingAnyone: "Anyone available",
    bookingLoadingTimes: "Loading times…",
    bookingOpenSlot: "Open slot",
    bookingLegendAvailable: "Available",
    bookingLegendBlocked: "Blocked",
    bookingDataNoticePre: "Your details are only used to process your booking — see our",

    productsTitle: "Products",
    productsLoading: "Loading products…",
    productsError: "Unable to load products. Please try again later.",
    productsEmpty: "No products available.",
    productsFrom: "From ",
    productAddToCart: "Add to Cart",
    productAdded: "Added to cart",
    productSelectOptions: "Select Options",
    productOutOfStock: "Out of Stock",
    productInStock: "In Stock",
    productOnlyLeft: (n: number) => `Only ${n} left!`,
    productOnlyLeftPrefix: "Only ",
    productOnlyLeftSuffix: " left!",
    productLoading: "Loading product…",
    productNotFound: "Product Not Found",
    productNotFoundBody: "The product you are looking for does not exist or is no longer available.",
    productSale: "Sale",
    productRelatedTitle: "You May Also Like",
    productRelatedSubtitle: "Explore more products from our collection",
    productSectionDetails: "Product Details",
    productSectionShipping: "Shipping & Returns",
    productSectionCare: "Care Instructions",
    productSectionSize: "Size Guide",
    productCloseViewer: "Close image viewer",
    productPreviousImage: "Previous image",
    productNextImage: "Next image",
    navToggleMenu: "Toggle menu",
    comparisonFeature: "Feature",
    productPaymentSuccess: "Payment successful! Your order has been placed.",
    productBackHome: "Back to Home",
    productBackToProducts: "Back to Products",
    productFreeShipping: "Free Shipping",
    productSecureCheckout: "Secure Checkout",
    productEasyReturns: "Easy Returns",
    productWhyTitle: "Why Choose Us",
    productWhySubtitle: "We're committed to providing you with the best shopping experience",
    productWhyQuality: "Premium Quality",
    productWhyQualityBody: "Crafted with the finest materials",
    productWhyReturns: "Easy Returns",
    productWhyReturnsBody: "30-day hassle-free returns",
    productWhyDelivery: "Fast Delivery",
    productWhyDeliveryBody: "2-5 business days shipping",
    productWhySupport: "24/7 Support",
    productWhySupportBody: "Always here to help you",

    checkoutTitle: "Checkout",
    checkoutLoading: "Loading…",
    checkoutYourDetails: "Your details",
    checkoutFullName: "Full name *",
    checkoutEmail: "Email address *",
    checkoutShippingAddress: "Shipping address",
    checkoutAddress: "Address *",
    checkoutCity: "City *",
    checkoutPostalCode: "Postal code *",
    checkoutNamePlaceholder: "John Doe",
    checkoutEmailPlaceholder: "john@example.com",
    checkoutAddressPlaceholder: "123 Main Street",
    checkoutCityPlaceholder: "London",
    checkoutPostalCodePlaceholder: "SW1A 1AA",
    checkoutSubmitting: "Processing order…",
    checkoutSubmit: "Confirm order",
    checkoutSummary: "Order summary",
    checkoutSubtotal: "Subtotal",
    checkoutShipping: "Shipping",
    checkoutShippingMethod: "Shipping Method",
    checkoutFree: "Free",
    checkoutTotal: "Total",
    checkoutEmptyTitle: "Your cart is empty",
    checkoutEmptyBody: "Add some items to your cart to checkout.",
    checkoutConfirmedTitle: "Order Confirmed!",
    checkoutConfirmedBody: "Thank you for your order.",
    checkoutConfirmationEmail: "We'll send a confirmation email to",
    checkoutErrorRequired: "Please fill in all required fields",
    checkoutErrorProcess: "Unable to process order. Please try again.",
    checkoutErrorEmptyCart: "Your cart is empty",
    checkoutErrorGeneric: "An error occurred",
    checkoutOutOfStock: "Out of stock",
    checkoutOutOfStockDetail: ["Only ", " available (requested ", ")"],
    checkoutOrderId: "Order ID:",
    checkoutContinueShopping: "Continue Shopping",
    checkoutBrowseProducts: "Browse Products",
    checkoutBackToShopping: "Back to shopping",
    checkoutQty: "Qty:",
    checkoutLoadingShipping: "Loading shipping options…",

    cookieText: "We use cookies to improve your experience and analyze site traffic.",
    cookieAccept: "Accept",
    cookieReject: "Reject",
    cookiePrivacyPolicy: "Privacy Policy",

    newsletterButton: "Subscribe",
    newsletterSuccess: "Thanks for subscribing!",
    newsletterPlaceholder: "Enter your email address",
    formSubmit: "Send message",
    formSuccessTitle: "Thanks for your message!",
    formSuccessBody: "We'll get back to you as soon as we can.",
    ssrProductsEmpty: "No products available.",

    legalTerms: "Terms of Service",
    legalPrivacy: "Privacy Policy",
    legalHome: "Home",
    legalRightsReserved: "All rights reserved.",
    legalLastUpdated: "Last updated",
  },
};

export function publishedSiteStrings(lang: SiteLanguage): PublishedSiteStrings {
  return PUBLISHED_SITE_STRINGS[lang] ?? PUBLISHED_SITE_STRINGS.da;
}

/**
 * Month and weekday names for the booking calendar. The generated site
 * renders the calendar grid itself, so it cannot lean on `Intl` for the
 * header row without shipping a formatter into every cell.
 */
export const CALENDAR_MONTHS: Record<SiteLanguage, string[]> = {
  da: [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

export const CALENDAR_WEEKDAYS: Record<SiteLanguage, string[]> = {
  da: ["søn", "man", "tir", "ons", "tor", "fre", "lør"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
