'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext';
import { PROVIDERS, Provider, toId, getReadContract } from '@/lib/contract';

export default function SecretsPanel() {
  const { address, contract } = useWallet();
  const [secretProvider, setSecretProvider] = useState<Provider>('ANTHROPIC');
  const [secretValue, setSecretValue] = useState('');
  const [revokeProvider, setRevokeProvider] = useState<Provider>('ANTHROPIC');
  const [mySecrets, setMySecrets] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSecrets = useCallback(async () => {
    if (!address) {
      setMySecrets({});
      return;
    }
    const readContract = getReadContract();
    const secrets: Record<string, boolean> = {};
    for (const prov of PROVIDERS) {
      try {
        const [, , exists] = await readContract.getSecretCiphertext(address, toId(prov));
        secrets[prov] = exists;
      } catch {
        secrets[prov] = false;
      }
    }
    setMySecrets(secrets);
  }, [address]);

  useEffect(() => {
    refreshSecrets();
  }, [refreshSecrets]);

  const handleSetSecret = async () => {
    if (!contract || !secretValue) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.setSecret(toId(secretProvider), ethers.toUtf8Bytes(secretValue));
      await tx.wait();
      setSecretValue('');
      setSuccess(`Secret saved for ${secretProvider}`);
      await refreshSecrets();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSecret = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.revokeSecret(toId(revokeProvider));
      await tx.wait();
      setSuccess(`Secret revoked for ${revokeProvider}`);
      await refreshSecrets();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 cursor-pointer" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 cursor-pointer" onClick={() => setSuccess(null)}>
          {success}
        </div>
      )}

      {/* Set Secret */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-4">Set Secret</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={secretProvider}
              onChange={(e) => setSecretProvider(e.target.value as Provider)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="sk-..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleSetSecret}
            disabled={loading || !contract || !secretValue}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#004f4f' }}
          >
            {loading ? 'Saving...' : 'Set Secret'}
          </button>
        </div>
      </div>

      {/* Revoke Secret */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-4">Revoke Secret</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={revokeProvider}
              onChange={(e) => setRevokeProvider(e.target.value as Provider)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button
            onClick={handleRevokeSecret}
            disabled={loading || !contract}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Revoking...' : 'Revoke Secret'}
          </button>
        </div>
      </div>

      {/* My Secrets Status */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-900">My Secrets</h4>
          <button
            onClick={refreshSecrets}
            className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
        {!address ? (
          <p className="text-gray-500">Connect wallet to view</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVIDERS.map(prov => (
              <div key={prov} className="flex items-center gap-2 text-sm">
                <span className={mySecrets[prov] ? 'text-green-600' : 'text-gray-400'}>
                  {mySecrets[prov] ? '✓' : '✗'}
                </span>
                <span className="text-gray-700">{prov}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
