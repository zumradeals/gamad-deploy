#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# GAMAD Deploy — Script d'installation automatique de production
# Ubuntu 22.04 / 24.04 — accès root requis
#
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/zumradeals/gamad-deploy/cursor/scripts/install.sh | bash
#   wget -O- https://raw.githubusercontent.com/zumradeals/gamad-deploy/cursor/scripts/install.sh | bash
#
# Idempotent : relancer le script sur un serveur déjà configuré ne casse rien.
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Constantes ────────────────────────────────────────────────────────────────
readonly GAMAD_USER="gamad"
readonly INSTALL_DIR="/opt/gamad-deploy"
readonly REPO_URL="https://github.com/zumradeals/gamad-deploy"
readonly REPO_BRANCH="cursor"
readonly COMPOSE_FILE="${INSTALL_DIR}/docker-compose.prod.yml"
readonly ENV_FILE="${INSTALL_DIR}/.env"

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Rapport final ─────────────────────────────────────────────────────────────
declare -A STEP_STATUS   # "ok" | "fail" | "skip"
STEPS_ORDER=()

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[✓]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[⚠]${NC}    $*"; }
log_error()   { echo -e "${RED}[✗]${NC}    $*" >&2; }
log_step()    { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

mark_ok()   { STEP_STATUS["$1"]="ok";   STEPS_ORDER+=("$1"); }
mark_fail() { STEP_STATUS["$1"]="fail"; STEPS_ORDER+=("$1"); }
mark_skip() { STEP_STATUS["$1"]="skip"; STEPS_ORDER+=("$1"); }

# ── Vérifications préliminaires ───────────────────────────────────────────────
check_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    log_error "Ce script doit être exécuté en tant que root (ou via sudo)."
    exit 1
  fi
}

check_os() {
  if ! grep -qiE "ubuntu" /etc/os-release 2>/dev/null; then
    log_warn "Système non-Ubuntu détecté. Le script est conçu pour Ubuntu 22.04/24.04."
  fi
}

# ── Étape 1 : Prérequis système ───────────────────────────────────────────────
install_system_deps() {
  log_step "Étape 1 : Prérequis système"

  log_info "Mise à jour des paquets..."
  apt-get update -qq
  apt-get upgrade -y -qq

  log_info "Installation des outils de base..."
  apt-get install -y -qq curl git ufw fail2ban ca-certificates gnupg lsb-release

  mark_ok "Prérequis système"
  log_success "Prérequis système installés."
}

# ── Étape 2 : Docker Engine (méthode officielle) ──────────────────────────────
install_docker() {
  log_step "Étape 2 : Docker Engine"

  if command -v docker &>/dev/null; then
    log_info "Docker est déjà installé ($(docker --version | head -1)). Ignoré."
    mark_skip "Docker"
    return
  fi

  log_info "Ajout du dépôt Docker officiel..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  log_info "Installation de Docker Engine + Docker Compose v2 plugin..."
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker

  mark_ok "Docker"
  log_success "Docker $(docker --version | head -1) installé."
}

# ── Étape 3 : Utilisateur gamad ───────────────────────────────────────────────
create_gamad_user() {
  log_step "Étape 3 : Utilisateur ${GAMAD_USER}"

  if id "${GAMAD_USER}" &>/dev/null; then
    log_info "L'utilisateur '${GAMAD_USER}' existe déjà. Ignoré."
    mark_skip "Utilisateur gamad"
  else
    useradd -m -s /bin/bash -G docker "${GAMAD_USER}"
    mark_ok "Utilisateur gamad"
    log_success "Utilisateur '${GAMAD_USER}' créé avec accès Docker."
  fi

  # S'assurer que gamad est dans le groupe docker même si l'utilisateur existait
  usermod -aG docker "${GAMAD_USER}" 2>/dev/null || true
}

# ── Étape 4 : Pare-feu UFW ────────────────────────────────────────────────────
configure_firewall() {
  log_step "Étape 4 : Pare-feu UFW"

  if ufw status | grep -q "Status: active"; then
    log_info "UFW est déjà actif."
    mark_skip "Pare-feu UFW"
  else
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp    comment "SSH"
    ufw allow 80/tcp    comment "HTTP"
    ufw allow 443/tcp   comment "HTTPS"
    ufw --force enable
    mark_ok "Pare-feu UFW"
    log_success "Pare-feu UFW configuré (22, 80, 443)."
  fi

  # Fail2ban
  if systemctl is-active --quiet fail2ban; then
    log_info "fail2ban est déjà actif."
  else
    systemctl enable --now fail2ban
    log_success "fail2ban activé."
  fi
}

# ── Étape 5 : Cloner le dépôt ────────────────────────────────────────────────
clone_repo() {
  log_step "Étape 5 : Cloner le dépôt"

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log_info "Le dépôt existe déjà dans ${INSTALL_DIR}. Mise à jour..."
    git -C "${INSTALL_DIR}" fetch origin "${REPO_BRANCH}"
    git -C "${INSTALL_DIR}" checkout "${REPO_BRANCH}"
    git -C "${INSTALL_DIR}" pull --ff-only origin "${REPO_BRANCH}"
    mark_skip "Clone dépôt"
    log_success "Dépôt mis à jour sur la branche ${REPO_BRANCH}."
  else
    log_info "Clonage de ${REPO_URL} dans ${INSTALL_DIR}..."
    git clone --branch "${REPO_BRANCH}" --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
    chown -R "${GAMAD_USER}:${GAMAD_USER}" "${INSTALL_DIR}"
    mark_ok "Clone dépôt"
    log_success "Dépôt cloné dans ${INSTALL_DIR}."
  fi
}

# ── Étape 6 : Générer le .env de production ───────────────────────────────────
generate_env() {
  log_step "Étape 6 : Génération du .env"

  if [[ -f "${ENV_FILE}" ]]; then
    log_info "${ENV_FILE} existe déjà. Ignoré (les secrets existants sont conservés)."
    mark_skip "Génération .env"
    return
  fi

  if [[ ! -f "${INSTALL_DIR}/.env.example" ]]; then
    log_error ".env.example introuvable dans ${INSTALL_DIR}. Impossible de générer .env."
    mark_fail "Génération .env"
    return
  fi

  # Générer les secrets automatiquement
  local jwt_secret encryption_key session_secret
  jwt_secret=$(openssl rand -hex 32)
  encryption_key=$(openssl rand -hex 32)
  session_secret=$(openssl rand -hex 32)

  cp "${INSTALL_DIR}/.env.example" "${ENV_FILE}"

  # Remplacer les placeholders générés
  sed -i "s|GENERATED_BY_INSTALL_SCRIPT|${jwt_secret}|1"  "${ENV_FILE}"
  sed -i "s|GENERATED_BY_INSTALL_SCRIPT|${encryption_key}|1" "${ENV_FILE}"
  sed -i "s|GENERATED_BY_INSTALL_SCRIPT|${session_secret}|1" "${ENV_FILE}"

  chmod 600 "${ENV_FILE}"
  chown "${GAMAD_USER}:${GAMAD_USER}" "${ENV_FILE}"

  mark_ok "Génération .env"
  log_success ".env généré avec les secrets cryptographiques."
  log_warn "IMPORTANT : éditez ${ENV_FILE} pour renseigner les variables manquantes."
}

# ── Étape 7 : Construire et démarrer les conteneurs ───────────────────────────
start_containers() {
  log_step "Étape 7 : Build et démarrage Docker"

  # Vérifier que les variables obligatoires sont définies
  local env_source="${ENV_FILE}"
  if [[ ! -f "${env_source}" ]]; then
    log_error "${ENV_FILE} introuvable. Exécutez d'abord l'étape de génération."
    mark_fail "Docker build"
    return
  fi

  # Valider que POSTGRES_PASSWORD est renseigné
  local pg_pass
  pg_pass=$(grep -E "^POSTGRES_PASSWORD=" "${env_source}" | cut -d= -f2-)
  if [[ -z "${pg_pass}" || "${pg_pass}" == "CHANGE_ME"* ]]; then
    log_error "POSTGRES_PASSWORD n'est pas configuré dans ${ENV_FILE}."
    log_error "Éditez ${ENV_FILE} puis relancez ce script."
    mark_fail "Docker build"
    return
  fi

  log_info "Construction des images Docker (peut prendre plusieurs minutes)..."
  docker compose -f "${COMPOSE_FILE}" build --progress=plain

  log_info "Démarrage des services..."
  docker compose -f "${COMPOSE_FILE}" up -d

  mark_ok "Docker build"
  log_success "Services Docker démarrés."
}

# ── Étape 8 : Attendre PostgreSQL + lancer les migrations ─────────────────────
run_migrations() {
  log_step "Étape 8 : Migrations Drizzle"

  log_info "Attente de la santé de PostgreSQL (max 60s)..."
  local max_attempts=12
  local attempt=0
  until docker compose -f "${COMPOSE_FILE}" exec -T postgres \
      pg_isready -U gamad -d gamad &>/dev/null; do
    attempt=$((attempt + 1))
    if [[ "${attempt}" -ge "${max_attempts}" ]]; then
      log_error "PostgreSQL n'est pas prêt après $((max_attempts * 5))s."
      mark_fail "Migrations"
      return
    fi
    log_info "PostgreSQL pas encore prêt... tentative ${attempt}/${max_attempts}"
    sleep 5
  done
  log_success "PostgreSQL est prêt."

  log_info "Lancement des migrations Drizzle..."
  docker compose -f "${COMPOSE_FILE}" exec -T control-plane \
    pnpm --filter @gamad/schema run db:migrate

  mark_ok "Migrations"
  log_success "Migrations Drizzle appliquées avec succès."
}

# ── Étape 9 : Vérification de santé du control-plane ─────────────────────────
check_health() {
  log_step "Étape 9 : Vérification de santé"

  log_info "Attente du démarrage du control-plane (max 60s)..."
  local max_attempts=12
  local attempt=0
  until curl -sf http://localhost/api/health &>/dev/null; do
    attempt=$((attempt + 1))
    if [[ "${attempt}" -ge "${max_attempts}" ]]; then
      log_error "Le control-plane ne répond pas sur /api/health après $((max_attempts * 5))s."
      log_warn "Vérifiez les logs : docker compose -f ${COMPOSE_FILE} logs control-plane"
      mark_fail "Health check"
      return
    fi
    log_info "En attente du control-plane... tentative ${attempt}/${max_attempts}"
    sleep 5
  done

  mark_ok "Health check"
  log_success "Control-plane répond sur /api/health ✓"
}

# ── Étape 10 : SSL optionnel ──────────────────────────────────────────────────
setup_ssl() {
  log_step "Étape 10 : SSL / Let's Encrypt"

  # Lire DOMAIN depuis .env
  local domain certbot_email
  domain=$(grep -E "^DOMAIN=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'")
  certbot_email=$(grep -E "^CERTBOT_EMAIL=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'")

  if [[ -z "${domain}" ]]; then
    log_info "DOMAIN non renseigné dans .env — SSL ignoré."
    mark_skip "SSL"
    return
  fi

  if [[ -z "${certbot_email}" || "${certbot_email}" == "admin@yourdomain.com" ]]; then
    log_warn "CERTBOT_EMAIL non configuré. Utilisez --register-unsafely-without-email ou renseignez CERTBOT_EMAIL."
    certbot_email="webmaster@${domain}"
  fi

  log_info "Installation de certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx

  log_info "Demande de certificat pour ${domain}..."
  certbot --nginx \
    -d "${domain}" \
    --non-interactive \
    --agree-tos \
    -m "${certbot_email}" \
    --redirect || {
      log_warn "certbot a échoué. Vérifiez que ${domain} pointe vers ce serveur."
      mark_fail "SSL"
      return
    }

  # Renouvellement automatique via systemd timer (présent par défaut sur Ubuntu 22.04+)
  if systemctl is-enabled certbot.timer &>/dev/null; then
    log_success "Renouvellement automatique certbot (systemd timer) déjà actif."
  else
    # Fallback : cron
    echo "0 3 * * * root certbot renew --quiet --post-hook 'docker compose -f ${COMPOSE_FILE} exec nginx nginx -s reload'" \
      > /etc/cron.d/certbot-renew
    log_success "Renouvellement certbot configuré via cron."
  fi

  mark_ok "SSL"
  log_success "Certificat SSL obtenu pour ${domain}."
}

# ── Rapport final ─────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}           GAMAD Deploy — Rapport d'installation${NC}"
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"

  for step in "${STEPS_ORDER[@]}"; do
    case "${STEP_STATUS[${step}]}" in
      ok)   echo -e "  ${GREEN}✓${NC}  ${step}" ;;
      fail) echo -e "  ${RED}✗${NC}  ${step}" ;;
      skip) echo -e "  ${YELLOW}↩${NC}  ${step} (déjà configuré)" ;;
    esac
  done

  echo ""

  # URL d'accès
  local domain
  domain=$(grep -E "^DOMAIN=" "${ENV_FILE}" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [[ -n "${domain}" ]]; then
    echo -e "  ${GREEN}${BOLD}URL :${NC} https://${domain}"
  else
    local server_ip
    server_ip=$(curl -sf https://api.ipify.org || hostname -I | awk '{print $1}')
    echo -e "  ${GREEN}${BOLD}URL :${NC} http://${server_ip}"
  fi

  echo ""

  # Variables encore à configurer
  local missing_vars=()
  while IFS= read -r line; do
    [[ "${line}" =~ ^#.*$ || -z "${line}" ]] && continue
    local key value
    key=$(echo "${line}" | cut -d= -f1)
    value=$(echo "${line}" | cut -d= -f2-)
    if [[ "${value}" == "CHANGE_ME"* ]]; then
      missing_vars+=("${key}")
    fi
  done < "${ENV_FILE}"

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "  ${YELLOW}${BOLD}⚠ Variables à configurer dans ${ENV_FILE} :${NC}"
    for v in "${missing_vars[@]}"; do
      echo -e "    ${YELLOW}→${NC}  ${v}"
    done
    echo ""
    echo -e "  Après modification : ${BOLD}docker compose -f ${COMPOSE_FILE} up -d${NC}"
    echo ""
  fi

  echo -e "  ${BOLD}Logs :${NC}  docker compose -f ${COMPOSE_FILE} logs -f"
  echo -e "  ${BOLD}Stop :${NC}  docker compose -f ${COMPOSE_FILE} down"
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"
}

# ── Point d'entrée principal ──────────────────────────────────────────────────
main() {
  echo -e "${BOLD}${GREEN}"
  echo "   ██████╗  █████╗ ███╗   ███╗ █████╗ ██████╗"
  echo "  ██╔════╝ ██╔══██╗████╗ ████║██╔══██╗██╔══██╗"
  echo "  ██║  ███╗███████║██╔████╔██║███████║██║  ██║"
  echo "  ██║   ██║██╔══██║██║╚██╔╝██║██╔══██║██║  ██║"
  echo "  ╚██████╔╝██║  ██║██║ ╚═╝ ██║██║  ██║██████╔╝"
  echo "   ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝"
  echo -e "${NC}${BOLD}  Deploy — Installation de production${NC}"
  echo ""

  check_root
  check_os

  install_system_deps
  install_docker
  create_gamad_user
  configure_firewall
  clone_repo
  generate_env
  start_containers
  run_migrations
  check_health
  setup_ssl

  print_summary
}

main "$@"
