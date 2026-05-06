# Icon Forge Web — production image
# Built from the monorepo root.
#
# In Railway: set "Dockerfile Path" = apps/web/Dockerfile.
FROM node:24-slim

WORKDIR /repo

# Copy workspace metadata for npm ci.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# IMPORTANT: prisma's schema is needed by the api workspace's postinstall
# hook (prisma generate). Even though this image doesn't run the API, npm ci
# at the workspace root runs every workspace's lifecycle scripts.
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma

RUN npm ci

# Copy source for the web workspace and the shared package only.
COPY packages/shared packages/shared
COPY apps/web apps/web

# Build the web Next.js app. NEXT_PUBLIC_API_URL is baked into the bundle
# at build time — Railway exposes service env vars as build args, but Docker
# requires an explicit ARG declaration to surface them inside RUN steps.
WORKDIR /repo/apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Railway sets PORT for us.
EXPOSE 3000
CMD ["npm", "start"]
