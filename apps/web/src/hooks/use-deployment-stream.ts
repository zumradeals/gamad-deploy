import { useEffect, useRef, useState, useCallback } from 'react';
import type { DeploymentStatus, LogLine } from '@/api/types';

const MAX_LINES = 5000;
const FLUSH_INTERVAL_MS = 100;
// Exponential backoff delays in ms, capped at 30s
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const TERMINAL_STATUSES: ReadonlySet<DeploymentStatus> = new Set(['SUCCESS', 'FAILED', 'ROLLED_BACK']);

const LEVEL_CLASS: Record<LogLine['level'], string> = {
  info: 'text-gray-200',
  warn: 'text-amber-400',
  error: 'text-red-400',
  success: 'text-emerald-400',
};

export interface UseDeploymentStreamResult {
  containerRef: React.RefObject<HTMLDivElement>;
  status: DeploymentStatus | null;
  isConnected: boolean;
  isPaused: boolean;
  follow: () => void;
  pause: () => void;
}

export function useDeploymentStream(deploymentId: string): UseDeploymentStreamResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<LogLine[]>([]);
  const linesCountRef = useRef(0);
  const isPausedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  const statusRef = useRef<DeploymentStatus | null>(null);

  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const appendLinesToDOM = useCallback((lines: LogLine[]) => {
    const container = containerRef.current;
    if (!container || lines.length === 0) return;

    const fragment = document.createDocumentFragment();
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = `leading-5 ${LEVEL_CLASS[line.level] ?? 'text-gray-200'}`;

      const time = document.createElement('span');
      time.className = 'text-gray-500 select-none mr-2 text-xs';
      time.textContent = new Date(line.timestamp).toLocaleTimeString('fr-FR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const msg = document.createElement('span');
      msg.className = 'text-xs';
      msg.textContent = line.message;

      row.appendChild(time);
      row.appendChild(msg);
      fragment.appendChild(row);
    }
    container.appendChild(fragment);

    if (!isPausedRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  const flushPending = useCallback(() => {
    const lines = pendingRef.current;
    if (lines.length === 0) return;
    pendingRef.current = [];

    const container = containerRef.current;
    if (container) {
      const overflow = linesCountRef.current + lines.length - MAX_LINES;
      if (overflow > 0) {
        for (let i = 0; i < overflow && container.firstChild; i++) {
          container.removeChild(container.firstChild);
        }
        linesCountRef.current = Math.max(0, linesCountRef.current - overflow);
      }
    }
    linesCountRef.current += lines.length;
    appendLinesToDOM(lines);
  }, [appendLinesToDOM]);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/deployments/${deploymentId}/stream`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) { ws.close(); return; }
      reconnectAttemptRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: unknown };
        if (msg.type === 'log') {
          pendingRef.current.push(msg.payload as LogLine);
        } else if (msg.type === 'status') {
          const incoming = (msg.payload as { status: DeploymentStatus }).status;
          statusRef.current = incoming;
          setStatus(incoming);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (isUnmountedRef.current) return;
      setIsConnected(false);
      // Do not reconnect if already in a terminal status
      if (statusRef.current && TERMINAL_STATUSES.has(statusRef.current)) return;
      const attempt = reconnectAttemptRef.current;
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => { ws.close(); };
  }, [deploymentId]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();
    flushTimerRef.current = window.setInterval(flushPending, FLUSH_INTERVAL_MS);

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      if (flushTimerRef.current !== null) window.clearInterval(flushTimerRef.current);
      // Final flush before unmount
      flushPending();
      wsRef.current?.close();
    };
  }, [connect, flushPending]);

  // Stop reconnect loop when status becomes terminal
  useEffect(() => {
    if (status && TERMINAL_STATUSES.has(status)) {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }
  }, [status]);

  const follow = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  return { containerRef, status, isConnected, isPaused, follow, pause };
}
