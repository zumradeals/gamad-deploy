# Scripts d'installation GAMAD Deploy

## Installation rapide sur un VPS vierge

```bash
# Via curl
curl -fsSL https://raw.githubusercontent.com/zumradeals/gamad-deploy/cursor/scripts/install.sh | bash

# Via wget
wget -O- https://raw.githubusercontent.com/zumradeals/gamad-deploy/cursor/scripts/install.sh | bash
```

**Prérequis :** Ubuntu 22.04 ou 24.04, accès root SSH.

---

## Ce que fait `install.sh`

| Étape | Action |
|-------|--------|
| 1 | `apt update` + installation de `curl`, `git`, `ufw`, `fail2ban` |
| 2 | Docker Engine (dépôt officiel) + Docker Compose v2 plugin |
| 3 | Création de l'utilisateur `gamad` avec accès Docker |
| 4 | Pare-feu UFW (ports 22, 80, 443) + fail2ban |
| 5 | Clone de `https://github.com/zumradeals/gamad-deploy` → `/opt/gamad-deploy` |
| 6 | Génération du `.env` avec les secrets cryptographiques |
| 7 | `docker compose build` + `docker compose up -d` |
| 8 | Attente de PostgreSQL + migrations Drizzle |
| 9 | Vérification `GET /api/health` |
| 10 | SSL Let's Encrypt via certbot (si `DOMAIN` est renseigné) |

Le script est **idempotent** : le relancer sur un serveur déjà configuré ne casse rien (les étapes déjà faites sont ignorées).

---

## Configuration après installation

Le fichier `/opt/gamad-deploy/.env` est généré automatiquement. Plusieurs variables **doivent** être renseignées manuellement avant que l'application soit pleinement fonctionnelle :

```bash
nano /opt/gamad-deploy/.env
```

Variables à configurer :

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Mot de passe fort pour PostgreSQL |
| `AGENT_TOKEN_SALT` | Sel aléatoire pour le hachage des tokens agent (≥ 32 caractères) |
| `GENIUSPAY_API_KEY` | Clé API GeniusPay (module billing) |
| `GENIUSPAY_API_SECRET` | Secret API GeniusPay |
| `GENIUSPAY_WEBHOOK_SECRET` | Secret de validation des webhooks GeniusPay |
| `DOMAIN` | Domaine pointant vers ce serveur (optionnel, active le SSL) |
| `CERTBOT_EMAIL` | E-mail pour les notifications Let's Encrypt |

Après modification du `.env` :

```bash
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml up -d
```

---

## Commandes utiles en production

```bash
# Voir les logs en temps réel
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml logs -f

# Logs d'un service spécifique
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml logs -f control-plane

# Redémarrer un service
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml restart control-plane

# Arrêter tous les services
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml down

# Mettre à jour l'application
cd /opt/gamad-deploy
git pull origin cursor
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Relancer les migrations après une mise à jour
docker compose -f docker-compose.prod.yml exec control-plane \
  pnpm --filter @gamad/schema run db:migrate
```

---

## Structure des fichiers créés

```
/opt/gamad-deploy/
├── .env                         # Variables d'environnement (généré)
├── docker-compose.prod.yml      # Stack Docker de production
├── nginx/
│   └── nginx.prod.conf          # Reverse proxy nginx
├── apps/
│   ├── control-plane/Dockerfile # Image NestJS
│   └── web/Dockerfile           # Image React (build Vite + nginx)
└── scripts/
    └── install.sh               # Ce script
```

---

## Résolution de problèmes

**PostgreSQL ne démarre pas :**
```bash
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml logs postgres
```
Vérifiez que `POSTGRES_PASSWORD` est défini dans `.env`.

**Le control-plane crashe au démarrage :**
```bash
docker compose -f /opt/gamad-deploy/docker-compose.prod.yml logs control-plane
```
Variables typiquement manquantes : `JWT_SECRET`, `DATABASE_URL`, `REDIS_HOST`.

**Certbot échoue :**
Vérifiez que `DOMAIN` pointe bien vers l'IP de ce serveur et que le port 80 est accessible depuis Internet.
