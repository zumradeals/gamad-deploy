# ADR-0007 — Idempotence des opérations agent par `deploymentId`

**Statut :** Accepté  
**Date :** 2026-05-23  
**Contexte :** P-04 — implémentation de l'agent VPS

---

## Contexte

BullMQ est configuré avec `attempts: 3` et backoff exponentiel (ADR implicite P-03).
Un crash entre l'action de l'agent (git clone, docker compose up, certbot) et la
confirmation au control plane peut provoquer un replay du job.

Sans garde, ce replay entraînerait :
- Une **deuxième capture de snapshot** d'un état S1 (post-premier-déploiement) au lieu
  de S0 (pré-déploiement) — rendant le rollback incorrect.
- Un **double dispatch** vers l'agent — deux containers concurrents pour le même déploiement.
- Un **double appel certbot** — potentielle erreur de rate-limit Let's Encrypt.

## Décision

Le `deploymentId` est le **token d'idempotence global** de toute opération destructive
de l'agent. Pour chaque opération :

### Snapshot (`ensureSnapshot`)

Avant toute capture, l'agent vérifie l'existence de
`/var/lib/gamad/snapshots/{deploymentId}/manifest.json`.

- **Existe** → retourne le snapshot S0 existant sans ré-écrire.
- **N'existe pas** → capture S0, écrit le manifest, callback → INSERT `deployment_snapshots`.

**Justification du choix filesystem vs DB :**
L'agent n'a pas d'accès direct à la base de données (INV-09 : toute intégration externe
est derrière une interface). Le filesystem local du VPS est le seul registre persistant
disponible côté agent sans casser l'isolation architecturale. Le "double rideau" — marker
filesystem + callback vers la table INSERT-only `deployment_snapshots` — garantit la
traçabilité audit (INV-04) sans couplage direct.

### Déploiement (`deploy`)

Avant d'exécuter le plan PDN, l'agent vérifie si un container portant le label
`gamad.deployment_id={deploymentId}` est déjà en cours d'exécution ou terminé avec succès.

- **Trouvé running** → retourne le résultat précédent (idempotent).
- **Non trouvé** → exécute le plan.

### Rollback (`rollback`)

Avant de restaurer, l'agent vérifie si l'état courant correspond déjà à S0
(via le manifest du snapshot). Si S0 est déjà actif → no-op.

## Séquence de crash illustrée

```
T1 : control plane → POST /deploy (deploymentId=dep-001)
T2 : agent capture S0 → écrit manifest + callback INSERT deployment_snapshots
T3 : agent git clone + docker compose up ← crash ici
T4 : BullMQ rejoue le job → control plane → POST /deploy (dep-001) à nouveau
T5 : agent détecte manifest /snapshots/dep-001/manifest.json → S0 non recapturé ✓
T6 : agent détecte container dep-001 absent → relance docker compose up ✓
```

## Conséquences

- **Toute opération destructive agent doit recevoir `deploymentId` en premier paramètre.**
- **Tout port agent `(GitExecutorPort, DockerExecutorPort, SnapshotPort, ...)` expose
  `deploymentId` comme premier paramètre de ses méthodes.**
- Pas de fallback "ré-essaie quand même" : le marker filesystem est la source de vérité.
  Si le manifest est corrompu, l'intervention est manuelle (opération exceptionnelle hors-scope).
- `CLAUDE.md §8` grave la règle : aucune opération destructive sans vérification du marker.

## Alternatives rejetées

| Alternative | Raison du rejet |
|---|---|
| Vérification via callback DB avant action | Casse INV-09 : l'agent ne doit pas lire la DB |
| Token d'idempotence séparé généré par BullMQ | Perd la traçabilité `deploymentId` ↔ audit |
| Re-snapshot systématique + comparaison hash | Coûteux et ne protège pas contre double action |
