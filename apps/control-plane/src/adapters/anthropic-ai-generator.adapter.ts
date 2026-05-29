// Adaptateur Anthropic — Couche Adapters (INV-09).
// Implémente AIGeneratorPort. Jamais importé par le Domain.
// Modèle : claude-opus-4-8 (adaptive thinking, effort medium).
// Prompt caching sur le system prompt (stable entre appels).

import Anthropic from '@anthropic-ai/sdk';
import { AIGeneratorPort, type GenerateTemplateParams, type GenerateTemplateResult } from '../domain/ai-generator/ai-generator.port';

const MODEL_ID = 'claude-opus-4-8';

const SYSTEM_PROMPT = `Tu es un expert en déploiement d'applications sur serveurs Linux via Docker.
Tu génères des fichiers gamad.json valides — le format déclaratif de GAMAD Deploy.

Structure d'un gamad.json :
{
  "version": "1",
  "name": "nom-du-service",
  "description": "Description courte",
  "services": [
    {
      "name": "api",
      "image": "node:20-alpine",
      "build": { "context": ".", "dockerfile": "Dockerfile" },
      "port": 3000,
      "env": { "NODE_ENV": "production" },
      "volumes": [],
      "healthCheck": { "path": "/health", "interval": 30, "timeout": 10, "retries": 3 }
    }
  ],
  "domain": "\${DOMAIN}",
  "httpsEnabled": true,
  "envVars": [
    { "key": "DATABASE_URL", "required": true, "description": "URL PostgreSQL" }
  ]
}

Règles :
- Génère TOUJOURS un JSON valide et complet.
- Utilise des images Docker officielles récentes (node:20-alpine, php:8.3-fpm-alpine, python:3.12-slim, etc.).
- Inclus TOUJOURS un healthCheck pour chaque service exposé.
- Les variables sensibles vont dans envVars[].required=true.
- Adapte les services à la description (DB, cache, proxy si nécessaire).
- Le champ "domain" doit contenir "\${DOMAIN}" littéralement — c'est une variable d'environnement.

Tu réponds UNIQUEMENT en JSON dans ce format exact :
{
  "contractContent": "<le gamad.json complet en string JSON échappée>",
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
