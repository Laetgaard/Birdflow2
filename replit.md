## Overview

SaaSify is a full-stack SaaS starter kit designed to accelerate the development of software-as-a-service applications. It provides essential features like authentication, user profiles, and a dashboard, enabling developers to focus on core product features. The project utilizes a monorepo structure, sharing TypeScript types and schemas between its React frontend and Express backend. The platform includes a comprehensive AI-powered website builder, a publishing system for Vercel, e-commerce capabilities with Stripe integration, a privacy-first analytics system, and an email notification system. It also features custom domain support, a streamlined onboarding process, and an admin dashboard for platform monitoring.

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
- **Row Level Security (RLS)**: Comprehensive multi-tenant isolation implemented.

### Row Level Security (RLS) System
Full multi-tenant isolation with domain-scoped public access:

**Security Model:**
1. **Owner-based access**: Tables with `owner_id` - only allow access where `owner_id = auth.uid()`
2. **Website-based access**: Tables with `website_id` - access via website ownership check
3. **Domain-scoped public access**: Anonymous users can only access data for the website matching their request domain
4. **Admin override**: Users with `is_admin = true` get full access

**Helper Functions:**
- `is_admin()`: Check if current user is an admin
- `owns_website(website_id)`: Check if user owns a specific website
- `can_access_website(website_id)`: Check owner OR admin access
- `website_for_host()`: Resolve website_id from request host header
- `is_request_for_website(website_id)`: Validate domain matches website_id and is published

**Tables with RLS:**
- profiles, public_stats, websites, website_inputs, builder_state
- products, orders, order_items, bookings, booking_services
- form_submissions, customers, media_assets, custom_domains
- shipping_methods, shipping_carrier_credentials, shipping_config
- website_payment_settings, email_settings, email_templates
- cookie_settings, analytics_events

**Migration File:** `supabase/migrations/20260107_rls_policies.sql`
- Must be applied directly in Supabase Dashboard SQL Editor
- Cannot run via development database (uses Supabase's `auth.uid()` function)

### Authentication
- **Provider**: Supabase Auth (email/password with email confirmation).
- **Session Handling**: JWT tokens validated via `requireAuth` middleware.
- **Profile Sync**: User profiles created/synced in Supabase PostgreSQL post email verification.

### Shared Code
The `shared/` directory centralizes database schemas, Zod validation schemas, TypeScript types, and the Component Registry for the website builder.

### Component System
A registry-based component system for the website builder, defining 18 component types with editable properties. It includes a `ComponentRenderer` and `PropertiesPanel` for dynamic rendering and editing.

### AI Builder Assistant
AI-powered website modification through structured JSON mutations with "Build Mode", "Thinking Mode", and "Design Analysis Mode". It supports "Creative Mode" (full CSS freedom) and "Safe Mode" (restricted styling), along with undo/redo functionality for changes. Mutations cover components, pages, global styles, style presets, and section-based composition.

**Phase 1 Professional UI/UX Capabilities:**

1. **Design Tokens System** (`shared/schema.ts`):
   - Extended globalStyles with: textColor, borderRadius, spacingScale, sectionGap, buttonStyle, cardStyle
   - All new tokens optional for backward compatibility with existing builder states
   - Publisher generates CSS custom properties from design tokens

2. **Style Presets** (`shared/stylePresets.ts`):
   - 5 preset themes: modern (tech/SaaS), luxury (premium/dark+gold), playful (creative/gradients), corporate (B2B), minimal (portfolio)
   - Each preset defines complete design token values
   - AI can apply presets via `apply_preset` mutation

3. **Section Registry** (`shared/sectionRegistry.ts`):
   - 15 section types: hero-section, features-section, testimonials-section, pricing-section, cta-section, etc.
   - Each section has layout variants (default, centered, split, minimal, bold)
   - Page templates combine sections for common page types (landing, about, pricing, contact)
   - AI adds sections via `add_section` mutation, which expands to component mutations

4. **AI Design Analysis** (`/api/websites/:id/ai/analyze`):
   - Scores design quality (1-100) based on visual hierarchy, color harmony, typography, spacing, layout, UX
   - Returns strengths, improvements needed, and actionable recommendations
   - Can suggest optimal style preset based on current design

**Mutation System:**
- `apply_preset`: Applies a style preset, internally converts to update_global_styles mutation
- `add_section`: Adds a section blueprint, internally expands to add_component mutations
- Expansion happens in applyMutations() before state update, maintaining backward compatibility

### Inline Editing System
Webflow-style inline editing for direct text manipulation in the builder canvas using `EditableText` components, theme presets, and state management for real-time updates.

### Publishing System
Generates a standalone Next.js project from the `builder_state` and deploys it to Vercel, handling data flow for orders, bookings, and forms to Supabase.

### Website Templates System
Provides a registry of 6 customizable website templates with complete `builderState` for quick setup through a multi-step wizard.

### Shopping Cart & Checkout System
A full e-commerce checkout flow with a React Context for cart state, `localStorage` persistence, and UI components. It integrates with Stripe for server-side product validation, checkout session creation, and webhook handling.

### Shipping System
Dual-mode shipping management supporting manual fixed pricing and live carrier rates (UPS, GLS, PostNord) with encrypted credentials, fallback mechanisms, and UI for management.

### Custom Domain Support
Simplified custom domain connection via Vercel integration, allowing users to add CNAME or A records with status tracking (pending, verifying, active).

### Payment Settings (Website-Owned Stripe)
Website owners can connect their own Stripe accounts, with encrypted storage of credentials, key validation, test/live mode detection, and injection into Vercel environment variables during deployment.

### Privacy-First Analytics System
GDPR-compliant analytics capturing page views, conversions, and e-commerce events without storing PII. It uses anonymous session tracking, centralized data sanitization, and provides an analytics dashboard.

**Published Site Analytics:**
- Published sites insert analytics directly to Supabase using the anon key
- RLS policy allows INSERT for any published website (`is_website_published(website_id)`)
- AnalyticsTracker component reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Events tracked: page_view, add_to_cart, checkout_start, checkout_success, booking_submit, booking_created, order_created
- Data sanitization removes PII, only allowing safe keys (path, productId, quantity, price, etc.)
- Cookie consent required before tracking (GDPR compliance)

**Migration File:** `supabase/migrations/20260108_fix_analytics_rls.sql`
- Simplifies anon INSERT policy to check only if website is published
- Must be applied in Supabase Dashboard SQL Editor

### Email Notification System
A comprehensive transactional email system using Resend (via Replit connector) for order confirmations, booking notifications, and website publishing. It supports per-website toggles, branding, template customization with variable replacement, and robust error handling.

**Default Email Templates:**
- 5 template types auto-created for each website: order_confirmation, booking_confirmation, booking_updated, booking_cancelled, website_published
- Templates seeded on-demand when accessing email settings (storage.ensureEmailTemplatesConfigured)
- Database trigger auto-creates templates for new websites
- Uses ON CONFLICT to handle concurrent requests safely

**Migration File:** `supabase/migrations/20260108_seed_default_email_templates.sql`
- Backfills missing templates for all existing websites
- Creates trigger for auto-seeding new websites
- Adds unique constraint on (website_id, template_type)
- Must be applied in Supabase Dashboard SQL Editor

### Onboarding System
A streamlined 5-step onboarding wizard for new users, guiding them from signup to a live editor by creating a website based on chosen templates, with atomic database transactions and coach marks for first-time users.

### Admin Dashboard
A protected `/admin` dashboard with access control for platform monitoring. It features real-time KPIs, growth charts (signups, websites, orders, bookings), a conversion funnel, and searchable directories for users and websites.

## External Dependencies

### Authentication & Authorization
- **Supabase**: User authentication, email verification, and session management.

### Database
- **Supabase PostgreSQL**: Primary data store, accessed via Drizzle ORM.

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client library.
- `drizzle-orm` / `drizzle-kit`: ORM and migration tools.
- `@tanstack/react-query`: Server state management.
- `@radix-ui/*`: Headless UI primitives.
- `framer-motion`: Animation library.
- `bcryptjs`: Password hashing.
- `resend`: Resend email API client (via Replit connector).

### Deployment
- **Vercel**: Hosts published Next.js sites and manages custom domains.

### Payment Processing
- **Stripe**: For e-commerce checkout sessions and webhooks.

### File Storage
- **Replit Object Storage**: For image uploads via presigned URLs.

### SaaS Subscription Billing
Professional subscription management for BirdFlow platform:

**Plans:**
- Free/Starter: 1 website, basic features
- Pro ($19/mo): 5 websites, AI builder, custom domains, e-commerce (up to 100 products)
- Business ($49/mo): Unlimited websites/products, team collaboration, white-label

**Implementation:**
- `server/subscriptionService.ts`: Plan definitions, Stripe customer/subscription management
- API routes: `/api/subscriptions/plans`, `/api/subscriptions/checkout`, `/api/subscriptions/billing-portal`, `/api/subscriptions/webhook`
- Database fields: `stripeCustomerId` (profiles), `stripeSubscriptionId`, `stripePriceId`, `subscriptionStatus`, `currentPeriodEnd` (websites)

**Environment Variables Required:**
- `STRIPE_PRO_PRICE_ID`: Stripe price ID for Pro plan
- `STRIPE_BUSINESS_PRICE_ID`: Stripe price ID for Business plan
- `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`: Webhook secret for subscription events

**Webhook Events Handled:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

**Plan Mapping (API → Database):**
- 'pro' → 'professional'
- 'business' → 'enterprise'
- 'free'/'starter' → 'free'