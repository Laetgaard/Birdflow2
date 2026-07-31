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

### Custom Components (Egne komponenter)
User-built components stored as data trees of primitive nodes (box/text/image/button/svg) defined in `shared/customComponents.ts` — never runtime-compiled code. The tree lives in `ComponentProps.customTree` on components of type `custom`; reusable copies are saved to `builderState.customComponents` as library entries ("Mine komponenter" in the palette) and deep-cloned with fresh node ids on insert. Any section can also be saved to the library. Per-breakpoint styling cascades base `styles` → `tabletStyles` (≤1024px) → `mobileStyles` (≤640px). The builder edits trees via `CustomComponentEditor` (layer tree, element editors, per-device style fields) and `CustomComponentRenderer` (canvas rendering, node selection, inline text editing via `node:<id>:<field>` editing fields). Published sites render trees with per-node CSS classes (`pn-<id>`) plus media queries generated inside the Next.js ComponentRenderer template. SVG markup is sanitized with the allowlist-based `shared/svgSanitizer.ts` at three points: builder save (PATCH route), builder render, and publish generation.

### Brand Guide
Per-website brand guide persisted at `builderState.brandGuide` (types in `shared/customComponents.ts`): colors (primary/secondary/accent/background/surface/text), typography (heading/body font + scale), logo, imagery style + notes, tone of voice + keywords, and spacing/radius/shadow/motion levels. Edited in the builder's "Brand" tab (`BrandGuidePanel`); "Anvend på hjemmesiden" maps the guide onto global styles via `brandGuideToDesignTokens()`.

### AI Builder Assistant
AI-powered website modification through structured JSON mutations supporting "Build Mode", "Thinking Mode", and "Design Analysis Mode". It includes "Creative Mode" (full CSS freedom) and "Safe Mode" (restricted styling), along with undo/redo functionality. Mutations cover components, pages, global styles, style presets, section-based composition, custom components (`add_custom_component` / `update_custom_component` — data trees only, optional library save), and brand-guide edits (`update_brand_guide`, deep partial merge with optional design-token application). The AI panel (`AIBuilderPanel.tsx`) is fully in Danish.

**AI images**: image fields may contain `ai://<description>` markers; `server/aiImages.ts` resolves them before mutations are applied (brand-grounded prompts, gpt-image-1, sharp→webp, stored in object storage as `/objects/uploads/*.webp` + media asset row, max 3 unique images per request; failures collapse to `''` with Danish notes).

**Pipeline** (in `/ai/build`, `/ai/apply`, `/ai/architect-build`): AI response → resolve `ai://` markers → apply mutations → deterministic self-check (`server/selfCheck.ts`: broken internal links → `/`, WCAG 4.5:1 contrast fixes, custom-tree responsive auto-fixes) → sanitize custom content → save → respond with a server-derived Danish build report (`server/aiReport.ts`, groups: Oprettet / Ændret / Tjek) rendered as a card in the panel.

**Design interview** (`POST /api/websites/:id/ai/design-interview`, wizard in the AI panel): feeling → 4 AI palettes (readability-enforced) → 3 font pairs (24 curated Google fonts) → optional inspiration image uploads (vision analysis, only website-owned media) + notes → writes `builderState.brandGuide` (+ global styles unless opted out). Guarded by `requireWebsitePermission("updateBuilder")`, strict zod body validation, and a per-user rate limit.

### AI Website Architect System
A professional 2-mode website building system that creates Webflow/Framer quality websites with complete design systems:

**Mode 1 - Architect/Planning Mode:**
- Analyzes websites conceptually (from URL or description)
- Detects site type, navigation structure, section patterns
- Designs a complete design system FIRST (colors, typography, spacing, radius, shadow, motion)
- Creates detailed plan with pages, sections, UX goals, conversion goals
- Does NOT modify builder_state until user approves
- Beautiful plan UI with design system preview showing colors, fonts, spacing, motion

**Mode 2 - Build Mode:**
- Executes approved plan in phases: Structure → Layout → Content → Motion
- Creates multi-page websites with proper navigation
- Applies design system to EVERY component (no hardcoded values)
- Professional quality: clear hierarchy, proper spacing, reusable patterns

**Comprehensive Design System:**
- Colors: primary, secondary, accent, background, surface, text
- Typography: headingFont, bodyFont, scale (modern/editorial/classic/bold)
- Spacing: section (tight/normal/airy), component (tight/normal/airy)
- Radius: none/soft/rounded
- Shadow: none/subtle/elevated
- Motion: style (none/subtle/expressive), speed (slow/normal/fast)
- Tone: luxury/modern/playful/corporate/minimal

**Design Presets Registry (`shared/designPresets.ts`):**
- LuxuryBrand: Elegant, serif fonts, airy spacing, slow subtle animations
- ModernSaaS: Blue tech palette, Inter font, balanced spacing, subtle motion
- PlayfulStartup: Vibrant colors, rounded corners, expressive animations
- CorporateBusiness: Conservative colors, tight spacing, minimal motion
- MinimalStudio: Few colors, maximum whitespace, no motion

**API Endpoints:**
- `POST /api/websites/:id/ai/architect-plan` - Create plan with design system
- `POST /api/websites/:id/ai/architect-build` - Build website applying design system
- `POST /api/websites/:id/ai/architect-from-url` - Screenshot + plan flow

**Schema:** `shared/websitePlanSchema.ts` defines WebsitePlan with complete DesignSystem object

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
- **Replit Object Storage**: For image uploads. The upload endpoints (`/api/uploads/request-url`, `/api/uploads/optimized-image`) require an authenticated user (Bearer token); all client upload helpers send it.

### Email Service
- **Resend**: Transactional email service (via Replit connector).