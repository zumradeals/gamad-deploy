# Tests d'intégration différés — Validation VPS réelle

> Ces tests **ne peuvent pas être automatisés** sans infrastructure VPS réelle.
> Ils constituent la checklist de validation manuelle avant toute mise en production.
> Chaque scénario documente : préconditions, action, assertion attendue, pourquoi c'est bloquant.

---

## Dette de test automatisée — à solder en P-06

Ces tests **peuvent être automatisés** (pas de VPS requis) mais n'ont pas encore été écrits.

### TD-01 — Chaîne complète StateMachine + optimistic-lock (Race-2 via PipelineJobRunner)

**Contexte :** E2E-04 prouve l'optimistic-lock de `PipelineRepositoryAdapter` en isolation
(appel direct à `repo.transitionWithLog()`). La `StateMachineService` n'est pas appelée dans
ce test. La défense en profondeur (ADR-0008) — StateMachine valide FIRST, optimistic-lock
garantit l'atomicité — n'est pas couverte bout-en-bout.

**Test à écrire :** déclencher deux `PipelineJobRunner.handleFailure()` simultanés sur le même
`deploymentId` en état RUNNING. Prouver que :
- `StateMachineService.transition(RUNNING, FAILED)` est appelée dans chaque path (spy)
- Exactement 1 ligne dans `deployment_state_transitions` (optimistic-lock gagne)
- Le 2e path ne lève pas d'erreur visible (no-op silencieux correct pour une race)

**Référence :** ADR-0008 §"Gap de couverture de test — E2E-04"

---

## Contexte

Les tests unitaires de P-02 et P-03 prouvent le comportement sur stubs.
Les tests de P-04 prouvent la sécurité structurelle (INV-10) et l'idempotence (INV-07)
sur des exécuteurs simulés.

**Ce qui ne peut pas être prouvé hors VPS :**
- `docker compose up` réel (réseau, volumes, registre d'images)
- Certbot + ACME challenge (domaine public + port 80 accessible)
- nginx config reload sans coupure de trafic
- Rollback restaurant un état système réel (pas un manifest JSON)
- Comportement sous crash vrai (SIGKILL mid-deploy)
- Latence réseau et timeouts réels des health checks

---

## Checklist de validation manuelle

### VPS-01 — `docker compose up` réel depuis le PDN

**Préconditions :**
- VPS avec Docker Engine installé
- PDN généré depuis un repo de test avec `has_compose_file: true`
- Clé git valide pour cloner le repo

**Action :** lancer un déploiement complet via `POST /deploy`

**Assertions :**
- [ ] `docker compose up -d` s'exécute sans erreur
- [ ] Les containers démarrent et passent en état `running`
- [ ] Le health check HTTP (`/health`) retourne 200 dans le délai configuré
- [ ] La transition RUNNING → SUCCESS est enregistrée en base

**Pourquoi bloquant :** le `DockerExecutorPort` stub retourne toujours succès —
un vrai compose peut échouer sur image manquante, port occupé, volume inexistant.

---

### VPS-02 — Certbot + ACME sur domaine public

**Préconditions :**
- Domaine DNS pointant vers le VPS (A record propagé)
- Port 80 accessible depuis Internet
- Email valide pour Let's Encrypt

**Action :** déploiement avec `nginx.tls: { enabled: true, domain: "app.example.com" }`

**Assertions :**
- [ ] Certbot obtient le certificat sans erreur
- [ ] nginx sert HTTPS sur le domaine
- [ ] Le health check HTTPS passe

**Pourquoi bloquant :** rate-limit Let's Encrypt (5 certificats/semaine/domaine).
En staging, utiliser `--staging` flag de certbot.

---

### VPS-03 — Rollback restaurant l'état système réel

**Préconditions :**
- Un déploiement S0 capturé (containers, nginx config, volumes)
- Un déploiement S1 échoué (containers S1 démarrés, certbot échoué)

**Action :** rollback déclenché par `on_error_stop: true`

**Assertions :**
- [ ] Containers S1 stoppés (`docker compose down`)
- [ ] Config nginx restaurée depuis le snapshot S0
- [ ] Containers S0 redémarrés (`docker compose up -d`)
- [ ] nginx reload sans coupure visible
- [ ] État `ROLLED_BACK` enregistré en base
- [ ] Health check S0 passe après restauration

**Pourquoi bloquant :** le stub simule le rollback sans vérification d'état réel.
Un crash pendant le rollback lui-même (ROLLBACK_PARTIAL) n'est pas récupérable automatiquement.

---

### VPS-04 — Comportement sous crash réel (SIGKILL mid-deploy)

**Préconditions :** déploiement en cours (docker pull en cours)

**Action :** SIGKILL du processus agent pendant `docker compose pull`

**Assertions :**
- [ ] BullMQ rejoue le job (retry count < maxAttempts)
- [ ] `ensureSnapshot` détecte le manifest S0 → pas de re-capture
- [ ] `docker compose up` repart depuis un état propre (idempotence)
- [ ] Pas de containers orphelins ni de volumes corrompus

**Pourquoi bloquant :** le crash réel peut laisser des objets Docker dans un état
intermédiaire (`docker compose up` lancé, containers à moitié démarrés).

---

### VPS-05 — Joignabilité réseau agent → control plane (callbacks C-06)

**Préconditions :** agent sur VPS, control plane sur serveur séparé

**Action :** agent tente de callback après chaque étape

**Assertions :**
- [ ] Callback `POST /agent/callback` atteint le control plane
- [ ] Timeout réseau géré (retry avec backoff côté agent)
- [ ] Si control plane inaccessible : agent log l'erreur mais ne plante pas

**Pourquoi bloquant :** en test unitaire, `CallbackPort` stub retourne toujours succès.
Une erreur réseau réelle (firewall, TLS certificate mismatch) ne peut pas être simulée.

---

### VPS-06 — Cas non-récupérable : ROLLBACK_PARTIAL

**Description :**
Un crash pendant le rollback lui-même (ex : nginx restore échoue après docker down)
laisse le VPS dans un état incohérent : containers S0 arrêtés, containers S1 arrêtés,
nginx en état inconnu.

**Ce cas n'est PAS géré automatiquement.** C'est une décision d'architecture :
la récupération d'un rollback partiel nécessite une intervention humaine.

**Procédure manuelle :**
1. SSH sur le VPS
2. `docker compose -f /var/lib/gamad/snapshots/{deploymentId}/docker-compose.yml up -d`
3. Restauration manuelle de la config nginx depuis le snapshot
4. Mise à jour manuelle de l'état en base : `UPDATE deployments SET state = 'FAILED'`
   (après vérification — ceci EST un UPDATE et non un INSERT ; cas exceptionnel documenté)

**Alerte :** mettre en place monitoring Prometheus/alerting sur l'état `ROLLED_BACK_PARTIAL`
avant mise en production.

---

### VPS-07 — Aucun secret dans les logs système (journal, stdout)

**Action :** déploiement complet avec `git_token` et `agent_token` dans la config

**Assertions :**
- [ ] `journalctl -u gamad-agent` ne contient aucune occurrence de `git_token`
- [ ] `journalctl -u gamad-agent` ne contient aucune occurrence de `agent_token`
- [ ] Les logs de nginx ne contiennent pas de token dans les URLs
- [ ] Les variables d'environnement du container ne sont pas loguées en clair

**Pourquoi bloquant :** les tests unitaires masquent les secrets dans les stubs.
Un vrai executor peut logger la commande complète (ex : `git clone https://token@repo`).

---

## Priorité de validation

| Scénario | Priorité | Bloquant prod ? |
|---|---|---|
| VPS-01 docker compose réel | P0 | Oui |
| VPS-03 rollback réel | P0 | Oui |
| VPS-07 secrets dans logs | P0 | Oui |
| VPS-04 crash SIGKILL | P1 | Oui |
| VPS-02 certbot ACME | P1 | Oui (si TLS requis) |
| VPS-05 callbacks réseau | P1 | Oui |
| VPS-06 ROLLBACK_PARTIAL | P2 | Non (monitoring requis) |

---

## P-05 — Validation complémentaire (REST + WebSocket + BullMQ réel)

Ces scénarios valident la couche de livraison et l'intégration bout-en-bout avec BullMQ/Redis + Postgres réels.
Les tests automatisés `E2E-01` à `E2E-04` couvrent les cas avec stubs d'agent ; les cas ci-dessous nécessitent un agent réel.

---

### VPS-08 — WebSocket : réception SUCCESS via connexion WS réelle

**Préconditions :**
- Control plane démarré avec WsAdapter (`main.ts`)
- Client WebSocket connecté à `ws://host:3000/events`
- Client envoie `{ "subscribe": "{deploymentId}" }`

**Action :** déploiement lancé via `POST /deployments`

**Assertions :**
- [ ] Le client WS reçoit `{ type: 'transition', toState: 'RUNNING', deployment_id, timestamp }`
- [ ] Le client WS reçoit `{ type: 'transition', toState: 'SUCCESS', deployment_id, timestamp }`
- [ ] Aucun événement WS avant le COMMIT (aucun état spéculatif)

**Pourquoi différé :** requiert un control plane HTTP démarré + client WS externe.

---

### VPS-09 — Authentification TenantMiddleware sur POST /deployments

**Préconditions :** JWT_SECRET configuré dans l'environnement

**Actions :**
1. Requête sans Authorization header
2. Requête avec JWT invalide
3. Requête avec JWT valide (org_id + user_id)

**Assertions :**
- [ ] 401 sur requête sans header
- [ ] 401 sur JWT invalide
- [ ] 201 sur JWT valide avec projet appartenant au tenant
- [ ] 404 si project_id appartient à un autre tenant (INV-06)

**Pourquoi différé :** requiert un JWT signé avec JWT_SECRET réel.

---

### VPS-10 — Callback agent → POST /agent/callback sans JWT

**Préconditions :** agent configuré avec l'URL callback du control plane

**Action :** agent envoie `POST /agent/callback` pendant un déploiement

**Assertions :**
- [ ] 204 reçu par l'agent
- [ ] La ligne apparaît dans `deployment_logs` (INSERT-only, INV-04)
- [ ] Aucune transition d'état déclenchée par le callback (INV-03)

**Pourquoi différé :** requiert un vrai agent VPS.

---

### VPS-11 — Idempotence sous crash Redis (reconnexion BullMQ)

**Préconditions :** job `provision-db` en cours, Redis redémarré

**Action :** SIGKILL Redis pendant le traitement du job

**Assertions :**
- [ ] BullMQ reconnecte automatiquement après redémarrage Redis
- [ ] Le job est retenté (attempts: 3)
- [ ] `isStepDone` retourne `true` si le step a déjà été marqué → pas de double-exécution
- [ ] Le pipeline aboutit à SUCCESS ou FAILED (jamais coincé en RUNNING)

**Pourquoi différé :** crash Redis réel dans un container Docker.

---

### VPS-12 — Contrainte d'unicité slug organisations

**Action :** créer deux organisations avec le même slug

**Assertions :**
- [ ] Deuxième INSERT lève une erreur de contrainte unique (`uq` sur `organizations.slug`)
- [ ] L'erreur est gérée proprement par l'API (409 Conflict, pas 500)

**Pourquoi différé :** test de contrainte DB qui dépend des migrations appliquées.

---

### VPS-13 — Démarrage propre : control plane sans DATABASE_URL

**Action :** démarrer le control plane sans la variable DATABASE_URL

**Assertions :**
- [ ] Le processus démarre mais les routes HTTP retournent 503 (ou l'app refuse de démarrer)
- [ ] Le message d'erreur ne contient pas de stack trace exposée au client
- [ ] `DeploymentNotifierService.onModuleInit()` skip le LISTEN sans planter

**Pourquoi différé :** test de démarrage en conditions dégradées.

---

### VPS-14 — Race 3 : deux POST /deployments simultanés pour le même projet

**Préconditions :** projet existant, deux requêtes HTTP simultanées

**Action :** `POST /deployments` × 2 en parallèle sur le même `project_id`

**Assertions :**
- [ ] Deux `deployment_id` distincts créés (UUID v4 — INV-05)
- [ ] Les deux déploiements entrent en RUNNING indépendamment
- [ ] Pas d'interférence entre les deux pipelines BullMQ
- [ ] L'agent reçoit bien deux dispatches séparés (ou l'un échoue proprement si ressources insuffisantes)

**Pourquoi différé :** requiert un agent et un VPS réels pour mesurer la contention.

---

## Priorité de validation étendue (P-05)

| Scénario | Priorité | Bloquant prod ? |
|---|---|---|
| VPS-08 WebSocket SUCCESS réel | P0 | Oui |
| VPS-09 TenantMiddleware JWT | P0 | Oui |
| VPS-10 Callback agent réel | P1 | Oui |
| VPS-11 Redis crash + reconnexion | P1 | Oui |
| VPS-13 Démarrage sans DATABASE_URL | P1 | Non (dégradation gracieuse) |
| VPS-12 Contrainte slug unique | P2 | Non |
| VPS-14 Race 3 double POST | P2 | Non (déploiements indépendants) |
