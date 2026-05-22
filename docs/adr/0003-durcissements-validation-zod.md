# ADR-0003 — Durcissements de validation Zod au-delà de la spec minimale

**Date :** 2026-05-22
**Statut :** Accepté
**Contexte :** P-00 — implémentation de `ContratRepoSchema` (C-02) et `PlanDeDeploiementNormalise` (C-01)

---

## Contexte

`docs/02-ARCHITECTURE-CONTRATS.md` spécifie la structure des contrats. Certaines
contraintes de validation sont implicites dans la spec (ex. "UPPER_SNAKE_CASE" dans
un exemple) mais non formalisées comme règles de rejet explicites. Lors de P-00,
ces contraintes ont été codifiées dans le schéma Zod et/ou dans les types TypeScript.

Conformément à la politique « aucun écart non tracé », cet ADR documente chaque
durcissement et sa justification. La spec `docs/02` a été mise à jour en conséquence.

---

## Décisions et justifications

### D1 — `health_checks` : tuple non-vide `[HealthCheck, ...HealthCheck[]]` dans C-01

**Où :** `packages/contracts/src/pdn.ts`, interface `PlanDeDeploiementNormalise`.

**Pourquoi :** INV-03 exige au moins un health check. Porter cette contrainte dans le
type TypeScript (via tuple rest) rend structurellement impossible de construire un PDN
valide sans health check — même avant la validation Zod ou le domain. C'est la même
philosophie que les `readonly` dans C-11 : l'immuabilité/invariant s'exprime dans le
type, la couche de validation est un second rideau.

**Alternative écartée :** garder `Array<HealthCheck>` et n'enforcer qu'en Zod/domain.
Rejetée : un `Array` vide compilerait sans erreur, ce qui laisse la CI muette sur une
violation d'INV-03.

### D2 — `source_ref.value : z.string().min(1)` dans C-02

**Où :** `packages/contracts/src/repo-contract.ts`.

**Pourquoi :** Une ref vide (`""`) est sémantiquement invalide (git ne peut pas cloner
sur une ref vide) et produirait un PDN avec `ref.value = ""`. Rejeter en amont évite
une erreur silencieuse à l'étape `resolve-source` du pipeline.

### D3 — `env[].name : /^[A-Z][A-Z0-9_]*$/` dans C-02

**Où :** `packages/contracts/src/repo-contract.ts`.

**Pourquoi :** La spec docs/02 donne un exemple en UPPER_SNAKE_CASE. Les variables
d'environnement sont injectées en shell — une casse incorrecte (`my-var`, `MyVar`)
est une source de bugs silencieux sur l'agent VPS. Le regex valide le format attendu
par les shells POSIX.

### D4 — `health.checks[].path : z.string().startsWith('/')` dans C-02

**Où :** `packages/contracts/src/repo-contract.ts`.

**Pourquoi :** Le `gamad.json` stocke un chemin relatif, pas une URL. Rejeter les
valeurs sans `/` initial (`health` au lieu de `/health`) évite une ambiguïté que le
`TemplateCompiler` devrait silencieusement corriger. Fail-fast > correction silencieuse.

### D5 — `health.checks[].expected_status : z.number().int().min(100).max(599)` dans C-02

**Pourquoi :** Un statut hors plage HTTP (`0`, `1000`) est un bug de configuration,
pas un cas métier. La validation à l'entrée rend le message d'erreur lisible par
l'utilisateur plutôt que par un développeur.

### D6 — `runtime.ports : z.number().int().positive()` dans C-02

**Pourquoi :** Un port `0` ou négatif est invalide pour un binding réseau. Un port
flottant (`8080.5`) serait silencieusement tronqué par le shell. Rejet explicite.

---

## Conséquence

Ces contraintes ont été reportées dans `docs/02-ARCHITECTURE-CONTRATS.md` (section
C-02). `docs/02` reste la source de vérité — cet ADR en documente uniquement l'origine
et le raisonnement.
