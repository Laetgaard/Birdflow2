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

## Recent Changes

- **2024-12-24**: Migrated all persistent data storage from Replit internal database to Supabase PostgreSQL
- **2024-12-24**: Added builder page with live preview, element selection, and properties sidebar
- **2024-12-24**: Implemented website creation with setup wizard and dashboard management
