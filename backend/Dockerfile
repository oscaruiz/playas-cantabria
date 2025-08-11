# ---- Base builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci

# Copy sources
COPY tsconfig.json ./
COPY src ./src
COPY firebase ./firebase
COPY data ./data

# Build
RUN npm run build

# ---- Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built artifacts and necessary runtime files
COPY --from=builder /app/dist ./dist
COPY data ./data

# Expose port
EXPOSE 4000

# Default envs (can be overridden at runtime)
ENV NODE_ENV=production \
    PORT=4000

# Start the compiled local server entry
CMD ["node", "dist/src/index.js"]
