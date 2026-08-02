# syntax=docker/dockerfile:1

# ── deps ─────────────────────────────────────────────────────────────────────
# Installs from package-lock.json exactly (npm ci) so the app always builds
# against the same dependency versions as local dev — this is what actually
# prevents the "works locally, breaks on the server" class of TS build error
# (e.g. a stale/partial node_modules missing a package's type declarations).
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
# ── build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"
RUN npm run docs:build && npm run build
RUN rm -rf ./dist/src/generated && cp -r ./src/generated ./dist/src/
# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# ffmpeg: required in-process by fluent-ffmpeg for media processing.
# ca-certificates: outbound HTTPS calls (Resend, Firebase, Fapshi, S3-compatible storage, ...).
# dumb-init: proper PID 1 signal handling so SIGTERM reaches the app for graceful shutdown.
# curl: used by the container HEALTHCHECK / compose healthcheck below.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates dumb-init curl \
  && rm -rf /var/lib/apt/lists/*

# Kept as the full install (not pruned to --omit=dev) so `npx prisma migrate
# deploy` works inside the container without a separate toolchain image.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package.json package-lock.json ./

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs mentora \
  && chown -R mentora:nodejs /app
USER mentora

EXPOSE 8003
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-3000}/health" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/index.js"]
