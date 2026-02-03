'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext';
import { PROVIDERS, Provider, toId, getReadContract } from '@/lib/contract';

export default function ModelsPanel() {
  const { address, contract } = useWallet();
  const [addModelProvider, setAddModelProvider] = useState<Provider>('ANTHROPIC');
  const [addModelName, setAddModelName] = useState('');
  const [removeModelProvider, setRemoveModelProvider] = useState<Provider>('ANTHROPIC');
  const [removeModelName, setRemoveModelName] = useState('');
  const [checkModelOwner, setCheckModelOwner] = useState('');
  const [checkModelProvider, setCheckModelProvider] = useState<Provider>('ANTHROPIC');
  const [checkModelName, setCheckModelName] = useState('');
  const [checkResult, setCheckResult] = useState<{ permitted: boolean; count: number; message: string } | null>(null);
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

  useEffect(() => {
    if (address) {
      setCheckModelOwner(address);
    }
  }, [address]);

  const providersWithSecrets = PROVIDERS.filter(p => mySecrets[p]);
  const hasSecrets = providersWithSecrets.length > 0;

  const handleAddModel = async () => {
    if (!contract || !addModelName) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.addAllowedModel(toId(addModelProvider), toId(addModelName));
      await tx.wait();
      setAddModelName('');
      setSuccess(`Model restriction added for ${addModelProvider}`);
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveModel = async () => {
    if (!contract || !removeModelName) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.removeAllowedModel(toId(removeModelProvider), toId(removeModelName));
      await tx.wait();
      setRemoveModelName('');
      setSuccess('Model restriction removed');
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckModel = async () => {
    if (!checkModelOwner || !checkModelName) return;
    if (!ethers.isAddress(checkModelOwner)) {
      setError('Invalid owner address');
      return;
    }
    try {
      const readContract = getReadContract();
      const [permitted, count] = await Promise.all([
        readContract.isModelPermitted(checkModelOwner, toId(checkModelProvider), toId(checkModelName)),
        readContract.modelCount(checkModelOwner, toId(checkModelProvider))
      ]);
      const countNum = Number(count);
      const message = countNum === 0
        ? `${permitted ? 'PERMITTED' : 'DENIED'} (no restrictions)`
        : `${permitted ? 'PERMITTED' : 'DENIED'} (${countNum} models whitelisted)`;
      setCheckResult({ permitted, count: countNum, message });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setCheckResult({ permitted: false, count: 0, message: err.message || 'Error checking model' });
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

      {!hasSecrets && address && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
          Set a secret first in the Secrets tab to manage model restrictions
        </div>
      )}

      {/* Add Allowed Model */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-1">Add Allowed Model</h4>
        <p className="text-sm text-gray-500 mb-4">If no models added for a provider, ALL models are allowed</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={addModelProvider}
                onChange={(e) => setAddModelProvider(e.target.value as Provider)}
                disabled={!hasSecrets}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              >
                {(hasSecrets ? providersWithSecrets : PROVIDERS).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={addModelName}
                onChange={(e) => setAddModelName(e.target.value)}
                placeholder="gpt-4, claude-3-opus, etc."
                disabled={!hasSecrets}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <button
            onClick={handleAddModel}
            disabled={loading || !contract || !addModelName || !hasSecrets}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#004f4f' }}
          >
            {loading ? 'Adding...' : 'Add Model'}
          </button>
        </div>
      </div>

      {/* Remove Allowed Model */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-4">Remove Allowed Model</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={removeModelProvider}
                onChange={(e) => setRemoveModelProvider(e.target.value as Provider)}
                disabled={!hasSecrets}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              >
                {(hasSecrets ? providersWithSecrets : PROVIDERS).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={removeModelName}
                onChange={(e) => setRemoveModelName(e.target.value)}
                placeholder="gpt-4"
                disabled={!hasSecrets}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <button
            onClick={handleRemoveModel}
            disabled={loading || !contract || !removeModelName || !hasSecrets}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Removing...' : 'Remove Model'}
          </button>
        </div>
      </div>

      {/* Check Model Permission */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-4">Check Model Permission</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <input
                type="text"
                value={checkModelOwner}
                onChange={(e) => setCheckModelOwner(e.target.value)}
                placeholder="0x..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={checkModelProvider}
                onChange={(e) => setCheckModelProvider(e.target.value as Provider)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={checkModelName}
                onChange={(e) => setCheckModelName(e.target.value)}
                placeholder="gpt-4"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <button
            onClick={handleCheckModel}
            disabled={!checkModelOwner || !checkModelName}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Permission
          </button>
          {checkResult && (
            <div className={`p-3 rounded-lg ${checkResult.permitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {checkResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
