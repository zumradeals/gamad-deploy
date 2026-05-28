// Delivery layer de l'agent : serveur HTTP minimal (node:http, zéro framework).
// Trois endpoints : POST /deploy (C-06), POST /check-health, GET /agent/health (C-07).
// Aucune logique métier ici — délègue à DeploymentService et runHealthChecks.

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AgentDispatchRequest, AgentHealthResponse, HealthCheck } from '@gamad/contracts';
import type { DeploymentService } from '../services/deployment.service';
import { agentAuthMiddleware } from './agent-auth.middleware';
import { runHealthChecks } from '../services/check-health.service';

const AGENT_VERSION = '0.1.0';

export function createAgentServer(
  deploymentService: DeploymentService,
  agentToken: string,
): Server {
  const startedAt = Date.now();

  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (req.method === 'GET' && url === '/agent/health') {
      const body: AgentHealthResponse = {
        status: 'ok',
        version: AGENT_VERSION,
        uptime_s: Math.floor((Date.now() - startedAt) / 1000),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }

    if (!agentAuthMiddleware(req, res, agentToken)) return;

    if (req.method === 'POST' && url === '/deploy') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let parsed: AgentDispatchRequest;
        try {
          parsed = JSON.parse(body) as AgentDispatchRequest;
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        deploymentService.deploy(parsed)
          .then(() => {
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accepted: true }));
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[gamad-agent] deploy ${parsed.deployment_id} FAILED: ${message}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
          });
        return;
      });
      return;
    }

    if (req.method === 'POST' && url === '/check-health') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        let parsed: { deployment_id: string; checks: HealthCheck[] };
        try {
          parsed = JSON.parse(body) as { deployment_id: string; checks: HealthCheck[] };
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
        runHealthChecks(parsed.deployment_id, parsed.checks)
          .then((result) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          })
          .catch((err: unknown) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          });
        return;
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
}
