# ──────────────────────────────────────────────────────────────────────────────
# BankShield Backend — Express API Dockerfile (Production)
# Target: Render.com
#
# IMPORTANT: Set Render's Docker Context to repo root (.) and Dockerfile path
# to ./server/Dockerfile
# ──────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS builder
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

# ── Production image ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules

COPY server/src/ ./src/
COPY server/package*.json ./

RUN mkdir -p /app/uploads

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
