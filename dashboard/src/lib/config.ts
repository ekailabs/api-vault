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
 * 1. NEXT_PUBLIC_API_BASE_URL env var (for production deployments)
 * 2. Smart detection from browser URL (for ROFL proxies)
 * 3. Gateway URL from config.json (for configured deployments)
 * 4. Fallback to localhost:3001 (for local development)
 */
export function getApiBaseUrl(): string {
  // Server-side: use env var or config
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || NETWORK.gateway || 'http://localhost:3001';
  }

  // Client-side: check if env var is set and not a placeholder
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl !== '__API_URL_PLACEHOLDER__') {
    return envUrl;
  }

  // Smart fallback: derive from browser location (works for ROFL and proxies)
  const { protocol, hostname, port } = window.location;

  // ROFL-style proxy URL pattern (p3000 -> p3001)
  if (hostname.includes('p3000')) {
    return `${protocol}//${hostname.replace('p3000', 'p3001')}`;
  }

  // Local dev: port 3000 -> 3001
  if (port === '3000') {
    return `${protocol}//${hostname}:3001`;
  }

  // Use gateway from config if available
  if (NETWORK.gateway) {
    return NETWORK.gateway;
  }

  // Production: assume API is on same origin
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}
