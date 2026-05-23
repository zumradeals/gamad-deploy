// INV-09 — Port docker isolé. Jamais de commande shell arbitraire.
// composeUp / composeDown opèrent par deploymentId (label Docker).
// isRunning permet de détecter un replay et éviter un double démarrage.

export abstract class DockerExecutorPort {
  abstract composeUp(
    deploymentId: string,
    composePath: string,
    envVars: Record<string, string>,
  ): Promise<void>;

  abstract composeDown(deploymentId: string): Promise<void>;

  abstract isRunning(deploymentId: string): Promise<boolean>;
}
