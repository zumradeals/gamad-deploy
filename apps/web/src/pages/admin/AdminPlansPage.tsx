// AdminPlansPage — gestion des plans tarifaires (Phase 2 superadmin).
// Table plans + Dialog création/édition + désactivation.

import { useState } from 'react';
import { Plus, Pencil, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useAdminPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeactivatePlan,
  type AdminPlan,
  type AdminPlanBody,
} from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function PlanStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-gray-600/40 bg-gray-800/40 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
      Inactif
    </span>
  );
}

// ── Formulaire plan ───────────────────────────────────────────────────────────

interface PlanFormProps {
  initial?: AdminPlan;
  onClose: () => void;
}

function PlanFormModal({ initial, onClose }: PlanFormProps) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(isEdit);
  const [priceAmount, setPriceAmount] = useState(String(initial?.priceAmount ?? 0));
  const [currency, setCurrency] = useState(initial?.currency ?? 'XOF');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [maxProjects, setMaxProjects] = useState(
    String((initial?.limits as Record<string, number> | undefined)?.['max_projects'] ?? 10),
  );
  const [maxServers, setMaxServers] = useState(
    String((initial?.limits as Record<string, number> | undefined)?.['max_servers'] ?? 5),
  );
  const [maxDeploys, setMaxDeploys] = useState(
    String((initial?.limits as Record<string, number> | undefined)?.['max_deployments_month'] ?? 100),
  );

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const isPending = createPlan.isPending || updatePlan.isPending;

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(generateSlug(v));
  };

  const handleSlugChange = (v: string) => {
    setSlug(v);
    setSlugEdited(true);
  };

  const handleSubmit = () => {
    const body: AdminPlanBody = {
      name,
      slug: slug || generateSlug(name),
      priceAmount: parseInt(priceAmount, 10) || 0,
      currency,
      isActive,
      limits: {
        max_projects: parseInt(maxProjects, 10) || 0,
        max_servers: parseInt(maxServers, 10) || 0,
        max_deployments_month: parseInt(maxDeploys, 10) || 0,
      },
    };

    if (isEdit && initial) {
      updatePlan.mutate(
        { id: initial.id, ...body },
        {
          onSuccess: () => {
            toast.success('Plan mis à jour');
            onClose();
          },
          onError: (e) => toast.error(e.message),
        },
      );
    } else {
      createPlan.mutate(body, {
        onSuccess: () => {
          toast.success('Plan créé');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Modifier le plan' : 'Nouveau plan'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label className="text-gray-300">Nom</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Pro"
              className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label className="text-gray-300">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="pro"
              className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500 font-mono text-sm"
            />
            <p className="text-[11px] text-gray-500">Auto-généré depuis le nom (modifiable)</p>
          </div>

          {/* Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-300">Prix (centimes)</Label>
              <Input
                type="number"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                min="0"
                className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Devise</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="XOF"
                className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500 uppercase"
              />
            </div>
          </div>

          {/* Limites */}
          <div className="space-y-2">
            <Label className="text-gray-300">Limites</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">Projets max</p>
                <Input
                  type="number"
                  value={maxProjects}
                  onChange={(e) => setMaxProjects(e.target.value)}
                  min="0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">Serveurs max</p>
                <Input
                  type="number"
                  value={maxServers}
                  onChange={(e) => setMaxServers(e.target.value)}
                  min="0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">Deploy/mois</p>
                <Input
                  type="number"
                  value={maxDeploys}
                  onChange={(e) => setMaxDeploys(e.target.value)}
                  min="0"
                  className="bg-gray-800 border-gray-700 text-white focus:border-emerald-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actif */}
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Plan actif</Label>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 19) % 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminPlansPage() {
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<AdminPlan | null>(null);

  const { data: plans, isLoading } = useAdminPlans();
  const deactivate = useDeactivatePlan();

  const handleDeactivate = (plan: AdminPlan) => {
    if (!window.confirm(`Désactiver le plan "${plan.name}" ? Cette action est réversible.`)) return;
    deactivate.mutate(plan.id, {
      onSuccess: () => toast.success(`Plan "${plan.name}" désactivé`),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Plans & Tarification</h1>
          <p className="text-sm text-gray-400 mt-1">Gestion des plans d'abonnement de la plateforme</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus size={14} className="mr-1.5" />
          Nouveau plan
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Slug</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Prix</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Limites</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
                : (plans ?? []).map((plan) => {
                    const limits = plan.limits as Record<string, number>;
                    return (
                      <tr key={plan.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-gray-200 font-medium">{plan.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{plan.slug}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {plan.priceAmount.toLocaleString('fr-FR')} {plan.currency}
                          <span className="text-gray-500 text-xs">/mois</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {limits['max_projects'] != null && (
                            <span className="mr-2">{limits['max_projects']} proj.</span>
                          )}
                          {limits['max_servers'] != null && (
                            <span className="mr-2">{limits['max_servers']} srv.</span>
                          )}
                          {limits['max_deployments_month'] != null && (
                            <span>{limits['max_deployments_month']} dépl./mois</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <PlanStatusBadge isActive={plan.isActive} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditPlan(plan)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                              title="Modifier"
                            >
                              <Pencil size={12} />
                            </Button>
                            {plan.isActive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeactivate(plan)}
                                disabled={deactivate.isPending}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                title="Désactiver"
                              >
                                <PowerOff size={12} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      {showForm && <PlanFormModal onClose={() => setShowForm(false)} />}
      {editPlan && <PlanFormModal initial={editPlan} onClose={() => setEditPlan(null)} />}
    </div>
  );
}
