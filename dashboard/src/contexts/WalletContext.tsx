'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner, Contract } from 'ethers';
import { NETWORK, CONTRACT_ABI, getReadContract } from '@/lib/contract';

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

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
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

  const updateAccount = useCallback(async (newAddress: string, newSigner: JsonRpcSigner) => {
    setAddress(newAddress);
    setSigner(newSigner);
    const contractInstance = new Contract(NETWORK.contract!, CONTRACT_ABI, newSigner);
    setContract(contractInstance);
    await checkOwnership(newAddress);
  }, [checkOwnership]);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not found. Please install MetaMask extension.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // First switch to Sapphire network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: NETWORK.chainId }],
        });
      } catch (switchError: unknown) {
        // Chain not added, try to add it
        const err = switchError as { code?: number };
        if (err.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: NETWORK.chainId,
              chainName: NETWORK.name,
              rpcUrls: [NETWORK.rpcUrl],
              nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
              blockExplorerUrls: [NETWORK.explorer],
            }],
          });
        } else {
          throw switchError;
        }
      }

      // Request permission - this prompts user to select/connect account
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      // Now get the connected accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No account selected');
      }

      const provider = new BrowserProvider(window.ethereum);
      const newSigner = await provider.getSigner();

      await updateAccount(accounts[0], newSigner);
    } catch (e: unknown) {
      const err = e as Error;
      console.error('Connect error:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [updateAccount]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsOwner(false);
    setContract(null);
    setSigner(null);
    setError(null);
  }, []);

  // Set up MetaMask event listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        disconnect();
      } else {
        // Account changed - need to reconnect
        disconnect();
      }
    };

    const handleChainChanged = () => {
      // Reload to reset state on chain change
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect]);

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

// Declare ethereum on window for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
