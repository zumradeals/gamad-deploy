// Port Domain pour le générateur de templates IA (INV-09, C-13).
// Le Domain ne connaît que ce port — jamais l'adaptateur Anthropic concret.

export interface GenerateTemplateParams {
  /** Description en langage naturel de l'application à déployer. */
  description: string;
  /** Catégorie cible (aide le modèle à orienter la génération). */
  category: 'web_app' | 'cms' | 'ecommerce' | 'stack' | 'data_tools' | 'devops';
  /** Templates de référence disponibles pour inspiration (slugs). */
  referenceTemplates?: string[];
}

export interface GenerateTemplateResult {
  /** gamad.json généré (string JSON valide). */
  contractContent: string;
  /** Explication courte de ce qui a été généré. */
  explanation: string;
  modelId: string;
  tokensInput: number;
  tokensOutput: number;
}

export abstract class AIGeneratorPort {
  abstract generateTemplate(params: GenerateTemplateParams): Promise<GenerateTemplateResult>;
}
