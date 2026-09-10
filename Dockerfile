# ════════════════════════════════════════════════════════
# Chalk — Multi-stage Dockerfile (monolithic image)
# Bundles: frontend (static) + backend (Express) + worker (BullMQ)
# ════════════════════════════════════════════════════════

# ─── Stage 1: Install dependencies ─────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json tsconfig.base.json ./

# Copy all package.json files for workspace resolution
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/worker/package.json packages/worker/
COPY packages/frontend/package.json packages/frontend/

# Install all dependencies (including devDependencies for build and Linux native binaries)
RUN npm install --ignore-scripts && npm i --no-save @rolldown/binding-linux-x64-gnu @esbuild/linux-x64 lightningcss-linux-x64-gnu @img/sharp-linux-x64

# ─── Stage 2: Build everything ─────────────────────────
FROM node:22-slim AS build

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ packages/

# Build order: shared → backend → worker → frontend
RUN npm run build -w packages/shared && \
    npm run build -w packages/backend && \
    npm run build -w packages/worker && \
    npm run build -w packages/frontend

# ─── Stage 3: Production runtime ──────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json tsconfig.base.json ./

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built packages from build stage
COPY --from=build /app/packages ./packages

# Copy entrypoint script
COPY docker/start.sh /app/docker/start.sh
RUN chmod +x /app/docker/start.sh

# Create uploads directory for local storage
RUN mkdir -p /app/uploads

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PROVIDER=local

EXPOSE 3001

ENTRYPOINT ["/app/docker/start.sh"]
