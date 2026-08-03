/**
 * Ready-made Terms and Privacy pages for a customer's website, in the
 * customer's own language.
 *
 * Nothing in the product calls this yet - generated and template sites link to
 * legal text they do not create here. It is localized anyway so that whoever
 * wires it up passes the website's language (`normalizeSiteLanguage(website.language)`)
 * rather than shipping a Danish privacy policy onto an English site. Both
 * entry points default to Danish, which is what the module produced before
 * the language choice existed.
 */
import type { BuilderComponentData } from './componentRegistry';
import type { BuilderPage } from './schema';
import {
  DEFAULT_SITE_LANGUAGE,
  PUBLISHED_SITE_STRINGS,
  SITE_LOCALE,
  type SiteLanguage,
} from './siteLanguage';

export type LegalPlaceholders = {
  websiteName: string;
  companyName: string;
  contactEmail: string;
  businessAddress: string;
};

const defaultPlaceholders: LegalPlaceholders = {
  websiteName: '[Website Name]',
  companyName: '[Company Name]',
  contactEmail: '[contact@example.com]',
  businessAddress: '[Your Business Address]',
};

export function replacePlaceholders(text: string, placeholders: Partial<LegalPlaceholders>): string {
  const merged = { ...defaultPlaceholders, ...placeholders };
  return text
    .replace(/\{\{website_name\}\}/g, merged.websiteName)
    .replace(/\{\{company_name\}\}/g, merged.companyName)
    .replace(/\{\{email\}\}/g, merged.contactEmail)
    .replace(/\{\{address\}\}/g, merged.businessAddress);
}

function lastUpdated(lang: SiteLanguage): string {
  return new Date().toLocaleDateString(SITE_LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const englishTerms = `
Terms of Service

Last updated: {{last_updated}}

1. Agreement to Terms
By accessing or using {{website_name}}, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access our service.

2. Use of Service
{{company_name}} grants you a limited, non-exclusive, non-transferable license to use our services for personal or business purposes in accordance with these Terms.

3. User Accounts
When you create an account, you must provide accurate and complete information. You are responsible for maintaining the security of your account and password.

4. Purchases and Payments
All purchases made through {{website_name}} are subject to our payment terms. Prices are subject to change without notice. We reserve the right to refuse or cancel orders.

5. Intellectual Property
The content, features, and functionality of {{website_name}} are owned by {{company_name}} and are protected by international copyright, trademark, and other intellectual property laws.

6. Limitation of Liability
{{company_name}} shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.

7. Changes to Terms
We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Service on this page.

8. Contact Information
If you have questions about these Terms, please contact us:
Email: {{email}}
Address: {{address}}
`.trim();

const englishPrivacy = `
Privacy Policy

Last updated: {{last_updated}}

1. Introduction
{{company_name}} ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use {{website_name}}.

2. Information We Collect
We may collect information you provide directly, such as:
- Name and contact information
- Payment and billing information
- Account credentials
- Communications you send to us

3. How We Use Your Information
We use your information to:
- Process transactions and send related information
- Send you technical notices and support messages
- Respond to your comments and questions
- Provide and improve our services

4. Information Sharing
We do not sell your personal information. We may share your information with:
- Service providers who assist in our operations
- Professional advisors
- Law enforcement when required by law

5. Data Security
We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.

6. Your Rights
Depending on your location, you may have rights to:
- Access your personal information
- Correct inaccurate information
- Delete your information
- Object to processing

7. Cookies
We use cookies to improve your experience. You can control cookies through your browser settings.

8. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.

9. Contact Us
If you have questions about this Privacy Policy, please contact us:
Email: {{email}}
Address: {{address}}
`.trim();

const danishTerms = `
Handelsbetingelser

Senest opdateret: {{last_updated}}

1. Accept af betingelserne
Ved at bruge {{website_name}} accepterer du disse handelsbetingelser. Er du ikke enig i en del af betingelserne, kan du ikke bruge tjenesten.

2. Brug af tjenesten
{{company_name}} giver dig en begrænset, ikke-eksklusiv og ikke-overdragelig ret til at bruge vores tjenester til privat eller erhvervsmæssig brug i overensstemmelse med disse betingelser.

3. Brugerkonti
Når du opretter en konto, skal du give korrekte og fuldstændige oplysninger. Du er selv ansvarlig for at holde din konto og adgangskode sikker.

4. Køb og betaling
Alle køb på {{website_name}} er omfattet af vores betalingsbetingelser. Priser kan ændres uden varsel. Vi forbeholder os retten til at afvise eller annullere ordrer.

5. Immaterielle rettigheder
Indhold, funktioner og design på {{website_name}} tilhører {{company_name}} og er beskyttet af ophavsret, varemærkeret og anden lovgivning om immaterielle rettigheder.

6. Ansvarsbegrænsning
{{company_name}} er ikke ansvarlig for indirekte tab, følgeskader eller andre indirekte omkostninger, der opstår som følge af din brug af eller manglende adgang til tjenesten.

7. Ændringer af betingelserne
Vi kan til enhver tid ændre disse betingelser. Væsentlige ændringer offentliggøres på denne side.

8. Kontakt
Har du spørgsmål til betingelserne, er du velkommen til at kontakte os:
E-mail: {{email}}
Adresse: {{address}}
`.trim();

const danishPrivacy = `
Privatlivspolitik

Senest opdateret: {{last_updated}}

1. Indledning
{{company_name}} ("vi", "vores" eller "os") respekterer dit privatliv. Denne privatlivspolitik beskriver, hvordan vi indsamler, bruger og beskytter dine personoplysninger, når du bruger {{website_name}}.

2. Oplysninger vi indsamler
Vi kan indsamle oplysninger, du selv giver os, for eksempel:
- Navn og kontaktoplysninger
- Betalings- og faktureringsoplysninger
- Loginoplysninger
- Beskeder, du sender til os

3. Sådan bruger vi dine oplysninger
Vi bruger dine oplysninger til at:
- Behandle bestillinger og sende relevante beskeder
- Sende dig tekniske beskeder og support
- Besvare dine spørgsmål og henvendelser
- Levere og forbedre vores tjenester

4. Videregivelse af oplysninger
Vi sælger ikke dine personoplysninger. Vi kan dele dem med:
- Leverandører, der hjælper med driften
- Professionelle rådgivere
- Myndigheder, når loven kræver det

5. Datasikkerhed
Vi bruger passende sikkerhedsforanstaltninger til at beskytte dine personoplysninger. Ingen overførsel via internettet er dog 100 % sikker.

6. Dine rettigheder
Efter databeskyttelsesforordningen (GDPR) har du blandt andet ret til at:
- Få indsigt i dine personoplysninger
- Få rettet forkerte oplysninger
- Få slettet dine oplysninger
- Gøre indsigelse mod behandlingen

7. Cookies
Vi bruger cookies for at forbedre din oplevelse. Du kan styre cookies i din browsers indstillinger.

8. Ændringer af politikken
Vi kan opdatere denne privatlivspolitik. Ændringer offentliggøres på denne side.

9. Kontakt os
Har du spørgsmål til privatlivspolitikken, er du velkommen til at kontakte os:
E-mail: {{email}}
Adresse: {{address}}
`.trim();

const TERMS_BY_LANGUAGE: Record<SiteLanguage, string> = {
  da: danishTerms,
  en: englishTerms,
};

const PRIVACY_BY_LANGUAGE: Record<SiteLanguage, string> = {
  da: danishPrivacy,
  en: englishPrivacy,
};

/** Kept for callers that only ever wanted the English wording. */
export const defaultTermsContent = englishTerms;
export const defaultPrivacyContent = englishPrivacy;

const generateId = () => Math.random().toString(36).substring(2, 9);

export function createLegalPages(
  placeholders?: Partial<LegalPlaceholders>,
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE
): BuilderPage[] {
  const t = PUBLISHED_SITE_STRINGS[lang];
  const stamp = lastUpdated(lang);
  const termsContent = replacePlaceholders(TERMS_BY_LANGUAGE[lang], placeholders || {}).replace(
    /\{\{last_updated\}\}/g,
    stamp
  );
  const privacyContent = replacePlaceholders(PRIVACY_BY_LANGUAGE[lang], placeholders || {}).replace(
    /\{\{last_updated\}\}/g,
    stamp
  );
  
  const headerStyles = {
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    padding: '16px 24px',
  };
  
  const footerStyles = {
    backgroundColor: '#1e293b',
    textColor: '#94a3b8',
    padding: '32px 24px',
  };
  
  const contentStyles = {
    backgroundColor: '#ffffff',
    textColor: '#374151',
    padding: '80px 24px',
  };
  
  const websiteName = placeholders?.websiteName || defaultPlaceholders.websiteName;
  
  // Legal pages use header with only Home link (no Terms/Privacy in nav)
  // Footer includes links to Terms and Privacy pages
  const termsPage: BuilderPage = {
    id: 'terms',
    name: t.legalTerms,
    path: '/terms',
    hidden: true, // Hidden from main navigation, only in footer
    components: [
      {
        id: generateId(),
        type: 'header',
        props: {
          title: websiteName,
          items: [
            { id: '1', title: t.legalHome, description: '/' },
          ],
        },
        styles: headerStyles,
      },
      {
        id: generateId(),
        type: 'text-image',
        props: {
          title: t.legalTerms,
          description: termsContent,
          imageSide: 'right',
        },
        styles: contentStyles,
      },
      {
        id: generateId(),
        type: 'footer',
        props: {
          title: `© ${new Date().getFullYear()} ${websiteName}. ${t.legalRightsReserved}`,
          description: placeholders?.contactEmail || defaultPlaceholders.contactEmail,
          items: [
            { id: '1', title: t.legalTerms, description: '/terms' },
            { id: '2', title: t.legalPrivacy, description: '/privacy' },
          ],
        },
        styles: footerStyles,
      },
    ],
  };
  
  const privacyPage: BuilderPage = {
    id: 'privacy',
    name: t.legalPrivacy,
    path: '/privacy',
    hidden: true, // Hidden from main navigation, only in footer
    components: [
      {
        id: generateId(),
        type: 'header',
        props: {
          title: websiteName,
          items: [
            { id: '1', title: t.legalHome, description: '/' },
          ],
        },
        styles: headerStyles,
      },
      {
        id: generateId(),
        type: 'text-image',
        props: {
          title: t.legalPrivacy,
          description: privacyContent,
          imageSide: 'right',
        },
        styles: contentStyles,
      },
      {
        id: generateId(),
        type: 'footer',
        props: {
          title: `© ${new Date().getFullYear()} ${websiteName}. ${t.legalRightsReserved}`,
          description: placeholders?.contactEmail || defaultPlaceholders.contactEmail,
          items: [
            { id: '1', title: t.legalTerms, description: '/terms' },
            { id: '2', title: t.legalPrivacy, description: '/privacy' },
          ],
        },
        styles: footerStyles,
      },
    ],
  };
  
  return [termsPage, privacyPage];
}

export function addLegalPagesToBuilderState<T extends { pages: BuilderPage[] }>(
  state: T,
  placeholders?: Partial<LegalPlaceholders>,
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE
): T {
  const legalPages = createLegalPages(placeholders, lang);
  const existingPageIds = state.pages.map(p => p.id);
  
  const pagesToAdd = legalPages.filter(lp => !existingPageIds.includes(lp.id));
  
  return {
    ...state,
    pages: [...state.pages, ...pagesToAdd],
  };
}
