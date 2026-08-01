#!/bin/bash
set -e

# Post-merge setup for BirdFlow (runs automatically after task merges).
#
# Sync dependencies: merges can update package.json without touching
# node_modules, and server-side dynamic imports then crash on the first
# request that hits them (server boots clean, fails later).
npm install --no-audit --no-fund

# NOTE: no `npm run db:push` here on purpose - drizzle push is interactive and
# destructive against the shared Supabase DB. Schema changes are applied as
# explicit SQL DDL by the agent performing the task.
