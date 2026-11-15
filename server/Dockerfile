FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Expose and run
EXPOSE 5000
CMD ["node", "src/server.js"]
