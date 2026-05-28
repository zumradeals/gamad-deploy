// Exécute les health checks du PDN depuis l'agent (côté VPS).
// Substitue localhost:{containerPort} → {GAMAD_HOST_GATEWAY}:{stableHostPort}.
//
// Pourquoi : quand l'agent tourne dans Docker (réseau bridge), `localhost` pointe
// sur le container agent et non sur l'hôte. Il faut passer par le gateway Docker.
//
// GAMAD_HOST_GATEWAY contrôle l'adresse hôte vue depuis l'agent :
//   - Agent Docker  : "host.docker.internal" (requiert --add-host=host.docker.internal:host-gateway)
//   - Agent natif   : "localhost" (défaut si variable absente)

import type { HealthCheck } from '@gamad/contracts';
import { stableHostPort } from './port-allocation';

const HOST_GATEWAY = process.env['GAMAD_HOST_GATEWAY'] ?? 'localhost';

export async function runHealthChecks(
  deploymentId: string,
  checks: HealthCheck[],
): Promise<{ passed: boolean; details: string[] }> {
  const hostPort = stableHostPort(deploymentId);
  const details: string[] = [];
  let passed = true;

  for (const check of checks) {
    const url = check.url.replace(/localhost:\d+/, `${HOST_GATEWAY}:${hostPort}`);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), check.timeout_s * 1000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const ok = res.status === check.expected_status;
      if (!ok) passed = false;
      details.push(`${check.name}: HTTP ${res.status} (expected ${check.expected_status}) ${ok ? '✓' : '✗'}`);
    } catch (err) {
      passed = false;
      details.push(`${check.name}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { passed, details };
}
