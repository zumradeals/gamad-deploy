# ── GAMAD Deploy — control-plane production image ──────────────────────────
# Uses tsx (TypeScript executor) to run the NestJS app directly from source.
# The monorepo uses moduleResolution:Bundler + workspace: packages exposed as
# TypeScript source, so tsx is the simplest correct executor without requiring
# a separate compile step or build-specific tsconfig.

FROM node:20-alpine

WORKDIR /app

# Install pnpm and tsx globally (tsx stays in the image layer, not the workspace)
RUN npm install -g pnpm@9.12.3 tsx

# Copy workspace manifest files first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for all relevant packages
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/schema/package.json     ./packages/schema/
COPY apps/control-plane/package.json  ./apps/control-plane/

# Install dependencies (frozen — reproducible)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source files
COPY packages/contracts/src   ./packages/contracts/src
COPY packages/schema/src      ./packages/schema/src
COPY packages/schema/drizzle.config.ts ./packages/schema/
COPY packages/schema/migrations ./packages/schema/migrations
COPY apps/control-plane/src   ./apps/control-plane/src
COPY apps/control-plane/tsconfig.json ./apps/control-plane/
COPY tsconfig.base.json ./

EXPOSE 3000

# --tsconfig ensures esbuild picks up experimentalDecorators + emitDecoratorMetadata
CMD ["tsx", "--tsconfig", "apps/control-plane/tsconfig.json", "apps/control-plane/src/main.ts"]
