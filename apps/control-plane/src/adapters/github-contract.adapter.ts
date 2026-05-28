// Adaptateur GitHub pour l'écriture de gamad.json (C-13, INV-09).
// Implémente les deux modes (PR / direct) avec transaction compensatoire (ADR-0009).
// git_token : jamais loggé, transmis uniquement dans Authorization header (CLAUDE.md §8).

import { Injectable } from '@nestjs/common';
import { ContratRepoSchema } from '@gamad/contracts';
import type { ValidatedContractDraft } from '../domain/contract-generator/validated-contract-draft';
import { GitWritePort } from './git-write.port';
import type { GitWriteParams, GitWriteResult } from './git-write.port';

interface GitHubRef { object: { sha: string } }
interface GitHubContent { sha?: string; download_url?: string }
interface GitHubPr { html_url: string }
interface GitHubCommit { commit: { html_url: string } }

@Injectable()
export class GithubContractAdapter extends GitWritePort {
  override async commitGamadJson(
    validatedDraft: ValidatedContractDraft,
    params: GitWriteParams,
  ): Promise<GitWriteResult> {
    // Consentement 2 : écriture directe sur la branche par défaut (ADR-0009).
    if (
      params.mode === 'direct' &&
      params.targetBranch === params.defaultBranch &&
      !params.confirmDefaultBranch
    ) {
      throw new Error(
        `Écriture directe sur "${params.defaultBranch}" (branche par défaut) : ` +
        'confirm_default_branch: true requis (ADR-0009).',
      );
    }

    // Validation Zod du contrat avant tout appel réseau.
    ContratRepoSchema.parse(validatedDraft.draft.contract);

    const content = JSON.stringify(validatedDraft.draft.contract, null, 2);

    if (params.mode === 'pr') {
      return this.createPr(validatedDraft, params, content);
    }
    return this.commitDirect(params, content);
  }

  // ── Mode PR ──────────────────────────────────────────────────────────────────

  private async createPr(
    validatedDraft: ValidatedContractDraft,
    params: GitWriteParams,
    content: string,
  ): Promise<GitWriteResult> {
    const { owner, repoName, gitToken, targetBranch, draftId } = {
      ...params,
      draftId: validatedDraft.draftId,
    };
    const base = `https://api.github.com/repos/${owner}/${repoName}`;
    const headers = this.headers(gitToken);
    const newBranch = `gamad/contract-${draftId}`;

    // 1. SHA de la branche de base.
    const baseSha = await this.getBranchSha(base, targetBranch, headers);

    // 2. Création de la branche de travail (point de non-retour → try-catch).
    await this.ghPost(`${base}/git/refs`, headers, {
      ref: `refs/heads/${newBranch}`,
      sha: baseSha,
    });

    try {
      // 3. Vérifie l'existence de gamad.json.
      const existing = await this.getFileInfo(base, newBranch, headers);
      this.assertOverwrite(existing, params.overwriteExisting);

      // 4. Écrit les fichiers générés (Dockerfile, docker-compose.yml, nginx.conf…).
      for (const file of validatedDraft.draft.generated_files ?? []) {
        const fileSha = await this.getFileSha(base, file.path, newBranch, headers);
        await this.ghPut(`${base}/contents/${encodeURIComponent(file.path)}`, headers, {
          message: `chore: add ${file.path} (via GAMAD Deploy, draft ${draftId})`,
          content: Buffer.from(file.content).toString('base64'),
          branch: newBranch,
          ...(fileSha ? { sha: fileSha } : {}),
        });
      }

      // 5. Écrit gamad.json sur la branche.
      await this.ghPut(`${base}/contents/gamad.json`, headers, {
        message: `chore: add gamad.json (via GAMAD Deploy, draft ${draftId})`,
        content: Buffer.from(content).toString('base64'),
        branch: newBranch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      });

      // 6. Ouvre la PR.
      const pr = await this.ghPost<GitHubPr>(`${base}/pulls`, headers, {
        title: 'chore: add gamad.json (GAMAD Deploy)',
        body: this.prBody(validatedDraft),
        head: newBranch,
        base: targetBranch,
      });

      return { mode: 'pr', url: pr.html_url };
    } catch (err) {
      // Transaction compensatoire : supprime la branche orpheline.
      await this.deleteBranch(base, newBranch, headers).catch(() => {
        // Suppression best-effort. Si elle échoue, la branche reste identifiable
        // par son préfixe gamad/contract-{draftId} (documenté ADR-0009).
      });
      throw err;
    }
  }

  // ── Mode direct ───────────────────────────────────────────────────────────────

  private async commitDirect(
    params: GitWriteParams,
    content: string,
  ): Promise<GitWriteResult> {
    const { owner, repoName, gitToken, targetBranch } = params;
    const base = `https://api.github.com/repos/${owner}/${repoName}`;
    const headers = this.headers(gitToken);

    const existing = await this.getFileInfo(base, targetBranch, headers);
    this.assertOverwrite(existing, params.overwriteExisting);

    const result = await this.ghPut<GitHubCommit>(`${base}/contents/gamad.json`, headers, {
      message: 'chore: add gamad.json (via GAMAD Deploy)',
      content: Buffer.from(content).toString('base64'),
      branch: targetBranch,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    });

    return { mode: 'direct', url: result.commit.html_url };
  }

  // ── Helpers GitHub API ────────────────────────────────────────────────────────

  private async getBranchSha(base: string, branch: string, headers: Record<string, string>): Promise<string> {
    const res = await fetch(`${base}/git/refs/heads/${branch}`, { headers });
    if (!res.ok) throw new Error(`Branche "${branch}" introuvable (${res.status})`);
    const data = (await res.json()) as GitHubRef;
    return data.object.sha;
  }

  private async getFileInfo(
    base: string,
    branch: string,
    headers: Record<string, string>,
  ): Promise<GitHubContent | null> {
    const res = await fetch(`${base}/contents/gamad.json?ref=${branch}`, { headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Vérification gamad.json échouée (${res.status})`);
    return (await res.json()) as GitHubContent;
  }

  private async getFileSha(
    base: string,
    path: string,
    branch: string,
    headers: Record<string, string>,
  ): Promise<string | undefined> {
    const res = await fetch(`${base}/contents/${encodeURIComponent(path)}?ref=${branch}`, { headers });
    if (!res.ok) return undefined;
    const data = (await res.json()) as GitHubContent;
    return data.sha ?? undefined;
  }

  private assertOverwrite(existing: GitHubContent | null, overwriteExisting: boolean): void {
    if (existing && !overwriteExisting) {
      throw Object.assign(
        new Error('GAMAD_JSON_EXISTS : gamad.json déjà présent. Relancez avec overwrite_existing: true.'),
        { code: 'GAMAD_JSON_EXISTS' },
      );
    }
  }

  private async deleteBranch(base: string, branch: string, headers: Record<string, string>): Promise<void> {
    await fetch(`${base}/git/refs/heads/${branch}`, { method: 'DELETE', headers });
  }

  private async ghPost<T = unknown>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub POST ${url} échoué (${res.status}) : ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async ghPut<T = unknown>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub PUT ${url} échoué (${res.status}) : ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private headers(gitToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${gitToken}`,
    };
  }

  private prBody(validatedDraft: ValidatedContractDraft): string {
    const { assumptions, warnings, confidence, generated_files } = validatedDraft.draft;
    const lines = [
      `Généré par GAMAD Deploy — confidence ${Math.round(confidence * 100)}%`,
      '',
      '**Fichiers créés**',
      '- gamad.json',
      ...(generated_files ?? []).map((f) => `- ${f.path}`),
      '',
      '**Hypothèses**',
      ...assumptions.map((a) => `- ${a}`),
    ];
    if (warnings.length > 0) {
      lines.push('', '**À vérifier avant merge**', ...warnings.map((w) => `- ⚠️ ${w}`));
    }
    return lines.join('\n');
  }
}
