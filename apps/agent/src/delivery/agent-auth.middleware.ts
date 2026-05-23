// Authentification de l'agent par agent_token (C-07).
// Le token est transmis dans le header Authorization : Bearer {agent_token}.
// Jamais loggé (CLAUDE.md §8). Comparaison en temps constant pour résister aux timing attacks.
// L'agent_token est injecté comme variable d'environnement au démarrage (INV-10 : aucun secret en clair).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function agentAuthMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  expectedToken: string,
): boolean {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!safeCompare(token, expectedToken)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}
