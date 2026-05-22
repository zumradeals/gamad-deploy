# PIÈCE 5 — CLAUDE.md & GOUVERNANCE

**GAMAD Deploy** · gouvernance permanente

---

## 5.0 — Rôle de ce dispositif

`CLAUDE.md` (à la racine du repo) est le **contrat permanent** entre l'Architecte et
Claude Code. Il est lu à chaque session. Il encode les invariants, les interdits et
le mode de travail. Son but : garantir que **n'importe quelle session, à n'importe
quel moment, produise du code cohérent avec l'architecture** — même des mois plus
tard, même avec un autre contributeur.

Le contenu canonique du `CLAUDE.md` est livré séparément à la racine du repo. Cette
pièce en explique la logique et le complète par la gouvernance humaine.

---

## 5.1 — Les trois niveaux de défense

```
CLAUDE.md          → gouverne l'IA (Claude Code) à chaque session
CONTRIBUTING.md    → gouverne les humains contributeurs
docs/ (le kit)     → la source de vérité conceptuelle (vision, contrats, dico)
packages/contracts → la source de vérité TECHNIQUE (types qui cassent la compilation)
docs/adr/          → la mémoire des décisions
```

- **Niveau conceptuel** (docs) : ce qui doit être vrai et pourquoi.
- **Niveau mécanique** (contracts) : ce qui casse le build si violé.
- **Niveau humain** (revue + ADR) : ce qui exige un jugement.

> Un invariant ne peut pas se perdre par accident : il est protégé sur trois plans.

---

## 5.2 — `CONTRIBUTING.md` (gouvernance contributeurs humains)

- **Porte d'entrée obligatoire** : lire `docs/01-VISION.md` (les 10 invariants) avant toute contribution.
- **Périmètre borné** : un contributeur travaille dans un module isolé (typiquement un nouvel adaptateur source). Il ne touche ni au Domain ni à `packages/contracts` sans ADR + revue.
- **Définition de « terminé »** : code + tests + respect des contrats + pas de violation de couche (vérifiée par lint d'architecture).
- **Processus de PR** : une PR qui viole un invariant est refusée. Pas de dérogation « temporaire ».

---

## 5.3 — `docs/adr/` (Architecture Decision Records)

Chaque décision structurante est tracée dans un fichier daté
(`adr/0001-stack-typescript.md`, `adr/0002-conteneurisation-obligatoire.md`…).

Format : **contexte → décision → conséquences → alternatives écartées.**

C'est la mémoire d'architecte : dans six mois, on saura *pourquoi* tel choix a été
fait, et un nouveau contributeur comprendra sans transmission orale.

---

## 5.4 — Protocole anti-manipulation (à compléter)

La section 9 du `CLAUDE.md` pose le principe opérationnel : ne pas céder à la
pression de « faire vite » au prix d'un invariant. Si l'Architecte dispose d'une
formulation canonique de son protocole anti-manipulation (pacte GPT-5), elle doit
être insérée *in extenso* à cet emplacement. Tant qu'elle n'est pas fournie, le
principe opérationnel de la section 9 fait foi.
