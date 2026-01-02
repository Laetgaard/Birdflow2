# SaaSify - SaaS Starter Kit

## Overview

SaaSify is a full-stack SaaS starter kit designed to accelerate building software-as-a-service applications. It provides authentication, user profiles, and a dashboard out of the box, allowing developers to focus on their core product features rather than boilerplate infrastructure.

The project uses a monorepo structure with a React frontend and Express backend, sharing TypeScript types and schemas between both layers.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (new-york style)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend lives in `client/src/` with pages in `pages/`, reusable UI components in `components/ui/`, and shared utilities in `lib/`.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Server**: HTTP server with Vite middleware in development, static file serving in production
- **API Pattern**: REST endpoints under `/api/` prefix
- **Build**: esbuild bundles server code for production

Server code is in `server/` with routes defined in `routes.ts` and database operations in `storage.ts`.

### Data Storage
- **Database**: Supabase PostgreSQL via Drizzle ORM (pooled connection)
- **Schema Location**: `shared/schema.ts` - defines database tables and Zod validation schemas
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization
- **Connection**: Uses transaction pooler for reliable serverless connections

Database tables:
- `profiles` - User profile data (id, email, fullName, phoneNumber, createdAt)
- `websites` - User's website projects (id, ownerId, name, status, setupType)
- `website_inputs` - Onboarding wizard data (businessDescription, pages, features, designPreset)
- `builder_state` - Website builder state as JSONB (pages, components, globalStyles)
- `orders` - Ecommerce orders (customerName, customerEmail, status, total, items)
- `bookings` - Appointment bookings (customerName, service, date, status)
- `form_submissions` - Contact form and other form submissions
- `customers` - Customer profiles aggregated from orders/bookings

### Authentication
- **Provider**: Supabase Auth (email/password with email confirmation)
- **Flow**: Frontend fetches Supabase config from `/api/config`, then uses Supabase JS client for auth operations
- **Session Handling**: JWT tokens passed via Authorization header, validated on protected routes using `requireAuth` middleware
- **Profile Sync**: After email verification, user profiles are created/synced in Supabase PostgreSQL database

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- Database schemas with Drizzle
- Zod validation schemas generated from Drizzle schemas
- TypeScript types inferred from schemas
- Component Registry (`shared/componentRegistry.ts`) - defines all website builder component types

### Component System Architecture
The website builder uses a registry-based component system:

**Component Registry** (`shared/componentRegistry.ts`):
- Defines 8 component types: hero, image-slider, text-image, cta, features, testimonials, header, footer
- Each component has: type, name, icon, defaultProps, defaultStyles, and fields array
- Field definitions specify editable properties with type (text, textarea, color, select, image, image-array, items)
- `createComponent(type)` creates new component instances with defaults

**ComponentRenderer** (`client/src/components/builder/ComponentRenderer.tsx`):
- Maps component type to React JSX
- Renders purely from builder_state data (props + styles)
- Reusable for both builder preview and published site rendering
- isPreview flag controls interactive behavior

**PropertiesPanel** (`client/src/components/builder/PropertiesPanel.tsx`):
- Dynamically renders edit fields based on component's field definitions
- Supports text, textarea, color picker, select, image URL, image array, and items editors
- Updates flow through parent to builder_state and Supabase persistence

### Publishing System
The publisher generates a standalone Next.js project from builder_state and deploys to Vercel:

**Publisher Service** (`server/publisher/`):
- `generator.ts` - Creates Next.js App Router project from builder_state
- `templates.ts` - Template generators for package.json, components, pages, theme.json
- `vercel.ts` - Vercel REST API integration for deployment
- `index.ts` - Orchestrates generation and deployment flow

**Generated Project Structure**:
- Portable Next.js 14 project with no builder dependencies
- Components render from props (no hardcoded content)
- `theme.json` drives global styling from globalStyles
- Supabase client uses anon key (client) and service role (server-only)
- Contact/Booking/Product components submit to Supabase tables via RLS

**Data Flow**:
- Published site writes orders/bookings/forms to Supabase with website_id
- /manage/:id dashboard reads same tables for website owners
- RLS policies scope data access by website_id

## External Dependencies

### Authentication & Authorization
- **Supabase**: Handles user authentication, email verification, and session management
- Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Database
- **Supabase PostgreSQL**: Primary data store accessed via Drizzle ORM
- Environment variable: `SUPABASE_DB_URL` (pooled connection string with port 6543)
- Connection format: `postgresql://postgres.[project-ref]:[password]@aws-[region].pooler.supabase.com:6543/postgres`

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client for auth
- `drizzle-orm` / `drizzle-kit`: Database ORM and migration tooling
- `@tanstack/react-query`: Server state management
- `@radix-ui/*`: Headless UI primitives for shadcn components
- `framer-motion`: Animation library used on landing page
- `bcryptjs`: Password hashing utilities

### Deployment
- **Vercel**: Hosts published Next.js sites via REST API
- Environment variables: `VERCEL_TOKEN`, `VERCEL_TEAM_ID` (optional)
- Published sites receive `SUPABASE_SERVICE_ROLE_KEY` as encrypted Vercel env var

### Website Templates System
Pre-built website templates that users can select when creating a new website:

**Template Registry** (`shared/websiteTemplates.ts`):
- 6 templates: Blank, Modern Business, Creative Portfolio, E-Commerce Store, Service Booking, Startup Landing
- Each template has: id, name, description, category, thumbnail, and complete builderState
- Categories: landing, business, portfolio, ecommerce, services, blog
- `getTemplateById(id)` and `cloneTemplateState(template)` for applying templates

**Create Website Modal** (`client/src/components/create-website-modal.tsx`):
- Multi-step wizard: Name → Setup Type → Template Selection
- Visual template grid with thumbnails and descriptions
- Template selection applies full builder state on creation

### Shopping Cart & Checkout System
The platform includes a complete e-commerce checkout flow:

**Cart Context** (`client/src/lib/cartContext.tsx`):
- React Context providing cart state across the app
- localStorage persistence with website-specific keys (`saasify_cart_${websiteId}`)
- Functions: addItem, removeItem, updateQuantity, clearCart
- Automatic total calculation and item count

**Cart UI** (`client/src/components/cart/`):
- CartDrawer: Slide-out cart with quantity controls, two-step checkout flow
- CartButton: Header button showing item count badge
- Email/name collection before checkout

**Checkout Flow**:
- Server-side product validation to prevent price tampering
- Currency validation ensures all cart items share same currency (USD/EUR/DKK)
- Stripe Checkout Session creation with order tracking
- Webhook handler updates order status (pending → paid) on payment completion

**API Endpoints**:
- `POST /api/public/websites/:id/checkout` - Create Stripe checkout session (public)
- `GET /api/public/websites/:id/products` - List active products (public)
- Stripe webhook at `/api/stripe/webhook` for payment event processing

## Recent Changes

- **2025-01-02**: Enhanced product page with image gallery, zoom, and lightbox functionality
- **2025-01-02**: Added multiple images support to products (images array column)
- **2025-01-02**: Cart context now supports quantity parameter in addItem function
- **2025-01-02**: Product page includes quantity selector, stock status, trust badges
- **2025-01-02**: Added shopping cart with localStorage persistence and CartDrawer UI
- **2025-01-02**: Implemented Stripe checkout with customer email collection and currency validation
- **2025-01-02**: Created checkout success/cancel pages with cart clearing on success
- **2025-01-02**: Added public checkout endpoint with server-side price validation
- **2025-01-02**: Updated ProductGrid component props for cart integration (productMode, showAddToCart)
- **2024-12-28**: Added customizable pre-built website templates with 6 starter templates (business, portfolio, ecommerce, services, landing)
- **2024-12-28**: Created multi-step website creation wizard with template selection UI
- **2024-12-28**: Added real-time booking updates via Supabase Realtime subscription in manage dashboard
- **2024-12-28**: Redesigned booking management UI with status-colored cards, quick action buttons, and visual improvements
- **2024-12-28**: Added booking filtering (All/Pending/Confirmed/Cancelled) and search by customer name/email/service
- **2024-12-28**: Improved services management with visual card grid, gradient icons, and inline add/edit/delete
- **2024-12-28**: Fixed click propagation in booking cards - quick actions don't trigger detail dialog
- **2024-12-28**: Enhanced BookingWidget with 3-step wizard flow (Service → Date/Time → Details), modern UI with progress indicators
- **2024-12-28**: Fixed builder/preview mode interaction handling - components selectable in builder but interactive on live sites
- **2024-12-28**: Updated publisher booking template to fetch services from database and use proper column names
- **2024-12-27**: Added ImageCropper component with react-image-crop library for image editing
- **2024-12-27**: Created MediaPanel for managing uploaded images in builder sidebar
- **2024-12-27**: Added booking_services table and booking services management in manage dashboard
- **2024-12-26**: Added multi-page support to builder - create, rename, delete pages with unique URL slugs
- **2024-12-26**: Updated Next.js generator to create separate routes for each page
- **2024-12-25**: Implemented publishing system with Next.js generator and Vercel deployment
- **2024-12-25**: Added management dashboard for orders, bookings, and form submissions
- **2024-12-25**: Added component system with registry, renderer, and dynamic properties panel for builder
- **2024-12-24**: Migrated all persistent data storage from Replit internal database to Supabase PostgreSQL
- **2024-12-24**: Added builder page with live preview, element selection, and properties sidebar
- **2024-12-24**: Implemented website creation with setup wizard and dashboard management
