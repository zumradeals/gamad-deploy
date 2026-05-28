// AdminUsersPage — liste paginée des utilisateurs (Phase 2 superadmin).
// Skeleton loading, search ILIKE, actions : détail / changer rôle / suspendre / créer / modifier / supprimer.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, ShieldCheck, Ban, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useAdminUsers,
  useChangeUserRole,
  useSuspendUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  type AdminUserSummary,
} from '@/api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

function PlatformRoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-gray-500 text-xs">—</span>;
  const variants: Record<string, string> = {
    superadmin: 'bg-red-500/15 text-red-400 border-red-500/20',
    support: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    user: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${variants[role] ?? variants['user']}`}>
      {role}
    </span>
  );
}

function StatusBadge({ suspendedAt }: { suspendedAt: string | null }) {
  if (suspendedAt) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 uppercase tracking-wide">
        Suspendu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
      Actif
    </span>
  );
}

function UserAvatar({ email, fullName }: { email: string; fullName: string | null }) {
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-200">
      {initials}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal changement de rôle ──────────────────────────────────────────────────

function ChangeRoleModal({
  user,
  onClose,
}: {
  user: AdminUserSummary;
  onClose: () => void;
}) {
  const [role, setRole] = useState<'superadmin' | 'support' | 'user'>(
    (user.platformRole as 'superadmin' | 'support' | 'user') ?? 'user',
  );
  const changeRole = useChangeUserRole();

  const handleSubmit = () => {
    changeRole.mutate(
      { id: user.id, role },
      {
        onSuccess: () => {
          toast.success(`Rôle de ${user.email} changé en "${role}"`);
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
          <DialogTitle className="text-white">Changer le rôle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-400">{user.email}</p>
          <div className="space-y-1">
            <Label className="text-gray-300">Rôle plateforme</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="user">user</option>
              <option value="support">support</option>
              <option value="superadmin">superadmin</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={changeRole.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {changeRole.isPending ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal créer utilisateur ────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [platformRole, setPlatformRole] = useState<'superadmin' | 'support' | 'user'>('user');
  const createUser = useCreateUser();

  const handleSubmit = () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Email et mot de passe sont requis.');
      return;
    }
    createUser.mutate(
      { email: email.trim(), fullName: fullName.trim(), password, platformRole },
      {
        onSuccess: (data) => {
          toast.success(`Utilisateur ${data.email} créé.`);
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
          <DialogTitle className="text-white">Nouvel utilisateur</DialogTitle>
          <DialogDescription className="text-gray-400">
            Créer un compte utilisateur sur la plateforme.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-gray-300">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Nom complet</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alice Dupont"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Mot de passe *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 caractères"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Rôle plateforme</Label>
            <select
              value={platformRole}
              onChange={(e) => setPlatformRole(e.target.value as typeof platformRole)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="user">user</option>
              <option value="support">support</option>
              <option value="superadmin">superadmin</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createUser.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createUser.isPending ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal modifier utilisateur ────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
}: {
  user: AdminUserSummary;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const updateUser = useUpdateUser();

  const handleSubmit = () => {
    updateUser.mutate(
      { id: user.id, email: email.trim(), fullName: fullName.trim() },
      {
        onSuccess: () => {
          toast.success('Utilisateur mis à jour.');
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
          <DialogTitle className="text-white">Modifier l'utilisateur</DialogTitle>
          <DialogDescription className="text-gray-400">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-gray-300">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Nom complet</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateUser.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {updateUser.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal supprimer utilisateur ───────────────────────────────────────────────

function DeleteUserModal({
  user,
  onClose,
}: {
  user: AdminUserSummary;
  onClose: () => void;
}) {
  const deleteUser = useDeleteUser();

  const handleConfirm = () => {
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        toast.success(`Utilisateur ${user.email} supprimé.`);
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Supprimer cet utilisateur ?</DialogTitle>
          <DialogDescription className="text-gray-400">
            <span className="font-medium text-gray-200">{user.email}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-red-400 font-medium">Cette action est irréversible.</p>
          <p className="text-xs text-gray-500 mt-1">
            L'utilisateur, ses memberships et ses rôles seront supprimés définitivement.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleModalUser, setRoleModalUser] = useState<AdminUserSummary | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserSummary | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserSummary | null>(null);

  const { data, isLoading } = useAdminUsers({ page, limit: 20, search });
  const suspendUser = useSuspendUser();

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSuspend = (user: AdminUserSummary) => {
    const action = user.suspendedAt ? 'réactiver' : 'suspendre';
    if (!window.confirm(`Voulez-vous ${action} le compte de ${user.email} ?`)) return;
    suspendUser.mutate(
      { id: user.id, suspend: !user.suspendedAt },
      {
        onSuccess: () => toast.success(`Compte ${user.suspendedAt ? 'réactivé' : 'suspendu'}`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Utilisateurs</h1>
        <p className="text-sm text-gray-400 mt-1">Gestion des comptes utilisateurs de la plateforme</p>
      </div>

      {/* Barre de recherche + bouton créer */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Rechercher email ou nom..."
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
          Nouvel utilisateur
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Avatar</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Rôle</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Orgs</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Créé le</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                : (data?.data ?? []).map((user) => (
                    <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <UserAvatar email={user.email} fullName={user.fullName} />
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-mono text-xs">{user.email}</td>
                      <td className="px-4 py-3 text-gray-300">{user.fullName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <PlatformRoleBadge role={user.platformRole} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge suspendedAt={user.suspendedAt} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-center">{user.orgsCount}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Voir le détail"
                          >
                            <Eye size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRoleModalUser(user)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Changer le rôle"
                          >
                            <ShieldCheck size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSuspend(user)}
                            className={`h-7 w-7 p-0 hover:bg-gray-700 ${user.suspendedAt ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-400 hover:text-orange-300'}`}
                            title={user.suspendedAt ? 'Réactiver' : 'Suspendre'}
                          >
                            <Ban size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditUser(user)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Modifier"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteUser(user)}
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
            {data ? `${data.total} utilisateur${data.total > 1 ? 's' : ''}` : '—'}
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
      {roleModalUser && (
        <ChangeRoleModal user={roleModalUser} onClose={() => setRoleModalUser(null)} />
      )}
      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {deleteUser && <DeleteUserModal user={deleteUser} onClose={() => setDeleteUser(null)} />}
    </div>
  );
}
