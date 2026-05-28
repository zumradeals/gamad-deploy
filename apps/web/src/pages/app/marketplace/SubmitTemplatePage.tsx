import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useSubmitTemplate } from '@/api/marketplace';
import { useAuthStore } from '@/store/auth.store';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function SubmitTemplatePage() {
  const navigate = useNavigate();
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const submitTemplate = useSubmitTemplate(currentOrgId);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [priceAmount, setPriceAmount] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) {
      setSlug(slugify(v));
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) { toast.error('Le nom est requis.'); return; }
    if (!slug.trim()) { toast.error('Le slug est requis.'); return; }
    if (!repoUrl.trim()) { toast.error("L'URL du dépôt est requise."); return; }

    try {
      new URL(repoUrl);
    } catch {
      toast.error("L'URL du dépôt n'est pas valide.");
      return;
    }

    submitTemplate.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        repoUrl: repoUrl.trim(),
        description: description.trim(),
        tags,
        priceAmount,
      },
      {
        onSuccess: () => {
          toast.success('Template soumis avec succès ! Il est en attente de validation.');
          void navigate('/app/orgs/templates');
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erreur lors de la soumission.');
        },
      },
    );
  };

  return (
    <div className="max-w-xl space-y-6">
      <Link
        to="/app/orgs/templates"
        className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text] transition-colors"
      >
        <ArrowLeft size={14} /> Mes templates
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold text-[--text]">Soumettre un template</h1>
        <p className="text-sm text-[--text-muted] mt-0.5">
          Votre dépôt doit contenir un fichier <code className="text-xs bg-[--border] px-1 rounded">gamad.json</code> valide à la racine.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[--border] bg-[--surface] p-5 space-y-4">
        {/* Nom */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom du template</Label>
          <Input
            id="name"
            placeholder="Mon application Node.js"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug <span className="text-xs text-[--text-muted]">(identifiant URL)</span></Label>
          <Input
            id="slug"
            placeholder="mon-app-nodejs"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
          />
        </div>

        {/* URL repo */}
        <div className="space-y-1.5">
          <Label htmlFor="repoUrl">URL du dépôt GitHub</Label>
          <Input
            id="repoUrl"
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className="w-full rounded-md border border-[--border] bg-transparent px-3 py-2 text-sm text-[--text] placeholder:text-[--text-muted] focus:outline-none focus:ring-1 focus:ring-[--accent] resize-none min-h-[80px]"
            placeholder="Décrivez votre template en quelques phrases…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label>Tags <span className="text-xs text-[--text-muted]">(max 5)</span></Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-[--border] px-2.5 py-0.5 text-xs text-[--text-muted] font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-500 transition-colors"
                  aria-label={`Supprimer le tag ${tag}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          {tags.length < 5 && (
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter un tag (ex. nodejs)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag} className="gap-1">
                <Plus size={13} /> Ajouter
              </Button>
            </div>
          )}
        </div>

        {/* Prix */}
        <div className="space-y-1.5">
          <Label htmlFor="price">Prix (XOF) — 0 = gratuit</Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={500}
            value={priceAmount}
            onChange={(e) => setPriceAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitTemplate.isPending} className="gap-2">
            {submitTemplate.isPending && <Loader2 size={14} className="animate-spin" />}
            Soumettre
          </Button>
        </div>
      </form>
    </div>
  );
}
