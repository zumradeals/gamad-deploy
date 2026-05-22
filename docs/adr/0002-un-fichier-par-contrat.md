# ADR-0002 — Un fichier par contrat dans packages/contracts

**Date :** 2026-05-22
**Statut :** Accepté
**Contexte :** P-00 — Fondations du monorepo

---

## Contexte

Le prompt P-00 listait 8 fichiers pour les 13 contrats (C-01 à C-13). Cinq contrats
(C-05, C-07, C-10, C-11, C-12) n'avaient pas de fichier dédié dans cette liste.
Note : C-07 a été intégré dans `agent-protocol.ts` car C-06 et C-07 forment un
protocole indissociable (dispatch + contrat agent). Les quatre autres (C-05, C-10,
C-11, C-12) ont reçu chacun un fichier dédié.

## Décision

Principe **un fichier par contrat** dans `packages/contracts/src/` :

```
pdn.ts              C-01
repo-contract.ts    C-02
source-resolver.ts  C-03
state-machine.ts    C-04
pipeline.ts         C-05
agent-protocol.ts   C-06 + C-07  ← exception justifiée (protocole indissociable)
payment-provider.ts C-08
vps-provider.ts     C-09
multi-tenant.ts     C-10
audit.ts            C-11
api.ts              C-12
contract-generator.ts C-13
index.ts            ré-exports centralisés
```

## Justification

1. **Isolation des changements.** Modifier C-11 (audit) n'oblige pas à ouvrir un
   fichier contenant C-05 (pipeline). Le diff d'une PR est lisible et ciblé.

2. **Traçabilité directe.** `git blame packages/contracts/src/audit.ts` = historique
   complet de C-11, sans bruit.

3. **Grep sans ambiguïté.** `grep -r "C-11"` ou `grep -r "DeploymentPlanRecord"`
   pointe vers un seul fichier.

4. **Respect de SRP au niveau fichier.** Chaque fichier a une seule raison de
   changer : l'évolution du contrat qu'il déclare.

## Exception documentée

`agent-protocol.ts` couvre C-06 (protocole dispatch/callback) ET C-07 (garanties
agent). Ces deux contrats définissent les deux faces d'un même canal de communication
et partagent le type `ResolvedPlan`. Les séparer créerait une dépendance croisée
entre les deux fichiers, ce qui serait plus fragile.

## Conséquences

- Toute addition future d'un contrat (C-14, etc.) doit recevoir son propre fichier.
- L'`index.ts` reste le seul point d'entrée public — les consumers importent
  `@gamad/contracts`, pas un sous-chemin interne.
- Ce principe s'applique uniquement à `packages/contracts`. Les couches applicatives
  peuvent organiser leurs fichiers différemment.
