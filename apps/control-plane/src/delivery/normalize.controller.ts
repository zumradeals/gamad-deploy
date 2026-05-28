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

interface NormalizePreviewBody {
  repo_url: string;
  branch?: string;
  analysis?: Partial<RepoAnalysis>;
}

interface NormalizeCommitBody {
  draft_id: string;
  repo_url: string;
  branch?: string;
  /** Jamais loggé (CLAUDE.md §8). */
  git_token: string;
}

@Controller('normalize')
export class NormalizeController {
  constructor(
    @Inject(ContractGeneratorService) private readonly generator: ContractGeneratorService,
    @Inject(DraftStoreService) private readonly draftStore: DraftStoreService,
    @Inject(GitWritePort) private readonly gitWrite: GitWritePort,
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

    const result = await this.gitWrite.commitGamadJson(validatedDraft, {
      owner,
      repoName,
      gitToken: body.git_token, // jamais loggé (CLAUDE.md §8)
      mode: 'pr',
      targetBranch,
      defaultBranch: targetBranch,
      overwriteExisting: false,
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
