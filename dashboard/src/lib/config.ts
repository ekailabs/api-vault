/**
 * Centralized configuration loaded from config.json
 * This is the single source of truth for network and gateway configuration.
 */

import config from '../../../config.json';

export type NetworkId = 'sapphire' | 'sapphire-testnet' | 'sapphire-localnet';

export interface NetworkConfig {
  chainId: string;
  name: string;
  rpcUrl: string;
  explorer: string | null;
  gateway: string | null;
}

export interface ContractConfig {
  EkaiControlPlane: string | null;
  owner: string | null;
}

// Default network from config
export const DEFAULT_NETWORK: NetworkId = config.defaultNetwork as NetworkId;

// Network configurations
export const NETWORKS: Record<NetworkId, NetworkConfig> = config.networks as Record<NetworkId, NetworkConfig>;

// Contract addresses per network
export const CONTRACTS: Record<NetworkId, ContractConfig> = config.contracts as Record<NetworkId, ContractConfig>;

// Current network config (based on default)
export const NETWORK = NETWORKS[DEFAULT_NETWORK];
export const CONTRACT = CONTRACTS[DEFAULT_NETWORK];

/**
 * Get the API/Gateway base URL.
 * Priority:
 * 1. NEXT_PUBLIC_API_BASE_URL env var (for overrides)
 * 2. Gateway URL from config.json
 */
export function getApiBaseUrl(): string {
  // Check env var first (works both server and client side)
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl !== '__API_URL_PLACEHOLDER__') {
    return envUrl;
  }

  // Use gateway from config.json
  if (NETWORK.gateway) {
    return NETWORK.gateway;
  }

  throw new Error('No gateway URL configured. Set NEXT_PUBLIC_API_BASE_URL or configure gateway in config.json');
}
