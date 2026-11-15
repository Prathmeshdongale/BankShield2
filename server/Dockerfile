# ──────────────────────────────────────────────────────────────────────────────
# BankShield Backend — Express API Dockerfile (Production)
# Target: Render.com
# ──────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Production image ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package*.json ./

# Create uploads directory
RUN mkdir -p /app/uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
