// INV-09 — Port git isolé. Reçoit des paramètres typés, jamais une chaîne shell.
// INV-10 — L'exécuteur réel construit la commande git en interne ; jamais exposé au PDN.

export interface GitRef {
  type: 'branch' | 'tag' | 'commit';
  value: string;
}

export abstract class GitExecutorPort {
  /** Clone le dépôt dans destPath. Idempotent si destPath existe déjà. */
  abstract clone(
    deploymentId: string,
    url: string,
    ref: GitRef,
    destPath: string,
  ): Promise<void>;
}
