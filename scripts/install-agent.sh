#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# GAMAD Deploy — Script d'installation de l'agent sur VPS
#
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/<org>/gamad-deploy/main/scripts/install-agent.sh \
#     | AGENT_TOKEN=<token> bash
#
# Variables d'environnement :
#   AGENT_TOKEN      (obligatoire) — token affiché lors de l'enregistrement du serveur
#   PORT             (optionnel, défaut 7500)
#   CERTBOT_EMAIL    (optionnel, défaut ops@gamad.io)
#   GAMAD_IMAGE      (optionnel) — image Docker à utiliser
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GAMAD_IMAGE="${GAMAD_IMAGE:-ghcr.io/zumradeals/gamad-deploy/agent:latest}"
PORT="${PORT:-7500}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-ops@gamad.io}"

if [ -z "${AGENT_TOKEN:-}" ]; then
  echo "❌  AGENT_TOKEN est requis." >&2
  echo "    Usage : AGENT_TOKEN=<token> bash install-agent.sh" >&2
  exit 1
fi

# ── Vérifications préalables ───────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || {
  echo "❌  Docker n'est pas installé. Installez Docker avant de continuer." >&2
  exit 1
}

echo "🚀 Installation de l'agent GAMAD Deploy..."
echo "   Image    : ${GAMAD_IMAGE}"
echo "   Port     : ${PORT}"

# ── Répertoires persistants ────────────────────────────────────────────────
mkdir -p /var/lib/gamad/deployments /var/lib/gamad/snapshots
chmod 700 /var/lib/gamad

# ── Arrêt du conteneur existant (mise à jour) ─────────────────────────────
docker stop gamad-agent 2>/dev/null || true
docker rm gamad-agent 2>/dev/null || true

# ── Récupération de la nouvelle image ─────────────────────────────────────
docker pull "${GAMAD_IMAGE}"

# ── Démarrage du conteneur ────────────────────────────────────────────────
docker run -d \
  --name gamad-agent \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  -e "AGENT_TOKEN=${AGENT_TOKEN}" \
  -e "PORT=${PORT}" \
  -e "CERTBOT_EMAIL=${CERTBOT_EMAIL}" \
  -v /var/lib/gamad:/var/lib/gamad \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc/nginx:/etc/nginx \
  -v /etc/letsencrypt:/etc/letsencrypt \
  --privileged \
  "${GAMAD_IMAGE}"

# ── Vérification santé ────────────────────────────────────────────────────
echo "⏳ Attente du démarrage de l'agent..."
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${PORT}/agent/health" >/dev/null 2>&1; then
    echo "✅ Agent GAMAD démarré avec succès sur le port ${PORT}."
    echo "   Testez depuis le dashboard GAMAD → bouton 'Tester la connexion'."
    exit 0
  fi
  sleep 2
done

echo "⚠️  L'agent a démarré mais ne répond pas encore sur /agent/health."
echo "   Vérifiez les logs : docker logs gamad-agent"
exit 1
