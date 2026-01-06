## Overview

SaaSify is a full-stack SaaS starter kit designed to accelerate the development of software-as-a-service applications. It provides essential features like authentication, user profiles, and a dashboard, enabling developers to focus on core product features. The project utilizes a monorepo structure, sharing TypeScript types and schemas between its React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS v4 with shadcn/ui (new-york style)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Framework**: Express.js with TypeScript
- **API Pattern**: REST endpoints under `/api/`
- **Build**: esbuild for production bundling

### Data Storage
- **Database**: Supabase PostgreSQL via Drizzle ORM
- **Schema**: Defined in `shared/schema.ts`, with Zod validation.
- **Migrations**: Drizzle Kit.
- **Tables**: `profiles`, `websites`, `website_inputs`, `builder_state`, `orders`, `order_items`, `bookings`, `form_submissions`, `customers`.
- **Row Level Security (RLS)**: Implemented for data isolation, particularly for `orders` and `order_items`, and website-specific data.

### Authentication
- **Provider**: Supabase Auth (email/password with email confirmation).
- **Session Handling**: JWT tokens validated via `requireAuth` middleware.
- **Profile Sync**: User profiles are created/synced in the Supabase PostgreSQL database post email verification.

### Shared Code
The `shared/` directory centralizes database schemas, Zod validation schemas, TypeScript types, and the Component Registry for the website builder, ensuring consistency across frontend and backend.

### Component System
The website builder uses a registry-based component system:
- **Component Registry**: Defines 18 component types with editable properties (e.g., text, image, color).
- **Component Types**: hero, header, footer, cta, features, testimonials, text-image, image-slider, product-grid, booking, gallery, pricing-table, faq, stats-counter, contact-form, video-embed, divider, spacer.
- **ComponentRenderer**: Renders components from `builder_state` for both preview and published sites.
- **PropertiesPanel**: Dynamically generates UI for editing component properties based on their definitions.

### AI Builder Assistant
AI-powered website modification through structured JSON mutations:
- **Build Mode**: Directly applies AI-generated changes to the website.
- **Thinking Mode**: Shows a step-by-step plan requiring explicit user approval before mutations apply.
- **Creative Mode vs Safe Mode**: Two-tier styling system:
  - **Safe Mode**: Restricts styles to basics (colors, padding, margin). Server-side filtering strips creative-only properties.
  - **Creative Mode**: Full CSS freedom including gradients, shadows, animations, transforms, advanced layouts.
- **Undo/Redo**: Version history with undo/redo support for AI changes.
- **Component Mutations**: add_component, update_component, remove_component, move_component, duplicate_component.
- **Page Mutations**: add_page, remove_page, update_page.
- **Global Styles**: update_global_styles for site-wide theme changes.

### Inline Editing System
Webflow-style inline editing for direct text manipulation in the builder canvas:
- **EditableText Component**: Contenteditable-based text editing with Enter to save, Escape to cancel.
- **Theme Presets**: Color presets (10 backgrounds, 6 text colors) and spacing presets (padding options).
- **Editable Fields**: Defined per component type in `editableTextFields` mapping (title, subtitle, description, buttonText).
- **State Management**: Uses `editingField` state in builder.tsx with `handleTextChange` handler for state updates.
- **Button Editing**: Maintains semantic `<button>` elements while enabling text editing for parity with published sites.

### Publishing System
Generates a standalone Next.js project from the `builder_state` and deploys it to Vercel.
- **Publisher Service**: Orchestrates project generation (using `generator.ts` and `templates.ts`) and Vercel deployment (`vercel.ts`).
- **Generated Project**: A portable Next.js 14 application that renders content from props, uses `theme.json` for global styling, and interacts with Supabase.
- **Data Flow**: Published sites write orders, bookings, and forms to Supabase, respecting RLS policies.

### Website Templates System
Provides pre-built website templates for quick setup:
- **Template Registry**: Stores 6 customizable templates (e.g., Modern Business, E-Commerce Store) with complete `builderState`.
- **Create Website Modal**: A multi-step wizard allowing users to select and apply templates during website creation.

### Shopping Cart & Checkout System
Includes a full e-commerce checkout flow:
- **Cart Context**: React Context with `localStorage` persistence for managing cart state.
- **Cart UI**: Components like `CartDrawer` and `CartButton` for user interaction.
- **Published Site Cart**: Generated Next.js sites include `CartProvider` and `CartDrawer` for consistent e-commerce functionality.
- **Checkout Flow**: Server-side product validation, Stripe Checkout Session creation, and webhook handling for order status updates.
- **API Endpoints**: Public endpoints for checkout and product listing, plus a Stripe webhook.

## External Dependencies

### Authentication & Authorization
- **Supabase**: Used for user authentication, email verification, and session management.

### Database
- **Supabase PostgreSQL**: The primary data store, accessed via Drizzle ORM.

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client library.
- `drizzle-orm` / `drizzle-kit`: ORM and migration tools.
- `@tanstack/react-query`: Server state management.
- `@radix-ui/*`: Headless UI primitives.
- `framer-motion`: Animation library.
- `bcryptjs`: Password hashing.

### Shipping System
Dual-mode shipping management supporting both manual and live carrier rates:
- **Manual Mode**: Store owners define fixed shipping prices (name, price, delivery time).
- **Live Mode**: Real-time shipping quotes from integrated carriers (UPS, GLS, PostNord).
- **Database Tables**: `shipping_methods`, `shipping_carrier_credentials`, `shipping_config`.
- **Carrier Providers**: Located in `server/shipping/providers/` with common interface.
- **ShippingService**: Orchestrates multiple carriers in `server/shipping/service.ts`.
- **Security**: Carrier credentials stored encrypted, masked (••••••••) in API responses.
- **Fallback**: Live mode falls back to manual rates if carrier APIs fail.
- **Validation**: Mode switching to live requires at least one validated active carrier.
- **UI**: Manage page shipping tab with mode toggle and carrier credential management.

### Custom Domain Support
Low-friction custom domain connection with minimal user steps:
- **Simplified Flow**: Domains are added directly to Vercel on creation, showing just ONE DNS record to add.
- **DNS Config**: CNAME for subdomains (www, shop, etc.), A record for apex domains (example.com).
- **Status Flow**: pending (add DNS) → verifying (checking) → active (connected).
- **Vercel Integration**: Uses existing Vercel project from website deployment for domain management.
- **Security**: All domain routes verify website ownership; requires website to be published first.
- **UI**: DomainsCard shows single DNS record with copy buttons, "Check Status" button polls Vercel.

### Payment Settings (Website-Owned Stripe)
Website owners can connect their own Stripe accounts for payment processing:
- **Database Table**: `website_payment_settings` stores encrypted Stripe credentials per website.
- **Encryption**: Sensitive keys (secret key, webhook secret) are encrypted using AES-256-CBC before storage.
- **ENCRYPTION_KEY**: Environment variable required for encryption/decryption (64-char hex string).
- **API Routes**: GET/POST/DELETE `/api/websites/:id/payment-settings` with owner verification.
- **Key Validation**: Stripe keys are validated by making a test API call before saving.
- **Test/Live Mode**: Automatically detects if keys are test or live mode based on key prefix.
- **Publisher Integration**: Owner's Stripe keys are injected into Vercel environment variables during deployment.
- **UI**: Settings tab shows connection status with dialog for entering API keys from Stripe Dashboard.
- **Security**: Keys are masked in API responses; only the key prefix is shown to users.

### Privacy-First Analytics System
Website analytics with GDPR compliance and no personal data storage:
- **Database Table**: `analytics_events` stores page views, conversions, and e-commerce events.
- **Session Tracking**: Anonymous sessionId via localStorage (30-minute expiry with rotation), no user identifiers.
- **No PII Storage**: No IP addresses, no cookies, no personal data. Only aggregated metrics.
- **Centralized Sanitization**: `ANALYTICS_ALLOWED_EVENT_DATA_FIELDS` and `sanitizeAnalyticsEventData()` in shared/schema.ts ensure consistent PII filtering at both API route and storage layers.
- **Allowed Event Data**: path, productId, orderId, orderTotal, bookingId, utm_source, utm_medium, utm_campaign.
- **Event Types**: page_view, product_view, add_to_cart, checkout_start, order_created, booking_created.
- **Analytics Dashboard**: Shows key metrics, conversion funnel, traffic sources, and top pages.
- **Published Site Integration**: AnalyticsTracker component included in generated Next.js sites for client-side tracking.
- **API Endpoints**: Public `/api/public/analytics/track` for event collection; authenticated endpoints for overview, funnel, traffic sources, and top pages with configurable date ranges.

### Email Notification System
Comprehensive transactional email system for order confirmations, booking notifications, and website publishing:
- **Email Provider**: SendGrid for all transactional emails (via @sendgrid/mail).
- **Database Tables**: `email_settings` (per-website toggles/branding), `email_templates` (custom templates per type).
- **Email Types**: order_confirmation, booking_confirmation, booking_updated, booking_cancelled, website_published.
- **Toggles**: Website owners can enable/disable each notification type independently.
- **Branding**: Customizable sender name, email, logo, primary color, and footer text per website.
- **Template Customization**: Each email type can have custom subject, heading, body text, and button text.
- **Variable Replacement**: Supports {{orderId}}, {{customerName}}, {{serviceName}}, {{date}}, etc.
- **Default Branding**: Falls back to "BirdFlow" branding when website has no custom settings.
- **Service Location**: `server/email/service.ts` with EmailService class and convenience methods.
- **Triggers**:
  - Order confirmation: Sent via webhook when Stripe payment completes (webhookHandlers.ts).
  - Booking confirmation: Sent when public booking is created (routes.ts).
  - Booking updates/cancellations: Sent when booking status changes (routes.ts).
  - Website published: Sent to owner when website is deployed (routes.ts).
- **Error Handling**: Email failures are logged but don't break main flows.
- **UI**: Emails tab in Manage page with notification toggles, branding editor, and template customization.
- **API Endpoints**: GET/PATCH `/api/websites/:id/email-settings`, GET/PUT `/api/websites/:id/email-templates/:type`.

### Onboarding System
Streamlined onboarding flow to get new users from signup to a live editor in under 3 minutes:
- **Multi-Step Wizard**: 5-step flow (Welcome, Choose Type, Website Name, Auto Setup, Success).
- **Website Types**: Booking, Webshop, Simple - each maps to a pre-configured template.
- **Template Mapping**: booking→service-booking, webshop→ecommerce-store, simple→modern-business.
- **Atomic Transaction**: Website creation uses a DB transaction wrapping website insert, builder state, onboarding completion, and stats increment.
- **Database Tables**: `public_stats` tracks total creators count; `profiles.onboardingCompleted` flag controls redirect logic.
- **Redirect Logic**: Users without completed onboarding are redirected from /dashboard to /onboarding.
- **Coach Marks**: First-time users see a tutorial overlay in the builder highlighting key UI areas.
- **API Endpoint**: POST `/api/onboarding/create-website` handles the atomic creation flow.
- **Stats Tracking**: Total creators count is incremented via upsert and displayed on the landing page.

### Deployment
- **Vercel**: Hosts published Next.js sites via its REST API, including custom domain connections.

### File Storage
- **Replit Object Storage**: Used for image uploads, integrated via a presigned URL flow.