export type DeploymentStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';

export interface OrgStats {
  activeProjects: number;
  runningDeployments: number;
  onlineServers: number;
}

export interface Organisation {
  id: string;
  name: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'online' | 'offline' | 'unknown';
}

/** Réponse à la création — token complet affiché une seule fois (CLAUDE.md §8). */
export interface ServerCreatedResult extends Server {
  token: string;
}

export interface ServerDetail extends Server {
  agentVersion: string;
  lastActivityAt: string | null;
  tokenSuffix: string;
  deployedProjects: Array<{ id: string; name: string; status: DeploymentStatus }>;
}

export interface RegenerateTokenResponse {
  token: string;
  suffix: string;
  port: number;
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  serverId: string;
  serverName: string;
  lastDeploymentId: string | null;
  lastDeploymentStatus: DeploymentStatus | null;
  lastDeploymentAt: string | null;
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  status: DeploymentStatus;
  branch: string;
  createdAt: string;
  completedAt: string | null;
}

export type PipelineStepName = 'resolve-source' | 'provision-db' | 'dispatch-agent' | 'await-health';
export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface DeploymentStep {
  name: PipelineStepName;
  status: PipelineStepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export interface DeploymentDetail extends Deployment {
  steps: DeploymentStep[];
  serverName: string;
  domain: string | null;
}

export interface AuditEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  userId: string;
  userName: string;
}

export interface AnalysisResult {
  confidence: 'high' | 'medium' | 'low';
  stack: string;
  ports: number[];
  healthCheckPath: string;
  assumptions: string[];
  hasCompose: boolean;
  hasDockerfile: boolean;
  hasGamadJson: boolean;
  detectedFramework: string;
}

// ── Normalize ─────────────────────────────────────────────────────────────────

export interface NormalizeFile {
  path: string;
  content: string;
}

export interface NormalizePreviewResult {
  draft_id: string;
  draft: {
    contract: unknown;
    confidence: number;
    assumptions: string[];
    warnings: string[];
    generated_files?: NormalizeFile[];
  };
}

export interface NormalizeCommitResult {
  pr_url: string;
}

export interface LogLine {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  pendingEmail: string | null;
  avatarUrl: string | null;
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
}

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  plan: Organisation['plan'];
}

export interface OrgMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface NotificationPrefs {
  deploySuccess: boolean;
  deployFailed: boolean;
  rollback: boolean;
  renewalUpcoming: boolean;
  webhookUrl: string;
}

export interface ApiKey {
  id: string;
  name: string;
  scope: 'read' | 'deploy' | 'admin';
  createdAt: string;
  lastUsedAt: string | null;
  suffix: string;
}

export interface CreateApiKeyResponse extends ApiKey {
  key: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillingInfo {
  plan: Organisation['plan'];
  status: 'active' | 'past_due' | 'cancelled';
  renewsAt: string | null;
  limits: {
    projects: number | null;
    servers: number | null;
    deploymentsPerMonth: number | null;
  };
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  description: string;
  createdAt: string;
}
