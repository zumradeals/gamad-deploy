// C-13 — API ContractGenerator (Delivery).
// Deux endpoints : analyze (génère le draft) + commit (écrit avec consentement dual).
// Consentement structurel (ADR-0009) :
//   - analyze → stocke le draft, émet draft_id
//   - commit  → draft_id (consentement contenu) + confirm_default_branch (consentement destination)
// git_token : jamais loggé, jamais persisté (CLAUDE.md §8).

import { Controller, Post, Param, Body, Req, NotFoundException, BadRequestException, GoneException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects } from '@gamad/schema';
import type { GamadContractDraft, RepoAnalysis } from '@gamad/contracts';
import type { TenantRequest } from '../persistence/tenant-middleware';
import { ContractGeneratorService } from '../domain/contract-generator/contract-generator.service';
import { ValidatedContractDraft } from '../domain/contract-generator/validated-contract-draft';
import { DraftStoreService } from './draft-store.service';
import { GitWritePort } from '../adapters/git-write.port';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';

interface AnalyzeBody {
  analysis?: Partial<RepoAnalysis>;
}

interface CommitBody {
  draft_id: string;
  mode: 'pr' | 'direct';
  target_branch?: string;
  overwrite_existing?: boolean;
  confirm_default_branch?: boolean;
  /** Jamais loggé (CLAUDE.md §8). */
  git_token: string;
}

@Controller('projects/:projectId/contracts')
export class ContractController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: NodePgDatabase,
    @Inject(ContractGeneratorService) private readonly generator: ContractGeneratorService,
    @Inject(DraftStoreService) private readonly draftStore: DraftStoreService,
    @Inject(GitWritePort) private readonly gitWrite: GitWritePort,
  ) {}

  /** Étape 1 — génère le draft et émet le draft_id (preuve de lecture). */
  @Post('analyze')
  async analyze(
    @Param('projectId') projectId: string,
    @Body() body: AnalyzeBody,
    @Req() req: TenantRequest,
  ): Promise<{ draft_id: string; draft: GamadContractDraft }> {
    const { org_id } = req.tenant;
    const project = await this.requireProject(projectId, org_id);

    const analysis: RepoAnalysis = {
      repo_url: project.repoUrl,
      has_dockerfile: false,
      has_compose_file: false,
      has_gamad_json: false,
      ...body.analysis,
    };

    const draft = this.generator.generate(analysis);
    const draftId = this.draftStore.save(draft, org_id);

    return { draft_id: draftId, draft };
  }

  /** Étape 2 — consentement dual → écriture (ADR-0009). */
  @Post('commit')
  async commit(
    @Param('projectId') projectId: string,
    @Body() body: CommitBody,
    @Req() req: TenantRequest,
  ): Promise<{ mode: string; url: string }> {
    const { org_id } = req.tenant;
    await this.requireProject(projectId, org_id);

    // Récupère le draft (TTL + isolation tenant).
    const draft = this.draftStore.retrieve(body.draft_id, org_id);
    if (!draft) {
      throw new GoneException('draft_id introuvable, expiré, ou appartient à un autre tenant.');
    }

    // Consentement au contenu → sealed type (ADR-0009).
    const validatedDraft = ValidatedContractDraft.fromApproval(draft, body.draft_id);

    // Résolution de l'URL GitHub → owner/repoName.
    const project = await this.requireProject(projectId, org_id);
    const { owner, repoName } = parseRepoUrl(project.repoUrl);
    const defaultBranch = project.repoBranch ?? 'main';
    const targetBranch = body.target_branch ?? defaultBranch;

    const result = await this.gitWrite.commitGamadJson(validatedDraft, {
      owner,
      repoName,
      gitToken: body.git_token, // jamais loggé (CLAUDE.md §8)
      mode: body.mode,
      targetBranch,
      defaultBranch,
      overwriteExisting: body.overwrite_existing ?? false,
      confirmDefaultBranch: body.confirm_default_branch ?? false,
    });

    // Invalide le draft (usage unique — pas de replay du consentement).
    this.draftStore.consume(body.draft_id);

    return { mode: result.mode, url: result.url };
  }

  private async requireProject(
    projectId: string,
    orgId: string,
  ): Promise<{ repoUrl: string; repoBranch: string }> {
    const [project] = await this.db
      .select({ repoUrl: projects.repoUrl, repoBranch: projects.repoBranch, orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.orgId !== orgId) {
      throw new NotFoundException(); // INV-06 : resource étrangère = 404
    }
    return project;
  }
}

function parseRepoUrl(repoUrl: string): { owner: string; repoName: string } {
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) {
    throw new BadRequestException(`URL de repo non supportée pour l'écriture GitHub : ${repoUrl}`);
  }
  return { owner: match[1]!, repoName: match[2]! };
}
