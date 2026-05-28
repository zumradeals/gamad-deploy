// AdminServersPage — liste des serveurs/agents cross-tenant (Phase 3 superadmin).
// Pas de pagination. Actualisation toutes les 30s (refetchInterval). Alerte STALE.
// Actions : créer (dialog multi-étapes avec token), modifier, supprimer.

import { useState } from 'react';
import { AlertTriangle, Plus, Pencil, Trash2, Copy, Check } from 'lucide-react';
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
  useAdminServers,
  useAdminOrgs,
  useCreateServer,
  useUpdateServer,
  useDeleteServer,
  type AdminServerSummary,
} from '@/api/admin';
import { buildDockerRunCommand } from '@/lib/agent';

// ── Helpers ───────────────────────────────────────────────────────────────────

type ServerStatus = AdminServerSummary['status'];

const SERVER_STATUS_LABELS: Record<ServerStatus, string> = {
  provisioning: 'Provisioning',
  installing: 'Installation',
  ready: 'Prêt',
  error: 'Erreur',
  destroyed: 'Détruit',
};

const SERVER_STATUS_CLASSES: Record<ServerStatus, string> = {
  provisioning: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  installing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  error: 'bg-red-500/15 text-red-400 border-red-500/20',
  destroyed: 'bg-gray-500/15 text-gray-500 border-gray-500/20',
};

function ServerStatusBadge({ status, isStale }: { status: ServerStatus; isStale: boolean }) {
  if (isStale) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
        <AlertTriangle size={9} />
        STALE
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SERVER_STATUS_CLASSES[status]}`}>
      {SERVER_STATUS_LABELS[status]}
    </span>
  );
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Jamais';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return new Date(lastSeenAt).toLocaleDateString('fr-FR');
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 11) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal créer serveur (multi-étapes) ────────────────────────────────────────

interface CreatedServer {
  id: string;
  name: string;
  host: string;
  agentPort: number;
  agentToken: string;
}

function CreateServerModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [agentPort, setAgentPort] = useState('7500');
  const [orgId, setOrgId] = useState('');
  const [provider, setProvider] = useState<'hetzner' | 'ovh' | 'digitalocean' | 'custom' | ''>('');
  const [region, setRegion] = useState('');
  const [created, setCreated] = useState<CreatedServer | null>(null);
  const [copied, setCopied] = useState(false);
  const createServer = useCreateServer();

  // Charger toutes les orgs pour le select (page 1, limit 100)
  const { data: orgsData } = useAdminOrgs({ page: 1, limit: 100 });
  const orgs = orgsData?.data ?? [];

  const handleSubmit = () => {
    if (!name.trim() || !host.trim() || !orgId) {
      toast.error('Nom, host et organisation sont requis.');
      return;
    }
    const port = Number(agentPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error('Port agent invalide (1–65535).');
      return;
    }
    createServer.mutate(
      {
        name: name.trim(),
        host: host.trim(),
        agentPort: port,
        orgId,
        ...(provider ? { provider } : {}),
        ...(region.trim() ? { region: region.trim() } : {}),
      },
      {
        onSuccess: (data) => {
          setCreated(data);
          setStep(2);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleCopy = async () => {
    if (!created) return;
    const cmd = buildDockerRunCommand(created.agentPort, created.agentToken);
    await navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 2 && created) {
    const dockerCmd = buildDockerRunCommand(created.agentPort, created.agentToken);
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Serveur créé — Commande d'installation</DialogTitle>
            <DialogDescription className="text-gray-400">
              Serveur <span className="font-medium text-gray-200">{created.name}</span> ({created.host}:{created.agentPort})
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300 font-medium">
                Ce token ne sera plus affiché. Copiez la commande maintenant et exécutez-la sur le VPS.
              </p>
            </div>
            <div className="relative">
              <pre className="rounded-md bg-gray-950 border border-gray-700 p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                {dockerCmd}
              </pre>
              <button
                onClick={() => { void handleCopy(); }}
                className="absolute top-2 right-2 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 px-2 py-1 text-xs text-gray-300 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Nouveau serveur VPS</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enregistrer un nouveau VPS sur la plateforme.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-gray-300">Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vps-prod-01"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Host (IP ou domaine) *</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.1"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Port agent</Label>
            <Input
              type="number"
              value={agentPort}
              onChange={(e) => setAgentPort(e.target.value)}
              min={1}
              max={65535}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Organisation *</Label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">— Sélectionner une organisation —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Provider</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">— Aucun / Personnalisé —</option>
              <option value="hetzner">Hetzner</option>
              <option value="ovh">OVH</option>
              <option value="digitalocean">DigitalOcean</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Région</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="eu-west-1"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createServer.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createServer.isPending ? 'Création...' : 'Créer le serveur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal modifier serveur ────────────────────────────────────────────────────

function EditServerModal({
  server,
  onClose,
}: {
  server: AdminServerSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState(server.host);
  const [agentPort, setAgentPort] = useState(String(server.agentPort));
  const updateServer = useUpdateServer();

  const handleSubmit = () => {
    const port = Number(agentPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error('Port agent invalide (1–65535).');
      return;
    }
    updateServer.mutate(
      { id: server.id, name: name.trim(), host: host.trim(), agentPort: port },
      {
        onSuccess: () => {
          toast.success('Serveur mis à jour.');
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
          <DialogTitle className="text-white">Modifier le serveur</DialogTitle>
          <DialogDescription className="text-gray-400">{server.name} — {server.host}</DialogDescription>
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
            <Label className="text-gray-300">Host</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-gray-300">Port agent</Label>
            <Input
              type="number"
              value={agentPort}
              onChange={(e) => setAgentPort(e.target.value)}
              min={1}
              max={65535}
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
            disabled={updateServer.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {updateServer.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal supprimer serveur ───────────────────────────────────────────────────

function DeleteServerModal({
  server,
  onClose,
}: {
  server: AdminServerSummary;
  onClose: () => void;
}) {
  const deleteServer = useDeleteServer();

  const handleConfirm = () => {
    deleteServer.mutate(server.id, {
      onSuccess: () => {
        toast.success(`Serveur "${server.name}" supprimé.`);
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Supprimer ce serveur ?</DialogTitle>
          <DialogDescription className="text-gray-400">
            <span className="font-medium text-gray-200">{server.name}</span> — {server.host}:{server.agentPort}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-red-400 font-medium">Cette action est irréversible.</p>
          <p className="text-xs text-gray-500 mt-1">
            La suppression est bloquée si le serveur héberge des projets actifs.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteServer.isPending}
          >
            {deleteServer.isPending ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminServersPage() {
  const { data, isLoading } = useAdminServers();
  const [createOpen, setCreateOpen] = useState(false);
  const [editServer, setEditServer] = useState<AdminServerSummary | null>(null);
  const [deleteServer, setDeleteServer] = useState<AdminServerSummary | null>(null);

  const servers = data?.data ?? [];
  const staleCount = servers.filter((s) => s.isStale).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Serveurs & Agents</h1>
          <p className="text-sm text-gray-400 mt-1">
            Vue globale des VPS et agents cross-tenant. Actualisation toutes les 30s.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {staleCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5">
              <AlertTriangle size={13} className="text-red-400" />
              <span className="text-xs text-red-400 font-medium">
                {staleCount} agent{staleCount > 1 ? 's' : ''} inactif{staleCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus size={14} />
            Nouveau serveur
          </Button>
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Organisation</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Host</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Port</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Version agent</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Dernière activité</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Projets</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : servers.length === 0
                ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Aucun serveur enregistré.
                      </td>
                    </tr>
                  )
                : servers.map((server) => (
                    <tr
                      key={server.id}
                      className={`border-b border-gray-800/50 transition-colors ${server.isStale ? 'bg-red-950/10' : 'hover:bg-gray-800/30'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {server.isStale && (
                            <AlertTriangle size={12} className="text-red-400 shrink-0" />
                          )}
                          <span className="text-gray-200 font-medium">{server.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{server.orgName}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{server.host}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{server.agentPort}</td>
                      <td className="px-4 py-3">
                        <ServerStatusBadge status={server.status} isStale={server.isStale} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {server.agentVersion ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={server.isStale ? 'text-red-400' : 'text-gray-400'}>
                          {formatLastSeen(server.lastSeenAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-center text-xs">
                        {server.projectsCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditServer(server)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                            title="Modifier"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteServer(server)}
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

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            {isLoading ? '…' : `${servers.length} serveur${servers.length > 1 ? 's' : ''} total`}
          </p>
        </div>
      </Card>

      {/* Modals */}
      {createOpen && <CreateServerModal onClose={() => setCreateOpen(false)} />}
      {editServer && <EditServerModal server={editServer} onClose={() => setEditServer(null)} />}
      {deleteServer && <DeleteServerModal server={deleteServer} onClose={() => setDeleteServer(null)} />}
    </div>
  );
}
