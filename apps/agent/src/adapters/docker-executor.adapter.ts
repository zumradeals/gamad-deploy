// INV-09 — Adaptateur docker compose réel. Spawn uniquement, pas de shell.
// Le deploymentId sert de nom de projet Docker (-p) pour isoler les conteneurs.
// Les variables d'env sont écrites dans un fichier temporaire pour éviter l'exposition en CLI.
// Détection automatique au premier appel : docker compose (v2 plugin) ou docker-compose (v1 standalone).

import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { DockerExecutorPort } from '../ports/docker-executor.port';

interface ComposeCmd { bin: string; prefix: string[] }

export class DockerExecutorAdapter extends DockerExecutorPort {
  // Détecté une seule fois au premier appel, puis mis en cache pour toute la vie du processus.
  private composeCmdPromise: Promise<ComposeCmd> | null = null;

  private getCompose(): Promise<ComposeCmd> {
    if (!this.composeCmdPromise) {
      this.composeCmdPromise = new Promise<ComposeCmd>((resolve) => {
        const child = spawn('docker', ['compose', 'version'], { stdio: 'pipe' });
        child.on('close', (code) => {
          if (code === 0) {
            console.log('[docker] docker compose v2 détecté');
            resolve({ bin: 'docker', prefix: ['compose'] });
          } else {
            console.log('[docker] fallback sur docker-compose v1');
            resolve({ bin: 'docker-compose', prefix: [] });
          }
        });
        child.on('error', () => resolve({ bin: 'docker-compose', prefix: [] }));
      });
    }
    return this.composeCmdPromise;
  }

  async composeUp(
    deploymentId: string,
    composePath: string,
    envVars: Record<string, string>,
  ): Promise<void> {
    const envFilePath = `${composePath}.gamad.env`;
    const envContent = Object.entries(envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    await writeFile(envFilePath, envContent, { mode: 0o600 });

    try {
      const { bin, prefix } = await this.getCompose();
      await this.run(bin, [
        ...prefix,
        '-p', deploymentId,
        '-f', composePath,
        '--env-file', envFilePath,
        'up', '-d', '--build', '--remove-orphans',
      ]);
    } finally {
      await unlink(envFilePath).catch(() => undefined);
    }
  }

  async composeDown(deploymentId: string): Promise<void> {
    const { bin, prefix } = await this.getCompose();
    await this.run(bin, [...prefix, '-p', deploymentId, 'down', '--remove-orphans']);
  }

  async isRunning(deploymentId: string): Promise<boolean> {
    try {
      const { bin, prefix } = await this.getCompose();
      const output = await this.runCapture(bin, [...prefix, '-p', deploymentId, 'ps', '-q']);
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  private run(bin: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: 'pipe' });
      const stderr: string[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`docker exited ${code ?? '?'}: ${stderr.join('')}`));
      });
      child.on('error', reject);
    });
  }

  private runCapture(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: 'pipe' });
      const stdout: string[] = [];
      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve(stdout.join('')) : reject(new Error(`docker exited ${code ?? '?'}`));
      });
      child.on('error', reject);
    });
  }
}

