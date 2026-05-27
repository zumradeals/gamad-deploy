// C-06 — Callback HTTP vers le control plane.
// Utilise node:http/https natif — zéro dépendance externe.
// Jamais de secret dans le payload (DeploymentLoggerService masque en amont).

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { AgentCallbackPayload } from '@gamad/contracts';
import { CallbackPort } from '../ports/callback.port';

export class CallbackAdapter extends CallbackPort {
  async send(callbackUrl: string, payload: AgentCallbackPayload): Promise<void> {
    const body = JSON.stringify(payload);
    const url = new URL(callbackUrl);
    const isHttps = url.protocol === 'https:';
    const requester = isHttps ? httpsRequest : httpRequest;

    await new Promise<void>((resolve, reject) => {
      const req = requester(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
