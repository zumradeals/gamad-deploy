// packages/contracts — source de vérité des 13 contrats GAMAD Deploy.
// Hub neutre : chaque couche (delivery, orchestration, domain, adapters, persistence) importe ici.
// Interfaces et types uniquement — aucune implémentation métier.

// C-01 — PDN
export type { PdnVersion, HealthCheck, PlanDeDeploiementNormalise } from './pdn';

// C-02 — gamad.json
export { ContratRepoSchema, ContractVersionSchema, SourceRefSchema, EnvVarSchema, HealthCheckSchema, PoliciesSchema } from './repo-contract';
export type { ContratRepo } from './repo-contract';

// C-03 — SourceResolver
export type { SourceInput, RepoAnalysis, SourceResolver, TemplateCompiler, GitAdapter } from './source-resolver';

// C-04 — Machine à états
export { LEGAL_TRANSITIONS, TERMINAL_STATES } from './state-machine';
export type { DeploymentState, DeploymentTransition, StateMachine } from './state-machine';

// C-05 — Pipeline
export type { JobName, JobDefinition, PipelineContext, JobResult } from './pipeline';

// C-06 + C-07 — Protocole Agent
export type { ResolvedPlan, AgentDispatchRequest, AgentCallbackEvent, AgentCallbackPayload, AgentHealthResponse, Agent } from './agent-protocol';

// C-08 — PaymentProvider
export type { InitParams, InitResult, RawWebhookNotification, PaymentEvent, PaymentProvider } from './payment-provider';

// C-09 — VpsProvider
export type { ServerStatus, CreateServerParams, ProvisionedServer, VpsProvider } from './vps-provider';

// C-10 — Multi-tenant
export type { PlatformRole, OrgRole, Plan, Organization, OrganizationMember, UserRole, TenantContext } from './multi-tenant';

// C-11 — Audit immuable
export type { DeploymentPlanRecord, DeploymentLogRecord, DeploymentStateTransitionRecord, PaymentTransactionRecord } from './audit';

// C-12 — API publique
export type { DeploymentStatus, CreateProjectRequest, CreateProjectResponse, LaunchDeploymentRequest, LaunchDeploymentResponse, DeploymentStatusResponse, BillingCheckoutRequest, BillingCheckoutResponse, StreamEventType, StreamEvent } from './api';

// C-13 — ContractGenerator
export type { GamadContractDraft, CommitContractParams, CommitResult, ContractGenerator } from './contract-generator';
