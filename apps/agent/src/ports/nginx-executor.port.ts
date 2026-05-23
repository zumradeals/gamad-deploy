// INV-09 — Port nginx isolé. Jamais d'écriture directe dans /etc/nginx.
// restoreFromSnapshot restaure la config sauvegardée dans le snapshot S0 (INV-08).

export interface NginxConfig {
  domain: string;
  upstreamUrl: string;
  https: boolean;
}

export abstract class NginxExecutorPort {
  abstract writeConfig(deploymentId: string, config: NginxConfig): Promise<void>;
  abstract reload(): Promise<void>;
  abstract restoreFromSnapshot(deploymentId: string): Promise<void>;
}
