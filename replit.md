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
AI-powered website modification through structured JSON mutations with "Build Mode" and "Thinking Mode". It supports "Creative Mode" (full CSS freedom) and "Safe Mode" (restricted styling), along with undo/redo functionality for changes. Mutations cover components, pages, and global styles.

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

### Email Notification System
A comprehensive transactional email system using SendGrid for order confirmations, booking notifications, and website publishing. It supports per-website toggles, branding, template customization with variable replacement, and robust error handling.

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
- `@sendgrid/mail`: SendGrid email API client.

### Deployment
- **Vercel**: Hosts published Next.js sites and manages custom domains.

### Payment Processing
- **Stripe**: For e-commerce checkout sessions and webhooks.

### File Storage
- **Replit Object Storage**: For image uploads via presigned URLs.