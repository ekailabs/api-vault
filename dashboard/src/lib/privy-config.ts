/**
 * Privy configuration for wallet authentication
 */

import { defineChain } from 'viem';
import { NETWORK } from './config';
import type { PrivyClientConfig } from '@privy-io/react-auth';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

// Define the Sapphire chain for Privy using config.json values
const chainId = parseInt(NETWORK.chainId, 16);
export const sapphireChain = defineChain({
  id: chainId,
  name: NETWORK.name,
  network: NETWORK.name.toLowerCase().replace(/\s+/g, '-'),
  nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
  rpcUrls: {
    default: { http: [NETWORK.rpcUrl] },
  },
  blockExplorers: NETWORK.explorer
    ? { default: { name: 'Explorer', url: NETWORK.explorer } }
    : undefined,
});

export const privyConfig: PrivyClientConfig = {
  defaultChain: sapphireChain,
  supportedChains: [sapphireChain],
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  loginMethods: ['wallet', 'email', 'google'],
  appearance: {
    theme: 'light',
    accentColor: '#004f4f',
  },
};
