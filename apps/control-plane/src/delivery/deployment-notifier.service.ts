// Service de notification temps réel basé sur Postgres LISTEN/NOTIFY.
// Source de vérité : seules les transitions COMMITÉES déclenchent un événement (INV-04).
// Utilisé par EventsGateway (WebSocket) et directement dans les tests d'intégration.
// Connexion pg dédiée (distincte du pool Drizzle) : LISTEN ne peut pas partager une connexion de pool.

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import type { DeploymentState } from '@gamad/contracts';

export interface DeploymentTransitionEvent {
  deploymentId: string;
  toState: DeploymentState;
}

type EventCallback = (event: DeploymentTransitionEvent) => void;

@Injectable()
export class DeploymentNotifierService implements OnModuleInit, OnModuleDestroy {
  private client: pg.Client | null = null;
  private readonly listeners = new Map<string, Set<EventCallback>>();

  async onModuleInit(): Promise<void> {
    const url = process.env['DATABASE_URL'];
    if (!url) return; // Mode test sans DB réelle : désactivé

    this.client = new pg.Client({ connectionString: url });
    await this.client.connect();
    await this.client.query('LISTEN deployment_transitions');

    this.client.on('notification', (msg) => {
      if (!msg.payload) return;
      let event: DeploymentTransitionEvent;
      try {
        event = JSON.parse(msg.payload) as DeploymentTransitionEvent;
      } catch {
        return;
      }
      this.dispatch(event);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.end().catch(() => {});
    this.client = null;
  }

  /** Subscribe à toutes les transitions d'un déploiement. Retourne l'unsubscribe. */
  subscribe(deploymentId: string, callback: EventCallback): () => void {
    if (!this.listeners.has(deploymentId)) {
      this.listeners.set(deploymentId, new Set());
    }
    this.listeners.get(deploymentId)!.add(callback);
    return () => {
      this.listeners.get(deploymentId)?.delete(callback);
    };
  }

  /** Permet aux tests d'émettre un événement synthétique sans passer par Postgres. */
  emit(event: DeploymentTransitionEvent): void {
    this.dispatch(event);
  }

  private dispatch(event: DeploymentTransitionEvent): void {
    this.listeners.get(event.deploymentId)?.forEach((cb) => cb(event));
  }
}
