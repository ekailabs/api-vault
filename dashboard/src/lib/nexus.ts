/**
 * Oasis Nexus indexer client.
 *
 * Sapphire's RPC caps `eth_getLogs` at 100 blocks per query, so scanning the
 * contract's full history from the browser is impractical. Nexus is the indexer
 * that powers the Sapphire block explorer; it lets us query every transaction
 * related to the contract in a handful of paginated requests.
 */

import { CONTRACT, DEFAULT_NETWORK } from './config';

// Nexus indexer base URL per network. The runtime path segment is `sapphire`
// on both mainnet and testnet; only the host differs.
const NEXUS_BASE: Record<string, string | null> = {
  sapphire: 'https://nexus.oasis.io/v1/sapphire',
  'sapphire-testnet': 'https://testnet.nexus.oasis.io/v1/sapphire',
  'sapphire-localnet': null,
};

export function getNexusBaseUrl(): string | null {
  return NEXUS_BASE[DEFAULT_NETWORK] ?? null;
}

// A unique on-chain user: an address that has signed a transaction to the
// contract, with how many it sent and when it last interacted.
export interface NexusUser {
  address: string;
  txCount: number;
  lastActive: string | null;
}

interface NexusTransaction {
  sender_0_eth?: string;
  timestamp?: string;
}

interface NexusTransactionsResponse {
  transactions: NexusTransaction[];
}

/**
 * Fetch every address that has signed a transaction to the contract, deduped,
 * with per-address transaction counts and last-active timestamps.
 *
 * This is the on-chain user set: every distinct account that has actually
 * interacted with the contract, including admin and the gateway relayer.
 * Sorted by transaction count, descending.
 */
export async function fetchUsers(): Promise<NexusUser[]> {
  const base = getNexusBaseUrl();
  if (!base) {
    throw new Error(`No Nexus indexer configured for network "${DEFAULT_NETWORK}"`);
  }
  const contract = CONTRACT.EkaiControlPlane;
  if (!contract) {
    throw new Error(`No contract address configured for network "${DEFAULT_NETWORK}"`);
  }

  const users = new Map<string, NexusUser>();
  const limit = 1000;
  let offset = 0;

  // Paginate until a page returns fewer rows than the limit.
  for (;;) {
    const url = `${base}/transactions?rel=${contract}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Nexus request failed: ${res.status} ${res.statusText}`);
    }
    const json: NexusTransactionsResponse = await res.json();
    const txs = json.transactions ?? [];
    for (const tx of txs) {
      const address = tx.sender_0_eth?.toLowerCase();
      if (!address) continue;
      const existing = users.get(address);
      if (existing) {
        existing.txCount += 1;
        if (tx.timestamp && (!existing.lastActive || tx.timestamp > existing.lastActive)) {
          existing.lastActive = tx.timestamp;
        }
      } else {
        users.set(address, { address, txCount: 1, lastActive: tx.timestamp ?? null });
      }
    }
    if (txs.length < limit) break;
    offset += limit;
  }

  return [...users.values()].sort((a, b) => b.txCount - a.txCount);
}
