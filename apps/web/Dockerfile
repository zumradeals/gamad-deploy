# ── GAMAD Deploy — web production image ────────────────────────────────────
# Stage 1: build the Vite SPA
# Stage 2: serve the static files with nginx

FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.12.3

# Workspace manifests (layer cache)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/schema/package.json    ./packages/schema/
COPY apps/web/package.json           ./apps/web/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Source files needed for the web build
COPY packages/contracts/src ./packages/contracts/src
COPY packages/schema/src    ./packages/schema/src
COPY apps/web/src           ./apps/web/src
COPY apps/web/public        ./apps/web/public
COPY apps/web/index.html    ./apps/web/
COPY apps/web/vite.config.ts        ./apps/web/
COPY apps/web/tsconfig.json         ./apps/web/
COPY apps/web/tsconfig.app.json     ./apps/web/ 2>/dev/null || true
COPY apps/web/tailwind.config.*     ./apps/web/ 2>/dev/null || true
COPY apps/web/postcss.config.*      ./apps/web/ 2>/dev/null || true
COPY tsconfig.base.json ./

RUN pnpm --filter @gamad/web run build

# Stage 2: nginx serves the built SPA
FROM nginx:1.27-alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA fallback: all routes return index.html so React Router works
COPY apps/web/nginx.spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
