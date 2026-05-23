// Preuve CLAUDE.md §8 : "Tu ne logges jamais un secret (git_token, agent_token, mots de passe)."
// DeploymentLoggerService masque les champs connus avant tout envoi de callback (C-11).
// Un secret d'env_var (secret=true) ne doit jamais apparaître en clair dans un callback.

import { describe, test, expect } from 'vitest';
import { DeploymentLoggerService } from '../services/deployment-logger.service';
import { CallbackStub } from '../stubs/callback.stub';

function makeLogger(): { logger: DeploymentLoggerService; callback: CallbackStub } {
  const callback = new CallbackStub();
  return { logger: new DeploymentLoggerService(callback), callback };
}

describe('Aucun secret dans les logs (CLAUDE.md §8)', () => {
  test('sanitize masque agent_token', () => {
    const { logger } = makeLogger();
    const sanitized = logger.sanitize({ agent_token: 'super-secret-token-123', other: 'safe' });

    expect(sanitized['agent_token']).toBe('[REDACTED]');
    expect(sanitized['other']).toBe('safe');
  });

  test('sanitize masque git_token', () => {
    const { logger } = makeLogger();
    const sanitized = logger.sanitize({ git_token: 'ghp_abc123XYZ' });

    expect(sanitized['git_token']).toBe('[REDACTED]');
  });

  test('sanitize masque password', () => {
    const { logger } = makeLogger();
    const sanitized = logger.sanitize({ password: 'p@ssw0rd' });

    expect(sanitized['password']).toBe('[REDACTED]');
  });

  test('sanitize masque en profondeur (objet imbriqué)', () => {
    const { logger } = makeLogger();
    const sanitized = logger.sanitize({ credentials: { agent_token: 'secret', user: 'admin' } });

    expect((sanitized['credentials'] as Record<string, unknown>)['agent_token']).toBe('[REDACTED]');
    expect((sanitized['credentials'] as Record<string, unknown>)['user']).toBe('admin');
  });

  test('callback reçoit payload sans les valeurs de secrets', async () => {
    const { logger, callback } = makeLogger();
    await logger.log(
      'http://control-plane/callback',
      'dep-001',
      'log',
      'déploiement',
      { agent_token: 'leak!', git_token: 'ghp_leak', safe_value: 'ok' },
    );

    const sent = callback.sent[0];
    expect(sent).toBeDefined();
    const payloadStr = JSON.stringify(sent);
    expect(payloadStr).not.toContain('leak!');
    expect(payloadStr).not.toContain('ghp_leak');
    expect(payloadStr).toContain('[REDACTED]');
    expect(payloadStr).toContain('ok'); // champ non secret préservé
  });

  test('champ inconnu (non secret) est transmis tel quel', () => {
    const { logger } = makeLogger();
    const sanitized = logger.sanitize({ deployment_id: 'dep-001', step: 'git-clone' });

    expect(sanitized['deployment_id']).toBe('dep-001');
    expect(sanitized['step']).toBe('git-clone');
  });
});
