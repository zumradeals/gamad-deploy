import { useTranslation } from 'react-i18next';
import { Play, Pause, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeploymentStream } from '@/hooks/use-deployment-stream';
import type { DeploymentStatus } from '@/api/types';

interface DeploymentTerminalProps {
  deploymentId: string;
  initialStatus?: DeploymentStatus | null;
}

export function DeploymentTerminal({ deploymentId, initialStatus }: DeploymentTerminalProps) {
  const { t } = useTranslation('deployment');
  const { containerRef, status, isConnected, isPaused, follow, pause } = useDeploymentStream(deploymentId);

  const effectiveStatus = status ?? initialStatus ?? null;
  const isTerminal = effectiveStatus === 'SUCCESS' || effectiveStatus === 'FAILED' || effectiveStatus === 'ROLLED_BACK';

  return (
    <div className="flex flex-col rounded-lg border border-[--border] overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between gap-2 bg-[#0d1117] px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isConnected ? (
            <Wifi size={12} className="text-emerald-400" />
          ) : isTerminal ? null : (
            <WifiOff size={12} className="text-amber-400 animate-pulse" />
          )}
          <span>
            {isConnected
              ? t('terminal.connected')
              : isTerminal
                ? null
                : t('terminal.disconnected')}
          </span>
        </div>
        {!isTerminal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-gray-400 hover:text-white"
            onClick={isPaused ? follow : pause}
          >
            {isPaused ? <Play size={11} /> : <Pause size={11} />}
            {isPaused ? t('terminal.follow') : t('terminal.pause')}
          </Button>
        )}
      </div>

      {/* Log output — DOM written directly by useDeploymentStream, no React re-render per line */}
      <div
        ref={containerRef}
        className="h-96 overflow-auto bg-[#0d1117] p-4 font-mono text-xs leading-5 scroll-smooth"
        aria-label={t('logs.title')}
      >
        {/* Lines appended here by useDeploymentStream via DOM API */}
      </div>

      {/* Limit warning rendered in React — structural change, not per-line */}
      <p className="bg-[#0d1117] border-t border-white/10 px-4 py-1 text-[10px] text-gray-600">
        {t('terminal.limit')}
      </p>
    </div>
  );
}
