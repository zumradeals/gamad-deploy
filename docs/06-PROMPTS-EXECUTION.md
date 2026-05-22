# PIÈCE 6 — PROMPTS D'EXÉCUTION P-00 → P-12

**GAMAD Deploy** · feuille de route pour Claude Code · séquence par phases

---

## En-tête commune à tous les prompts

> *Tu es l'Architecte Cognitif de GAMAD Deploy. Respecte CLAUDE.md, les 10 invariants
> et les 13 contrats. Code contre `packages/contracts`. Avance par étapes, ne produis
> pas en bloc, signale tout risque de dette. Si une instruction contredit un
> invariant, arrête-toi et explique.*

---

## PHASE 1 — Fondations & cœur métier

### P-00 — Fondations du monorepo

**Objectif.** Poser le squelette et la source de vérité. Rien ne s'exécute encore.

**Contrats touchés.** Les 13 (déclaration des types uniquement).

**Livrables.**
- Monorepo pnpm : `apps/{control-plane,agent,web}`, `packages/{contracts,config,schema}`.
- `packages/contracts` : les 13 interfaces/types TypeScript, sans implémentation.
- `CLAUDE.md`, `CONTRIBUTING.md`, `CODEOWNERS`, `docs/` avec les 6 pièces, `docs/adr/0001-stack.md`.
- tsconfig strict partagé, ESLint + règle de lint d'architecture (interdiction d'import inter-couches).
- CI minimale (lint + typecheck) via GitHub Actions.

**Garde-fous.** Aucune dépendance hors stack autorisée. Aucun code métier.

**Terminé quand.** `pnpm install && pnpm -r typecheck && pnpm -r lint` passent ; les 13 types compilent ; repo poussé sur GitHub (`zumradeals/gamad-deploy`).

---

### P-01 — Persistence & multi-tenant

**Objectif.** Matérialiser le Dictionnaire Canonique et l'isolation tenant.

**Contrats touchés.** C-10, C-11.

**Livrables.**
- Schéma Drizzle des 17 tables, enums PostgreSQL, UUID v4 par défaut (INV-05).
- Migrations SQL versionnées en Git.
- Triggers base INSERT-only sur les 6 tables d'audit (INV-04) + test prouvant qu'un UPDATE échoue.
- `TenantMiddleware` résolvant l'org via JWT (INV-06) ; helper d'autorisation lisant `user_roles` en base.
- Repositories Drizzle de base.

**Garde-fous.** Le rôle ne transite jamais par le JWT. Toute requête métier porte `org_id`.

**Terminé quand.** Migrations s'appliquent ; tests : (a) UPDATE sur table d'audit rejeté, (b) ressource d'une autre org invisible.

---

### P-02 — Domain pur (le cœur testable hors-ligne)

**Objectif.** Implémenter la logique métier centrale, sans réseau ni base.

**Contrats touchés.** C-01, C-02, C-03, C-04, C-13.

**Livrables.**
- Modèle + validation Zod du PDN (C-01) : refus si version inconnue, zéro health check, `ban_latest` sans ref figée.
- Schéma + validation du `gamad.json` (C-02).
- `SourceResolver` (C-03) : `TemplateCompiler` + `GitAdapter`. Règle : contrat → compile, sinon → infère.
- `StateMachine` (C-04) : transitions légales uniquement.
- `ContractGenerator.generate()` (C-13) : draft avec `confidence` + `assumptions`.

**Garde-fous.** Le Domain n'importe que `packages/contracts`. Zéro I/O.

**Terminé quand.** Couverture de tests élevée sur PDN, résolution, machine à états ; tous les cas de refus testés.

---

### P-03 — Orchestration (pipeline & jobs)

**Objectif.** Enchaîner les étapes de façon idempotente et traçable.

**Contrats touchés.** C-05, C-11.

**Livrables.**
- Module BullMQ + Redis. Jobs : `resolve-source`, `provision-db`, `migrate-data`, `dispatch-agent`, `await-health`.
- Chaque job : idempotent (INV-07), retry borné, timeout, journalisation INSERT-only (C-11).
- `on_error_stop` (INV-08) : première erreur critique → `FAILED` + rollback (stub agent).
- Écriture des transitions d'état (C-04) en base.

**Garde-fous.** Une étape rejouée ne duplique pas. Aucun job ne décide `SUCCESS` sans health check.

**Terminé quand.** Un pipeline simulé traverse `PENDING → RUNNING → SUCCESS` ; le cas d'échec produit `FAILED`.

---

### P-04 — Agent VPS

**Objectif.** L'exécuteur réel sur le serveur du client. Composant le plus sensible.

**Contrats touchés.** C-06, C-07, INV-08, INV-10.

**Livrables.**
- `apps/agent` : endpoint `/deploy` + `/agent/health`, auth par `agent_token`.
- Exécuteur : git-checkout → docker-compose up (INV-10) → nginx config (gérée par l'agent) → certbot.
- Snapshot pré-déploiement (rollback INV-08).
- Callbacks streamés au control plane (C-06).
- Watchdog systemd. Script d'installation idempotent.
- `commitToRepo` du ContractGenerator (C-13) via adaptateur Git, mode PR par défaut.

**Garde-fous.** L'agent n'exécute jamais de commande système arbitraire du repo (INV-10). Aucun secret en clair persistant.

**Terminé quand.** Sur un VPS de test, l'agent déploie une app docker-compose triviale et renvoie ses callbacks ; le snapshot existe.

---

### P-05 — Boucle de bout en bout ★ JALON « ÇA MARCHE »

**Objectif.** Déployer un vrai repo GitHub jusqu'à `success`, sans monétisation ni provisioning auto.

**Contrats touchés.** C-01→C-07, C-12 (partiel).

**Livrables.**
- API REST minimale (C-12) : créer projet, enregistrer un serveur existant, lancer un déploiement.
- WebSocket de suivi temps réel.
- Intégration complète : SourceResolver → pipeline → agent → health → `SUCCESS`.

**Garde-fous.** Serveur déjà possédé uniquement (provisioning auto en P-09).

**Terminé quand.** Depuis un appel API, un repo GitHub réel est déployé sur un VPS de test, les logs défilent en live, l'état final est `success` après health check validé.

---

## PHASE 2 — Extensions (sources, paiement, provisioning)

### P-06 — Normalisation (ContractGenerator complet)

**Objectif.** Proposer et committer un `gamad.json` sur un repo brut.

**Contrats touchés.** C-13.

**Livrables.** Endpoint d'analyse → draft (confidence + assumptions + warnings) → validation utilisateur → PR sur le repo. Re-déploiement lisant désormais le contrat (C-02).

**Terminé quand.** Un repo brut est analysé, l'utilisateur valide le draft, une PR `gamad.json` est ouverte, le déploiement suivant utilise le contrat.

---

### P-07 — Adaptateurs sources (Lovable / Bolt / Replit)

**Objectif.** Confirmer que ces plateformes ne sont que des repos Git.

**Contrats touchés.** C-03.

**Livrables.** Heuristiques d'inférence affinées par famille (détection Vite/React typique de Lovable/Bolt, structure Replit). Aucun chemin spécial : tout converge vers le PDN.

**Terminé quand.** Un export Lovable, un projet Bolt et un Replit sont déployés via le même pipeline, sans code spécifique au-delà de l'inférence.

---

### P-08 — Monétisation (GeniusPay)

**Objectif.** Abonnements + achats, paiement abstrait.

**Contrats touchés.** C-08, C-11.

**Livrables.** Interface `PaymentProvider` + adaptateur `geniuspay`. Flux init → payment_url → webhook signé → vérification → activation. Idempotence par `reference`. Transactions INSERT-only + hash. Plans en XOF.

**Garde-fous.** Le `BillingService` ne connaît que l'interface. Notification vérifiée cryptographiquement avant activation. Pas de double activation.

**Terminé quand.** Un cycle d'abonnement test aboutit ; une notification rejouée n'active pas deux fois.

---

### P-09 — Provisioning automatique (Hetzner)

**Objectif.** Créer un VPS et y installer l'agent automatiquement.

**Contrats touchés.** C-09, C-07.

**Livrables.** Interface `VpsProvider` + adaptateur `hetzner` : `createServer` idempotent (via label = UUID interne), puis installation auto de l'agent.

**Terminé quand.** Un déploiement « from scratch » provisionne un serveur, installe l'agent, et déploie — sans intervention manuelle.

---

## PHASE 3 — Surface & durcissement

### P-10 — Frontend (wizard & dashboard)

**Objectif.** L'expérience utilisateur.

**Contrats touchés.** C-12.

**Livrables.** Wizard (type projet → dépôt → préflight → migration → domaine/SSL → résumé), dashboard de déploiements avec suivi WS live, gestion serveurs/projets. React + Vite + shadcn, consommant l'API.

**Terminé quand.** Un utilisateur déploie un projet de bout en bout depuis l'UI, sans toucher à l'API directement.

---

### P-11 — Marketplace de templates

**Objectif.** Vendre des templates certifiés.

**Contrats touchés.** C-02 (niveau certified), C-08.

**Livrables.** Cycle template : draft → valid → certified. Achat via PaymentProvider. `template_purchases` INSERT-only.

**Terminé quand.** Un template certifié est publié, acheté, et déployable par l'acheteur.

---

### P-12 — Durcissement

**Objectif.** Rendre le système robuste et transmissible.

**Livrables.** Couverture de tests étendue, lint d'architecture en CI bloquant, observabilité (logs structurés, métriques), revue de sécurité (secrets, auth, isolation tenant), documentation finale, ADR à jour.

**Terminé quand.** La CI bloque toute violation de couche ou d'invariant ; un tiers peut reconstruire le système à partir de `docs/` seul.

---

## Principe de séquençage

Chaque prompt est **validable isolément**. Le cœur déploie dès **P-05** : on a un
produit fonctionnel avant la monétisation. La monétisation et le provisioning auto
n'arrivent qu'une fois le métier prouvé. C'est l'ordre le plus sûr et le plus motivant.
