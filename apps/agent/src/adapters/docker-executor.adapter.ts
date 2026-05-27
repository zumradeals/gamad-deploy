// INV-09 — Adaptateur docker compose réel. Spawn uniquement, pas de shell.
// Le deploymentId sert de nom de projet Docker (-p) pour isoler les conteneurs.
// Les variables d'env sont écrites dans un fichier temporaire pour éviter l'exposition en CLI.

import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { DockerExecutorPort } from '../ports/docker-executor.port';

export class DockerExecutorAdapter extends DockerExecutorPort {
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
      await this.run([
        'compose',
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
    await this.run(['compose', '-p', deploymentId, 'down', '--remove-orphans']);
  }

  async isRunning(deploymentId: string): Promise<boolean> {
    try {
      const output = await this.runCapture([
        'compose', '-p', deploymentId, 'ps', '-q',
      ]);
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      const stderr: string[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`docker exited ${code ?? '?'}: ${stderr.join('')}`));
      });
      child.on('error', reject);
    });
  }

  private runCapture(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      const stdout: string[] = [];
      child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve(stdout.join('')) : reject(new Error(`docker exited ${code ?? '?'}`));
      });
      child.on('error', reject);
    });
  }
}
