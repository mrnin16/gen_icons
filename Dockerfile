# Icon Forge — production image
# Uses Node 24 directly so Prisma 7's engine requirement
# (^20.19 || ^22.12 || >=24.0) is satisfied without depending on
# Nixpacks's nixpkgs version of node.
FROM node:24-slim

WORKDIR /app

# Prisma needs OpenSSL for its query engine.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies first to maximize Docker layer cache hits.
# postinstall fires `prisma generate`, which only reads prisma/schema.prisma —
# no DB connection required at build time.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the source and build Next.js.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Railway sets PORT for us; Next.js reads it.
EXPOSE 3000
CMD ["npm", "start"]
