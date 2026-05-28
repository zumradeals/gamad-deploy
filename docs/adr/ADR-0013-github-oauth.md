# ADR-0013 — GitHub OAuth (C-14) : repo picker, fork auto, token chiffré au repos

**Date :** 2026-05-28  
**Statut :** Accepté  
**Contrats touchés :** C-14 (GitHub OAuth), C-13 (NormalizeController — git_token optionnel)

---

## Contexte

L'authentification GitHub est aujourd'hui entièrement manuelle : l'utilisateur génère
un PAT, le colle dans le wizard, et le token ne vit que dans Redis (removeOnComplete: true).

Ce modèle a deux limites :
1. **Friction** — saisir un PAT à chaque déploiement est une barrière à l'adoption.
2. **Repos publics non possédés** — impossible de normaliser (ouvrir une PR) sur un repo
   dont on n'est pas propriétaire. La seule solution propre est de forker le repo, mais un
   fork automatique exige des droits API GitHub persistants.

## Décision

Implémenter GitHub OAuth 2.0 (OAuth App classique, scope `repo,read:user`) :

- **Token chiffré au repos** — AES-256-GCM, clé `GITHUB_OAUTH_TOKEN_KEY` (32 octets, base64).
  Seul le ciphertext est persisté en DB (`github_oauth_tokens`). La clé ne quitte jamais
  le serveur. Jamais de token en clair dans les logs (CLAUDE.md §8, INV-04).
- **Un token par (org_id, user_id)** — contrainte unique composite.
- **Scope minimal** — `repo` (R/W repos privés + fork), `read:user` (login + id).
- **Token jamais exposé au frontend** — `GET /github/status` retourne
  `{ connected, github_login, scopes, connected_at }` uniquement.
- **Fallback PAT manuel** — si `git_token` est fourni manuellement dans une requête,
  il prime sur le token OAuth. Le wizard reste utilisable sans OAuth.
- **DispatchAgent** — si `job.data.gitToken` est absent, tente de récupérer le token
  OAuth depuis la DB (déchiffré, embarqué dans l'URL HTTPS uniquement au dispatch,
  removeOnComplete: true dans Redis — même invariant qu'avant).

## Flow OAuth

```
Frontend                     Backend                      GitHub
   │                            │                            │
   │ GET /github/auth-url        │                            │
   ├───────────────────────────>│                            │
   │ { url: "https://github..."}│                            │
   │<───────────────────────────┤                            │
   │                            │                            │
   │ window.location = url      │                            │
   ├────────────────────────────┼──────── authorize ────────>│
   │                            │                            │
   │                            │<─── callback?code&state ───┤
   │                            │  1. verify state (HMAC)    │
   │                            │  2. exchange code → token  │
   │                            │  3. GET /user → login+id   │
   │                            │  4. AES-256-GCM encrypt    │
   │                            │  5. upsert DB              │
   │<──── redirect /settings/github?connected=true ──────────┤
```

## CSRF (state)

`state = base64url(JSON.stringify({org_id, user_id, exp})) + "." + HMAC-SHA256(payload, CLIENT_SECRET)`

Auto-signé avec `GITHUB_OAUTH_CLIENT_SECRET`. Expiration 10 min. Aucun stockage serveur requis.

## Fork auto

`POST /github/repos/fork { owner, repo }` — appelle `POST https://api.github.com/repos/{owner}/{repo}/forks`.
Le fork est asynchrone côté GitHub (~quelques secondes). Le wizard poll l'existence du fork
avant de lancer la normalisation.

## Variables d'environnement requises

| Variable | Description |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | ID de l'OAuth App GitHub |
| `GITHUB_OAUTH_CLIENT_SECRET` | Secret de l'OAuth App GitHub (aussi clé HMAC state) |
| `GITHUB_OAUTH_TOKEN_KEY` | 32 octets base64 pour AES-256-GCM |
| `GITHUB_OAUTH_CALLBACK_URL` | URL de callback complète (ex. `https://api.gamad.io/auth/github/callback`) |
| `FRONTEND_URL` | URL du frontend pour la redirection post-OAuth |

## Conséquences

- **INV-06 respecté** : toutes les requêtes DB utilisent `orgId + userId` pour l'isolation.
- **CLAUDE.md §8 respecté** : token jamais loggé, clé jamais en clair dans le code.
- **INV-09 respecté** : GitHub OAuth est un adaptateur derrière une interface — le Domain
  n'a aucune dépendance sur GitHub.
- **Backward compatible** : le wizard fonctionne toujours avec PAT manuel.
- **Nouveau** : `github_oauth_tokens` table → migration SQL requise au déploiement.
