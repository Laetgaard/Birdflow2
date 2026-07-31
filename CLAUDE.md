# CLAUDE.md - AI Assistant Guide for SaaSify (BirdFlow2)

## Project Overview

SaaSify is a full-stack SaaS website builder platform with AI-powered design, e-commerce, booking systems, and Vercel publishing. Users create accounts, build websites through an AI architect or visual editor, and publish them to custom domains.

**Tech stack:** TypeScript monorepo with React 19 frontend, Express.js backend, Supabase PostgreSQL database, and Drizzle ORM.

## Repository Structure

```
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/           # Route pages (wouter)
│       ├── components/      # UI & feature components
│       │   ├── ui/          # shadcn/ui primitives (60+)
│       │   ├── builder/     # Website builder components
│       │   ├── animated/    # Animation components
│       │   └── checkout/    # Cart & checkout flow
│       ├── hooks/           # Custom React hooks
│       ├── contexts/        # React contexts
│       └── lib/             # Utilities, auth, API client
├── server/                  # Express.js backend
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # All REST API endpoints (~200KB)
│   ├── storage.ts           # Database access layer (~80KB)
│   ├── aiBuilder.ts         # AI website mutation system
│   ├── phasedArchitect.ts   # AI 2-phase website planner
│   ├── websiteArchitect.ts  # AI design system generator
│   ├── aiVisionCloner.ts    # Vision-based site cloning
│   ├── subscriptionService.ts # Stripe subscription logic
│   ├── webhookHandlers.ts   # Stripe webhook processing
│   ├── stripeClient.ts      # Stripe API client
│   ├── screenshotService.ts # Puppeteer screenshots
│   ├── publisher/           # Vercel deployment pipeline
│   │   ├── generator.ts     # Next.js project generation
│   │   ├── vercel.ts        # Vercel API integration
│   │   └── templates.ts     # Next.js templates
│   ├── email/               # Email service (Resend/SendGrid)
│   ├── shipping/            # Shipping carriers (UPS, GLS, PostNord)
│   └── replit_integrations/ # Replit platform services
├── shared/                  # Code shared between client & server
│   ├── schema.ts            # Drizzle ORM schema (34 tables)
│   ├── componentRegistry.ts # Builder component definitions
│   ├── websiteTemplates.ts  # Pre-built website templates
│   ├── sectionRegistry.ts   # Section types & variants
│   ├── designPresets.ts     # Design system presets
│   ├── aiBuilderSchema.ts   # AI mutation Zod schemas
│   ├── builderHistory.ts    # Undo/redo system
│   ├── subscriptionPlans.ts # Plan tier definitions
│   └── websitePlanSchema.ts # AI architect plan structure
├── supabase/                # Database migrations
├── script/build.ts          # Production build script
├── scripts/                 # Utility scripts (migration, seeding)
├── migrations/              # Drizzle migration files
└── attached_assets/         # Static assets & task specs
```

## Commands

### Development
```bash
npm run dev          # Start Express backend (port 5000, serves both API + Vite HMR)
npm run dev:client   # Start Vite frontend only (port 5000)
```

### Build & Production
```bash
npm run build        # Build client (Vite) + server (esbuild) to dist/
npm run start        # Run production server from dist/index.cjs
```

### Type Checking
```bash
npm run check        # Run TypeScript compiler (tsc) with strict mode
```

### Database
```bash
npm run db:push      # Push Drizzle schema changes to Supabase PostgreSQL
```

### Tests
```bash
npm test             # Vitest (tests/, server/*.test.ts, shared/, client/src/)
```
Tests are mostly source tripwires + pure-function coverage; they run with
no database and no OpenAI key. No linter is configured.

## Architecture Patterns

### Monorepo with Shared Code
- `shared/` contains schemas, types, and registries used by both client and server
- Path aliases: `@/*` -> `client/src/*`, `@shared/*` -> `shared/*`
- Single `tsconfig.json` covers all three directories

### Frontend (client/)
- **Router:** Wouter (lightweight, not React Router)
- **State:** TanStack React Query with `staleTime: Infinity` and no auto-refetch
- **API calls:** `apiRequest()` helper in `client/src/lib/queryClient.ts` wraps fetch with credentials
- **Auth:** Supabase Auth via context provider (`client/src/lib/auth.tsx`), config fetched from `/api/config` at boot
- **UI framework:** shadcn/ui (new-york style) with Radix UI primitives, Tailwind CSS v4, Lucide icons
- **Forms:** React Hook Form + Zod validation via `@hookform/resolvers`
- **Animation:** Framer Motion
- **Route protection:** `<ProtectedRoute>` component wraps authenticated pages; supports `requireAdmin` and `requireOnboarding` props

### Backend (server/)
- **Single routes file:** All API endpoints registered in `server/routes.ts`
- **Storage layer:** `server/storage.ts` exports `db` (Drizzle instance) and `storage` (helper class with CRUD methods)
- **Auth flow:** Supabase JWT tokens validated server-side; profiles table synced with Supabase users
- **Stripe webhook:** Registered BEFORE `express.json()` middleware in `server/index.ts` (needs raw body)
- **AI systems:** Three modes - Build (mutations), Think (analysis), Phased Architect (plan + execute)
- **Publishing:** Generates Next.js projects and deploys to Vercel via API

### Database (shared/schema.ts)
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Schema location:** `shared/schema.ts` - single file with all 34 tables
- **Insert schemas:** Generated via `drizzle-zod`'s `createInsertSchema()`
- **Key tables:** `profiles`, `websites`, `builderState`, `products`, `orders`, `bookings`, `analyticsEvents`, `customDomains`, `emailSettings`
- **Naming:** snake_case for DB columns, camelCase for TypeScript fields (Drizzle maps automatically)
- **Encryption:** Sensitive fields (carrier credentials) encrypted with AES-256-CBC via `ENCRYPTION_KEY` env var

### Subscription / Billing
- Three platform plans: Basic (69 DKK), Starter (149 DKK), Professional (249 DKK)
- Plan limits enforced server-side: max websites, max pages, feature gates (booking, webshop)
- Stripe handles payment processing; webhook events update local subscription state

## Key Conventions

### TypeScript
- **Strict mode** enabled globally
- **Module:** ESNext with bundler resolution
- Types exported from `shared/schema.ts` using Drizzle's `$inferSelect` / `$inferInsert`
- Zod used for runtime validation at API boundaries

### File Organization
- One large routes file (`server/routes.ts`) rather than per-feature route modules
- One large storage file (`server/storage.ts`) rather than per-entity repositories
- Component registry pattern for builder: component types defined in `shared/componentRegistry.ts`
- UI primitives in `client/src/components/ui/`, feature components alongside pages or in `client/src/components/builder/`

### API Convention
- All API routes prefixed with `/api/`
- JSON request/response bodies
- Supabase access tokens sent via `Authorization: Bearer <token>` header from client
- Server validates tokens against Supabase, then queries `profiles` table for user data

### CSS / Styling
- Tailwind CSS v4 with CSS-first configuration in `client/src/index.css`
- HSL CSS variables for theming (background, foreground, primary, secondary, muted, etc.)
- `cn()` utility from `client/src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge)

### Build System
- **Client:** Vite bundles React app to `dist/public/`
- **Server:** esbuild bundles Express app to `dist/index.cjs` (CJS format, minified)
- Selective dependency bundling via allowlist in `script/build.ts` for cold-start optimization
- Production runs as single Node.js process serving both static files and API

## Environment Variables

Required environment variables (set in Replit secrets or `.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-CBC encryption |
| `OPENAI_API_KEY` | OpenAI API key for AI builder features |
| `VERCEL_TOKEN` | Vercel API token for publishing |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `SENDGRID_API_KEY` | SendGrid API key (fallback email) |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket |
| `GCS_KEY_FILE` | GCS service account key |
| `PORT` | Server port (default: 5000) |

## Common Tasks

### Adding a new API endpoint
1. Add the route handler in `server/routes.ts` inside the `registerRoutes()` function
2. If new DB queries are needed, add methods to the storage class in `server/storage.ts`
3. If new tables are needed, define them in `shared/schema.ts` and run `npm run db:push`

### Adding a new page
1. Create the page component in `client/src/pages/`
2. Add the route in `client/src/App.tsx` using `<Route>` from wouter
3. Wrap with `<ProtectedRoute>` if authentication is required

### Adding a new UI component
1. For shadcn/ui primitives: components go in `client/src/components/ui/`
2. For feature components: place near the page that uses them or in `client/src/components/builder/`
3. Use `cn()` for conditional Tailwind classes

### Adding a new builder component type
1. Define the component type and props in `shared/componentRegistry.ts`
2. Add rendering logic in the builder's `ComponentRenderer.tsx`
3. Add property editing UI in `PropertiesPanel.tsx`

### Modifying the database schema
1. Edit table definitions in `shared/schema.ts`
2. Run `npm run db:push` to apply changes to the database
3. Update insert schemas if needed (they use `createInsertSchema()` from drizzle-zod)

## Warnings

- `server/routes.ts` is ~200KB - be precise when editing; read relevant sections first
- `server/storage.ts` is ~80KB - same caution applies
- The Stripe webhook route MUST be registered before `express.json()` middleware (it needs raw body)
- No test suite exists - validate changes manually or via `npm run check`
- No linter configured - follow existing code style (Prettier-like formatting)
- Currency is DKK (Danish Krone) throughout the billing system
