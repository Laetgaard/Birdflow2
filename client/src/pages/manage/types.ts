// Shared types for the manage dashboard sections.
// Moved out of the old monolithic manage.tsx so every section module can
// import them without circular dependencies.

export type ManageWebsite = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
  /** 3-letter ISO trading currency, e.g. "DKK". */
  currency: string;
  // Present only when an administrator manages someone else's website
  // (set server-side on GET /api/websites/:id). UI state only.
  adminContext?: {
    ownerId: string;
    ownerDisplayName: string;
  };
};

/** Props every manage section receives from the shell. */
export type SectionProps = {
  websiteId: string;
  accessToken: string;
  website: ManageWebsite;
  /** Navigate to another manage section, e.g. onNavigate?.("orders") */
  onNavigate?: (section: string) => void;
};

export type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'confirmed';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded';
  total: number;
  currency?: string;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
  shippingAddress?: { street: string; city: string; state: string; zip: string; country: string } | null;
  shippingName?: string | null;
  // Fulfilment (set from the order detail dialog)
  deliveryDate?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  shippedEmailSentAt?: string | null;
  createdAt: string;
};

export type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  service: string;
  serviceId?: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  teamMemberId?: string | null;
  place?: string | null;
  sendReminder?: boolean;
  price?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: string;
};

export type TeamMemberAvailabilityWindow = {
  dayOfWeek: number; // 0 = søndag ... 6 = lørdag
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
};

export type TeamMember = {
  id: string;
  websiteId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  color: string;
  serviceIds: string[]; // tom = alle ydelser
  availability: TeamMemberAvailabilityWindow[]; // tom = altid tilgængelig
  active: boolean;
  sortOrder: number;
};

export type OpenSlot = {
  id: string;
  websiteId: string;
  serviceId?: string | null;
  teamMemberId?: string | null;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  durationMinutes: number;
  status: 'open' | 'booked';
  bookingId?: string | null;
  notes?: string | null;
};

export type FormSubmission = {
  id: string;
  formName: string;
  data: Record<string, any>;
  createdAt: string;
  read: boolean;
};

// Mirrors CustomerWithStats in shared/schema.ts: identity row plus
// aggregates the server computes from orders/bookings at read time.
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  /** Paid orders only. */
  ordersCount: number;
  /** Lifetime paid-order revenue, minor units. */
  totalSpentCents: number;
  bookingsCount: number;
  lastActivityAt: string | null;
};

export type ProductVariantOption = {
  id: string;
  name: string;
  priceAdjustment: number;
  stockQuantity?: number;
  sku?: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  options: ProductVariantOption[];
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  productDetails?: string;
  careInstructions?: string;
  sizeGuide?: string;
  shippingInfo?: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  imageUrl?: string;
  images?: string[];
  status: 'active' | 'draft' | 'archived';
  inventory?: string;
  category?: string;
  trackInventory?: boolean;
  stockQuantity?: number;
  variants?: ProductVariant[];
};

export type ProductReview = {
  id: string;
  productId: string;
  websiteId: string;
  name: string;
  rating: number;
  text?: string | null;
  verified: boolean;
  createdAt: string;
};

export type BookingService = {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: string;
  currency: string;
  isActive: boolean;
};

export type ServiceAvailability = {
  id: string;
  serviceId: string;
  websiteId: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number | null;
  isActive: boolean;
};

export type ServiceBlockedDate = {
  id: string;
  serviceId: string;
  websiteId: string;
  blockedDate: string;
  reason: string | null;
  isRecurringYearly: boolean;
  createdAt: string;
};

export type ServiceDateRange = {
  id: string;
  serviceId: string;
  websiteId: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export type ShippingMethod = {
  id: string;
  websiteId: string;
  name: string;
  description?: string;
  priceAmount: number;
  currency: string;
  deliveryTime?: string;
  isActive: boolean;
  sortOrder: number;
};

export type ShippingConfig = {
  id?: string;
  websiteId: string;
  mode: 'manual' | 'live';
  fallbackToManual: boolean;
  defaultCarrier?: string;
};

export type PaymentSettings = {
  id?: string;
  websiteId: string;
  stripeAccountId?: string | null;
  stripeConnectStatus?: 'not_connected' | 'connected';
  stripePublishableKey?: string | null;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  testMode: boolean;
  isConnected: boolean;
  connectedAt?: string | null;
};

export type CarrierCredential = {
  id: string;
  websiteId: string;
  carrier: string;
  credentials: Record<string, string>;
  testMode: boolean;
  isActive: boolean;
};

export type CarrierInfo = {
  id: string;
  name: string;
  logo: string;
  requiredCredentials: { key: string; label: string; type: string }[];
};

export type CustomDomain = {
  id: string;
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'error';
  dnsType?: string;
  dnsName?: string;
  dnsValue?: string;
  errorMessage?: string;
  createdAt: string;
};

export type EmailSettings = {
  id: string;
  websiteId: string;
  orderConfirmationEnabled: boolean;
  bookingConfirmationEnabled: boolean;
  bookingUpdatedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingReminderEnabled: boolean;
  bookingReminderLeadHours: number;
  bookingFollowupEnabled: boolean;
  bookingFollowupDelayHours: number;
  shippingConfirmationEnabled: boolean;
  welcomeEmailEnabled: boolean;
  abandonedCartEnabled: boolean;
  newSubmissionEnabled: boolean;
  refundConfirmationEnabled: boolean;
  senderName?: string | null;
  senderEmail?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  footerText?: string | null;
};

export type LegalSettings = {
  id: string;
  websiteId: string;
  websiteName: string | null;
  companyName: string | null;
  contactEmail: string | null;
  businessAddress: string | null;
  termsCustomContent: string | null;
  privacyCustomContent: string | null;
};

export type EmailTemplate = {
  id: string;
  websiteId: string;
  templateType: string;
  subject: string;
  heading: string;
  bodyText: string;
  buttonText?: string | null;
};

// UI labels are Danish; template ids and default contents are data and stay
// unchanged (they seed the actual customer-facing emails).
export const EMAIL_TEMPLATE_TYPES = [
  { id: 'order_confirmation', name: 'Ordrebekræftelse', description: 'Sendes når en kunde gennemfører et køb' },
  { id: 'shipping_confirmation', name: 'Forsendelsesbekræftelse', description: 'Sendes når en ordre afsendes med tracking-info' },
  { id: 'refund_confirmation', name: 'Refusionsbekræftelse', description: 'Sendes når en refusion behandles for en ordre' },
  { id: 'booking_confirmation', name: 'Bookingbekræftelse', description: 'Sendes når en kunde opretter en booking' },
  { id: 'booking_updated', name: 'Booking opdateret', description: 'Sendes når en booking ændres' },
  { id: 'booking_cancelled', name: 'Booking aflyst', description: 'Sendes når en booking aflyses' },
  { id: 'booking_reminder', name: 'Påmindelse', description: 'Sendes automatisk før en aftale som påmindelse' },
  { id: 'booking_followup', name: 'Opfølgning', description: 'Sendes automatisk efter en aftale som tak-for-besøget' },
  { id: 'welcome_email', name: 'Velkomstmail', description: 'Sendes til nye kunder efter deres første køb eller tilmelding' },
  { id: 'abandoned_cart', name: 'Forladt kurv-påmindelse', description: 'Sendes når en kunde efterlader varer i kurven' },
  { id: 'new_submission', name: 'Ny formular-indsendelse', description: 'Giver dig besked når nogen udfylder en kontaktformular' },
  { id: 'website_published', name: 'Hjemmeside udgivet', description: 'Sendes til dig når din hjemmeside udgives' },
];

export const DEFAULT_TEMPLATES: Record<string, { subject: string; heading: string; bodyText: string; buttonText?: string }> = {
  order_confirmation: {
    subject: 'Order Confirmation - #{{orderId}}',
    heading: 'Thank you for your order!',
    bodyText: 'We have received your order and are processing it. You will receive another email when your order ships.',
    buttonText: 'View Order',
  },
  shipping_confirmation: {
    subject: 'Your order has shipped! - #{{orderId}}',
    heading: 'Your order is on its way!',
    bodyText: 'Great news! Your order #{{orderId}} has been shipped. You can track your package using the link below.',
    buttonText: 'Track Package',
  },
  refund_confirmation: {
    subject: 'Refund Processed - #{{orderId}}',
    heading: 'Your refund has been processed',
    bodyText: 'We have processed a refund of {{totalAmount}} for order #{{orderId}}. Please allow 5-10 business days for the refund to appear in your account.',
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
  booking_reminder: {
    subject: 'Reminder: {{serviceName}} on {{date}}',
    heading: 'Your appointment is coming up',
    bodyText: 'This is a friendly reminder about your upcoming appointment. We look forward to seeing you!',
  },
  booking_followup: {
    subject: 'Thank you for your visit - {{serviceName}}',
    heading: 'Thank you for visiting us!',
    bodyText: 'We hope you enjoyed your appointment. We would love to see you again - book your next appointment anytime.',
  },
  welcome_email: {
    subject: 'Welcome to {{websiteName}}!',
    heading: 'Welcome aboard, {{customerName}}!',
    bodyText: 'Thank you for joining us! We\'re excited to have you. Browse our latest products and find something you love.',
    buttonText: 'Start Shopping',
  },
  abandoned_cart: {
    subject: 'You left something behind!',
    heading: 'Your cart is waiting for you',
    bodyText: 'It looks like you left some items in your shopping cart. Complete your purchase before they sell out!',
    buttonText: 'Complete Purchase',
  },
  new_submission: {
    subject: 'New form submission from {{websiteName}}',
    heading: 'You have a new contact form submission',
    bodyText: 'A visitor has submitted a form on your website. Review the details below and respond promptly.',
    buttonText: 'View Submission',
  },
  website_published: {
    subject: 'Your website is now live!',
    heading: 'Congratulations! Your website is published',
    bodyText: 'Your website is now live and accessible to the world. Click below to visit your site.',
    buttonText: 'Visit Website',
  },
};
