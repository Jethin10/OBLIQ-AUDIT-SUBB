# OBLIQ Audit — all-in-one container (Next.js + embedded SQLite).
# node:sqlite is unflagged from Node 23.4, so we use a current Node image.
# Works on Railway, Render, Fly.io, or any Docker host with a persistent volume
# mounted at /app/data (that's where audit.db and uploaded files live).

FROM node:25-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:25-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next needs a larger heap to compile the landing page bundle.
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:25-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# SQLite lives here. Mount a volume at /app/data so data survives restarts.
ENV DATA_DIR=/app/data

# Copy only what production needs.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next-build ./.next-build
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create the data dir and seed the demo data (idempotent) at container start.
RUN mkdir -p /app/data
EXPOSE 3000
ENV PORT=3000

# Seed only on first boot, then start. See scripts/start-production.mjs.
CMD ["node", "scripts/start-production.mjs"]
