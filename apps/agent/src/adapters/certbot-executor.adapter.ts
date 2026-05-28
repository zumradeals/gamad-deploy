// INV-09 — Adaptateur certbot réel. Arguments validés en amont par PdnSecurityValidator.
// --non-interactive + --agree-tos évitent tout prompt bloquant.
//
// GAMAD_CERTBOT_AUTHENTICATOR contrôle le mode de validation ACME :
//   "nginx"    (défaut) → utilise le plugin nginx du certbot hôte
//   "webroot"  → utilise le webroot du nginx Docker (requiert GAMAD_CERTBOT_WEBROOT)
//   "standalone" → arrête temporairement le port 80 (à éviter en prod)

import { spawn } from 'node:child_process';
import { CertbotExecutorPort } from '../ports/certbot-executor.port';

const AUTHENTICATOR = process.env['GAMAD_CERTBOT_AUTHENTICATOR'] ?? 'nginx';
const WEBROOT_PATH  = process.env['GAMAD_CERTBOT_WEBROOT'] ?? '/var/www/certbot';

export class CertbotExecutorAdapter extends CertbotExecutorPort {
  async obtainCertificate(domain: string, email: string): Promise<void> {
    const authArgs = AUTHENTICATOR === 'webroot'
      ? ['--webroot', '-w', WEBROOT_PATH]
      : [`--${AUTHENTICATOR}`];

    await this.run([
      'certbot', 'certonly',
      ...authArgs,
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
