# PIÈCE 2 — ARCHITECTURE CONCEPTUELLE & CONTRATS

**GAMAD Deploy** · version conceptuelle v1.0

> Un contrat est une **frontière figée** : tant qu'il est respecté, les deux côtés
> peuvent évoluer indépendamment. C'est l'application directe de INV-09 et de
> l'isolation en couches.

---

## 2.0 — Vue d'ensemble des 13 contrats

| # | Contrat | Couche | Rôle |
|---|---|---|---|
| C-01 | Plan de Déploiement Normalisé (PDN) | Domain | Format pivot unique |
| C-02 | Fichier `gamad.json` (contrat repo) | Domain | Ce que le client déclare |
| C-03 | SourceResolver (Compiler + Inferer) | Domain | RepoAnalysis → PDN (synchrone, pur) |
| C-04 | Machine à états du déploiement | Domain | Transitions légales |
| C-05 | Pipeline & Étapes (Jobs) | Orchestration | Séquence d'exécution |
| C-06 | Protocole Control Plane ↔ Agent | Adapters | Dispatch + Callback |
| C-07 | Contrat de l'Agent VPS | Adapters | Ce que l'agent garantit |
| C-08 | PaymentProvider | Adapters | Paiement abstrait (GeniusPay) |
| C-09 | VpsProvider | Adapters | Provisioning serveur (Hetzner) |
| C-10 | Modèle multi-tenant & autorisation | Persistence | Isolation + rôles |
| C-11 | Journal d'audit immuable | Persistence | INSERT-only + hash |
| C-12 | API publique (Delivery) | Delivery | Surface REST/WS |
| C-13 | ContractGenerator (Normalizer) | Domain | Génère/normalise un gamad.json |

---

## C-01 — Plan de Déploiement Normalisé (PDN v1.0)

**Rôle.** Format pivot unique. Toute source y est traduite ; l'exécuteur ne lit que lui (INV-01).

```typescript
type PdnVersion = "1.0";

interface PlanDeDeploiementNormalise {
  pdn_version: PdnVersion;

  source: {
    type: "template" | "git";
    url: string;
    ref: { type: "branch" | "tag" | "commit"; value: string };
    fingerprint: {
      commit_sha?: string;
      template_version?: string;
      repo_id?: string;
    };
  };

  artifact: {
    kind: "docker-compose" | "node" | "static";  // conteneurisable uniquement (INV-10)
    compose_file?: string;
    app_root?: string;
    build_command?: string;
    start_command?: string;
    output_dir?: string;
  };

  env_vars: Array<{
    name: string;              // UPPER_SNAKE_CASE
    required: boolean;
    default?: string;
    secret: boolean;           // si true → jamais loggé, jamais en clair en base
  }>;

  runtime: {
    ports: Record<string, number>;
    volumes?: string[];
  };

  proxy: {
    domain?: string;
    paths: Record<string, { target: string }>;
    https: boolean;
  };

  health_checks: Array<{       // au moins 1 (INV-03)
    name: string;
    url: string;
    expected_status: number;
    timeout_s: number;
    attempts: number;
    interval_s: number;
  }>;

  policies: {
    ban_latest: boolean;       // interdit les images Docker :latest
    on_error_stop: boolean;    // INV-08
  };
}
```

**Invariants du contrat.**
- `pdn_version` non supportée → le plan est **refusé**.
- `health_checks.length >= 1` sinon refus (INV-03).
- `policies.ban_latest === true` → `source.ref.type ∈ {tag, commit}` obligatoire.
- Le PDN ne contient jamais de payload lourd — uniquement des **références** résolues plus tard.
- Une fois calculé, le PDN est figé et hashé (SHA-256) avant exécution (INV-04).

---

## C-02 — Fichier contrat du dépôt `gamad.json`

**Rôle.** Le fichier que le client place à la racine de son repo pour déclarer son
intention de déploiement. Source de vérité si présent (INV-02).

```jsonc
{
  "contract_version": "1.0",
  "name": "Mon application",
  "artifact_type": "docker-compose",   // docker-compose | node | static
  "source_ref": { "type": "tag", "value": "v1.0.0" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "http": 8080 }
  },
  "env": [
    { "name": "DB_PASSWORD", "required": true,  "secret": true },
    { "name": "SMTP_HOST",   "required": false, "default": "localhost" }
  ],
  "health": {
    "checks": [
      { "name": "web", "path": "/health", "expected_status": 200, "timeout_s": 30 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}
```

**Invariants.**
- Validé par un **schéma strict** (Zod) avant toute compilation.
- `contract_version` inconnue → refus explicite avec message clair.
- Si présent, **aucune heuristique ne le contredit** (INV-02).

**Contraintes de validation Zod (schéma `ContratRepoSchema`, `packages/contracts/src/repo-contract.ts`) :**
- `source_ref.value` : chaîne non vide (`min(1)`).
- `env[].name` : format **UPPER_SNAKE_CASE** (`/^[A-Z][A-Z0-9_]*$/`) — rejeté sinon.
- `health.checks` : tableau d'au moins 1 élément (`min(1)`, INV-03).
- `health.checks[].path` : doit commencer par `/` (chemin relatif, pas une URL complète).
- `health.checks[].expected_status` : entier dans `[100, 599]`.
- `runtime.ports` : valeurs entières positives.

> **Note de distinction C-01/C-02 :** `health.checks[].path` dans le `gamad.json` est un
> chemin relatif (ex. `/health`). Le `TemplateCompiler` le transforme en URL complète
> (`url: string`) dans le PDN (C-01) lors de la compilation. Ce sont deux représentations
> différentes de la même information à deux niveaux du pipeline.

---

## C-03 — SourceResolver : Compiler + Inferer

**Rôle.** Transformer une `RepoAnalysis` (déjà produite par la couche Adapters) en PDN.
Deux chemins, une seule sortie (INV-01). Zéro I/O — `resolve()` est **synchrone**.

```typescript
// Entrée du Domain : RepoAnalysis produite par GitAdapter (Adapters, I/O).
interface SourceResolver {
  resolve(analysis: RepoAnalysis): PlanDeDeploiementNormalise;   // synchrone, pur
}

// RepoAnalysis porte rawContract? pour que le Domain fasse le parsing (logique métier).
interface RepoAnalysis {
  repo_url?: string;
  ref?: { type: 'branch' | 'tag' | 'commit'; value: string };
  commit_sha?: string;
  has_dockerfile: boolean;
  has_compose_file: boolean;
  has_gamad_json: boolean;
  rawContract?: string;   // contenu brut du gamad.json si trouvé par l'Adapter
  detected_framework?: string;
  detected_language?: string;
  detected_runtime?: string;
}

// Chemin A — contrat présent (INV-02 : prime sur toute inférence). Synchrone, Domain pur.
interface TemplateCompiler {
  compile(contract: ContratRepo, analysis: RepoAnalysis): PlanDeDeploiementNormalise;
}

// Port I/O — implémenté dans la couche Adapters en P-04. JAMAIS dans le Domain.
// Prend les credentials (SourceInput), produit une RepoAnalysis. Ne touche pas au PDN.
interface GitAdapter {
  analyze(input: SourceInput): Promise<RepoAnalysis>;
}
```

**Chaîne complète (I/O hors Domain) :**
```
SourceInput → [GitAdapter / Adapters, I/O] → RepoAnalysis → [SourceResolver / Domain, pur] → PDN
```

**Règle de résolution (figée, ADR-0006).**
```
1. analysis.rawContract présent → ContratRepoSchema.safeParse() → TemplateCompiler.compile()  [INV-02]
2. Sinon → SourceInferer.infer(analysis)   [logique heuristique interne au Domain, pas exposée]
3. Dans les deux cas → validatePdn() → PDN figé avant exécution
```

**SourceInferer** est interne au Domain (non exposé dans packages/contracts).
`GitAdapter` est un port de la couche Adapters — son nom "Adapter" indique l'appartenance
à la couche Adapters, pas au Domain.

**Invariant.** Un repo avec contrat et un repo sans contrat produisent le même type
de sortie (PDN). Le reste du système ne fait aucune différence.

---

## C-04 — Machine à états du déploiement

**Rôle.** Définir les transitions **légales**. Toute transition hors graphe est un bug (INV-08).

```
PENDING ──▶ RUNNING ──┬──▶ SUCCESS
                      └──▶ FAILED ──▶ ROLLED_BACK
```

| État | Signification | Transitions sortantes autorisées |
|---|---|---|
| `PENDING` | Créé, en file d'attente | → `RUNNING` |
| `RUNNING` | Pipeline en cours | → `SUCCESS`, → `FAILED` |
| `SUCCESS` | Tous health checks OK (INV-03) | (terminal) |
| `FAILED` | Erreur critique, arrêt (INV-08) | → `ROLLED_BACK` |
| `ROLLED_BACK` | Snapshot précédent restauré | (terminal) |

**Invariants.**
- Aucune transition ne saute `RUNNING`.
- `SUCCESS` exige la validation explicite des health checks.
- Chaque transition est journalisée (C-11), jamais écrasée.

---

## C-05 — Pipeline & Étapes (Jobs BullMQ)

**Rôle.** Décomposer un déploiement en étapes idempotentes, traçables, ré-essayables (INV-07).

```
[1] resolve-source     → produit le PDN (C-03), le fige (C-01, C-11)
[2] provision-db       → (si requis) provisionne PostgreSQL cible
[3] migrate-data       → (si requis) applique migrations + données
[4] dispatch-agent     → envoie le PDN résolu à l'agent VPS (C-06)
[5] await-health       → poll les health checks (C-01) → décide SUCCESS/FAILED
```

**Invariants.**
- Chaque étape est un job BullMQ distinct, avec retry borné et timeout.
- Une étape idempotente : rejouée, elle ne duplique pas (INV-07).
- Échec critique → `on_error_stop` → état `FAILED` + rollback (INV-08).
- L'avancement est poussé en temps réel au client via WebSocket (C-12).

---

## C-06 — Protocole Control Plane ↔ Agent

**Dispatch (control plane → agent).**
```typescript
POST http://{agent_host}:{agent_port}/deploy
Authorization: Bearer {agent_token}
Body: {
  deployment_id: string;        // UUID
  resolved_plan: ResolvedPlan;  // PDN + références résolues
  callback_url: string;
}
```

**Callback (agent → control plane).**
```typescript
POST {callback_url}
Body: {
  deployment_id: string;
  event: "log" | "step_started" | "step_done" | "health_result" | "finished";
  level?: "info" | "warn" | "error";
  message?: string;
  payload?: Record<string, unknown>;
}
```

**Invariants.**
- L'agent est **aveugle à la source** (INV-01).
- Authentification par `agent_token` unique par serveur.
- Tout callback est journalisé en INSERT-only (C-11).
- L'agent ne décide jamais du `SUCCESS` final — le control plane tranche (INV-03).

---

## C-07 — Contrat de l'Agent VPS

**Garanties de l'agent.**
- S'installe via un script idempotent (systemd + Docker + nginx + certbot).
- S'auto-supervise (watchdog systemd, health endpoint `/agent/health`).
- Exécute un plan résolu : checkout Git → build/up Docker → config nginx → SSL certbot.
- Prend un **snapshot** de l'état précédent avant tout déploiement (rollback, INV-08).
- Renvoie chaque étape via callback (C-06).
- Ne stocke aucun secret en clair persistant.

**Invariant.** L'agent est **remplaçable** : tant qu'il honore C-06 et ces garanties,
son implémentation interne peut changer sans toucher au control plane.

---

## C-08 — PaymentProvider (abstraction, GeniusPay en première implémentation)

```typescript
interface PaymentProvider {
  readonly name: string;  // "geniuspay"
  initTransaction(params: InitParams): Promise<InitResult>;
  verifyNotification(payload: unknown, signature: string): Promise<PaymentEvent>;
}

interface InitParams {
  amount: number;
  currency: string;
  reference: string;        // unique, idempotent
  customer: { id: string; email?: string; phone?: string };
  return_url: string;
  notify_url: string;
  context: Record<string, string>;
}

interface InitResult { payment_url: string; provider_session_id: string; }

interface PaymentEvent {
  reference: string;
  status: "success" | "failed" | "pending";
  provider_session_id: string;
  verified: boolean;
}
```

**Flux métier (identique quel que soit le fournisseur).**
```
init → payment_url (client paie) → notification asynchrone → verifyNotification → activation
```

**Invariants.**
- Le métier (`BillingService`) ne connaît que l'interface, jamais GeniusPay directement.
- Toute notification est vérifiée cryptographiquement avant activation.
- Idempotence : une notification rejouée n'active pas deux fois (INV-07).
- Chaque transaction est figée en INSERT-only (C-11).

---

## C-09 — VpsProvider (provisioning serveur abstrait)

```typescript
interface VpsProvider {
  readonly name: string;                          // "hetzner"
  createServer(params: CreateServerParams): Promise<ProvisionedServer>;
  getStatus(providerServerId: string): Promise<ServerStatus>;
  destroy(providerServerId: string): Promise<void>;
}

interface CreateServerParams {
  region: string;
  size: string;
  ssh_public_key: string;
  label: string;                                  // = server_id interne (UUID)
}

interface ProvisionedServer {
  provider_server_id: string;
  host: string;
  status: ServerStatus;
}

type ServerStatus = "provisioning" | "ready" | "error" | "destroyed";
```

**Invariants.**
- Un serveur **déjà possédé** par le client est un cas de première classe : le
  `VpsProvider` n'est pas obligatoire — le client peut enregistrer un serveur
  existant et n'installer que l'agent (C-07). *Incarnation de la souveraineté.*
- `createServer` idempotent via le `label` (UUID interne) — rejoué, pas de doublon (INV-07).
- `provider_server_id` et `host` figés à la création, aucune mutation destructive non tracée.

---

## C-10 — Modèle multi-tenant & autorisation

```typescript
interface Organization { id: string; name: string; slug: string; plan: string; }

interface OrganizationMember {
  org_id: string;
  user_id: string;
  org_role: "owner" | "admin" | "member";
}

interface UserRole { user_id: string; role: "superadmin" | "support" | "user"; }
```

**Règles d'autorisation (figées).**
- Le tenant courant est résolu côté serveur par un `TenantMiddleware` (JWT + org sélectionnée), jamais d'un paramètre client arbitraire (INV-06).
- Le rôle n'est jamais lu depuis le JWT applicatif ; il est vérifié en base à chaque requête sensible.
- Toute requête de données porte implicitement `org_id = :current_tenant`. Une ressource d'une autre org est invisible (404, pas 403).
- Séparation `org_role` (pouvoir dans une org) vs `platform_role` (pouvoir sur la plateforme).

**Invariant.** Aucune fonction métier ne fait confiance à une portée tenant fournie
par le client. La portée est toujours injectée par l'infrastructure.

---

## C-11 — Journal d'audit immuable (INSERT-only + hash)

| Table | Ce qu'elle fige | Hashée |
|---|---|---|
| `deployment_plans` | Le PDN exact exécuté (C-01) | SHA-256 du plan |
| `deployment_logs` | Chaque événement/callback (C-06) | — (append séquentiel) |
| `deployment_state_transitions` | Chaque transition d'état (C-04) | — |
| `payment_transactions` | Chaque transaction (C-08) | SHA-256 du payload vérifié |

```sql
CREATE OR REPLACE FUNCTION refuse_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit table is INSERT-only (INV-04): % forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;
-- Appliqué BEFORE UPDATE OR DELETE sur chaque table d'audit.
```

**Invariants.**
- Aucun `UPDATE` ni `DELETE` sur une table d'audit, garanti au niveau base (défense en profondeur).
- Le `plan_hash` prouve qu'un déploiement n'a pas été altéré a posteriori.
- Une correction = un nouvel enregistrement, jamais une modification.

---

## C-12 — API publique (Delivery : REST + WebSocket)

```
POST   /auth/login                      → session
GET    /orgs                            → orgs de l'utilisateur
POST   /orgs/:id/servers                → enregistrer/provisionner un serveur (C-09)
GET    /servers/:id                     → statut serveur
POST   /projects                        → créer un projet (repo + serveur cible)
POST   /projects/:id/deploy             → lancer un déploiement → renvoie deployment_id
GET    /deployments/:id                 → état + métadonnées
POST   /billing/checkout                → init paiement (C-08) → payment_url
POST   /webhooks/payment/:provider      → notification asynchrone (C-08, signature vérifiée)
POST   /agents/callback                 → callback agent (C-06, auth par agent_token)

WS /deployments/:id/stream
  ← événements poussés : log | step_started | step_done | health_result | finished
```

**Invariants.**
- La couche Delivery valide et délègue, elle ne décide jamais d'une règle métier.
- Toute entrée est validée par un schéma Zod avant d'atteindre le Domain.
- Les webhooks et callbacks ont leur propre authentification, distincte du JWT utilisateur.
- Le suivi temps réel lit les événements d'audit (C-11), il n'invente jamais d'état.

---

## C-13 — ContractGenerator (Normalizer)

**Rôle.** L'inverse de C-02 : à partir de l'analyse d'un repo brut (Lovable, Bolt,
Replit, GitHub quelconque), produire un `gamad.json` candidat, le proposer à
l'utilisateur, et optionnellement le committer sur son repo (« normalisation »).

```typescript
interface ContractGenerator {
  generate(analysis: RepoAnalysis): GamadContractDraft;
  commitToRepo(params: CommitContractParams): Promise<CommitResult>;
}

interface GamadContractDraft {
  contract: ContratRepo;        // structure C-02
  confidence: number;           // 0..1 — certitude de l'inférence
  assumptions: string[];        // hypothèses faites
  warnings: string[];           // ce que l'utilisateur doit vérifier
}

interface CommitContractParams {
  project_id: string;
  contract: ContratRepo;        // version validée par l'utilisateur
  mode: "pull_request" | "direct_commit";
  git_token: string;            // jamais loggé
}

interface CommitResult { mode: string; ref_url: string; }
```

**Flux de normalisation.**
```
repo brut → analyze → ContractGenerator.generate() → draft (confidence + assumptions)
         → l'utilisateur révise et valide
         → ContractGenerator.commitToRepo() → PR ou commit du gamad.json
         → les futurs déploiements lisent le contrat (C-02), plus d'inférence
```

**Invariants.**
- **Jamais d'écriture sans validation explicite** de l'utilisateur (INV-02).
- Le draft expose toujours ses `assumptions` et `confidence` — pas de magie opaque.
- `commitToRepo` privilégie le mode `pull_request` (non destructif) par défaut.
- Le `git_token` est traité comme un secret, jamais journalisé.
