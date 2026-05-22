# CONTRIBUTING — GAMAD Deploy

Bienvenue. Ce projet suit une discipline d'architecture stricte. Avant toute
contribution, lis ce document **et** `docs/01-VISION.md` (les 10 invariants).

## 1. Porte d'entrée obligatoire

Avant ta première PR :
1. Lis `docs/01-VISION.md` — les 10 invariants fondateurs.
2. Lis `docs/02-ARCHITECTURE-CONTRATS.md` — les 13 contrats.
3. Lis `CLAUDE.md` — les règles de travail.

Tu ne peux pas contribuer utilement sans comprendre ces trois documents.

## 2. Périmètre des contributions

- **Ouvert aux contributeurs** : les adaptateurs (`apps/control-plane/src/adapters/source/`).
  Tu peux ajouter le support d'une nouvelle plateforme source (ex. un nouveau type de
  dépôt) sans déstabiliser le cœur.
- **Réservé à l'Architecte** : `domain/`, `packages/contracts/`, le schéma de données.
  Toute modification ici exige un ADR (`docs/adr/`) et une revue.

## 3. La règle d'or des couches

```
Delivery → Orchestration → Domain → Adapters → Persistence
```

`domain/` n'importe JAMAIS une couche au-dessus. Le Domain ne connaît que
`packages/contracts`. Une PR qui viole ce sens de dépendance est refusée — la CI le
détecte via le lint d'architecture.

## 4. Coder contre les contrats

On code TOUJOURS contre les interfaces de `packages/contracts`, jamais en les
contournant. Si tu as besoin de modifier un contrat, ce n'est pas une PR ordinaire :
ouvre d'abord un ADR décrivant le besoin, la décision, les conséquences et les
alternatives écartées.

## 5. Définition de « terminé »

Une PR est complète quand :
- [ ] Le code respecte les contrats touchés.
- [ ] Aucune violation de couche (lint d'architecture vert).
- [ ] Tests présents (obligatoires sur Domain et agent).
- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` passent.
- [ ] Aucun secret en clair, aucun UPDATE/DELETE sur table d'audit.
- [ ] Si un contrat change : ADR présent et validé.

## 6. Ce qui fait refuser une PR

- Violation d'un invariant (INV-01 à INV-10), sans exception « temporaire ».
- Couplage à un fournisseur concret dans le Domain.
- Dépendance ajoutée sans justification ni validation.
- Contournement de la résolution de tenant.

## 7. Esprit

La vitesse n'est jamais une excuse pour la dette. On construit un système
comprehensible, maintenable et reconstructible — pas un système rapide.
