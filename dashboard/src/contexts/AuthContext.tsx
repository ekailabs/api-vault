'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/lib/api';

export interface AuthState {
  address: string | null;
  token: string | null;
  expiresAt: number | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  connectWallet: () => Promise<string>;
  login: (expiration: number, signature: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ekai_auth_token';
const ADDRESS_KEY = 'ekai_auth_address';
const EXPIRATION_KEY = 'ekai_auth_expiration';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    address: null,
    token: null,
    expiresAt: null,
    isConnected: false,
    isLoading: true,
    error: null
  });

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem(STORAGE_KEY);
        const address = localStorage.getItem(ADDRESS_KEY);
        const expirationStr = localStorage.getItem(EXPIRATION_KEY);
        const expiresAt = expirationStr ? parseInt(expirationStr, 10) : null;

        if (token && address && expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          if (now < expiresAt) {
            setState({
              address,
              token,
              expiresAt,
              isConnected: true,
              isLoading: false,
              error: null
            });
          } else {
            // Token expired, clean up
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(ADDRESS_KEY);
            localStorage.removeItem(EXPIRATION_KEY);
            setState(prev => ({ ...prev, isLoading: false }));
          }
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setState(prev => ({ ...prev, isLoading: false, error: 'Failed to initialize authentication' }));
      }
    };

    initializeAuth();
  }, []);

  const connectWallet = async (): Promise<string> => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }

      const address = accounts[0];
      setState(prev => ({
        ...prev,
        isConnected: true,
        error: null
      }));

      return address;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      throw err;
    }
  };

  const login = async (address: string, expiration: number, signature: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!address) {
        throw new Error('No wallet address connected');
      }

      // Call the backend auth endpoint
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          expiration,
          signature
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Authentication failed: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Store token in localStorage
      localStorage.setItem(STORAGE_KEY, data.token);
      localStorage.setItem(ADDRESS_KEY, data.address);
      localStorage.setItem(EXPIRATION_KEY, String(data.expiresAt));

      setState({
        address: data.address,
        token: data.token,
        expiresAt: data.expiresAt,
        isConnected: true,
        isLoading: false,
        error: null
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ADDRESS_KEY);
    localStorage.removeItem(EXPIRATION_KEY);
    setState({
      address: null,
      token: null,
      expiresAt: null,
      isConnected: false,
      isLoading: false,
      error: null
    });
  };

  const checkAuth = (): boolean => {
    if (!state.token || !state.expiresAt) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > state.expiresAt) {
      logout();
      return false;
    }

    return true;
  };

  const value: AuthContextType = {
    ...state,
    connectWallet,
    login,
    logout,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Helper to get the API base URL (mirrors the pattern in api.ts)
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }

  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl !== '__API_URL_PLACEHOLDER__') {
    return envUrl;
  }

  const { protocol, hostname } = window.location;
  if (hostname.includes('p3000')) {
    return `${protocol}//${hostname.replace('p3000', 'p3001')}`;
  }

  return 'http://localhost:3001';
}
