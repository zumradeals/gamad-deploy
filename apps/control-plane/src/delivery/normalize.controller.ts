// Normalisation gate (C-13) — sans projectId requis.
// Utilisé par le wizard Step 3 pour créer gamad.json + fichiers Docker dans le repo.
// git_token : jamais loggé, transmis uniquement dans Authorization header (CLAUDE.md §8).
// Dual consent : preview (draft_id = preuve de lecture) + commit (ADR-0009).

import { Controller, Post, Body, Req, GoneException, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { GamadContractDraft, RepoAnalysis } from '@gamad/contracts';
import type { TenantRequest } from '../persistence/tenant-middleware';
import { ContractGeneratorService } from '../domain/contract-generator/contract-generator.service';
import { ValidatedContractDraft } from '../domain/contract-generator/validated-contract-draft';
import { DraftStoreService } from './draft-store.service';
import { GitWritePort } from '../adapters/git-write.port';
import { GithubOAuthTokenRepository } from '../adapters/github-oauth-token.repository';
import { decryptOAuthToken } from '../adapters/github-oauth.adapter';

interface NormalizePreviewBody {
  repo_url: string;
  branch?: string;
  analysis?: Partial<RepoAnalysis>;
}

interface NormalizeCommitBody {
  draft_id: string;
  repo_url: string;
  branch?: string;
  overwrite_existing?: boolean;
  /**
   * Jamais loggé (CLAUDE.md §8).
   * Optionnel si GitHub OAuth connecté — le token chiffré est récupéré depuis la DB.
   */
  git_token?: string;
}

@Controller('normalize')
export class NormalizeController {
  constructor(
    @Inject(ContractGeneratorService) private readonly generator: ContractGeneratorService,
    @Inject(DraftStoreService) private readonly draftStore: DraftStoreService,
    @Inject(GitWritePort) private readonly gitWrite: GitWritePort,
    @Inject(GithubOAuthTokenRepository) private readonly oauthRepo: GithubOAuthTokenRepository,
  ) {}

  /** Étape 1 — génère le draft + les fichiers à créer, émet le draft_id. */
  @Post('preview')
  async preview(
    @Body() body: NormalizePreviewBody,
    @Req() req: TenantRequest,
  ): Promise<{ draft_id: string; draft: GamadContractDraft }> {
    const { org_id } = req.tenant;

    const analysis: RepoAnalysis = {
      repo_url: body.repo_url,
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      ...body.analysis,
    };

    const draft = this.generator.generate(analysis);
    const draftId = this.draftStore.save(draft, org_id);

    return { draft_id: draftId, draft };
  }

  /** Étape 2 — consentement dual → PR GitHub (ADR-0009). */
  @Post('commit')
  async commit(
    @Body() body: NormalizeCommitBody,
    @Req() req: TenantRequest,
  ): Promise<{ pr_url: string }> {
    const { org_id } = req.tenant;

    const draft = this.draftStore.retrieve(body.draft_id, org_id);
    if (!draft) {
      throw new GoneException('draft_id introuvable, expiré, ou appartient à un autre tenant.');
    }

    const validatedDraft = ValidatedContractDraft.fromApproval(draft, body.draft_id);
    const { owner, repoName } = parseRepoUrl(body.repo_url);
    const targetBranch = body.branch ?? 'main';

    // Résolution du token : PAT manuel > token OAuth déchiffré depuis DB (CLAUDE.md §8).
    let gitToken = body.git_token;
    if (!gitToken) {
      try {
        const stored = await this.oauthRepo.find(req.tenant.org_id, req.tenant.user_id);
        if (stored) {
          gitToken = decryptOAuthToken(stored.encryptedToken);
        }
      } catch {
        // Table absente ou erreur DB — on continue sans token OAuth
      }
    }
    if (!gitToken) {
      throw new BadRequestException(
        'git_token manquant — fournissez un token ou connectez GitHub via /github/auth-url',
      );
    }

    const result = await this.gitWrite.commitGamadJson(validatedDraft, {
      owner,
      repoName,
      gitToken, // jamais loggé (CLAUDE.md §8)
      mode: 'pr',
      targetBranch,
      defaultBranch: targetBranch,
      overwriteExisting: body.overwrite_existing ?? false,
      confirmDefaultBranch: false,
    });

    this.draftStore.consume(body.draft_id);

    return { pr_url: result.url };
  }
}

function parseRepoUrl(repoUrl: string): { owner: string; repoName: string } {
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) {
    throw new BadRequestException(`URL de repo non supportée pour l'écriture GitHub : ${repoUrl}`);
  }
  return { owner: match[1]!, repoName: match[2]! };
}
