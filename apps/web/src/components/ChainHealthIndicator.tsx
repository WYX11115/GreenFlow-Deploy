import { useQuery } from '@tanstack/react-query';
import { Activity, CircleAlert } from 'lucide-react';
import { api } from '../lib/api';

export function ChainHealthIndicator() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 5_000,
    retry: false
  });

  if (!health.data) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-200/10 px-3 py-1.5 text-xs text-amber-100">
        <CircleAlert size={14} aria-hidden="true" />
        {health.isError ? 'Chain unavailable' : 'Checking local chain…'}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs text-mint">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
      </span>
      <Activity size={14} aria-hidden="true" />
      Chain {health.data.chain.chainId} · block {health.data.chain.latestBlock}
    </div>
  );
}

