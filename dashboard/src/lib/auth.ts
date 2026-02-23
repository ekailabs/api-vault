/**
 * Authentication utilities for MetaMask Web3 login
 * Handles EIP-712 message signing and token management
 */

import { getApiBaseUrl } from './api';
import { NETWORK } from './config';

// Re-export for backwards compatibility
export { getApiBaseUrl };

// Dynamic chain ID from config.json (supports testnet + mainnet)
const CHAIN_ID = parseInt(NETWORK.chainId, 16);

/**
 * Connect to MetaMask wallet
 * @returns Promise with connected address
 */
export async function connectMetaMask(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts available');
    }

    return accounts[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('user rejected')) {
      throw new Error('User rejected MetaMask connection');
    }
    throw error;
  }
}

/**
 * Create EIP-712 typed data structure for signing
 * This structure must match what the backend expects to verify
 */
export function createEIP712Message(
  address: string,
  expiration: number
): EIP712TypedData {
  return {
    domain: {
      name: 'Ekai Gateway',
      version: '1',
      chainId: CHAIN_ID,
      // Note: No verifyingContract for off-chain signing
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }
      ],
      Login: [
        { name: 'address', type: 'address' },
        { name: 'expiration', type: 'uint256' }
      ]
    },
    primaryType: 'Login',
    message: {
      address,
      expiration
    }
  };
}

/**
 * Request signature from MetaMask for EIP-712 typed data
 */
export async function signMessage(typedData: EIP712TypedData): Promise<string> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [typedData.message.address, JSON.stringify(typedData)]
    }) as string;

    return signature;
  } catch (error) {
    if (error instanceof Error && error.message.includes('user rejected')) {
      throw new Error('User rejected message signing');
    }
    throw error;
  }
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now > expiresAt;
}

/**
 * Format token and export commands for display
 */
export function formatTokenExport(token: string): string {
  const apiUrl = getApiBaseUrl();
  return `export ANTHROPIC_BASE_URL=${apiUrl}\nexport ANTHROPIC_API_KEY=${token}`;
}


/**
 * Calculate time until token expiration
 */
export function getTimeUntilExpiration(expiresAt: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const secondsRemaining = Math.max(0, expiresAt - now);

  return {
    days: Math.floor(secondsRemaining / 86400),
    hours: Math.floor((secondsRemaining % 86400) / 3600),
    minutes: Math.floor((secondsRemaining % 3600) / 60),
    seconds: secondsRemaining % 60
  };
}

/**
 * Format expiration time for display
 */
export function formatExpirationTime(expiresAt: number): string {
  const time = getTimeUntilExpiration(expiresAt);

  if (time.days > 0) {
    return `${time.days} day${time.days > 1 ? 's' : ''} remaining`;
  }

  if (time.hours > 0) {
    return `${time.hours} hour${time.hours > 1 ? 's' : ''} remaining`;
  }

  if (time.minutes > 0) {
    return `${time.minutes} minute${time.minutes > 1 ? 's' : ''} remaining`;
  }

  return `${time.seconds} second${time.seconds > 1 ? 's' : ''} remaining`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// TypeScript types for EIP-712

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract?: string;
}

export interface EIP712Type {
  name: string;
  type: string;
}

export interface EIP712Message {
  address: string;
  expiration: number;
}

export interface EIP712TypedData {
  domain: EIP712Domain;
  types: {
    EIP712Domain: EIP712Type[];
    Login: EIP712Type[];
  };
  primaryType: 'Login';
  message: EIP712Message;
}
