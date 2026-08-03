import { getUncachableResendClient } from '../replit_integrations/resendClient';
import { storage } from '../storage';
import { buildBookingIcs, type IcsMethod } from './ics';
import type { EmailSettings, EmailTemplate, Order, Booking } from '@shared/schema';
import {
  DEFAULT_SITE_LANGUAGE,
  SITE_LOCALE,
  normalizeSiteLanguage,
  type SiteLanguage,
} from '@shared/siteLanguage';
import { EMAIL_LABELS, defaultEmailTemplates } from './defaultTemplates';

const DEFAULT_BRANDING = {
  senderName: 'BirdFlow',
  senderEmail: 'info@bird-flow.com',
  logoUrl: '',
  primaryColor: '#6366f1',
  footerText: 'Sent via BirdFlow - Website Builder Platform',
};

interface EmailAttachment {
  filename: string;
  content: string; // base64
}

interface EmailData {
  to: string;
  websiteId: string;
  templateType: string;
  variables: Record<string, string>;
  buttonUrl?: string;
  attachments?: EmailAttachment[];
}

function generateEmailHtml(
  settings: EmailSettings | null | undefined,
  template: EmailTemplate | null | undefined,
  templateType: string,
  variables: Record<string, string>,
  buttonUrl: string | undefined,
  lang: SiteLanguage
): string {
  const defaults = defaultEmailTemplates(lang);
  const branding = {
    logoUrl: settings?.logoUrl || DEFAULT_BRANDING.logoUrl,
    primaryColor: settings?.primaryColor || DEFAULT_BRANDING.primaryColor,
    footerText: settings?.footerText || DEFAULT_BRANDING.footerText,
  };

  const defaultTemplate = defaults[templateType] || defaults.order_confirmation;
  const content = {
    heading: template?.heading || defaultTemplate.heading,
    bodyText: template?.bodyText || defaultTemplate.bodyText,
    buttonText: template?.buttonText || defaultTemplate.buttonText,
  };

  const replaceVariables = (text: string): string => {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const heading = replaceVariables(content.heading);
  const bodyText = replaceVariables(content.bodyText);
  const buttonTextFinal = content.buttonText ? replaceVariables(content.buttonText) : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${branding.logoUrl ? `
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <img src="${branding.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 200px;">
            </td>
          </tr>
          ` : ''}
          
          <tr>
            <td style="padding: ${branding.logoUrl ? '16px' : '32px'} 32px 8px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                ${heading}
              </h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 16px 32px 24px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                ${bodyText}
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 0 32px 24px;">
              <table role="presentation" style="width: 100%; background-color: #f4f4f5; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px;">
                    ${Object.entries(variables)
                      .filter(([key]) => !['orderId', 'serviceName', 'websiteName', 'websiteUrl'].includes(key))
                      .map(([key, value]) => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                          <span style="color: #71717a; font-size: 14px;">${formatLabel(key, lang)}:</span>
                          <span style="color: #18181b; font-size: 14px; font-weight: 500;">${value}</span>
                        </div>
                      `).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          ${buttonTextFinal && buttonUrl ? `
          <tr>
            <td style="padding: 0 32px 32px; text-align: center;">
              <a href="${buttonUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${branding.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                ${buttonTextFinal}
              </a>
            </td>
          </tr>
          ` : ''}
          
          <tr>
            <td style="padding: 24px 32px; background-color: #f4f4f5; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                ${branding.footerText}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function formatLabel(key: string, lang: SiteLanguage): string {
  const translated = EMAIL_LABELS[lang]?.[key];
  if (translated) return translated;
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export class EmailService {
  /**
   * The language the recipient website is written in. Every default template,
   * date and label follows it. Danish when the website is gone or unreadable -
   * the same experience customers had before language was a choice.
   */
  private async websiteLanguage(websiteId: string): Promise<SiteLanguage> {
    try {
      const website = await storage.getWebsite(websiteId);
      return normalizeSiteLanguage(website?.language);
    } catch (err) {
      console.error('[EmailService] Could not read website language, using Danish:', err);
      return DEFAULT_SITE_LANGUAGE;
    }
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    console.log(`[EmailService] Attempting to send ${data.templateType} email to ${data.to} for website ${data.websiteId}`);
    
    if (!data.websiteId) {
      console.error('[EmailService] FAILED: websiteId is missing - cannot send email without website context');
      return false;
    }
    
    try {
      // Defensive: ensure email templates exist before trying to send
      await storage.ensureEmailTemplatesConfigured(data.websiteId);
      
      const { client: resend, fromEmail } = await getUncachableResendClient();
      if (!resend) {
        console.error('[EmailService] FAILED: Could not get Resend client - email API unavailable');
        throw new Error('Email API client unavailable');
      }
      console.log(`[EmailService] Got Resend client, fromEmail: ${fromEmail}`);

      const settings = await storage.getEmailSettings(data.websiteId);
      console.log(`[EmailService] Email settings loaded:`, settings ? { 
        senderName: settings.senderName, 
        senderEmail: settings.senderEmail,
        orderConfirmationEnabled: settings.orderConfirmationEnabled,
        bookingConfirmationEnabled: settings.bookingConfirmationEnabled,
      } : 'null (using defaults)');
      
      // Try to get company name from legal settings if no sender name is set
      let companyName: string | null = null;
      if (!settings?.senderName) {
        const legalSettings = await storage.getLegalSettings(data.websiteId);
        if (legalSettings?.companyName) {
          companyName = legalSettings.companyName;
          console.log(`[EmailService] Using company name from legal settings: ${companyName}`);
        }
      }
      
      const isEnabled = this.isEmailTypeEnabled(settings, data.templateType);
      if (!isEnabled) {
        console.log(`[EmailService] Email type ${data.templateType} is DISABLED for website ${data.websiteId}`);
        return false;
      }
      console.log(`[EmailService] Email type ${data.templateType} is enabled`);

      const template = await storage.getEmailTemplate(data.websiteId, data.templateType);
      console.log(`[EmailService] Template lookup for ${data.templateType}:`, template ? { 
        id: template.id, 
        subject: template.subject,
        heading: template.heading?.substring(0, 50),
      } : 'null (using defaults)');
      
      const lang = await this.websiteLanguage(data.websiteId);
      const defaultTemplate = defaultEmailTemplates(lang)[data.templateType];
      let subject = template?.subject || defaultTemplate?.subject || 'Notification';
      
      Object.entries(data.variables).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      const html = generateEmailHtml(settings, template, data.templateType, data.variables, data.buttonUrl, lang);

      // Priority for sender name: email settings > legal settings company name > default
      const fromName = settings?.senderName || companyName || DEFAULT_BRANDING.senderName;
      const senderEmail = settings?.senderEmail || fromEmail || DEFAULT_BRANDING.senderEmail;

      console.log(`[EmailService] Sending via Resend: to=${data.to}, from=${fromName} <${senderEmail}>, subject="${subject}"`);
      
      const result = await resend.emails.send({
        to: data.to,
        from: `${fromName} <${senderEmail}>`,
        subject,
        html,
        ...(data.attachments && data.attachments.length > 0
          ? { attachments: data.attachments }
          : {}),
      });

      console.log(`[EmailService] Resend API response:`, result);
      console.log(`[EmailService] SUCCESS: ${data.templateType} email sent to ${data.to}`);
      return true;
    } catch (error: any) {
      console.error(`[EmailService] FAILED to send ${data.templateType} email to ${data.to}:`, error?.message || error);
      if (error?.response) {
        console.error(`[EmailService] Resend error response:`, error.response);
      }
      return false;
    }
  }

  private isEmailTypeEnabled(settings: EmailSettings | undefined, templateType: string): boolean {
    if (!settings) return true;

    switch (templateType) {
      case 'order_confirmation':
        return settings.orderConfirmationEnabled;
      case 'order_shipped':
        return settings.shippingConfirmationEnabled;
      case 'booking_confirmation':
        return settings.bookingConfirmationEnabled;
      case 'booking_updated':
        return settings.bookingUpdatedEnabled;
      case 'booking_cancelled':
        return settings.bookingCancelledEnabled;
      case 'booking_reminder':
        return settings.bookingReminderEnabled;
      case 'booking_followup':
        return settings.bookingFollowupEnabled;
      default:
        return true;
    }
  }

  // Builds a calendar invite (.ics) attachment for a booking. Returns
  // undefined when the booking has no usable date/time.
  private async buildBookingIcsAttachment(
    booking: Booking,
    serviceName: string,
    method: IcsMethod
  ): Promise<EmailAttachment[] | undefined> {
    try {
      if (!booking?.date || !booking?.time) return undefined;
      const rawTime = String(booking.time);
      if (!/^\d{1,2}:\d{2}/.test(rawTime)) return undefined;
      const timeStr = (rawTime.length > 5 ? rawTime.slice(0, 5) : rawTime).padStart(5, '0');
      const parsedDate = new Date(booking.date);
      if (isNaN(parsedDate.getTime())) return undefined;
      const dateStr = parsedDate.toISOString().slice(0, 10);

      const settings = await storage.getEmailSettings(booking.websiteId);
      let organizerName = settings?.senderName || '';
      if (!organizerName) {
        const legal = await storage.getLegalSettings(booking.websiteId);
        organizerName = legal?.companyName || DEFAULT_BRANDING.senderName;
      }
      const organizerEmail = settings?.senderEmail || DEFAULT_BRANDING.senderEmail;

      // SEQUENCE must increase across updates of the same UID
      const baseMs = booking.createdAt
        ? new Date(booking.createdAt).getTime()
        : Date.now();
      let sequence = Math.max(0, Math.floor((Date.now() - baseMs) / 60000));
      if (method === 'CANCEL') sequence += 1;

      const ics = buildBookingIcs({
        uid: `booking-${booking.id}@birdflow`,
        method,
        sequence,
        dateStr,
        timeStr,
        durationMinutes: booking.durationMinutes || 60,
        summary: serviceName,
        description: booking.notes || undefined,
        location: booking.place || undefined,
        organizerName,
        organizerEmail,
        attendeeName: booking.customerName || undefined,
        attendeeEmail: booking.customerEmail || undefined,
      });

      return [
        {
          filename: method === 'CANCEL' ? 'cancellation.ics' : 'booking.ics',
          content: Buffer.from(ics, 'utf8').toString('base64'),
        },
      ];
    } catch (err) {
      console.error('[EmailService] Failed to build ICS attachment:', err);
      return undefined;
    }
  }

  async sendOrderConfirmation(order: Order, customerEmail: string, websiteUrl?: string): Promise<boolean> {
    const totalCents = typeof order.total === 'number' ? order.total : parseInt(String(order.total)) || 0;
    const lang = await this.websiteLanguage(order.websiteId);
    return this.sendEmail({
      to: customerEmail,
      websiteId: order.websiteId,
      templateType: 'order_confirmation',
      variables: {
        orderId: order.id,
        // The customer's own currency, formatted for their language.
        total: new Intl.NumberFormat(SITE_LOCALE[lang], {
          style: 'currency',
          currency: (order.currency || 'DKK').toUpperCase(),
        }).format(totalCents / 100),
        status: order.status,
        customerName: order.customerName || (lang === 'da' ? 'Kunde' : 'Customer'),
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/orders/${order.id}` : undefined,
    });
  }

  /**
   * Shipping confirmation with promised delivery date and optional tracking.
   * Gated by emailSettings.shippingConfirmationEnabled.
   */
  async sendOrderShipped(order: Order, customerEmail: string, websiteUrl?: string): Promise<boolean> {
    const lang = await this.websiteLanguage(order.websiteId);
    const deliveryDate = order.deliveryDate
      ? new Date(order.deliveryDate).toLocaleDateString(SITE_LOCALE[lang], {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : lang === 'da'
        ? 'snarest muligt'
        : 'as soon as possible';
    const trackingLine = order.trackingNumber
      ? `Track & trace${order.trackingCarrier ? ` (${order.trackingCarrier})` : ''}: ${order.trackingNumber}.`
      : '';
    return this.sendEmail({
      to: customerEmail,
      websiteId: order.websiteId,
      templateType: 'order_shipped',
      variables: {
        orderId: order.id,
        customerName: order.customerName || (lang === 'da' ? 'Kunde' : 'Customer'),
        deliveryDate,
        trackingLine,
        trackingNumber: order.trackingNumber || '',
        carrier: order.trackingCarrier || '',
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/orders/${order.id}` : undefined,
    });
  }

  private async bookingVariables(booking: Booking, serviceName: string): Promise<Record<string, string>> {
    const lang = await this.websiteLanguage(booking.websiteId);
    const variables: Record<string, string> = {
      serviceName,
      date: new Date(booking.date).toLocaleDateString(SITE_LOCALE[lang], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      time: booking.time || '',
      customerName: booking.customerName || (lang === 'da' ? 'Kunde' : 'Customer'),
    };
    if (booking.place) variables.place = booking.place;
    return variables;
  }

  async sendBookingConfirmation(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_confirmation',
      variables: await this.bookingVariables(booking, serviceName),
      buttonUrl: websiteUrl ? `${websiteUrl}/bookings/${booking.id}` : undefined,
      attachments: await this.buildBookingIcsAttachment(booking, serviceName, 'REQUEST'),
    });
  }

  async sendBookingUpdated(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_updated',
      variables: {
        ...(await this.bookingVariables(booking, serviceName)),
        status: booking.status,
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/bookings/${booking.id}` : undefined,
      attachments: await this.buildBookingIcsAttachment(booking, serviceName, 'REQUEST'),
    });
  }

  async sendBookingCancelled(booking: Booking, customerEmail: string, serviceName: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_cancelled',
      variables: await this.bookingVariables(booking, serviceName),
      attachments: await this.buildBookingIcsAttachment(booking, serviceName, 'CANCEL'),
    });
  }

  async sendBookingReminder(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_reminder',
      variables: await this.bookingVariables(booking, serviceName),
      buttonUrl: websiteUrl ? `${websiteUrl}/bookings/${booking.id}` : undefined,
    });
  }

  async sendBookingFollowup(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_followup',
      variables: await this.bookingVariables(booking, serviceName),
      buttonUrl: websiteUrl,
    });
  }

  /**
   * Tell BirdFlow that a customer just claimed one of its own onboarding
   * meetings. Goes to the platform calendar's own templates, so it never
   * reaches a customer and never touches a customer site's email settings.
   */
  async sendPlatformMeetingNotification(
    booking: Booking,
    adminEmail: string,
    serviceName: string,
    details: { customerWebsiteName?: string | null; adminUrl?: string }
  ): Promise<boolean> {
    return this.sendEmail({
      to: adminEmail,
      websiteId: booking.websiteId,
      templateType: 'platform_meeting_notification',
      variables: {
        ...(await this.bookingVariables(booking, serviceName)),
        customerEmail: booking.customerEmail || '',
        customerPhone: booking.customerPhone || '',
        website: details.customerWebsiteName || 'Ingen hjemmeside endnu',
        notes: booking.notes || '',
      },
      buttonUrl: details.adminUrl,
    });
  }

  /**
   * "Din opdaterede hjemmeside er klar" - sent when an admin hands an improved
   * site back to the customer. Links to the authenticated onboarding page.
   */
  async sendOnboardingReadyForReview(
    customerEmail: string,
    websiteId: string,
    details: { customerName: string; websiteName: string; onboardingUrl: string }
  ): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId,
      templateType: 'onboarding_ready_for_review',
      variables: {
        customerName: details.customerName,
        websiteName: details.websiteName,
      },
      buttonUrl: details.onboardingUrl,
    });
  }

  async sendWebsitePublished(ownerEmail: string, websiteId: string, websiteName: string, websiteUrl: string): Promise<boolean> {
    return this.sendEmail({
      to: ownerEmail,
      websiteId,
      templateType: 'website_published',
      variables: {
        websiteName,
        websiteUrl,
      },
      buttonUrl: websiteUrl,
    });
  }
}

export const emailService = new EmailService();
