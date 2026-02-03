import { ethers } from 'ethers';

export const PROVIDERS = ['ANTHROPIC', 'OPENAI', 'GOOGLE', 'XAI', 'OPENROUTER', 'GROQ'] as const;
export type Provider = typeof PROVIDERS[number];

export const NETWORKS = {
  'sapphire-testnet': {
    chainId: '0x5aff',
    name: 'Sapphire Testnet',
    rpcUrl: 'https://testnet.sapphire.oasis.io',
    explorer: 'https://testnet.explorer.sapphire.oasis.io',
    contract: '0x1647A17be7Ad7A01C6657aC05FA10349E7f32268',
  },
  'sapphire': {
    chainId: '0x5afe',
    name: 'Sapphire Mainnet',
    rpcUrl: 'https://sapphire.oasis.io',
    explorer: 'https://explorer.sapphire.oasis.io',
    contract: null as string | null,
  },
} as const;

export const DEFAULT_NETWORK = 'sapphire-testnet';
export const NETWORK = NETWORKS[DEFAULT_NETWORK];

export const CONTRACT_ABI = [
  "function owner() view returns (address)",
  "function gateway() view returns (address)",
  "function getRoflKey() view returns (bytes pubkey, uint64 version, bool active)",
  "function setGateway(address)",
  "function clearGateway()",
  "function setRoflKey(bytes, uint64, bool)",
  "function addProvider(bytes32)",
  "function removeProvider(bytes32)",
  "function isValidProvider(bytes32) view returns (bool)",
  "function setSecret(bytes32, bytes)",
  "function revokeSecret(bytes32)",
  "function getSecretCiphertext(address, bytes32) view returns (bytes, uint64, bool, uint64)",
  "function addDelegate(address)",
  "function removeDelegate(address)",
  "function isDelegatePermitted(address, address) view returns (bool)",
  "function delegateCount(address) view returns (uint32)",
  "function addAllowedModel(bytes32, bytes32)",
  "function removeAllowedModel(bytes32, bytes32)",
  "function isModelPermitted(address, bytes32, bytes32) view returns (bool)",
  "function modelCount(address, bytes32) view returns (uint32)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)"
];

// Convert a string (provider/model name) to bytes32 ID
export function toId(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name.toUpperCase()));
}

// Create a read-only provider
export function getReadProvider() {
  return new ethers.JsonRpcProvider(NETWORK.rpcUrl);
}

// Create a read-only contract instance
export function getReadContract() {
  const provider = getReadProvider();
  return new ethers.Contract(NETWORK.contract!, CONTRACT_ABI, provider);
}

// Shorten an address for display
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Get explorer URL for an address
export function getExplorerUrl(address: string): string {
  return `${NETWORK.explorer}/address/${address}`;
}
