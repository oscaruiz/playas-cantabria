# ---- build ----
FROM --platform=$TARGETPLATFORM node:16-bullseye AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY firebase ./firebase
COPY data ./data
RUN npm run build
RUN npm prune --omit=dev

# ---- runner ----
FROM --platform=$TARGETPLATFORM node:16-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY data ./data
EXPOSE 4000
CMD ["node", "dist/src/index.js"]
