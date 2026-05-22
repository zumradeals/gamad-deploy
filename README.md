# GAMAD Deploy

> Transforme un dépôt Git en application en production sur un VPS que tu possèdes —
> de façon **répétable, auditable et souveraine**.

GAMAD Deploy est une plateforme SaaS de déploiement automatisé conçue pour les PME et
développeurs africains. Connecte un dépôt (GitHub, ou un export Lovable / Bolt /
Replit), choisis un serveur que tu possèdes, et la plateforme déploie, sécurise et
supervise ton application — sans dépendre d'une plateforme propriétaire étrangère.

## Principe central

```
Source (Git / template / Lovable / Bolt…) 
   → Plan de Déploiement Normalisé (PDN) 
      → Exécution par un agent sur ton VPS
```

L'exécuteur ne connaît jamais l'origine : toute source est traduite en un plan
normalisé, versionné et figé avant exécution.

## Documentation (à lire dans l'ordre)

1. [`docs/01-VISION.md`](docs/01-VISION.md) — Vision & 10 invariants fondateurs
2. [`docs/02-ARCHITECTURE-CONTRATS.md`](docs/02-ARCHITECTURE-CONTRATS.md) — 13 contrats
3. [`docs/03-DICTIONNAIRE-CANONIQUE.md`](docs/03-DICTIONNAIRE-CANONIQUE.md) — 17 tables
4. [`docs/04-STRUCTURE.md`](docs/04-STRUCTURE.md) — Structure du monorepo
5. [`docs/05-CLAUDE-GOUVERNANCE.md`](docs/05-CLAUDE-GOUVERNANCE.md) — Gouvernance
6. [`docs/06-PROMPTS-EXECUTION.md`](docs/06-PROMPTS-EXECUTION.md) — Feuille de route P-00 → P-12

Pour contribuer : [`CONTRIBUTING.md`](CONTRIBUTING.md).
Pour Claude Code : [`CLAUDE.md`](CLAUDE.md) (lu à chaque session).

## Stack

TypeScript de bout en bout · NestJS · BullMQ + Redis · PostgreSQL · Drizzle ·
agent Node.js (Docker + nginx + certbot) · React + Vite + shadcn · pnpm workspaces.

## État

Conception terminée (kit documentaire complet). Implémentation à dérouler via les
prompts P-00 → P-12 dans Claude Code.

## Licence

Propriété de GAMAD Technologie. Tous droits réservés.
