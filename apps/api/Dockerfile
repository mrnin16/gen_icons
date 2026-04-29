# Icon Forge API — production image
# Built from the monorepo root: pass build context as the repo root, this
# Dockerfile lives at apps/api/Dockerfile.
#
# In Railway: set "Dockerfile Path" = apps/api/Dockerfile.
FROM node:24-slim

WORKDIR /repo

# OpenSSL is required by the Prisma query engine.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy workspace metadata + the api workspace's prisma schema (needed for
# postinstall: prisma generate).
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma

# Install all workspace deps; the api workspace's postinstall fires
# `prisma generate` automatically.
RUN npm ci

# Copy source for the api workspace and the shared package only.
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build the api Next.js app.
WORKDIR /repo/apps/api
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma validates DATABASE_URL at import time; next build imports all routes
# including the SVG/sprite handlers which import PrismaClient. Provide a dummy
# URL so the build succeeds. Railway overrides this with the real value at runtime.
ARG DATABASE_URL=postgresql://dummy:dummy@dummy:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

RUN npm run build

# Railway sets PORT for us; next start picks it up.
EXPOSE 3001
CMD ["npm", "start"]
