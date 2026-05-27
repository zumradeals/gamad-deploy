// C-04 — Machine à états du déploiement
// Toute transition hors graphe est un bug (INV-08). SUCCESS exige la validation
// explicite des health checks (INV-03). Chaque transition est journalisée (C-11).

export type DeploymentState =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ROLLED_BACK';

export type DeploymentTransition =
  | { from: 'PENDING'; to: 'RUNNING' }
  | { from: 'PENDING'; to: 'FAILED' }
  | { from: 'RUNNING'; to: 'SUCCESS' }
  | { from: 'RUNNING'; to: 'FAILED' }
  | { from: 'FAILED'; to: 'ROLLED_BACK' };

export const LEGAL_TRANSITIONS: ReadonlyArray<DeploymentTransition> = [
  { from: 'PENDING', to: 'RUNNING' },
  { from: 'PENDING', to: 'FAILED' },
  { from: 'RUNNING', to: 'SUCCESS' },
  { from: 'RUNNING', to: 'FAILED' },
  { from: 'FAILED', to: 'ROLLED_BACK' },
] as const;

export const TERMINAL_STATES: ReadonlySet<DeploymentState> = new Set<DeploymentState>([
  'SUCCESS',
  'ROLLED_BACK',
]);

export interface StateMachine {
  /** Retourne le nouvel état ou lève une erreur si la transition est illégale. */
  transition(current: DeploymentState, next: DeploymentState): DeploymentState;
  isTerminal(state: DeploymentState): boolean;
}
