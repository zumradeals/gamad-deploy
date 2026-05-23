# Tests d'intégration différés — Validation VPS réelle

> Ces tests **ne peuvent pas être automatisés** sans infrastructure VPS réelle.
> Ils constituent la checklist de validation manuelle avant toute mise en production.
> Chaque scénario documente : préconditions, action, assertion attendue, pourquoi c'est bloquant.

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
