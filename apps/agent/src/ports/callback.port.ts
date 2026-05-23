// C-06 — Port callback vers le control plane.
// Jamais de secret dans le payload (INV-04, DeploymentLoggerService masque avant appel).

import type { AgentCallbackPayload } from '@gamad/contracts';

export abstract class CallbackPort {
  abstract send(callbackUrl: string, payload: AgentCallbackPayload): Promise<void>;
}
