import { describe, test, expect } from 'vitest';
import type { DeploymentState } from '@gamad/contracts';
import { IllegalTransitionError, StateMachineService } from '../state-machine/state-machine.service';

const sm = new StateMachineService();

describe('StateMachineService', () => {
  // ── Transitions légales ─────────────────────────────────────────────────

  test.each<[DeploymentState, DeploymentState]>([
    ['PENDING', 'RUNNING'],
    ['RUNNING', 'SUCCESS'],
    ['RUNNING', 'FAILED'],
    ['FAILED', 'ROLLED_BACK'],
  ])('transition légale %s → %s retourne le nouvel état', (from, to) => {
    expect(sm.transition(from, to)).toBe(to);
  });

  // ── Transitions illégales ───────────────────────────────────────────────

  test.each<[DeploymentState, DeploymentState]>([
    ['PENDING', 'SUCCESS'],
    ['PENDING', 'FAILED'],
    ['PENDING', 'ROLLED_BACK'],
    ['RUNNING', 'PENDING'],
    ['RUNNING', 'ROLLED_BACK'],
    ['SUCCESS', 'RUNNING'],
    ['SUCCESS', 'FAILED'],
    ['ROLLED_BACK', 'RUNNING'],
    ['FAILED', 'RUNNING'],
  ])('transition illégale %s → %s lève IllegalTransitionError', (from, to) => {
    expect(() => sm.transition(from, to)).toThrow(IllegalTransitionError);
    expect(() => sm.transition(from, to)).toThrow(/INV-08/);
  });

  // ── États terminaux ─────────────────────────────────────────────────────

  test.each<DeploymentState>(['SUCCESS', 'ROLLED_BACK'])(
    '%s est un état terminal',
    (state) => {
      expect(sm.isTerminal(state)).toBe(true);
    },
  );

  test.each<DeploymentState>(['PENDING', 'RUNNING', 'FAILED'])(
    '%s n\'est pas un état terminal',
    (state) => {
      expect(sm.isTerminal(state)).toBe(false);
    },
  );

  // ── Cohérence graphe ────────────────────────────────────────────────────

  test('un état terminal ne peut plus transitionner (SUCCESS)', () => {
    expect(() => sm.transition('SUCCESS', 'RUNNING')).toThrow(IllegalTransitionError);
  });

  test('un état terminal ne peut plus transitionner (ROLLED_BACK)', () => {
    expect(() => sm.transition('ROLLED_BACK', 'PENDING')).toThrow(IllegalTransitionError);
  });

  test('séquence complète PENDING → RUNNING → FAILED → ROLLED_BACK', () => {
    let state: DeploymentState = 'PENDING';
    state = sm.transition(state, 'RUNNING');
    state = sm.transition(state, 'FAILED');
    state = sm.transition(state, 'ROLLED_BACK');
    expect(state).toBe('ROLLED_BACK');
    expect(sm.isTerminal(state)).toBe(true);
  });

  test('séquence complète PENDING → RUNNING → SUCCESS', () => {
    let state: DeploymentState = 'PENDING';
    state = sm.transition(state, 'RUNNING');
    state = sm.transition(state, 'SUCCESS');
    expect(state).toBe('SUCCESS');
    expect(sm.isTerminal(state)).toBe(true);
  });
});
