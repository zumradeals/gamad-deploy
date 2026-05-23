import { CallbackPort } from '../ports/callback.port';
import type { AgentCallbackPayload } from '@gamad/contracts';

export class CallbackStub extends CallbackPort {
  readonly sent: Array<{ url: string; payload: AgentCallbackPayload }> = [];

  override async send(callbackUrl: string, payload: AgentCallbackPayload): Promise<void> {
    this.sent.push({ url: callbackUrl, payload });
  }
}
