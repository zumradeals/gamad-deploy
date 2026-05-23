# ADR-0008 — Race 2 : optimistic-lock comme 2e ligne de défense (défense en profondeur)

**Statut :** Accepté  
**Date :** 2026-05-23  
**Contexte :** P-05 — jalon intégration, Race 2 identifiée et résolue

---

## Contexte

P-05 introduit `PipelineRepositoryAdapter` qui implémente `transitionWithLog()` sur Postgres
réel. Lors du jalon E2E, la Race 2 a été identifiée :

> Deux jobs BullMQ échouent quasi-simultanément → deux `handleFailure` lisent RUNNING →
> les deux tentent de persister `RUNNING → FAILED` → double ligne dans
> `deployment_state_transitions` (violation INV-04).

L'annonce initiale (Étape 0) prévoyait que la `StateMachine` du Domain serait la barrière
primaire (le 2e write verrait FAILED et lèverait `IllegalTransitionError`). À l'implémentation,
un **optimistic-lock SQL** a été ajouté dans l'adaptateur. Cet ADR documente le changement de
mécanisme, sa justification, et sa relation avec la StateMachine.

---

## Décision

### Deux barrières, deux responsabilités distinctes

```
  PipelineJobRunner.handleFailure()
       │
       ├─ 1️⃣  StateMachineService.transition(from, to)     ← DOMAIN (règle métier)
       │       Lève IllegalTransitionError si transition illégale (ex. FAILED→FAILED).
       │       Retourne `validated` — seul résultat légal autorisé.
       │
       └─ 2️⃣  PipelineRepositoryAdapter.transitionWithLog(deploymentId, from, validated, ...)
               UPDATE deployments SET status = validated
               WHERE id = $id AND status = from           ← PERSISTENCE (concurrence)
               → 0 lignes affectées → no-op (concurrent a déjà commité)
               → 1 ligne affectée  → INSERT audit rows + pg_notify
```

**Barrière 1 (StateMachine — Domain)** : valide la légalité métier d'une transition.
La règle "FAILED→FAILED est illégal" vit dans `StateMachineService`, pas dans SQL.

**Barrière 2 (optimistic-lock — Persistence)** : garantit l'atomicité sous concurrence
sans verrou applicatif. Le `from` qui alimente le `WHERE` est la valeur déjà validée par
la StateMachine — l'optimistic-lock n'a aucune connaissance métier.

### Pourquoi l'optimistic-lock plutôt que laisser la StateMachine seule

La StateMachine seule ne peut pas protéger la Race 2 en base de données car :

1. `getDeploymentState()` et l'écriture ne sont pas atomiques au niveau applicatif
2. Deux process lisent RUNNING avant que l'un des deux commite → les deux passent la StateMachine → double INSERT dans `deployment_state_transitions`

L'optimistic-lock résout le problème à la seule couche qui peut le garantir : la base de
données, via le mécanisme de row-lock natif de PostgreSQL sur le `UPDATE`.

---

## Comportement du no-op silencieux

Le `if (!updated) return` dans l'adaptateur est **seulement atteignable** dans la fenêtre
de race concurrente. Un bug logique séquentiel qui produirait une transition illégale
(ex. appel `handleFailure` quand l'état n'est plus RUNNING) est détecté en amont :

- La garde `if (currentState === 'RUNNING')` dans `handleFailure` filtre les états non-RUNNING
- `stateMachine.transition(currentState, 'FAILED')` lève `IllegalTransitionError` si illégal
- L'erreur remonte dans BullMQ → loggée dans `deployment_logs` → signal visible

Le no-op est donc silencieux **uniquement pour un événement normal** (race gagnée par un
concurrent), et jamais pour un bug logique. **Aucun signal de détection n'est perdu.**

---

## Invariant architectural (CLAUDE.md §8)

> **`PipelineJobRunner` est le seul composant autorisé à appeler `transitionWithLog()`.**

Si `transitionWithLog()` est appelé directement en court-circuitant `PipelineJobRunner`,
la StateMachine ne serait pas consultée. L'optimistic-lock persisterait alors une transition
sans validation métier. C'est une violation architecturale que cet ADR interdit.

Règle ajoutée à `CLAUDE.md §8` : aucun appel direct à `repo.transitionWithLog()` hors
de `PipelineJobRunner`.

---

## Gap de couverture de test — E2E-04

Le test `E2E-04` prouve l'optimistic-lock **en isolation** (appel direct à
`repo.transitionWithLog()` sans `PipelineJobRunner`) pour tester précisément le mécanisme
de concurrence Postgres.

La chaîne complète (StateMachine + optimistic-lock) est prouvée **structurellement** par
`E2E-01` et `E2E-02` qui traversent le pipeline complet via `PipelineJobRunner`. Un test
unitaire dédié à la chaîne `StateMachine → optimistic-lock → no-op` peut être ajouté
en P-06 si la couverture doit être explicite.

---

## Conséquences

- L'optimistic-lock est une **garantie technique de concurrence** — il ne remplace pas la
  StateMachine, il la complète.
- `transitionWithLog()` est un contrat **bi-partite** : le domaine valide, la persistence
  persiste de façon atomique. L'un sans l'autre est incomplet.
- **CLAUDE.md §8** : ajouter la règle "aucun appel direct à `repo.transitionWithLog()`
  hors de `PipelineJobRunner`."
- La Race 2 est prouvée par test (E2E-04) et documentée ici.

## Alternatives rejetées

| Alternative | Raison du rejet |
|---|---|
| StateMachine seule (lève IllegalTransitionError en app) | Non atomique — race window entre read et write |
| Contrainte UNIQUE sur `(deployment_id, to_state)` | Trop restrictive — empêche ROLLED_BACK après FAILED |
| SELECT FOR UPDATE avant écriture | Pessimistic lock — overhead, risque de deadlock sous charge |
| Serializable isolation | Rejette les transactions concurrentes avec erreur de sérialisation — complexité de retry |
