# ADR-0009 — P-06 : Consentement dual pour ContractGenerator (C-13)

**Statut :** Accepté  
**Date :** 2026-05-23  
**Contexte :** P-06 — Normalisation, écriture de gamad.json sur repo client

---

## Contexte

P-06 implémente `commitToRepo()` (C-13) : à partir d'un draft gamad.json généré par
`ContractGenerator`, écrire le fichier sur le repo Git du client via l'API GitHub.
Deux surfaces de risque distinctes exigent deux signaux de consentement distincts.

---

## Deux consentements, deux risques

### Consentement 1 — Contenu (draft_id)

> "J'ai vu et j'approuve ce qui va être écrit."

Le `draft_id` (UUID v4) est émis par `POST /contracts/analyze`. L'utilisateur ne peut pas
le deviner : il doit avoir appelé analyze et reçu le draft. Renvoyer ce `draft_id` au
endpoint commit **prouve structurellement** que l'utilisateur a lu le draft avant d'écrire.

Ce mécanisme est renforcé par un **sealed type** (`ValidatedContractDraft`) :
- Constructeur privé — impossible à instancier directement
- Seul `ValidatedContractDraft.fromApproval(draft, draftId)` peut le créer
- `commitGamadJson()` (port) accepte uniquement `ValidatedContractDraft`
- Sans `draft_id`, `fromApproval` lève une erreur → pas de `ValidatedContractDraft`
  → `commitGamadJson` est **incompilable** sans consentement au contenu

### Consentement 2 — Destination (confirm_default_branch)

> "Je comprends que j'écris directement sur la branche par défaut du repo."

Approuver le **contenu** d'un gamad.json ≠ approuver d'écrire directement sur `main`.
Écrire sur `main` sans review est un acte irréversible à risque élevé : pas de PR,
pas de diff visible, déclenchement potentiel de CI/CD immédiat.

**Règle :** si `mode = 'direct'` ET `targetBranch === defaultBranch` (ex. `main`),
le champ `confirm_default_branch: true` est **obligatoire** dans le corps de la requête.
Sans lui : refus immédiat, aucune écriture.

Ce signal est **distinct** de `draft_id` car il couvre un risque différent. Un utilisateur
peut approuver le contenu sans avoir conscience qu'il cible la branche de production.

---

## Matrice des consentements requis

| Mode | Cible | draft_id requis | confirm_default_branch requis |
|---|---|---|---|
| `pr` | toute branche | ✅ | ❌ |
| `direct` | branche non-défaut | ✅ | ❌ |
| `direct` | branche défaut (main) | ✅ | ✅ |

---

## Garantie zéro branche orpheline (mode PR)

En mode PR, la création de branche précède les écritures. Un échec intermédiaire laisserait
une branche orpheline. Pattern retenu : **transaction compensatoire**.

```
1. GET  base branch SHA
2. POST create branch gamad/contract-{draftId}       ← point de non-retour
   try {
3.   GET  check existing gamad.json
4.   PUT  gamad.json on new branch
5.   POST create pull request
   } catch {
     DELETE refs/heads/gamad/contract-{draftId}       ← compensation
     rethrow
   }
```

Cas non-récupérable : étape 2 réussit, le DELETE de compensation échoue (panne réseau).
Résidu : branche `gamad/contract-{draftId}` orpheline, identifiable par son préfixe.
Documenté dans `TESTS-INTEGRATION-DIFFERES.md` (VPS-14b) comme intervention manuelle.

---

## Cas gamad.json déjà présent

L'étape 3 (GET contents) est **systématique** avant tout PUT, dans les deux modes.

- **404** → fichier absent → flux nominal.
- **200 sans `overwrite_existing: true`** → erreur `GAMAD_JSON_EXISTS` (contenu existant
  renvoyé) → aucune écriture, branche créée en mode PR nettoyée.
- **200 avec `overwrite_existing: true`** → le PUT inclut le `sha` du fichier existant
  (mécanisme GitHub natif : anti-race, empêche l'écrasement concurrent).

---

## Conséquences

- `ValidatedContractDraft` vit dans le Domain (couche pure, zéro I/O).
- `GithubContractAdapter` vit dans Adapters, derrière `GitWritePort` (INV-09).
- `git_token` : ni loggé, ni persisté. Jamais tracé dans `draft`, `assumptions`, `warnings`.
- La règle `confirm_default_branch` est vérifiée dans `GithubContractAdapter` **avant**
  toute opération réseau — jamais délégué au caller.
- Mode PR = défaut recommandé (C-13). Mode direct = option avancée, double consentement.

## Alternatives rejetées

| Alternative | Raison du rejet |
|---|---|
| Flag `confirmed: true` dans le body | Applicatif, contournable par bug ou appel direct |
| Consentement implicite (TTL draft) | Prouve la temporalité, pas la lecture du contenu |
| Un seul signal pour les deux risques | Confond "j'approuve le contenu" et "j'approuve le risque d'écrire sur main" |
| Token CSRF distinct | Complexité inutile — le draft_id UUID v4 remplit le même rôle |
