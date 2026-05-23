// Agent VPS — C-06 (callbacks) + C-07 (garanties agent).
// Honore INV-01 (aveugle à la source), INV-08 (on_error_stop), INV-10 (pas de commande shell).
// Idempotence par deploymentId (ADR-0007).

export { PdnSecurityValidatorService, PdnSecurityValidatorError } from './services/pdn-security-validator.service';
export { DeploymentService } from './services/deployment.service';
export { DeploymentLoggerService } from './services/deployment-logger.service';
export { createAgentServer } from './delivery/agent.server';
export { agentAuthMiddleware } from './delivery/agent-auth.middleware';
export { GitExecutorPort } from './ports/git-executor.port';
export type { GitRef } from './ports/git-executor.port';
export { DockerExecutorPort } from './ports/docker-executor.port';
export { NginxExecutorPort } from './ports/nginx-executor.port';
export type { NginxConfig } from './ports/nginx-executor.port';
export { CertbotExecutorPort } from './ports/certbot-executor.port';
export { SnapshotPort } from './ports/snapshot.port';
export type { SnapshotManifest } from './ports/snapshot.port';
export { CallbackPort } from './ports/callback.port';
