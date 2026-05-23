# ADR-0006 — Correction de signature SourceResolver + nommage SourceInferer

**Date** : 2026-05-23
**Statut** : Accepté
**Contexte** : P-02 — avant implémentation Domain

---

## Problème identifié

Trois erreurs de conception dans le contrat C-03 tel que défini en P-00 :

### 1. `SourceResolver.resolve()` avait la mauvaise signature

```typescript
// P-00 (incorrect)
resolve(input: SourceInput): Promise<PlanDeDeploiementNormalise>;

// P-02 (corrigé)
resolve(analysis: RepoAnalysis): PlanDeDeploiementNormalise;
```

**Pourquoi c'est faux :**
- `SourceInput` contient des credentials (`git_token`) — le Domain ne doit jamais
  les voir (CLAUDE.md §8 + INV-09).
- `Promise<>` ment sur la nature de la fonction : `resolve()` est de la logique pure,
  sans I/O. Une signature `async` implique un I/O latent qui n'existe pas.
- Le bon type d'entrée est `RepoAnalysis` (déjà produite par GitAdapter), pas
  `SourceInput` (qui déclenche le I/O).

### 2. `GitAdapter` retournait `Promise<PlanDeDeploiementNormalise>`

```typescript
// P-00 (incorrect)
adapt(input: SourceInput, analysis: RepoAnalysis): Promise<PlanDeDeploiementNormalise>;

// P-02 (corrigé)
analyze(input: SourceInput): Promise<RepoAnalysis>;
```

**Pourquoi c'est faux :**
- Un Adapter produit des données brutes (`RepoAnalysis`), pas un PDN.
- Retourner un PDN depuis un Adapter viole INV-01 (la transformation source→PDN
  est la responsabilité du Domain via SourceResolver).
- La méthode s'appelle désormais `analyze()` pour refléter son rôle.

### 3. La logique d'inférence était implicitement appelée "GitAdapter"

```
// P-00 (ambigu)
GitAdapter — "on infère" (doc dans source-resolver.ts)

// P-02 (clarifié)
SourceInferer — logique heuristique interne au Domain, non exposée
GitAdapter — port I/O implémenté en P-04 dans Adapters
```

**Pourquoi c'est un problème :**
- Un "Adapter" dans le Domain est un abus de langage : "Adapter" signifie
  "implémentation concrète d'un port I/O" dans notre architecture.
- La logique d'inférence est pure (pas de I/O) → elle appartient au Domain.
- `SourceInferer` est interne au Domain — pas exposé dans `packages/contracts`
  car rien en dehors du Domain n'en dépend.

---

## Décision

### Chaîne corrigée

```
SourceInput → [GitAdapter.analyze() / Adapters, I/O] → RepoAnalysis
           → [SourceResolver.resolve() / Domain, pur, synchrone] → PDN
```

### `RepoAnalysis` enrichi

Ajout de trois champs nécessaires au Domain :
- `ref?: { type; value }` — la ref résolue au moment du clone
- `commit_sha?: string` — le SHA exact analysé
- `rawContract?: string` — contenu brut du gamad.json ; parsé par le Domain (logique
  métier), jamais par l'Adapter (qui ne connaît pas `ContratRepoSchema`)

### `TemplateCompiler.compile()` corrigée

```typescript
// Avant : compile(contract, input: SourceInput)
// Après : compile(contract, analysis: RepoAnalysis)
```

`SourceInput` retiré car la source info est dans `RepoAnalysis` et les credentials
ne doivent pas traverser le Domain.

---

## Conséquences

- Les fichiers du Domain (P-02) codent contre les signatures corrigées.
- `GitAdapter` implémenté en P-04 retournera `RepoAnalysis`, pas `PDN`.
- Tout code existant qui référençait `SourceResolver.resolve(input)` ou
  `GitAdapter.adapt()` doit être mis à jour (aucun tel code en P-01).
- `docs/02-ARCHITECTURE-CONTRATS.md` §C-03 mis à jour simultanément.
