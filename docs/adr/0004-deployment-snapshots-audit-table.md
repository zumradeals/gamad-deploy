# ADR-0004 — deployment_snapshots est une table d'audit (INSERT-only)

**Date :** 2026-05-22
**Statut :** Accepté
**Contexte :** P-01 — étape 0, anomalie détectée dans docs/03

---

## Anomalie détectée

`docs/03` section 3.8 déclarait **"6 tables d'audit"** mais n'en nommait que **5** :
`deployment_plans`, `deployment_logs`, `deployment_state_transitions`,
`payment_transactions`, `template_purchases`. La table `deployment_snapshots`
(section 3.5) n'avait pas de marqueur 🔒 et était qualifiée de "sémantiquement append"
sans trigger formel.

## Analyse

`deployment_snapshots` répond à la définition d'une table d'audit (C-11) :

1. **Write-once par construction.** Un snapshot est écrit une seule fois, au
   démarrage du job `dispatch-agent`, avant toute modification du serveur. Il fige
   trois faits historiques : `compose_state` (images Docker courantes),
   `nginx_config` (config nginx courante), `commit_sha` (sha déployé).

2. **Aucun UPDATE ne sera jamais légitime.** Ces faits décrivent l'état du serveur
   à un instant T passé. Il est impossible qu'ils changent rétroactivement.

3. **La question "a servi au rollback le…" est dérivable sans UPDATE.** Si
   `deployments.status = 'rolled_back'`, le snapshot lié par `deployment_id` a servi.
   Le *quand* est dans `deployment_state_transitions` (transition `FAILED → ROLLED_BACK`,
   INSERT-only). Aucune nouvelle colonne dans `deployment_snapshots` n'est nécessaire.

4. **Le trigger INSERT-only est une défense en profondeur.** Sans lui, un bug
   applicatif pourrait écraser l'état de snapshot et invalider le rollback (INV-08).

## Décision

`deployment_snapshots` reçoit le trigger `refuse_audit_mutation()` au même titre que
les 5 autres tables d'audit. Le compteur "6 tables d'audit" dans docs/03 section 3.8
était juste — c'est la liste nommée qui était incomplète.

## Corrections apportées

- `docs/03-DICTIONNAIRE-CANONIQUE.md` section 3.5 : ajout du marqueur 🔒 et du trigger.
- `docs/03-DICTIONNAIRE-CANONIQUE.md` section 3.8 : `deployment_snapshots` ajouté à
  la liste des 6 tables d'audit.
- `packages/schema` : trigger `no_update_deployment_snapshots` ajouté à la migration.
