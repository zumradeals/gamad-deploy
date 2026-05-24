// WebSocket gateway — diffusion temps réel des transitions d'état (C-12).
// Source : DeploymentNotifierService (Postgres NOTIFY après COMMIT) — aucun état spéculatif.
// Protocole : le client envoie { subscribe: deploymentId } pour s'abonner.
// Émis : { type: 'transition', deployment_id, toState, timestamp }.
// Nécessite WsAdapter (@nestjs/platform-ws) dans main.ts.

import type {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect} from '@nestjs/websockets';
import {
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, WebSocket } from 'ws';
import { Inject, Injectable } from '@nestjs/common';
import { DeploymentNotifierService } from './deployment-notifier.service';

@Injectable()
@WebSocketGateway({ path: '/events' })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly unsubscribes = new WeakMap<WebSocket, () => void>();

  constructor(
    @Inject(DeploymentNotifierService)
    private readonly notifier: DeploymentNotifierService,
  ) {}

  afterInit(_server: Server): void {
    // Gateway initialisée — le serveur WS est prêt.
  }

  handleConnection(client: WebSocket): void {
    client.on('message', (raw) => {
      let msg: { subscribe?: string };
      try {
        msg = JSON.parse(raw.toString()) as { subscribe?: string };
      } catch {
        return;
      }

      if (typeof msg.subscribe === 'string') {
        // Annule abonnement précédent si présent.
        this.unsubscribes.get(client)?.();

        const unsubscribe = this.notifier.subscribe(msg.subscribe, (event) => {
          if (client.readyState === client.OPEN) {
            client.send(
              JSON.stringify({
                type: 'transition',
                deployment_id: event.deploymentId,
                toState: event.toState,
                timestamp: new Date().toISOString(),
              }),
            );
          }
        });

        this.unsubscribes.set(client, unsubscribe);
      }
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.unsubscribes.get(client)?.();
    this.unsubscribes.delete(client);
  }
}
