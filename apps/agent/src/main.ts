// Point d'entrée de l'agent GAMAD.
// Variables d'environnement requises : AGENT_TOKEN
// Variables optionnelles : PORT (défaut 7500), CERTBOT_EMAIL

import { createAgentServer } from './delivery/agent.server';
import { DeploymentService } from './services/deployment.service';
import { DeploymentLoggerService } from './services/deployment-logger.service';
import { CallbackAdapter } from './adapters/callback.adapter';
import { GitExecutorAdapter } from './adapters/git-executor.adapter';
import { DockerExecutorAdapter } from './adapters/docker-executor.adapter';
import { NginxExecutorAdapter } from './adapters/nginx-executor.adapter';
import { CertbotExecutorAdapter } from './adapters/certbot-executor.adapter';
import { SnapshotAdapter } from './adapters/snapshot.adapter';

const AGENT_TOKEN = process.env['AGENT_TOKEN'];
const PORT = parseInt(process.env['PORT'] ?? '7500', 10);
const CERTBOT_EMAIL = process.env['CERTBOT_EMAIL'] ?? 'ops@gamad.io';

if (!AGENT_TOKEN) {
  console.error('[gamad-agent] AGENT_TOKEN est requis.');
  process.exit(1);
}

const callback = new CallbackAdapter();
const logger = new DeploymentLoggerService(callback);

const deploymentService = new DeploymentService(
  new GitExecutorAdapter(),
  new DockerExecutorAdapter(),
  new NginxExecutorAdapter(),
  new CertbotExecutorAdapter(),
  new SnapshotAdapter(),
  logger,
  CERTBOT_EMAIL,
);

const server = createAgentServer(deploymentService, AGENT_TOKEN);

server.listen(PORT, () => {
  console.log(`[gamad-agent] Agent démarré sur le port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('[gamad-agent] Arrêt propre.');
    process.exit(0);
  });
});
