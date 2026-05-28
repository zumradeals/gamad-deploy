// INV-09 — Adaptateur nginx réel.
// Configurable via variables d'environnement pour supporter deux modes :
//
//   Mode hôte   (agent natif ou Docker sur VPS dédié) — défaut :
//     GAMAD_NGINX_CONF_DIR    = /etc/nginx/sites-available
//     GAMAD_NGINX_ENABLED_DIR = /etc/nginx/sites-enabled   (symlinks actifs)
//     GAMAD_NGINX_RELOAD_CMD  = nginx -s reload
//
//   Mode Docker (agent Docker sur même VPS que le control-plane) :
//     GAMAD_NGINX_CONF_DIR    = /etc/nginx/gamad-apps      (volume partagé)
//     GAMAD_NGINX_ENABLED_DIR =                            (vide → pas de symlink)
//     GAMAD_NGINX_RELOAD_CMD  = docker exec <nginx-container> nginx -s reload

import { spawn } from 'node:child_process';
import { writeFile, readFile, copyFile, mkdir, unlink, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { NginxExecutorPort } from '../ports/nginx-executor.port';
import type { NginxConfig } from '../ports/nginx-executor.port';

const SITES_AVAILABLE = process.env['GAMAD_NGINX_CONF_DIR'] ?? '/etc/nginx/sites-available';
const SITES_ENABLED   = process.env['GAMAD_NGINX_ENABLED_DIR'] ?? '/etc/nginx/sites-enabled';
const RELOAD_CMD      = (process.env['GAMAD_NGINX_RELOAD_CMD'] ?? 'nginx -s reload').split(' ');
const SNAPSHOT_BASE   = '/var/lib/gamad/snapshots';

export class NginxExecutorAdapter extends NginxExecutorPort {
  async writeConfig(deploymentId: string, config: NginxConfig): Promise<void> {
    const confPath = `${SITES_AVAILABLE}/${deploymentId}.conf`;

    await mkdir(SITES_AVAILABLE, { recursive: true });
    const content = this.renderConfig(config);
    await writeFile(confPath, content, { encoding: 'utf8', mode: 0o644 });

    if (SITES_ENABLED) {
      await mkdir(SITES_ENABLED, { recursive: true });
      const linkPath = `${SITES_ENABLED}/${deploymentId}.conf`;
      if (!existsSync(linkPath)) {
        await symlink(confPath, linkPath);
      }
    }
  }

  async reload(): Promise<void> {
    await this.run(RELOAD_CMD);
  }

  async restoreFromSnapshot(deploymentId: string): Promise<void> {
    const snapshotNginxPath = `${SNAPSHOT_BASE}/${deploymentId}/nginx.conf`;
    const confPath = `${SITES_AVAILABLE}/${deploymentId}.conf`;
    const linkPath = SITES_ENABLED ? `${SITES_ENABLED}/${deploymentId}.conf` : null;

    if (existsSync(snapshotNginxPath)) {
      await copyFile(snapshotNginxPath, confPath);
    } else {
      // Pas de config sauvegardée → supprimer les fichiers créés pendant le déploiement
      if (linkPath) await unlink(linkPath).catch(() => undefined);
      await unlink(confPath).catch(() => undefined);
    }
  }

  /** Sauvegarde la config nginx actuelle dans le répertoire snapshot (appelé par SnapshotAdapter). */
  async saveToSnapshot(deploymentId: string): Promise<void> {
    const confPath = `${SITES_AVAILABLE}/${deploymentId}.conf`;
    const snapshotDir = `${SNAPSHOT_BASE}/${deploymentId}`;
    await mkdir(snapshotDir, { recursive: true });

    if (existsSync(confPath)) {
      await copyFile(confPath, `${snapshotDir}/nginx.conf`);
    } else {
      // Marque l'absence de config pré-existante
      await writeFile(`${snapshotDir}/nginx.absent`, '', 'utf8');
    }
  }

  private renderConfig(config: NginxConfig): string {
    const lines: string[] = [
      `server {`,
      `    listen 80;`,
      `    server_name ${config.domain};`,
      ``,
      `    location / {`,
      `        proxy_pass ${config.upstreamUrl};`,
      `        proxy_set_header Host $host;`,
      `        proxy_set_header X-Real-IP $remote_addr;`,
      `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
      `        proxy_set_header X-Forwarded-Proto $scheme;`,
      `    }`,
      `}`,
    ];

    if (config.https) {
      lines.push(
        ``,
        `server {`,
        `    listen 443 ssl;`,
        `    server_name ${config.domain};`,
        ``,
        `    ssl_certificate /etc/letsencrypt/live/${config.domain}/fullchain.pem;`,
        `    ssl_certificate_key /etc/letsencrypt/live/${config.domain}/privkey.pem;`,
        ``,
        `    location / {`,
        `        proxy_pass ${config.upstreamUrl};`,
        `        proxy_set_header Host $host;`,
        `        proxy_set_header X-Real-IP $remote_addr;`,
        `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
        `        proxy_set_header X-Forwarded-Proto $scheme;`,
        `    }`,
        `}`,
      );
    }

    return lines.join('\n') + '\n';
  }

  private async readFileIfExists(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
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
