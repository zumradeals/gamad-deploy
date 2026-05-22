# PIÈCE 1 — VISION & INVARIANTS FONDATEURS

**Projet : GAMAD Deploy** · Document racine · v1.0

> Ce document est la constitution du projet. Toute décision technique, tout
> contrat, tout prompt et toute contribution doit s'y conformer. Il transcende
> la stack et survit aux outils.

---

## 1.1 — Énoncé de vision (le pourquoi)

> **GAMAD Deploy permet à une PME ou un développeur africain de transformer un
> dépôt Git en une application en production sur son propre serveur, de façon
> répétable, auditable et souveraine — sans dépendre d'une plateforme
> propriétaire étrangère.**

Trois mots portent la vision :

- **Répétable** — le même dépôt produit le même résultat.
- **Auditable** — chaque action est tracée et figée.
- **Souveraine** — le client possède son serveur, sa base, ses données.

---

## 1.2 — Ce que le produit EST / N'EST PAS

| Le produit EST | Le produit N'EST PAS |
|---|---|
| Un orchestrateur de déploiement vers des VPS que le client possède | Un hébergeur (on ne loue pas de serveurs) |
| Un traducteur Source → Plan normalisé → Exécution | Un simple exécuteur de scripts |
| Un système contractuel (le plan est la loi) | Un système heuristique qui « devine » |
| Multi-tenant avec isolation stricte | Mono-utilisateur |
| Monétisé (abonnement + marketplace + crédits) | Gratuit sans modèle |

---

## 1.3 — Les 10 Invariants Fondateurs (NON NÉGOCIABLES)

Ces invariants sont la **constitution technique** du projet. Ils transcendent la stack.

**INV-01 — Séparation Source → Plan → Exécution.**
Toute source (Git brut, template certifié, autre) est compilée en un **Plan de
Déploiement Normalisé (PDN)** versionné, avant toute exécution. L'exécuteur ne
connaît jamais l'origine. *Conséquence : ajouter une source ne touche jamais au moteur.*

**INV-02 — Le contrat explicite prime sur l'inférence.**
Si un dépôt contient un fichier-contrat (`gamad.json`), il fait foi intégralement.
Aucune heuristique ne le contourne. L'inférence n'intervient qu'en son absence.

**INV-03 — Succès = santé vérifiée, jamais « build OK ».**
Un déploiement n'est `success` que si tous les health checks passent. Un build
réussi sans santé validée est un `failed`.

**INV-04 — Immutabilité d'audit (INSERT-only).**
Tout plan exécuté, tout log, toute transaction de paiement est figé avec un hash
SHA-256. On ne met jamais à jour un enregistrement d'audit ; on en insère un nouveau.

**INV-05 — UUID v4 partout.**
Aucune clé primaire séquentielle exposée. Toutes les entités sont identifiées par UUID v4.

**INV-06 — Le tenant est injecté, jamais déduit côté client.**
La portée multi-tenant (organisation) est résolue côté serveur via le JWT et un
middleware. Le client ne peut jamais désigner un autre tenant. Le rôle n'est jamais
stocké dans le JWT applicatif — il est vérifié en base.

**INV-07 — Idempotence des étapes.**
Chaque étape du pipeline (provision, migrate, dispatch, healthcheck) doit pouvoir
être rejouée sans effet de bord destructeur. Une étape interrompue se reprend, ne se duplique pas.

**INV-08 — Arrêt immédiat sur erreur critique (`on_error_stop`).**
Le pipeline stoppe à la première erreur critique et conserve un snapshot
pré-déploiement permettant le rollback. Pas de continuation « best effort » sur un état corrompu.

**INV-09 — Les intégrations externes sont des adaptateurs remplaçables.**
Paiement (GeniusPay), fournisseur de VPS (Hetzner), source (GitHub) : chacun est
derrière une interface abstraite. Le métier ne dépend jamais d'un fournisseur concret.

**INV-10 — Conteneurisation obligatoire.**
Tout artefact déployé s'exécute dans un conteneur. Aucune exécution au niveau de
l'hôte n'est permise, sauf via un template certifié explicitement audité. Garantit
isolation, reproductibilité et rollback propre ; protège le VPS du client contre tout repo malveillant.

---

## 1.4 — Les 5 couches (isolation stricte)

Le système est organisé en couches dont les dépendances ne vont que vers le bas.
Une couche ne connaît jamais celle du dessus.

1. **Delivery** (API REST/WS, contrôleurs NestJS) — parle au monde extérieur.
2. **Orchestration** (pipeline, jobs BullMQ) — coordonne les étapes.
3. **Domain** (logique métier pure : compilation du PDN, validation, règles) — ne connaît ni HTTP ni base.
4. **Adapters** (GitHub, GeniusPay, Hetzner, agent VPS) — traduisent vers l'extérieur.
5. **Persistence** (Drizzle, PostgreSQL) — stocke et audite.

> **Règle d'or : le Domain ne dépend de rien. Tout dépend du Domain ou de plus bas.**

---

## 1.5 — Différences assumées avec l'ancien projet (Hamayni)

| Aspect | Ancien (Hamayni) | Nouveau (GAMAD Deploy) |
|---|---|---|
| Backend | Edge Functions Deno (Supabase) | NestJS auto-hébergé |
| Base | Supabase Cloud (propriétaire) | PostgreSQL souverain (VPS) |
| Jobs longs | Appels chaînés fragiles | BullMQ + workers supervisés |
| Paiement | PaiementPro (SOAP) | GeniusPay (adaptateur abstrait) |
| Contrat | `hamayni.json` | `gamad.json` (PDN v1.0) |
| Genèse | Lovable (couplage) | Repo vide + docs + CLAUDE.md |

---

*L'ancien projet a été une source d'apprentissage. GAMAD Deploy en extrait la logique
métier éprouvée, mais l'implémentation est neuve, souveraine et conçue from scratch.*
