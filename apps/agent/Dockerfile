# ── GAMAD Deploy — agent production image ──────────────────────────────────
# Exécute l'agent TypeScript directement avec tsx (même pattern que control-plane).
# Requiert : AGENT_TOKEN (obligatoire), PORT (défaut 7500), CERTBOT_EMAIL (optionnel).

FROM node:20-alpine

WORKDIR /app

# Outils système requis pour les adaptateurs
RUN apk add --no-cache git docker-cli nginx certbot certbot-nginx

# Répertoires de travail de l'agent
RUN mkdir -p /var/lib/gamad/deployments /var/lib/gamad/snapshots \
    && chmod 700 /var/lib/gamad

# pnpm + tsx globaux
RUN npm install -g pnpm@9.12.3 tsx

# Fichiers workspace pour le cache des layers
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/agent/package.json ./apps/agent/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Sources
COPY packages/contracts/src ./packages/contracts/src
COPY apps/agent/src         ./apps/agent/src
COPY apps/agent/tsconfig.json ./apps/agent/
COPY tsconfig.base.json ./

EXPOSE 7500

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:7500/agent/health || exit 1

CMD ["tsx", "apps/agent/src/main.ts"]
