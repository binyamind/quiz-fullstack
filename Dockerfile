# Root-level Dockerfile for the whole stack. `--target api` or `--target web`.

# ---- deps: install once, reuse in both build and runtime layers ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# ---- build-api: compile TypeScript to dist/ ----
FROM node:22-alpine AS build-api
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api ./apps/api
RUN npm run build:api

# ---- build-web: Next.js standalone bundle ----
FROM node:22-alpine AS build-web
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm run build:web

# ---- api: production runtime ----
FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm prune --omit=dev

COPY --from=build-api /app/apps/api/dist ./apps/api/dist
COPY apps/api/src/infra/migrations ./apps/api/dist/infra/migrations

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]

# ---- web: Next.js standalone runtime ----
FROM node:22-alpine AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build-web /app/apps/web/.next/standalone ./
COPY --from=build-web /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build-web /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
