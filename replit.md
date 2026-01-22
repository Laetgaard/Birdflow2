## Overview

SaaSify is a full-stack SaaS starter kit designed to accelerate the development of software-as-a-service applications. It provides essential features like authentication, user profiles, and a dashboard, enabling developers to focus on core product features. The platform includes a comprehensive AI-powered website builder, a publishing system for Vercel, e-commerce capabilities with Stripe integration, a privacy-first analytics system, an email notification system, custom domain support, and a streamlined onboarding process. It leverages a monorepo structure, sharing TypeScript types and schemas between its React frontend and Express backend.

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
- **Row Level Security (RLS)**: Comprehensive multi-tenant isolation with owner-based, website-based, domain-scoped public access, and admin override.

### Authentication
- **Provider**: Supabase Auth (email/password with email confirmation).
- **Session Handling**: JWT tokens validated via `requireAuth` middleware.
- **Profile Sync**: User profiles created/synced in Supabase PostgreSQL post email verification.

### Shared Code
The `shared/` directory centralizes database schemas, Zod validation schemas, TypeScript types, and the Component Registry for the website builder.

### Component System
A registry-based component system for the website builder defining 20 component types with editable properties. Includes a `ComponentRenderer` and `PropertiesPanel`. Per-component entrance animations are configurable with triggers and duration.

### AI Builder Assistant
AI-powered website modification through structured JSON mutations supporting "Build Mode", "Thinking Mode", and "Design Analysis Mode". It includes "Creative Mode" (full CSS freedom) and "Safe Mode" (restricted styling), along with undo/redo functionality. Mutations cover components, pages, global styles, style presets, and section-based composition. Professional UI/UX capabilities include a Design Tokens System, 5 Style Presets, and a Section Registry (15 types with variants) for rapid page creation. AI Design Analysis scores design quality and provides recommendations.

### AI Website Architect System (NEW)
A professional 2-mode website building system that creates Webflow/Framer quality websites:

**Mode 1 - Architect/Planning Mode:**
- Analyzes websites conceptually (from URL or description)
- Detects site type, navigation structure, section patterns
- Extracts design system (colors, typography, spacing, tone)
- Creates detailed plan with pages, sections, UX goals, conversion goals
- Does NOT modify builder_state until user approves
- Beautiful plan UI with collapsible sections and "Apply Plan" button

**Mode 2 - Build Mode:**
- Executes approved plan in phases: Structure → Layout → Content → Motion
- Creates multi-page websites with proper navigation
- Maintains consistent design system across all pages
- Professional quality: clear hierarchy, proper spacing, reusable patterns

**API Endpoints:**
- `POST /api/websites/:id/ai/architect-plan` - Create plan without building
- `POST /api/websites/:id/ai/architect-build` - Build website from plan
- `POST /api/websites/:id/ai/architect-from-url` - Screenshot + plan flow

**Schema:** `shared/websitePlanSchema.ts` defines WebsitePlan with SiteType, DesignSystem, Pages, Sections, BuildPhases

### Inline Editing System
Webflow-style inline editing for direct text manipulation using `EditableText` components, theme presets, and state management for real-time updates.

### Publishing System
Generates a standalone Next.js project from the `builder_state` and deploys it to Vercel, handling data flow for orders, bookings, and forms to Supabase.

### Website Templates System
Provides a registry of 6 customizable website templates with complete `builderState` for quick setup through a multi-step wizard.

### Shopping Cart & Checkout System
A full e-commerce checkout flow with React Context for cart state, `localStorage` persistence, and UI components. Integrates with Stripe for server-side product validation, checkout session creation, and webhook handling. Products support multiple variants with price adjustments.

### Shipping System
Dual-mode shipping management supporting manual fixed pricing and live carrier rates (UPS, GLS, PostNord) with encrypted credentials and fallback mechanisms.

### Calendar Availability System
Comprehensive booking availability management for services including weekly schedules, blocked dates (with yearly recurring option), and active service periods. The system includes UI for managing availability and an interactive calendar for booking on published sites.

### Custom Domain Support
Simplified custom domain connection via Vercel integration, allowing users to add CNAME or A records with status tracking.

### Payment Settings (Website-Owned Stripe)
Website owners can connect their own Stripe accounts, with encrypted storage of credentials, key validation, and test/live mode detection.

### Privacy-First Analytics System
GDPR-compliant analytics capturing page views, conversions, and e-commerce events without storing PII. Uses anonymous session tracking, centralized data sanitization, and provides an analytics dashboard. Published sites insert analytics directly to Supabase with RLS.

### Email Notification System
A comprehensive transactional email system using Resend for order confirmations, booking notifications, and website publishing. Supports per-website toggles, branding, template customization with variable replacement, and error handling. Default email templates are auto-created and seeded for each website.

### Onboarding System
A streamlined 5-step onboarding wizard for new users, guiding them from signup to a live editor by creating a website based on chosen templates, with atomic database transactions and coach marks.

### Admin Dashboard
A protected `/admin` dashboard with access control for platform monitoring. Features real-time KPIs, growth charts, a conversion funnel, and searchable directories for users and websites.

### SaaS Subscription Billing
Professional subscription management for the platform, offering Free/Starter, Pro, and Business plans with different feature sets and website limits. Implemented via Stripe for customer and subscription management, with API routes for plan display, checkout, billing portal, and webhook handling for subscription events.

## External Dependencies

### Authentication & Authorization
- **Supabase**: User authentication, email verification, session management.

### Database
- **Supabase PostgreSQL**: Primary data store.

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client library.
- `drizzle-orm` / `drizzle-kit`: ORM and migration tools.
- `@tanstack/react-query`: Server state management.
- `@radix-ui/*`: Headless UI primitives.
- `framer-motion`: Animation library.
- `bcryptjs`: Password hashing.

### Deployment
- **Vercel**: Hosts published Next.js sites and manages custom domains.

### Payment Processing
- **Stripe**: For e-commerce checkout sessions, webhooks, and subscription billing.

### File Storage
- **Replit Object Storage**: For image uploads.

### Email Service
- **Resend**: Transactional email service (via Replit connector).