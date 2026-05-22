// C-01 — Plan de Déploiement Normalisé (PDN v1.0)
// Format pivot unique. Toute source y est traduite ; l'exécuteur ne lit que lui (INV-01).
// Invariants : pdn_version non supportée → refus ; health_checks.length >= 1 (INV-03) ;
// ban_latest === true → ref.type ∈ {tag, commit} obligatoire.
// Une fois calculé, le PDN est figé et hashé SHA-256 avant exécution (INV-04).

export type PdnVersion = '1.0';

/** Un health check individuel du PDN (URL complète, résolue par le TemplateCompiler). */
export interface HealthCheck {
  name: string;
  /** URL complète, ex. http://localhost:8080/health — contrastée avec le path relatif de C-02. */
  url: string;
  expected_status: number;
  timeout_s: number;
  attempts: number;
  interval_s: number;
}

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

  /**
   * Tableau non vide — INV-03 porté dans le type lui-même.
   * [HealthCheck, ...HealthCheck[]] rend impossible de construire un PDN sans health check.
   */
  health_checks: [HealthCheck, ...HealthCheck[]];

  policies: {
    /** Interdit les images Docker :latest. */
    ban_latest: boolean;
    /** Première erreur critique → FAILED + rollback (INV-08). */
    on_error_stop: boolean;
  };
}
