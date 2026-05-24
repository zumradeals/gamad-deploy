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
}

export interface LogLine {
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: string;
}
