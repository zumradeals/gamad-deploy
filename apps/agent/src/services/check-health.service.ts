// Exécute les health checks du PDN depuis l'agent (côté VPS).
// Substitue localhost:{containerPort} → localhost:{stableHostPort}
// pour que les checks atteignent le port hôte réellement mappé.

import type { HealthCheck } from '@gamad/contracts';
import { stableHostPort } from './port-allocation';

export async function runHealthChecks(
  deploymentId: string,
  checks: HealthCheck[],
): Promise<{ passed: boolean; details: string[] }> {
  const hostPort = stableHostPort(deploymentId);
  const details: string[] = [];
  let passed = true;

  for (const check of checks) {
    const url = check.url.replace(/localhost:\d+/, `localhost:${hostPort}`);
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
