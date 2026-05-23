// Implémentation de StateMachine (C-04).
// Seules les transitions de LEGAL_TRANSITIONS sont autorisées.
// Toute transition hors graphe lève IllegalTransitionError (INV-08).

import {
  LEGAL_TRANSITIONS,
  TERMINAL_STATES,
  type DeploymentState,
  type StateMachine,
} from '@gamad/contracts';

export class IllegalTransitionError extends Error {
  constructor(from: DeploymentState, to: DeploymentState) {
    super(`Transition illégale : ${from} → ${to} (INV-08)`);
    this.name = 'IllegalTransitionError';
  }
}

export class StateMachineService implements StateMachine {
  transition(current: DeploymentState, next: DeploymentState): DeploymentState {
    const isLegal = LEGAL_TRANSITIONS.some((t) => t.from === current && t.to === next);
    if (!isLegal) {
      throw new IllegalTransitionError(current, next);
    }
    return next;
  }

  isTerminal(state: DeploymentState): boolean {
    return TERMINAL_STATES.has(state);
  }
}
