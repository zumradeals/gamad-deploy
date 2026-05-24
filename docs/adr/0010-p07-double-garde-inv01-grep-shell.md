# ADR-0010 — P-07 : Double garde sur INV-01 (grep shell CI + test Vitest)

**Statut :** Accepté  
**Date :** 2026-05-24  
**Contexte :** P-07 — SourceInferer enrichi, invariant INV-01 (inférence par classe technique, jamais par marque)

---

## Contexte

INV-01 est le premier invariant de la constitution GAMAD : la source n'est jamais traitée
différemment à cause de son origine commerciale. `SourceInferer` est le composant qui
implémente cet invariant. Un chemin par marque (`if platform === 'lovable'`) dans ce
fichier viderait l'invariant de son sens.

P-07 introduit un test Vitest qui lit `source-inferer.ts` et vérifie l'absence de noms
de plateformes. Ce test a d'ailleurs attrapé les mots interdits dans les propres
commentaires d'en-tête lors du développement — preuve que le mécanisme est vivant.

La question posée à la clôture de P-07 : ce test Vitest suffit-il, ou faut-il un gate CI
shell distinct ?

---

## Analyse — deux niveaux de garde, deux positions différentes

### Garde interne (test Vitest)

Le test Vitest surveille `source-inferer.ts` **depuis l'intérieur** du code applicatif :
- Il s'exécute dans le même processus que le code qu'il surveille
- Il dépend de `readFileSync` — mockable en test
- Il dépend du runner Vitest — contournable si Vitest est mal configuré ou si le fichier
  de test est modifié en même temps que le fichier gardé

**Valeur :** message d'erreur précis au développeur, lisible dans la sortie `pnpm test`.

### Garde externe (grep shell CI)

Le grep shell surveille `source-inferer.ts` **depuis l'extérieur** du code applicatif :
- Il s'exécute dans un job GitHub Actions indépendant, sans Node ni pnpm
- Il ne lit aucun code applicatif ; il ne peut pas être désactivé par une modif du code
  qu'il garde
- Il ne partage aucune vulnérabilité avec l'inférenceur : même si tous les tests Vitest
  étaient désactivés, ce job continuerait à tourner

**Valeur :** verrou externe inviolable. Bloque la PR indépendamment de l'état des tests.

---

## Décision — défense en profondeur, les deux gardes actifs

Les deux gardes sont complémentaires, pas redondants :

| Dimension | Vitest (interne) | grep shell CI (externe) |
|---|---|---|
| Feedback au dev | Immédiat, message clair | Visible dans CI |
| Résistance au contournement | Faible (mockable) | Forte (hors portée du code) |
| Dépendances | Node, pnpm, Vitest | Aucune (shell pur) |
| Bloque la PR | Via `unit-tests` job | Via `guard-inv01` job dédié |

**INV-01 est l'invariant fondateur.** Il mérite le niveau de robustesse maximal. La règle
générale appliquée : pour un invariant critique, le gardien ne doit pas être lui-même dans
la pièce qu'il garde. Le grep shell est ce gardien extérieur.

---

## Périmètre du grep shell

Fichier : `apps/control-plane/src/domain/source-resolver/source-inferer.ts`

Mots interdits : `lovable`, `bolt`, `replit`, `cursor`, `v0` (insensible à la casse).

Ce périmètre est intentionnellement restreint à l'inférenceur. C'est le seul fichier du
Domain où un chemin par marque pourrait s'introduire dans le flux d'inférence. Les autres
fichiers (tests, adapters, delivery) peuvent légitimement mentionner ces noms
(documentation, fixtures de test).

---

## Conséquences

- Tout ajout de nom de plateforme dans `source-inferer.ts` bloque la PR, même sans lancer
  les tests localement.
- Le job `guard-inv01` est le job le plus léger du workflow : checkout + grep, pas de
  Node, pas de pnpm, pas de service. Il tourne en quelques secondes.
- Si de nouvelles plateformes émergent, la liste des mots interdits dans `ci.yml` est
  étendue au même endroit. Un ADR de mise à jour n'est pas nécessaire — c'est une
  extension de liste, pas un changement de principe.

## Alternatives rejetées

| Alternative | Raison du rejet |
|---|---|
| Grep shell seul (sans Vitest) | Perd le message d'erreur contextuel au dev |
| Vitest seul (sans grep shell) | Gardien dans la pièce qu'il garde — contournable |
| Grep sur tout le Domain | Sur-périmètre : les tests ont le droit de nommer les plateformes |
| ESLint custom rule | Dépend de Node/pnpm, plus complexe, même niveau de robustesse que Vitest |
