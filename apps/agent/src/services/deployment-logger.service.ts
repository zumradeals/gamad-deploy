// Wraps CallbackPort pour garantir qu'aucun secret n'apparaît dans les callbacks (C-11).
// Masque les champs connus (agent_token, git_token) et les valeurs d'env_vars secret=true.
// Rule : CLAUDE.md §8 "Tu ne logges jamais un secret (git_token, agent_token, mots de passe)."

import type { AgentCallbackPayload } from '@gamad/contracts';
import type { CallbackPort } from '../ports/callback.port';

const SECRET_FIELD_NAMES = new Set(['agent_token', 'git_token', 'password', 'secret', 'token']);

export class DeploymentLoggerService {
  constructor(private readonly callback: CallbackPort) {}

  async log(
    callbackUrl: string,
    deploymentId: string,
    event: AgentCallbackPayload['event'],
    message?: string,
    payload?: Record<string, unknown>,
    level?: AgentCallbackPayload['level'],
  ): Promise<void> {
    const sanitizedPayload = payload !== undefined ? this.sanitize(payload) : undefined;
    const basePayload: AgentCallbackPayload = {
      deployment_id: deploymentId,
      event,
      ...(level !== undefined ? { level } : {}),
      ...(message !== undefined ? { message } : {}),
      ...(sanitizedPayload !== undefined ? { payload: sanitizedPayload } : {}),
    };
    await this.callback.send(callbackUrl, basePayload);
  }

  sanitize(payload: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (SECRET_FIELD_NAMES.has(key.toLowerCase())) {
        result[key] = '[REDACTED]';
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
