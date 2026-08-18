# Root-level Dockerfile for the whole stack. `--target api` builds the backend;
# a `web` target joins it when the Next.js app lands, so one file covers every
# service as SPECS.md requires.

# ---- deps: install once, reuse in both build and runtime layers ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci

# ---- build: compile TypeScript to dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api ./apps/api
RUN npm run build:api

# ---- api: production runtime ----
FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app

# Prune dev dependencies rather than reinstalling, so the image matches the lockfile.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm prune --omit=dev

COPY --from=build /app/apps/api/dist ./apps/api/dist
# Migrations are read from disk at boot, and tsc does not copy .sql files.
COPY apps/api/src/infra/migrations ./apps/api/dist/infra/migrations

# Run unprivileged; the base image ships a `node` user.
USER node
EXPOSE 4000

# `/ready` checks Postgres and Redis, unlike `/health` which is liveness only.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
