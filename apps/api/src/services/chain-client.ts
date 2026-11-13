import { PHASE4_CONTRACTS } from '@greenflow/shared';
import { createPublicClient, http } from 'viem';
import type { ApiConfig } from '../config.js';

export interface ChainSnapshot {
  connected: boolean;
  contractsReady: boolean;
  chainId: number | null;
  latestBlock: string | null;
}

export type ChainProbe = () => Promise<ChainSnapshot>;

export function createChainProbe(config: ApiConfig): ChainProbe {
  const client = createPublicClient({ transport: http(config.ANVIL_RPC_URL) });

  return async () => {
    try {
      const [chainId, latestBlock, ...contractCodes] = await Promise.all([
        client.getChainId(),
        client.getBlockNumber(),
        ...Object.values(PHASE4_CONTRACTS).map((address) => client.getCode({ address }))
      ]);

      return {
        connected: chainId === config.ANVIL_CHAIN_ID,
        contractsReady: contractCodes.every((code) => Boolean(code && code !== '0x')),
        chainId,
        latestBlock: latestBlock.toString()
      };
    } catch {
      return { connected: false, contractsReady: false, chainId: null, latestBlock: null };
    }
  };
}

