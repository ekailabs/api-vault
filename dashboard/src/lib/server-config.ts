/**
 * Server-side configuration helpers.
 * Reads from config.json — avoids deep relative imports from API routes.
 */

import config from '../../../config.json';

type NetworkId = 'sapphire' | 'sapphire-testnet' | 'sapphire-localnet';

const defaultNetwork = config.defaultNetwork as NetworkId;

export function getRpcUrl(): string {
  return config.networks[defaultNetwork].rpcUrl;
}
