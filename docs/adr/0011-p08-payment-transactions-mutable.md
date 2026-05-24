# ADR-0011 — P-08 : payment_transactions devient mutable (écart au Dictionnaire P-01)

**Statut :** Accepté  
**Date :** 2026-05-24  
**Contexte :** P-08 — Intégration GeniusPay, idempotence financière

---

## Contexte

En P-01, `payment_transactions` était marquée 🔒 INSERT-only dans le Dictionnaire Canonique,
et un trigger `tg_payment_transactions_insert_only` (migration 0001) l'imposait en base.

P-08 exige une idempotence financière stricte : quand GeniusPay notifie un `payment.success`,
BillingService doit exécuter :

```sql
UPDATE payment_transactions
SET status = 'success'
WHERE reference = $ref AND status = 'pending'
```

Ce pattern optimistic-lock est le seul mécanisme fiable contre la double activation (Garde-fou B).
Il est incompatible avec le trigger INSERT-only.

---

## Décision

1. **Suppression du trigger** `tg_payment_transactions_insert_only` (migration 0003).
2. **payment_transactions devient partiellement mutable** : seul `status` (et `provider_session_id`)
   sont mis à jour — jamais `amount`, `org_id`, `reference`, `created_at` (les champs financiers immuables).
3. **Création de `payment_state_transitions`** : table d'audit INSERT-only (🔒 trigger) qui trace chaque
   transition avec `from_status`, `to_status`, `event_type`, `payload_hash` SHA-256 (C-11, INV-04).

L'audit immuable est préservé, déplacé de la table principale vers la table de transitions.

---

## Pourquoi pas UPDATE-only via trigger ?

Un trigger BEFORE UPDATE pourrait interdire la modification des champs immuables.
Ce niveau de protection n'est pas jugé nécessaire à ce stade : le seul code qui UPDATE
`payment_transactions` est `BillingRepositoryAdapter.completeIfPending`, qui ne touche
que `status`, `provider_session_id`, et `payload_hash`.

Si cette contrainte devenait nécessaire, un ADR de mise à jour suffira.

---

## Conséquences

- `payment_transactions` : 🔒 retiré — statut mutable pour idempotence.
- `payment_state_transitions` : 🔒 nouvelle table d'audit (INV-04, C-11).
- `docs/03-DICTIONNAIRE-CANONIQUE.md` : mis à jour en même commit.
- Migration 0003 : atomique, réversible (le trigger peut être recréé si rollback).
