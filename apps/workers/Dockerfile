FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY apps/workers/package.json ./apps/workers/
COPY apps/web/package.json ./apps/web/
COPY package.json package-lock.json ./
RUN npm ci --workspace=apps/workers

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/workers ./apps/workers
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=apps/workers

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

COPY --from=builder /app/node_modules ./node_modules
# package.json carries "type": "module"; without it Node parses dist/ as CommonJS
COPY --from=builder /app/apps/workers/package.json ./apps/workers/package.json
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist

USER worker
CMD ["node", "apps/workers/dist/index.js"]
