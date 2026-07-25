FROM node:24-alpine AS base

# Install dependencies layer
FROM base AS deps
WORKDIR /app
COPY apps/web/package.json ./apps/web/
COPY apps/workers/package.json ./apps/workers/
COPY package.json package-lock.json ./
RUN npm ci --workspace=apps/web

# Build layer
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY prisma ./prisma

# npm workspaces can place a dependency in the workspace's own node_modules
# instead of hoisting it to the root (next is nested under apps/web/node_modules
# per package-lock.json). The COPY above overwrites apps/web with plain source,
# so the workspace-local node_modules from the deps stage must be restored after.
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Tailwind CSS v4 ships platform-specific native bindings via optional deps.
# package-lock.json generated on Windows omits the Linux binary; rebuild restores it.
RUN npm rebuild --workspace=apps/web

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=apps/web

# Production layer
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
