# ADR-0012 — Transition PENDING → FAILED dans la machine à états

**Date :** 2026-05-27  
**Statut :** Accepté  
**Contrat touché :** C-04 (State Machine)

## Contexte

La machine à états originale ne définissait pas de transition `PENDING → FAILED`.
L'hypothèse implicite était que le premier job du pipeline (`resolve-source`) ne
pouvait échouer qu'après avoir amorcé la transition `PENDING → RUNNING`.

En pratique, plusieurs erreurs peuvent survenir *avant* que cette transition soit
déclenchée :
- Erreur de connexion à la base de données lors de la récupération du PDN.
- Exception dans le processor avant l'appel à `ctx.transition('PENDING', 'RUNNING', …)`.
- Erreur réseau transitoire entre l'enqueue BullMQ et l'exécution du premier job.

Dans tous ces cas, `handleFailure` dans `PipelineJobRunner` lisait `currentState ===
'PENDING'`, ne trouvait pas de transition légale, et retournait silencieusement.
BullMQ marquait le job comme « complété » (pas de re-throw). Le déploiement restait
bloqué en PENDING indéfiniment — aucune interface ne permettait d'en sortir.

## Décision

Ajouter `{ from: 'PENDING', to: 'FAILED' }` à `LEGAL_TRANSITIONS` dans
`packages/contracts/src/state-machine.ts`.

Mettre à jour `handleFailure` dans `PipelineJobRunner` pour gérer `currentState ===
'PENDING'` de la même manière que `currentState === 'RUNNING'`.

Envelopper l'appel à `agentPort.rollback()` dans un bloc try-catch : une erreur de
rollback (agent injoignable) ne doit pas re-throw vers BullMQ, car le déploiement est
déjà marqué FAILED et une nouvelle tentative ne ferait qu'alterner entre FAILED et un
rollback en échec.

## Conséquences

- **Positives :** Tout déploiement bloqué en PENDING suite à une erreur pipeline
  atteint désormais FAILED, état observable et actionnable depuis l'interface.
- **Neutres :** La transition `PENDING → FAILED` contourne l'état RUNNING ;
  cela reste cohérent avec INV-03 (succès = health checks OK) car un déploiement
  n'ayant jamais démarré ne peut pas avoir passé ses health checks.
- **Négatives / risques :** Aucun. `FAILED → ROLLED_BACK` reste possible si le PDN
  est disponible ; la chaîne de rollback n'est pas pertinente lorsque le déploiement
  n'a pas atteint l'agent.
