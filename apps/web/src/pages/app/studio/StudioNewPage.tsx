import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useCreateBlueprint, CATEGORY_LABELS, type TemplateCategory } from '@/api/studio';

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [TemplateCategory, string][];

const DEFAULT_CONTRACT = JSON.stringify(
  {
    contract_version: '1.0',
    name: 'mon-template',
    artifact_type: 'docker-compose',
    source_ref: { type: 'branch', value: 'main' },
    runtime: { compose_file: 'docker-compose.yml', ports: { app: 3000 } },
    env: [
      { name: 'NODE_ENV', required: true, secret: false, default: 'production' },
    ],
    health: {
      checks: [{ name: 'app', path: '/health', expected_status: 200, timeout_s: 30 }],
    },
    policies: { ban_latest: true, on_error_stop: true },
  },
  null,
  2,
);

export function StudioNewPage() {
  const navigate = useNavigate();
  const create = useCreateBlueprint();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('web_app');
  const [contractContent, setContractContent] = useState(DEFAULT_CONTRACT);
  const [contractError, setContractError] = useState<string | null>(null);

  const validateJson = (value: string) => {
    try {
      JSON.parse(value);
      setContractError(null);
    } catch {
      setContractError('JSON invalide');
    }
  };

  const handleContractChange = (v: string) => {
    setContractContent(v);
    validateJson(v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Le nom est requis.'); return; }
    if (contractError) { toast.error('Le gamad.json contient des erreurs JSON.'); return; }

    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

    create.mutate(
      { name: name.trim(), description: description.trim(), tags, category, contractContent },
      {
        onSuccess: ({ id }) => {
          toast.success('Blueprint créé.');
          navigate(`/app/studio/${id}`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur création.'),
      },
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app/studio">
          <Button variant="ghost" size="sm" className="gap-1 text-[--text-muted]">
            <ArrowLeft size={14} /> Retour
          </Button>
        </Link>
        <h1 className="font-display text-xl font-bold text-[--text]">Nouveau blueprint</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Métadonnées */}
        <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[--text]">Informations générales</h2>

          <div className="space-y-2">
            <Label htmlFor="name">Nom du blueprint *</Label>
            <Input
              id="name"
              placeholder="Mon API Node.js"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              placeholder="Décrivez votre template en quelques mots..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-[--border] bg-[--bg] px-3 py-2 text-sm text-[--text] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--accent] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full rounded-md border border-[--border] bg-[--bg] px-3 py-2 text-sm text-[--text] focus:outline-none focus:ring-2 focus:ring-[--accent]"
              >
                {CATEGORIES.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (séparés par virgule)</Label>
              <Input
                id="tags"
                placeholder="nodejs, api, postgres"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Éditeur gamad.json */}
        <div className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[--text]">gamad.json</h2>
            {contractError ? (
              <span className="text-xs text-red-500 font-medium">{contractError}</span>
            ) : (
              <span className="text-xs text-emerald-500 font-medium">JSON valide</span>
            )}
          </div>
          <p className="text-xs text-[--text-muted]">
            Définissez le contrat de déploiement selon la spec C-02. Vous pourrez le modifier après création.
          </p>
          <textarea
            value={contractContent}
            onChange={(e) => handleContractChange(e.target.value)}
            rows={20}
            spellCheck={false}
            className={`w-full rounded-md border px-3 py-2.5 text-xs font-mono bg-[--bg] text-[--text] focus:outline-none focus:ring-2 resize-y ${
              contractError ? 'border-red-400 focus:ring-red-400' : 'border-[--border] focus:ring-[--accent]'
            }`}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/app/studio">
            <Button type="button" variant="outline">Annuler</Button>
          </Link>
          <Button type="submit" disabled={create.isPending || !!contractError} className="gap-2">
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Créer le blueprint
          </Button>
        </div>
      </form>
    </div>
  );
}
