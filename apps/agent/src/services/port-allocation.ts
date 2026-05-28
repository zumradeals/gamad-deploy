// Port hôte stable par deploymentId — hash dans la plage 10000–59999.
// Idempotent : même deploymentId → même port (ADR-0007).
// Évite tout conflit avec les ports système (80, 443, 3000…).

export function stableHostPort(deploymentId: string): number {
  let hash = 0;
  for (let i = 0; i < deploymentId.length; i++) {
    hash = ((hash << 5) - hash + deploymentId.charCodeAt(i)) | 0;
  }
  return 10000 + (Math.abs(hash) % 50000);
}
