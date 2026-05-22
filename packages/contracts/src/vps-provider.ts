// C-09 — VpsProvider (provisioning serveur abstrait, Hetzner en première implémentation)
// createServer idempotent via le label (UUID interne) — rejoué, pas de doublon (INV-07).
// Un serveur déjà possédé par le client est un cas de première classe (souveraineté).

export type ServerStatus = 'provisioning' | 'ready' | 'error' | 'destroyed';

export interface CreateServerParams {
  region: string;
  size: string;
  ssh_public_key: string;
  /** = server_id interne UUID v4 (INV-05) — garantit l'idempotence. */
  label: string;
}

export interface ProvisionedServer {
  /** provider_server_id et host sont figés à la création, aucune mutation destructive. */
  provider_server_id: string;
  host: string;
  status: ServerStatus;
}

export interface VpsProvider {
  readonly name: string; // ex. "hetzner"
  createServer(params: CreateServerParams): Promise<ProvisionedServer>;
  getStatus(providerServerId: string): Promise<ServerStatus>;
  destroy(providerServerId: string): Promise<void>;
}
