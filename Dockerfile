# ==============================================================================
# Base stage
# ==============================================================================
FROM node:22-alpine AS base

WORKDIR /usr/src/app

# Install build tools for native C++ modules (e.g. argon2)
RUN apk add --no-cache python3 make g++

# ==============================================================================
# Development stage (used for docker-compose dev with hot-reload)
# ==============================================================================
FROM base AS development

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000 50052

CMD ["npm", "run", "start:dev"]

# ==============================================================================
# Builder stage (compiles TypeScript to dist)
# ==============================================================================
FROM base AS builder

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Prune dev dependencies to leave only production dependencies
RUN npm prune --omit=dev

# ==============================================================================
# Production stage (lightweight production image)
# ==============================================================================
FROM node:22-alpine AS production

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy non-root user node configuration
USER node

# Copy production node_modules and built dist artifacts
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

EXPOSE 3000 50052

CMD ["node", "dist/main.js"]