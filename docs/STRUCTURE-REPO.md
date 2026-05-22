# STRUCTURE DU REPO — GAMAD Deploy

Ce document montre **exactement** où placer chaque fichier dans le repo
`zumradeals/gamad-deploy`.

Il distingue deux ensembles :
- **[KIT]** — les fichiers de documentation livrés maintenant (à placer tels quels).
- **[P-00]** — les dossiers/fichiers de code que Claude Code créera lors du prompt P-00
  (montrés ici pour que tu visualises la cible finale ; ne les crée pas à la main).

---

## Arborescence cible complète

```
gamad-deploy/
│
├── CLAUDE.md                                   [KIT] ← racine
├── CONTRIBUTING.md                             [KIT] ← racine
├── CODEOWNERS                                  [KIT] ← racine
├── README.md                                   [KIT] ← racine
│
├── docs/                                       [KIT]
│   ├── 01-VISION.md                            [KIT]
│   ├── 02-ARCHITECTURE-CONTRATS.md             [KIT]
│   ├── 03-DICTIONNAIRE-CANONIQUE.md            [KIT]
│   ├── 04-STRUCTURE.md                         [KIT]
│   ├── 05-CLAUDE-GOUVERNANCE.md                [KIT]
│   ├── 06-PROMPTS-EXECUTION.md                 [KIT]
│   ├── STRUCTURE-REPO.md                       [KIT] ← ce fichier
│   └── adr/
│       └── 0001-stack-typescript.md            [KIT]
│
├── pnpm-workspace.yaml                         [P-00]
├── package.json                                [P-00]
├── tsconfig.base.json                          [P-00]
├── .gitignore                                  [P-00]
│
├── .github/
│   └── workflows/
│       └── ci.yml                              [P-00] ← lint + typecheck
│
├── packages/
│   ├── contracts/                              [P-00] ← SOURCE DE VÉRITÉ
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── pdn.ts                           # C-01
│   │       ├── repo-contract.ts                 # C-02
│   │       ├── source-resolver.ts               # C-03
│   │       ├── state-machine.ts                 # C-04
│   │       ├── agent-protocol.ts                # C-06
│   │       ├── payment-provider.ts              # C-08
│   │       ├── vps-provider.ts                  # C-09
│   │       ├── contract-generator.ts            # C-13
│   │       └── index.ts
│   │
│   ├── config/                                 [P-00]
│   │   ├── eslint/
│   │   └── tsconfig/
│   │
│   └── schema/                                 [P-01] ← Drizzle (17 tables)
│       ├── package.json
│       └── src/
│           ├── schema.ts
│           └── migrations/
│
├── apps/
│   ├── control-plane/                          [P-00 squelette → P-02+ rempli]
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── delivery/                        # COUCHE DELIVERY (C-12)
│   │       │   ├── http/
│   │       │   ├── ws/
│   │       │   └── webhooks/
│   │       ├── orchestration/                   # COUCHE ORCHESTRATION (C-05)
│   │       │   ├── pipeline/
│   │       │   ├── jobs/
│   │       │   └── queue.module.ts
│   │       ├── domain/                          # COUCHE DOMAIN (ne dépend de rien)
│   │       │   ├── pdn/                          # C-01
│   │       │   ├── source-resolver/             # C-03
│   │       │   ├── contract-generator/          # C-13
│   │       │   ├── state-machine/               # C-04
│   │       │   └── billing/
│   │       ├── adapters/                         # COUCHE ADAPTERS (INV-09)
│   │       │   ├── source/                       # github, lovable, bolt, replit
│   │       │   ├── payment/                       # geniuspay (C-08)
│   │       │   ├── vps/                            # hetzner (C-09)
│   │       │   └── agent/                          # client protocole agent (C-06)
│   │       ├── persistence/                       # COUCHE PERSISTENCE (C-10, C-11)
│   │       │   ├── repositories/
│   │       │   ├── tenancy/                        # TenantMiddleware (INV-06)
│   │       │   └── audit/                          # INSERT-only + hash
│   │       ├── shared/
│   │       └── main.ts
│   │
│   ├── agent/                                   [P-04]
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts                         # /deploy + /agent/health (C-06)
│   │       ├── executor/
│   │       │   ├── git-checkout.ts
│   │       │   ├── docker-compose.ts             # INV-10
│   │       │   ├── nginx-config.ts
│   │       │   └── certbot.ts
│   │       ├── snapshot/                          # rollback (INV-08)
│   │       ├── callback/                          # C-06
│   │       └── watchdog/                          # C-07
│   │
│   └── web/                                     [P-10]
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── pages/
│           ├── components/
│           └── main.tsx
```

---

## Résumé : ce que tu places maintenant (les 12 fichiers du KIT)

| Fichier | Emplacement dans le repo |
|---|---|
| `CLAUDE.md` | racine |
| `CONTRIBUTING.md` | racine |
| `CODEOWNERS` | racine |
| `README.md` | racine |
| `01-VISION.md` | `docs/` |
| `02-ARCHITECTURE-CONTRATS.md` | `docs/` |
| `03-DICTIONNAIRE-CANONIQUE.md` | `docs/` |
| `04-STRUCTURE.md` | `docs/` |
| `05-CLAUDE-GOUVERNANCE.md` | `docs/` |
| `06-PROMPTS-EXECUTION.md` | `docs/` |
| `STRUCTURE-REPO.md` | `docs/` |
| `0001-stack-typescript.md` | `docs/adr/` |

Tout le reste (`apps/`, `packages/`, configs, CI) est créé par Claude Code au
prompt **P-00**. Ne le crée pas à la main : laisse l'outil le générer en lisant le
`CLAUDE.md` et la Pièce 6.

---

## Procédure de mise en place

1. Décompresse l'archive `gamad-deploy-kit.zip` : elle reproduit déjà la structure
   `docs/` + `docs/adr/` + fichiers racine.
2. Place son contenu à la racine de ton repo local `gamad-deploy`.
3. `git add . && git commit -m "docs: kit de conception GAMAD Deploy (vision, contrats, dico, prompts)"`
4. `git push` vers `zumradeals/gamad-deploy`.
5. Ouvre le repo dans VSCode avec Claude Code, puis lance le prompt **P-00**
   (copié depuis `docs/06-PROMPTS-EXECUTION.md`).
```
