// C-01 — Plan de Déploiement Normalisé (PDN v1.0)
// Format pivot unique. Toute source y est traduite ; l'exécuteur ne lit que lui (INV-01).
// Invariants : pdn_version non supportée → refus ; health_checks.length >= 1 (INV-03) ;
// ban_latest === true → ref.type ∈ {tag, commit} obligatoire.
// Une fois calculé, le PDN est figé et hashé SHA-256 avant exécution (INV-04).

export type PdnVersion = '1.0';

export interface PlanDeDeploiementNormalise {
  pdn_version: PdnVersion;

  source: {
    type: 'template' | 'git';
    url: string;
    ref: { type: 'branch' | 'tag' | 'commit'; value: string };
    fingerprint: {
      commit_sha?: string;
      template_version?: string;
      repo_id?: string;
    };
  };

  /** Conteneurisable uniquement (INV-10). */
  artifact: {
    kind: 'docker-compose' | 'node' | 'static';
    compose_file?: string;
    app_root?: string;
    build_command?: string;
    start_command?: string;
    output_dir?: string;
  };

  env_vars: Array<{
    name: string;           // UPPER_SNAKE_CASE
    required: boolean;
    default?: string;
    /** true → jamais loggé, jamais en clair en base. */
    secret: boolean;
  }>;

  runtime: {
    ports: Record<string, number>;
    volumes?: string[];
  };

  proxy: {
    domain?: string;
    paths: Record<string, { target: string }>;
    https: boolean;
  };

  /** Au moins 1 health check requis (INV-03). */
  health_checks: Array<{
    name: string;
    url: string;
    expected_status: number;
    timeout_s: number;
    attempts: number;
    interval_s: number;
  }>;

  policies: {
    /** Interdit les images Docker :latest. */
    ban_latest: boolean;
    /** Première erreur critique → FAILED + rollback (INV-08). */
    on_error_stop: boolean;
  };
}
