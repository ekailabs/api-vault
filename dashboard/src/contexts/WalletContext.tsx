'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner, Contract } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { NETWORK, CONTRACT_ABI, getReadContract } from '@/lib/contract';
import { sapphireChain } from '@/lib/privy-config';

interface WalletContextType {
  address: string | null;
  isOwner: boolean;
  isConnecting: boolean;
  contract: Contract | null;
  signer: JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const DEFAULT_WALLET_CONTEXT: WalletContextType = {
  address: null,
  isOwner: false,
  isConnecting: false,
  contract: null,
  signer: null,
  connect: async () => {},
  disconnect: () => {},
  error: null,
  clearError: () => {},
};

export function useWallet() {
  const context = useContext(WalletContext);
  // Return defaults during SSR (before Privy/WalletProvider mounts)
  return context ?? DEFAULT_WALLET_CONTEXT;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const { login: privyLogin, logout: privyLogout, authenticated, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const [address, setAddress] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const checkOwnership = useCallback(async (userAddress: string) => {
    try {
      const readContract = getReadContract();
      const owner = await readContract.owner();
      setIsOwner(owner.toLowerCase() === userAddress.toLowerCase());
    } catch (e) {
      console.error('Failed to check ownership:', e);
      setIsOwner(false);
    }
  }, []);

  const setupWallet = useCallback(async (wallet: (typeof wallets)[0]) => {
    try {
      // Switch to Sapphire chain
      await wallet.switchChain(sapphireChain.id);

      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new BrowserProvider(ethereumProvider);
      const newSigner = await provider.getSigner();
      const addr = wallet.address;

      setAddress(addr);
      setSigner(newSigner);
      const contractInstance = new Contract(NETWORK.contract!, CONTRACT_ABI, newSigner);
      setContract(contractInstance);
      await checkOwnership(addr);
    } catch (e) {
      console.error('Failed to setup wallet:', e);
      setError(e instanceof Error ? e.message : 'Failed to setup wallet');
    }
  }, [checkOwnership]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      privyLogin();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('Connect error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [privyLogin]);

  const disconnect = useCallback(() => {
    privyLogout();
    setAddress(null);
    setIsOwner(false);
    setContract(null);
    setSigner(null);
    setError(null);
  }, [privyLogout]);

  // Auto-setup when Privy authenticates and wallets become available
  useEffect(() => {
    if (!privyReady || !walletsReady) return;

    if (authenticated && wallets.length > 0) {
      // Use the first available wallet (embedded or external)
      const wallet = wallets[0];
      if (wallet.address !== address) {
        setupWallet(wallet);
      }
    } else if (!authenticated && address) {
      // User logged out of Privy
      setAddress(null);
      setIsOwner(false);
      setContract(null);
      setSigner(null);
    }
  }, [authenticated, wallets, privyReady, walletsReady, address, setupWallet]);

  return (
    <WalletContext.Provider value={{
      address,
      isOwner,
      isConnecting,
      contract,
      signer,
      connect,
      disconnect,
      error,
      clearError,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
