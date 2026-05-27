// INV-09 — Adaptateur git réel. Jamais de shell string interpolation.
// Chaque argument git est un élément de tableau séparé (spawn, pas exec).
// INV-10 — L'entrée PDN est validée par PdnSecurityValidator avant d'arriver ici.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { GitExecutorPort } from '../ports/git-executor.port';
import type { GitRef } from '../ports/git-executor.port';

export class GitExecutorAdapter extends GitExecutorPort {
  async clone(
    _deploymentId: string,
    url: string,
    ref: GitRef,
    destPath: string,
  ): Promise<void> {
    if (existsSync(destPath)) {
      // Idempotence : fetch + reset au lieu de recloner
      await this.run('git', ['-C', destPath, 'fetch', '--all', '--tags', '--prune'], {});
      const target = ref.type === 'branch' ? `origin/${ref.value}` : ref.value;
      await this.run('git', ['-C', destPath, 'reset', '--hard', target], {});
      return;
    }

    if (ref.type === 'commit') {
      // Pour un commit hash : clone sans depth puis checkout
      await this.run('git', ['clone', url, destPath], {});
      await this.run('git', ['-C', destPath, 'checkout', ref.value], {});
    } else {
      // branch ou tag : clone shallow en ciblant directement la ref
      await this.run('git', ['clone', '--depth=1', '--branch', ref.value, url, destPath], {});
    }
  }

  private run(cmd: string, args: string[], env: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
        stdio: 'pipe',
      });

      const stderr: string[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git exited ${code ?? '?'}: ${stderr.join('')}`));
        }
      });

      child.on('error', reject);
    });
  }
}
