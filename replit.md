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
- **Component Registry**: Defines 8 component types with editable properties (e.g., text, image, color).
- **ComponentRenderer**: Renders components from `builder_state` for both preview and published sites.
- **PropertiesPanel**: Dynamically generates UI for editing component properties based on their definitions.

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

### Custom Domain Support
Low-friction custom domain connection with minimal user steps:
- **Simplified Flow**: Domains are added directly to Vercel on creation, showing just ONE DNS record to add.
- **DNS Config**: CNAME for subdomains (www, shop, etc.), A record for apex domains (example.com).
- **Status Flow**: pending (add DNS) → verifying (checking) → active (connected).
- **Vercel Integration**: Uses existing Vercel project from website deployment for domain management.
- **Security**: All domain routes verify website ownership; requires website to be published first.
- **UI**: DomainsCard shows single DNS record with copy buttons, "Check Status" button polls Vercel.

### Deployment
- **Vercel**: Hosts published Next.js sites via its REST API, including custom domain connections.

### File Storage
- **Replit Object Storage**: Used for image uploads, integrated via a presigned URL flow.