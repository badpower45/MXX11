#!/usr/bin/env bash
set -euo pipefail

# Usage: DATABASE_URL=... ./scripts/remote_seed.sh
# This script runs prisma generate, migrate/deploy and then the seed script

if [ -z "${DATABASE_URL-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Export DATABASE_URL before running."
  exit 1
fi

export DATABASE_URL

echo "1) Generating Prisma client..."
npm run prisma:generate

# Prefer migrations if present; fallback to deploy
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations || true)" ]; then
  echo "2) Applying migrations (prisma:migrate)..."
  npm run prisma:migrate
else
  echo "2) No local migrations found, running prisma:deploy..."
  npm run prisma:deploy || true
fi

echo "3) Running seed script..."
npm run seed

echo "Done. Seed completed against: ${DATABASE_URL}"
