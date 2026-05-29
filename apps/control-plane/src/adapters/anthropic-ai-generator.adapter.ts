// Adaptateur Anthropic — Couche Adapters (INV-09).
// Implémente AIGeneratorPort. Jamais importé par le Domain.
// Modèle : claude-opus-4-8 (adaptive thinking, effort medium).
// Prompt caching sur le system prompt (stable entre appels).

import Anthropic from '@anthropic-ai/sdk';
import { AIGeneratorPort, type GenerateTemplateParams, type GenerateTemplateResult } from '../domain/ai-generator/ai-generator.port';

const MODEL_ID = 'claude-opus-4-8';

const SYSTEM_PROMPT = `Tu es un expert en déploiement d'applications sur serveurs Linux via Docker.
Tu génères des fichiers gamad.json valides — le contrat déclaratif de déploiement GAMAD v1.0.

Schéma OBLIGATOIRE du gamad.json (respecte exactement cette structure) :
{
  "contract_version": "1.0",
  "name": "mon-app",
  "artifact_type": "docker-compose",
  "source_ref": { "type": "branch", "value": "main" },
  "runtime": {
    "compose_file": "docker-compose.yml",
    "ports": { "app": 3000 }
  },
  "env": [
    { "name": "NODE_ENV", "required": true, "secret": false, "default": "production" },
    { "name": "DATABASE_URL", "required": true, "secret": true }
  ],
  "health": {
    "checks": [
      { "name": "api", "path": "/health", "expected_status": 200, "timeout_s": 30 }
    ]
  },
  "policies": { "ban_latest": true, "on_error_stop": true }
}

Règles STRICTES :
- "contract_version" TOUJOURS "1.0".
- "artifact_type" : "docker-compose" pour les apps Docker, "node" pour Node.js natif, "static" pour les sites statiques.
- "env[].name" : UPPER_SNAKE_CASE obligatoire.
- "env[].secret" : true pour les mots de passe, tokens, clés API.
- "health.checks" : au moins 1 check avec path relatif (commence par "/").
- "runtime.ports" : objet clé→numéro de port.
- N'utilise jamais "ban_latest: false" sauf si l'image n'a pas de tag versionné officiel (ex: wordpress).
- Adapte les env vars à l'application décrite (DB, cache Redis, SMTP, etc.).
- Pour les stacks multi-services (app + DB), liste tous les ports exposés dans "runtime.ports".

Tu réponds UNIQUEMENT en JSON dans ce format exact :
{
  "contractContent": "<le gamad.json complet sérialisé en string JSON — toutes les guillemets internes échappées>",
  "explanation": "<2-3 phrases expliquant les choix techniques>"
}`;

export class AnthropicAIGeneratorAdapter extends AIGeneratorPort {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  override async generateTemplate(params: GenerateTemplateParams): Promise<GenerateTemplateResult> {
    const userPrompt = `Génère un gamad.json pour : ${params.description}
Catégorie : ${params.category}
${params.referenceTemplates?.length ? `Templates de référence : ${params.referenceTemplates.join(', ')}` : ''}`;

    const stream = this.client.messages.stream({
      model: MODEL_ID,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Prompt caching : le system prompt est stable — on le met en cache.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Aucune réponse texte de l\'IA.');
    }

    let parsed: { contractContent: string; explanation: string };
    try {
      // Le modèle peut parfois entourer le JSON de backticks.
      const raw = textBlock.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new Error('La réponse IA n\'est pas un JSON valide.');
    }

    // Valider que contractContent est lui-même un JSON valide.
    try {
      JSON.parse(parsed.contractContent);
    } catch {
      throw new Error('Le gamad.json généré n\'est pas un JSON valide.');
    }

    return {
      contractContent: parsed.contractContent,
      explanation: parsed.explanation ?? '',
      modelId: MODEL_ID,
      tokensInput: message.usage.input_tokens,
      tokensOutput: message.usage.output_tokens,
    };
  }
}
