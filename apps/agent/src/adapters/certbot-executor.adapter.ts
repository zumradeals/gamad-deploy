// INV-09 — Adaptateur certbot réel. Arguments validés en amont par PdnSecurityValidator.
// --non-interactive + --agree-tos évitent tout prompt bloquant.

import { spawn } from 'node:child_process';
import { CertbotExecutorPort } from '../ports/certbot-executor.port';

export class CertbotExecutorAdapter extends CertbotExecutorPort {
  async obtainCertificate(domain: string, email: string): Promise<void> {
    await this.run([
      'certbot', 'certonly',
      '--nginx',
      '--non-interactive',
      '--agree-tos',
      '-m', email,
      '-d', domain,
    ]);
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(args[0]!, args.slice(1), { stdio: 'pipe' });
      const stderr: string[] = [];
      child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
      child.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(`certbot exited ${code ?? '?'}: ${stderr.join('')}`));
      });
      child.on('error', reject);
    });
  }
}
