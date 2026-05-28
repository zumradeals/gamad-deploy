// Orchestrateur principal du pipeline agent (C-07).
// Ordre : validate → ensureSnapshot → clone → docker up → nginx → certbot.
// En cas d'erreur + on_error_stop : rollback (docker down → nginx restore → snapshot restore).
// L'agent est aveugle à la source (INV-01) : il ne lit que le PDN résolu.
// Idempotence par deploymentId (ADR-0007) : chaque opération destructive vérifie son marker.

import type { AgentDispatchRequest, PlanDeDeploiementNormalise } from '@gamad/contracts';
import type { GitExecutorPort } from '../ports/git-executor.port';
import type { DockerExecutorPort } from '../ports/docker-executor.port';
import type { NginxExecutorPort } from '../ports/nginx-executor.port';
import type { NginxConfig } from '../ports/nginx-executor.port';
import type { CertbotExecutorPort } from '../ports/certbot-executor.port';
import type { SnapshotPort } from '../ports/snapshot.port';
import type { SnapshotManifest } from '../ports/snapshot.port';
import type { DeploymentLoggerService } from './deployment-logger.service';
import { PdnSecurityValidatorService } from './pdn-security-validator.service';

const BASE_PATH = '/var/lib/gamad/deployments';

export class DeploymentService {
  private readonly securityValidator = new PdnSecurityValidatorService();

  constructor(
    private readonly git: GitExecutorPort,
    private readonly docker: DockerExecutorPort,
    private readonly nginx: NginxExecutorPort,
    private readonly certbot: CertbotExecutorPort,
    private readonly snapshot: SnapshotPort,
    private readonly logger: DeploymentLoggerService,
    private readonly certbotEmail: string = 'ops@gamad.io',
  ) {}

  async deploy(request: AgentDispatchRequest): Promise<void> {
    const { deployment_id, resolved_plan: pdn, callback_url } = request;

    // INV-10 : valide structurellement avant tout appel de port.
    this.securityValidator.validate(pdn);

    // ADR-0007 : snapshot write-once avant toute action destructive.
    await this.ensureSnapshot(deployment_id, callback_url);

    try {
      await this.logger.log(callback_url, deployment_id, 'step_started', 'git-clone');
      await this.git.clone(
        deployment_id,
        pdn.source.url,
        pdn.source.ref,
        `${BASE_PATH}/${deployment_id}`,
      );

      await this.logger.log(callback_url, deployment_id, 'step_started', 'docker-up');
      if (!(await this.docker.isRunning(deployment_id))) {
        const envVars = this.buildEnvMap(pdn);
        const composePath = `${BASE_PATH}/${deployment_id}/${pdn.artifact.compose_file ?? 'docker-compose.yml'}`;
        await this.docker.composeUp(deployment_id, composePath, envVars);
      }

      if (pdn.proxy.domain !== undefined) {
        await this.logger.log(callback_url, deployment_id, 'step_started', 'nginx-config');
        const nginxConfig = this.buildNginxConfig(pdn);
        await this.nginx.writeConfig(deployment_id, nginxConfig);
        await this.nginx.reload();

        if (pdn.proxy.https) {
          await this.logger.log(callback_url, deployment_id, 'step_started', 'certbot');
          await this.certbot.obtainCertificate(pdn.proxy.domain, this.certbotEmail);
          await this.nginx.reload();
        }
      }

      await this.logger.log(callback_url, deployment_id, 'finished', 'déploiement terminé');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logger.log(callback_url, deployment_id, 'log', message, undefined, 'error').catch(() => undefined);
      if (pdn.policies.on_error_stop) {
        await this.rollback(deployment_id, callback_url, pdn);
      }
      throw error;
    }
  }

  async ensureSnapshot(deploymentId: string, callbackUrl: string): Promise<SnapshotManifest> {
    if (await this.snapshot.exists(deploymentId)) {
      // ADR-0007 : write-once — retourne S0 inchangé sans jamais recapturer.
      return this.snapshot.getManifest(deploymentId);
    }
    const manifest = await this.snapshot.capture(deploymentId);
    await this.logger.log(callbackUrl, deploymentId, 'step_done', 'snapshot-capturé', {
      capturedAt: manifest.capturedAt,
    });
    return manifest;
  }

  private async rollback(
    deploymentId: string,
    callbackUrl: string,
    pdn: PlanDeDeploiementNormalise,
  ): Promise<void> {
    await this.logger.log(callbackUrl, deploymentId, 'step_started', 'rollback');
    await this.docker.composeDown(deploymentId);
    if (pdn.proxy.domain !== undefined) {
      await this.nginx.restoreFromSnapshot(deploymentId);
      await this.nginx.reload();
    }
    await this.snapshot.restore(deploymentId);
    await this.logger.log(callbackUrl, deploymentId, 'finished', 'rollback terminé');
  }

  private buildEnvMap(pdn: PlanDeDeploiementNormalise): Record<string, string> {
    const result: Record<string, string> = {};
    for (const envVar of pdn.env_vars) {
      if (envVar.default !== undefined) {
        result[envVar.name] = envVar.default;
      }
    }
    return result;
  }

  private buildNginxConfig(pdn: PlanDeDeploiementNormalise): NginxConfig {
    const firstPort = Object.values(pdn.runtime.ports)[0] ?? 3000;
    return {
      domain: pdn.proxy.domain ?? '',
      upstreamUrl: `http://localhost:${firstPort}`,
      https: pdn.proxy.https,
    };
  }
}
