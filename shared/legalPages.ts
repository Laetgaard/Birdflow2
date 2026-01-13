import type { BuilderComponentData } from './componentRegistry';
import type { BuilderPage } from './schema';

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

export const defaultTermsContent = `
Terms of Service

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

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

export const defaultPrivacyContent = `
Privacy Policy

Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

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

const generateId = () => Math.random().toString(36).substring(2, 9);

export function createLegalPages(placeholders?: Partial<LegalPlaceholders>): BuilderPage[] {
  const termsContent = replacePlaceholders(defaultTermsContent, placeholders || {});
  const privacyContent = replacePlaceholders(defaultPrivacyContent, placeholders || {});
  
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
  
  const termsPage: BuilderPage = {
    id: 'terms',
    name: 'Terms of Service',
    path: '/terms',
    components: [
      {
        id: generateId(),
        type: 'header',
        props: {
          title: websiteName,
          items: [
            { id: '1', title: 'Home', description: '/' },
            { id: '2', title: 'Terms', description: '/terms' },
            { id: '3', title: 'Privacy', description: '/privacy' },
          ],
        },
        styles: headerStyles,
      },
      {
        id: generateId(),
        type: 'text-image',
        props: {
          title: 'Terms of Service',
          description: termsContent,
          imageSide: 'right',
        },
        styles: contentStyles,
      },
      {
        id: generateId(),
        type: 'footer',
        props: {
          title: `© ${new Date().getFullYear()} ${websiteName}. All rights reserved.`,
          description: placeholders?.contactEmail || defaultPlaceholders.contactEmail,
        },
        styles: footerStyles,
      },
    ],
  };
  
  const privacyPage: BuilderPage = {
    id: 'privacy',
    name: 'Privacy Policy',
    path: '/privacy',
    components: [
      {
        id: generateId(),
        type: 'header',
        props: {
          title: websiteName,
          items: [
            { id: '1', title: 'Home', description: '/' },
            { id: '2', title: 'Terms', description: '/terms' },
            { id: '3', title: 'Privacy', description: '/privacy' },
          ],
        },
        styles: headerStyles,
      },
      {
        id: generateId(),
        type: 'text-image',
        props: {
          title: 'Privacy Policy',
          description: privacyContent,
          imageSide: 'right',
        },
        styles: contentStyles,
      },
      {
        id: generateId(),
        type: 'footer',
        props: {
          title: `© ${new Date().getFullYear()} ${websiteName}. All rights reserved.`,
          description: placeholders?.contactEmail || defaultPlaceholders.contactEmail,
        },
        styles: footerStyles,
      },
    ],
  };
  
  return [termsPage, privacyPage];
}

export function addLegalPagesToBuilderState<T extends { pages: BuilderPage[] }>(
  state: T,
  placeholders?: Partial<LegalPlaceholders>
): T {
  const legalPages = createLegalPages(placeholders);
  const existingPageIds = state.pages.map(p => p.id);
  
  const pagesToAdd = legalPages.filter(lp => !existingPageIds.includes(lp.id));
  
  return {
    ...state,
    pages: [...state.pages, ...pagesToAdd],
  };
}
