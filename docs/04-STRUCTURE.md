# PIÈCE 4 — STRUCTURE DU MONOREPO

**GAMAD Deploy** · organisation physique reflétant les 5 couches

---

## 4.0 — Principe directeur

> **L'arborescence doit se lire comme l'architecture.** En ouvrant un dossier, on
> doit savoir à quelle couche et à quel contrat il répond. Un contributeur trouve
> sa place sans explication orale.

Gestionnaire de monorepo : **pnpm workspaces** (léger). Trois applications, des
packages partagés. *Turborepo gardé en évolution possible (voir `docs/adr/`), non
introduit par anticipation.*

---

## 4.1 — Arborescence racine

```
gamad-deploy/
├── apps/
│   ├── control-plane/          # NestJS — les 5 couches
│   ├── agent/                  # Node — l'agent VPS (C-07)
│   └── web/                    # React + Vite + shadcn — frontend
│
├── packages/
│   ├── contracts/              # ★ SOURCE DE VÉRITÉ : types des 13 contrats
│   ├── config/                 # configs partagées (eslint, tsconfig)
│   └── schema/                 # schéma Drizzle + migrations (Dictionnaire en code)
│
├── docs/                       # ★ GOUVERNANCE : les pièces du kit
│   ├── 01-VISION.md
│   ├── 02-ARCHITECTURE-CONTRATS.md
│   ├── 03-DICTIONNAIRE-CANONIQUE.md
│   ├── 04-STRUCTURE.md
│   ├── 05-CLAUDE-GOUVERNANCE.md
│   ├── 06-PROMPTS-EXECUTION.md
│   └── adr/                    # Architecture Decision Records
│
├── CLAUDE.md                   # ★ gouvernance permanente pour Claude Code
├── CONTRIBUTING.md             # ★ règles pour contributeurs humains
├── CODEOWNERS                  # qui possède quel module
├── README.md
├── pnpm-workspace.yaml
└── package.json
```

Les trois ★ matérialisent la charte : **`packages/contracts` + `docs/` + `CLAUDE.md`
sont la source de vérité**, le code n'en est que l'implémentation.

---

## 4.2 — Intérieur du control-plane (les 5 couches, lisibles)

```
apps/control-plane/src/
├── delivery/                   # COUCHE DELIVERY (C-12)
│   ├── http/                   # contrôleurs REST + validation Zod
│   │   ├── projects.controller.ts
│   │   ├── deployments.controller.ts
│   │   ├── servers.controller.ts
│   │   └── billing.controller.ts
│   ├── ws/                     # gateway WebSocket (suivi temps réel)
│   └── webhooks/               # webhooks paiement + callback agent
│
├── orchestration/              # COUCHE ORCHESTRATION (C-05)
│   ├── pipeline/               # définition de la séquence d'étapes
│   ├── jobs/                   # jobs BullMQ : resolve, provision, migrate, dispatch, health
│   └── queue.module.ts
│
├── domain/                     # COUCHE DOMAIN — NE DÉPEND DE RIEN
│   ├── pdn/                    # C-01 : modèle + validation du PDN
│   ├── source-resolver/        # C-03 : Compiler + Adapter
│   ├── contract-generator/     # C-13 : normalisation gamad.json
│   ├── state-machine/          # C-04 : transitions légales
│   └── billing/                # logique de monétisation pure
│
├── adapters/                   # COUCHE ADAPTERS — REMPLAÇABLES (INV-09)
│   ├── source/                 # github.adapter.ts, lovable, bolt, replit (tous = git)
│   ├── payment/                # payment.provider.ts (interface) + geniuspay.adapter.ts (C-08)
│   ├── vps/                    # vps.provider.ts (interface) + hetzner.adapter.ts (C-09)
│   └── agent/                  # client du protocole agent (C-06)
│
├── persistence/                # COUCHE PERSISTENCE (C-10, C-11)
│   ├── repositories/           # accès données via Drizzle
│   ├── tenancy/                # TenantMiddleware (INV-06)
│   └── audit/                  # écriture INSERT-only + hash
│
├── shared/                     # utilitaires transverses (crypto, hash, errors)
└── main.ts
```

> **Règle d'or matérialisée :** `domain/` n'importe **jamais** `delivery/`,
> `adapters/` ni `persistence/`. Il ne connaît que les types de `packages/contracts`.
> Vérifiable mécaniquement (lint d'architecture).

---

## 4.3 — Intérieur de l'agent

```
apps/agent/src/
├── server.ts                   # endpoint /deploy + /agent/health (C-06)
├── executor/
│   ├── git-checkout.ts
│   ├── docker-compose.ts       # build + up (conteneurisation INV-10)
│   ├── nginx-config.ts         # géré par l'agent, jamais par le repo
│   └── certbot.ts
├── snapshot/                   # snapshot pré-déploiement (rollback INV-08)
├── callback/                   # renvoi des événements au control plane (C-06)
└── watchdog/                   # auto-supervision (C-07)
```

---

## 4.4 — `packages/contracts` (le cœur partagé)

```
packages/contracts/src/
├── pdn.ts                      # C-01 — type PlanDeDeploiementNormalise
├── repo-contract.ts            # C-02 — type ContratRepo + schéma Zod
├── source-resolver.ts          # C-03 — interfaces
├── state-machine.ts            # C-04 — états + transitions
├── agent-protocol.ts           # C-06 — dispatch + callback
├── payment-provider.ts         # C-08 — interface
├── vps-provider.ts             # C-09 — interface
├── contract-generator.ts       # C-13 — interface
└── index.ts
```

Importé par les **trois** apps. Un changement de contrat ici casse la compilation
partout où il n'est pas respecté — la « seule vérité » rendue mécaniquement contraignante.

---

## 4.5 — Gouvernance des contributeurs

**`CONTRIBUTING.md`** pose les règles non négociables :
- Tout contributeur lit `docs/01-VISION.md` (les 10 invariants) avant toute PR.
- On code **contre les contrats** de `packages/contracts`, jamais en les contournant.
- Une modification de contrat exige un **ADR** dans `docs/adr/` + revue.
- Un module = un périmètre isolé. On ne traverse pas les couches.
- Tests obligatoires sur le Domain et l'agent.

**`CODEOWNERS`** attribue chaque dossier à un responsable :
- `domain/` et `packages/contracts/` réservés à l'Architecte.
- Les adaptateurs (`adapters/source/`) ouverts aux contributeurs : ils peuvent
  ajouter le support d'une nouvelle plateforme sans déstabiliser le cœur.

> Un contributeur a une **place claire et bornée** : enrichir un adaptateur, jamais
> toucher au cœur sans contrat ni revue.

---

## 4.6 — Note sur le gestionnaire de monorepo

Démarrage avec **pnpm workspaces seul** : sobre, suffisant pour trois applications,
gère parfaitement le partage de `packages/contracts`. **Turborepo** (cache de build,
orchestration de tâches) est une addition non destructive, à introduire seulement le
jour où les builds deviennent lents — décision à tracer dans un ADR. **Nx** écarté :
complexité prématurée pour ce périmètre.
