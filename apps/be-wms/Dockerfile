# ==============================================================================
# Stage 1: Dependencies — Install only production + workspace deps
# ==============================================================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for the target app AND its workspace dependencies
COPY apps/be-wms/package.json ./apps/be-wms/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install all dependencies (dev + prod) for the build stage
RUN pnpm install --frozen-lockfile

# ==============================================================================
# Stage 2: Builder — Compile TypeScript
# ==============================================================================
FROM deps AS builder

WORKDIR /app

# Copy source code for the app and its workspace dependencies
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/tsconfig/ ./packages/tsconfig/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY apps/be-wms/ ./apps/be-wms/

# Build the backend application
RUN pnpm --filter @bduck/be-wms build

# ==============================================================================
# Stage 3: Runner — Production-only image
# ==============================================================================
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

ENV NODE_ENV=production

# Use pnpm deploy to create a self-contained production bundle
# This copies only the production deps (no devDependencies) into /app/deploy
COPY --from=builder /app/ /app/
RUN pnpm --filter @bduck/be-wms deploy --prod /app/deploy

# Start fresh with only the deployed output
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy the pruned deploy output
COPY --from=runner /app/deploy/ ./
# Copy compiled JS from the builder
COPY --from=builder /app/apps/be-wms/dist/ ./dist/

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs
USER expressjs

EXPOSE 4000

CMD ["node", "dist/index.js"]
