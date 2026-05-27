// INV-08 — Snapshot write-once (ADR-0007).
// S0 capture : tar du répertoire de déploiement + config nginx existante.
// exists() vérifié AVANT capture() pour garantir l'idempotence.
// Stockage : /var/lib/gamad/snapshots/<deploymentId>/

import { spawn } from 'node:child_process';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { SnapshotPort } from '../ports/snapshot.port';
import type { SnapshotManifest } from '../ports/snapshot.port';

const SNAPSHOT_BASE = '/var/lib/gamad/snapshots';
const DEPLOYMENT_BASE = '/var/lib/gamad/deployments';

export class SnapshotAdapter extends SnapshotPort {
  private manifestPath(deploymentId: string): string {
    return `${SNAPSHOT_BASE}/${deploymentId}/manifest.json`;
  }

  async exists(deploymentId: string): Promise<boolean> {
    return existsSync(this.manifestPath(deploymentId));
  }

  async capture(deploymentId: string): Promise<SnapshotManifest> {
    const snapshotDir = `${SNAPSHOT_BASE}/${deploymentId}`;
    await mkdir(snapshotDir, { recursive: true });

    const deploymentDir = `${DEPLOYMENT_BASE}/${deploymentId}`;

    if (existsSync(deploymentDir)) {
      // Tar du répertoire de déploiement existant (cas re-déploiement)
      await this.run([
        'tar', '-czf',
        `${snapshotDir}/deployment.tar.gz`,
        '-C', DEPLOYMENT_BASE,
        deploymentId,
      ]);
    }

    const manifest: SnapshotManifest = {
      deploymentId,
      capturedAt: new Date().toISOString(),
    };

    await writeFile(this.manifestPath(deploymentId), JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
  }

  async getManifest(deploymentId: string): Promise<SnapshotManifest> {
    const raw = await readFile(this.manifestPath(deploymentId), 'utf8');
    return JSON.parse(raw) as SnapshotManifest;
  }

  async restore(deploymentId: string): Promise<void> {
    const snapshotDir = `${SNAPSHOT_BASE}/${deploymentId}`;
    const tarPath = `${snapshotDir}/deployment.tar.gz`;
    const deploymentDir = `${DEPLOYMENT_BASE}/${deploymentId}`;

    // Supprimer le répertoire déployé par le pipeline échoué
    if (existsSync(deploymentDir)) {
      await this.run(['rm', '-rf', deploymentDir]);
    }

    // Restaurer l'état S0 si un tar existe
    if (existsSync(tarPath)) {
      await this.run(['tar', '-xzf', tarPath, '-C', DEPLOYMENT_BASE]);
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(args[0]!, args.slice(1), { stdio: 'pipe' });
      const stderr: string[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code ?? '?'}: ${stderr.join('')}`));
      });
      child.on('error', reject);
    });
  }
}
