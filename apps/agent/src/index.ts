// Agent VPS — squelette (implémentation en P-04)
// Honore C-06 (callbacks) et C-07 (garanties agent).
// S'installe via script idempotent (systemd + Docker + nginx + certbot).
// Ne stocke aucun secret en clair persistant. Aveugle à la source (INV-01).

import type { Agent, AgentDispatchRequest, AgentHealthResponse } from '@gamad/contracts';

export type { Agent, AgentDispatchRequest, AgentHealthResponse };
