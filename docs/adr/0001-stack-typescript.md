# ADR 0001 — Stack TypeScript de bout en bout

- **Statut** : Accepté
- **Date** : 2026-05-22
- **Décideurs** : Architecte (GAMAD Technologie)

## Contexte

GAMAD Deploy reprend la logique métier de l'ancien projet Hamayni (déploiement
automatisé), mais repart de zéro avec un nouveau plan de conception. Le métier impose
des traitements longs et asynchrones (provisionner une base, migrer, dispatcher vers
un agent, attendre des health checks), un agent distant, du temps réel vers le client,
et du multi-tenant. L'ancien agent VPS était en Node.js.

Trois options de stack back-end ont été considérées : Laravel/MySQL/cPanel (cohérence
avec l'écosystème GEOFACT de l'organisation), Node/TypeScript moderne, ou un big-bang
dans une stack à la mode.

## Décision

**TypeScript de bout en bout, sans Supabase ni Lovable :**
- Control plane : NestJS (isolation de couches imposée par le framework).
- Files d'attente : BullMQ + Redis (jobs longs traçables, ré-essayables).
- Base : PostgreSQL auto-hébergé (souveraineté).
- ORM : Drizzle (SQL-first, migrations lisibles versionnées en Git).
- Agent VPS : Node.js (inspiré de l'ancien, réécrit avec tests).
- Frontend : React + Vite + shadcn.
- Hébergement : VPS (pas cPanel mutualisé).

## Conséquences

- Un seul langage du frontend à l'agent : moins de dette cognitive, transmissibilité maximale.
- Réutilisation du savoir opérationnel de l'ancien agent Node.
- L'écosystème queues/temps-réel de Node est mature pour ce cas d'usage.
- PostgreSQL souverain aligne le projet sur la vision IKOMA/GAMAD.

## Alternatives écartées

- **Laravel/cPanel** : excellent pour GEOFACT et les ERP, mais l'asynchrone long
  (queues, workers supervisés) s'accommode mal d'un hébergement mutualisé cPanel ;
  imposerait deux langages (PHP + Node pour l'agent). Écarté pour ce produit précis.
- **Big-bang nouvelle stack à la mode** : maximum de dette, perte de l'actif
  opérationnel, contraire à la charte. Écarté.
