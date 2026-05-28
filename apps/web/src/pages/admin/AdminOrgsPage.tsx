// AdminOrgsPage — liste paginée des organisations (Phase 2 superadmin).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminOrgs } from '@/api/admin';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-800">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-gray-700" style={{ width: `${50 + (i * 17) % 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export function AdminOrgsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

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

      {/* Barre de recherche */}
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/orgs/${org.id}`)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                          title="Voir le détail"
                        >
                          <Eye size={13} />
                        </Button>
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
    </div>
  );
}
