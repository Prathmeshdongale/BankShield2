# ──────────────────────────────────────────────────────────────────────────────
# BankShield Frontend — React + Vite Dockerfile (for local CI testing)
# Production deployment: Vercel (Jenkins triggers Vercel CLI)
# ──────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Preview server (for CI smoke testing) ────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --spider -q http://localhost:4173/ || exit 1

CMD ["serve", "-s", "dist", "-l", "4173"]
