import sgMail from '@sendgrid/mail';
import { storage } from '../storage';
import type { EmailSettings, EmailTemplate, Order, Booking } from '@shared/schema';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not set - email sending will fail');
}

// Default platform branding
const DEFAULT_BRANDING = {
  senderName: 'BirdFlow',
  senderEmail: 'noreply@birdflow.io',
  logoUrl: '',
  primaryColor: '#6366f1',
  footerText: 'Sent via BirdFlow - Website Builder Platform',
};

// Default templates per email type
const DEFAULT_TEMPLATES: Record<string, { subject: string; heading: string; bodyText: string; buttonText?: string }> = {
  order_confirmation: {
    subject: 'Order Confirmation - #{{orderId}}',
    heading: 'Thank you for your order!',
    bodyText: 'We have received your order and are processing it. You will receive another email when your order ships.',
    buttonText: 'View Order',
  },
  booking_confirmation: {
    subject: 'Booking Confirmation - {{serviceName}}',
    heading: 'Your booking is confirmed!',
    bodyText: 'We look forward to seeing you at your scheduled appointment.',
    buttonText: 'View Booking',
  },
  booking_updated: {
    subject: 'Booking Updated - {{serviceName}}',
    heading: 'Your booking has been updated',
    bodyText: 'The details of your booking have been modified. Please review the updated information below.',
    buttonText: 'View Booking',
  },
  booking_cancelled: {
    subject: 'Booking Cancelled - {{serviceName}}',
    heading: 'Your booking has been cancelled',
    bodyText: 'Your booking has been cancelled as requested. If you have any questions, please contact us.',
  },
  website_published: {
    subject: 'Your website is now live!',
    heading: 'Congratulations! Your website is published',
    bodyText: 'Your website is now live and accessible to the world. Click below to visit your site.',
    buttonText: 'Visit Website',
  },
};

interface EmailData {
  to: string;
  websiteId: string;
  templateType: string;
  variables: Record<string, string>;
  buttonUrl?: string;
}

// Generate HTML email with branding
function generateEmailHtml(
  settings: EmailSettings | null | undefined,
  template: EmailTemplate | null | undefined,
  templateType: string,
  variables: Record<string, string>,
  buttonUrl?: string
): string {
  const branding = {
    logoUrl: settings?.logoUrl || DEFAULT_BRANDING.logoUrl,
    primaryColor: settings?.primaryColor || DEFAULT_BRANDING.primaryColor,
    footerText: settings?.footerText || DEFAULT_BRANDING.footerText,
  };

  const defaultTemplate = DEFAULT_TEMPLATES[templateType] || DEFAULT_TEMPLATES.order_confirmation;
  const content = {
    heading: template?.heading || defaultTemplate.heading,
    bodyText: template?.bodyText || defaultTemplate.bodyText,
    buttonText: template?.buttonText || defaultTemplate.buttonText,
  };

  // Replace variables in content
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
          <!-- Logo -->
          ${branding.logoUrl ? `
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <img src="${branding.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 200px;">
            </td>
          </tr>
          ` : ''}
          
          <!-- Heading -->
          <tr>
            <td style="padding: ${branding.logoUrl ? '16px' : '32px'} 32px 8px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                ${heading}
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 16px 32px 24px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                ${bodyText}
              </p>
            </td>
          </tr>
          
          <!-- Variables/Details section -->
          <tr>
            <td style="padding: 0 32px 24px;">
              <table role="presentation" style="width: 100%; background-color: #f4f4f5; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px;">
                    ${Object.entries(variables)
                      .filter(([key]) => !['orderId', 'serviceName', 'websiteName', 'websiteUrl'].includes(key))
                      .map(([key, value]) => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                          <span style="color: #71717a; font-size: 14px;">${formatLabel(key)}:</span>
                          <span style="color: #18181b; font-size: 14px; font-weight: 500;">${value}</span>
                        </div>
                      `).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Button -->
          ${buttonTextFinal && buttonUrl ? `
          <tr>
            <td style="padding: 0 32px 32px; text-align: center;">
              <a href="${buttonUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${branding.primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                ${buttonTextFinal}
              </a>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
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

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export class EmailService {
  async sendEmail(data: EmailData): Promise<boolean> {
    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return false;
    }

    try {
      // Get website email settings
      const settings = await storage.getEmailSettings(data.websiteId);
      
      // Check if this email type is enabled
      const isEnabled = this.isEmailTypeEnabled(settings, data.templateType);
      if (!isEnabled) {
        console.log(`Email type ${data.templateType} is disabled for website ${data.websiteId}`);
        return false;
      }

      // Get custom template if exists
      const template = await storage.getEmailTemplate(data.websiteId, data.templateType);
      
      // Get default template for subject
      const defaultTemplate = DEFAULT_TEMPLATES[data.templateType];
      let subject = template?.subject || defaultTemplate?.subject || 'Notification';
      
      // Replace variables in subject
      Object.entries(data.variables).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });

      // Generate HTML
      const html = generateEmailHtml(settings, template, data.templateType, data.variables, data.buttonUrl);

      // Determine sender
      const fromName = settings?.senderName || DEFAULT_BRANDING.senderName;
      const fromEmail = settings?.senderEmail || DEFAULT_BRANDING.senderEmail;

      // Send email
      await sgMail.send({
        to: data.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject,
        html,
      });

      console.log(`Email sent: ${data.templateType} to ${data.to}`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  private isEmailTypeEnabled(settings: EmailSettings | undefined, templateType: string): boolean {
    if (!settings) return true; // Default to enabled if no settings

    switch (templateType) {
      case 'order_confirmation':
        return settings.orderConfirmationEnabled;
      case 'booking_confirmation':
        return settings.bookingConfirmationEnabled;
      case 'booking_updated':
        return settings.bookingUpdatedEnabled;
      case 'booking_cancelled':
        return settings.bookingCancelledEnabled;
      default:
        return true; // Enable by default for other types
    }
  }

  // Convenience methods for specific email types
  async sendOrderConfirmation(order: Order, customerEmail: string, websiteUrl?: string): Promise<boolean> {
    const totalCents = typeof order.total === 'number' ? order.total : parseInt(String(order.total)) || 0;
    return this.sendEmail({
      to: customerEmail,
      websiteId: order.websiteId,
      templateType: 'order_confirmation',
      variables: {
        orderId: order.id,
        total: `$${(totalCents / 100).toFixed(2)}`,
        status: order.status,
        customerName: order.customerName || 'Customer',
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/orders/${order.id}` : undefined,
    });
  }

  async sendBookingConfirmation(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_confirmation',
      variables: {
        serviceName,
        date: new Date(booking.date).toLocaleDateString(),
        time: booking.time || '',
        customerName: booking.customerName || 'Customer',
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/bookings/${booking.id}` : undefined,
    });
  }

  async sendBookingUpdated(booking: Booking, customerEmail: string, serviceName: string, websiteUrl?: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_updated',
      variables: {
        serviceName,
        date: new Date(booking.date).toLocaleDateString(),
        time: booking.time || '',
        customerName: booking.customerName || 'Customer',
        status: booking.status,
      },
      buttonUrl: websiteUrl ? `${websiteUrl}/bookings/${booking.id}` : undefined,
    });
  }

  async sendBookingCancelled(booking: Booking, customerEmail: string, serviceName: string): Promise<boolean> {
    return this.sendEmail({
      to: customerEmail,
      websiteId: booking.websiteId,
      templateType: 'booking_cancelled',
      variables: {
        serviceName,
        date: new Date(booking.date).toLocaleDateString(),
        time: booking.time || '',
        customerName: booking.customerName || 'Customer',
      },
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
