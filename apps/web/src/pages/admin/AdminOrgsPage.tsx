// AdminOrgsPage — liste paginée des organisations (Phase 2 superadmin).
// Actions : voir détail / modifier / supprimer / créer.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useAdminOrgs,
  useAdminPlans,
  useCreateOrg,
  useUpdateOrg,
  useDeleteOrg,
  type AdminOrgSummary,
} from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 17) % 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal créer organisation ──────────────────────────────────────────────────

function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [planId, setPlanId] = useState<string>('');
  const createOrg = useCreateOrg();
  const { data: plans } = useAdminPlans();

  const activePlans = (plans ?? []).filter((p) => p.isActive);

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(slugify(v));
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      toast.error('Le nom et le slug sont requis.');
      return;
    }
    if (!ownerUserId.trim()) {
      toast.error("L'UUID du propriétaire est requis.");
      return;
    }
    createOrg.mutate(
      {
        name: name.trim(),
        slug: slug.trim(),
        planId: planId || null,
        ownerUserId: ownerUserId.trim(),
      },
      {
        onSuccess: (data) => {
          toast.success(`Organisation "${data.name}" créée.`);
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Nouvelle organisation</DialogTitle>
          <DialogDescription className="text-gray-400">
            Créer une organisation et désigner son propriétaire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-gray-300">Nom *</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ma Société"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Slug *</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ma-societe"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">UUID du propriétaire *</Label>
            <Input
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Plan (optionnel)</Label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">— Aucun plan —</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createOrg.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createOrg.isPending ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal modifier organisation ───────────────────────────────────────────────

function EditOrgModal({
  org,
  onClose,
}: {
  org: AdminOrgSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const updateOrg = useUpdateOrg();

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      toast.error('Le nom et le slug sont requis.');
      return;
    }
    updateOrg.mutate(
      { id: org.id, name: name.trim(), slug: slug.trim() },
      {
        onSuccess: () => {
          toast.success('Organisation mise à jour.');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Modifier l'organisation</DialogTitle>
          <DialogDescription className="text-gray-400">{org.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-gray-300">Nom</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateOrg.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {updateOrg.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal supprimer organisation ──────────────────────────────────────────────

function DeleteOrgModal({
  org,
  onClose,
}: {
  org: AdminOrgSummary;
  onClose: () => void;
}) {
  const deleteOrg = useDeleteOrg();

  const handleConfirm = () => {
    deleteOrg.mutate(org.id, {
      onSuccess: () => {
        toast.success(`Organisation "${org.name}" supprimée.`);
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Supprimer cette organisation ?</DialogTitle>
          <DialogDescription className="text-gray-400">
            <span className="font-medium text-gray-200">{org.name}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-red-400 font-medium">Cette action est irréversible.</p>
          <p className="text-xs text-gray-500 mt-1">
            Les membres, projets et serveurs détruits seront supprimés en cascade.
            Les serveurs actifs bloquent la suppression.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteOrg.isPending}
          >
            {deleteOrg.isPending ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminOrgsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<AdminOrgSummary | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<AdminOrgSummary | null>(null);

  const { data, isLoading } = useAdminOrgs({ page, limit: 20, search });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Organisations</h1>
        <p className="text-sm text-gray-400 mt-1">Gestion des organisations de la plateforme</p>
      </div>

      {/* Barre de recherche + bouton créer */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Rechercher par nom..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500"
            />
          </div>
          <Button
            onClick={handleSearch}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Rechercher
          </Button>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <Plus size={14} />
          Nouvelle organisation
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
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Membres</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Projets</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Serveurs</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Créé le</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                : (data?.data ?? []).map((org) => (
                    <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">{org.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{org.slug}</td>
                      <td className="px-4 py-3">
                        {org.planName ? (
                          <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                            {org.planName}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-center">{org.membersCount}</td>
                      <td className="px-4 py-3 text-gray-400 text-center">{org.projectsCount}</td>
                      <td className="px-4 py-3 text-gray-400 text-center">{org.serversCount}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(org.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/orgs/${org.id}`)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Voir le détail"
                          >
                            <Eye size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditOrg(org)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Modifier"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteOrg(org)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-gray-700"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {data ? `${data.total} organisation${data.total > 1 ? 's' : ''}` : '—'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 h-7 px-2 text-xs"
            >
              Préc.
            </Button>
            <span className="text-xs text-gray-400">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 h-7 px-2 text-xs"
            >
              Suiv.
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {createOpen && <CreateOrgModal onClose={() => setCreateOpen(false)} />}
      {editOrg && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} />}
      {deleteOrg && <DeleteOrgModal org={deleteOrg} onClose={() => setDeleteOrg(null)} />}
    </div>
  );
}
