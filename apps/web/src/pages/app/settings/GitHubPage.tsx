import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Github, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useGitHubStatus, useGitHubAuthUrl, useGitHubDisconnect } from '@/api/github';

export function GitHubPage() {
  const { t } = useTranslation('settings');
  const [params, setParams] = useSearchParams();
  const { data: status, isLoading } = useGitHubStatus();
  const getAuthUrl = useGitHubAuthUrl();
  const disconnect = useGitHubDisconnect();

  // Handle OAuth callback result in URL params
  useEffect(() => {
    if (params.get('connected') === 'true') {
      toast.success(t('github.connect.btn'));
      setParams({}, { replace: true });
    }
    const error = params.get('error');
    if (error) {
      toast.error(t('github.error', { message: decodeURIComponent(error) }));
      setParams({}, { replace: true });
    }
  }, []); // intentionally run once on mount to consume OAuth callback URL params

  const handleConnect = () => {
    getAuthUrl.mutate(undefined, {
      onSuccess: ({ url }) => {
        window.location.href = url;
      },
      onError: (err: Error) => {
        toast.error(err.message);
      },
    });
  };

  const handleDisconnect = () => {
    if (!window.confirm(t('github.disconnect.confirm'))) return;
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success(t('github.disconnected')),
      onError: (err: Error) => toast.error(err.message),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[--text]">{t('github.title')}</h2>
        <p className="text-sm text-[--text-muted] mt-1">{t('github.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-[--border] bg-[--surface] p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[--text-muted]">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[--text]">
                  {t('github.connected.label')}{' '}
                  <span className="font-mono text-[--accent]">@{status.github_login}</span>
                </p>
                {status.connected_at && (
                  <p className="text-xs text-[--text-muted] mt-0.5">
                    {t('github.connected.since')}{' '}
                    {new Date(status.connected_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            {status.scopes && status.scopes.length > 0 && (
              <div className="text-xs text-[--text-muted]">
                <span className="font-medium">{t('github.connected.scopes')} : </span>
                <span className="font-mono">{status.scopes.join(', ')}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              className="text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {disconnect.isPending ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : (
                <XCircle size={14} className="mr-2" />
              )}
              {t('github.disconnect')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Github size={20} className="text-[--text-muted] shrink-0" />
              <p className="text-sm text-[--text-muted]">{t('github.connect.hint')}</p>
            </div>
            <Button onClick={handleConnect} disabled={getAuthUrl.isPending} className="gap-2">
              {getAuthUrl.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Github size={14} />
              )}
              {t('github.connect.btn')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
