'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext';
import { PROVIDERS, Provider, toId, getReadContract, NETWORK } from '@/lib/contract';
import { CopyableAddress } from '@/components/ui/CopyableAddress';

interface ContractInfo {
  owner: string;
  gateway: string;
  roflKey: {
    pubkey: string;
    version: string;
    active: boolean;
  };
  paused?: boolean;
}

export default function AdminPanel() {
  const { address, isOwner, contract } = useWallet();
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [gatewayAddr, setGatewayAddr] = useState('');
  const [roflPubkey, setRoflPubkey] = useState('0x0000000000000000000000000000000000000000000000000000000000000000');
  const [roflVersion, setRoflVersion] = useState(1);
  const [roflActive, setRoflActive] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(PROVIDERS[0]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshInfo = useCallback(async () => {
    try {
      const readContract = getReadContract();
      const [owner, gateway, rofl] = await Promise.all([
        readContract.owner(),
        readContract.gateway(),
        readContract.getRoflKey()
      ]);
      let paused = false;
      try {
        paused = await readContract.paused();
      } catch {
        // paused() might not exist on older contracts
      }
      setContractInfo({
        owner,
        gateway: gateway || '(not set)',
        roflKey: {
          pubkey: rofl[0],
          version: rofl[1].toString(),
          active: rofl[2]
        },
        paused
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.error('Failed to fetch contract info:', err.message);
    }
  }, []);

  const refreshProviders = useCallback(async () => {
    const readContract = getReadContract();
    const results: Record<string, boolean> = {};
    for (const name of PROVIDERS) {
      try {
        const valid = await readContract.isValidProvider(toId(name));
        results[name] = valid;
      } catch {
        results[name] = false;
      }
    }
    setProviders(results);
  }, []);

  useEffect(() => {
    refreshInfo();
    refreshProviders();
  }, [refreshInfo, refreshProviders]);

  const handleSetGateway = async () => {
    if (!contract || !gatewayAddr) return;
    if (!ethers.isAddress(gatewayAddr)) {
      setError('Invalid address');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.setGateway(gatewayAddr);
      await tx.wait();
      setGatewayAddr('');
      setSuccess('Gateway set');
      await refreshInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetRoflKey = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.setRoflKey(roflPubkey || '0x', roflVersion, roflActive);
      await tx.wait();
      setSuccess('ROFL Key set');
      await refreshInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.addProvider(toId(selectedProvider));
      await tx.wait();
      setSuccess(`Provider ${selectedProvider} added`);
      await refreshProviders();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProvider = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.removeProvider(toId(selectedProvider));
      await tx.wait();
      setSuccess(`Provider ${selectedProvider} removed`);
      await refreshProviders();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllProviders = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      for (const name of PROVIDERS) {
        if (!providers[name]) {
          const tx = await contract.addProvider(toId(name));
          await tx.wait();
        }
      }
      setSuccess('All providers added');
      await refreshProviders();
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

      {!address && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
          Connect your wallet to see if you have admin access.
        </div>
      )}

      {address && !isOwner && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
          You are not the contract owner. Admin functions are disabled.
          {contractInfo?.owner && (
            <div className="mt-2">
              Owner: <CopyableAddress address={contractInfo.owner} showExplorerLink />
            </div>
          )}
        </div>
      )}

      {/* Contract Info */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-900">Contract Info</h4>
          <button
            onClick={refreshInfo}
            className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Network:</span>
            <span className="font-mono text-gray-900">{NETWORK.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Contract:</span>
            <CopyableAddress address={NETWORK.contract!} showExplorerLink />
          </div>
          {contractInfo && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Owner:</span>
                <CopyableAddress address={contractInfo.owner} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Gateway:</span>
                {contractInfo.gateway === '(not set)' ? (
                  <span className="font-mono text-gray-900">(not set)</span>
                ) : (
                  <CopyableAddress address={contractInfo.gateway} />
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ROFL Key Version:</span>
                <span className="font-mono text-gray-900">{contractInfo.roflKey.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ROFL Key Active:</span>
                <span className={contractInfo.roflKey.active ? 'text-green-600' : 'text-red-600'}>{contractInfo.roflKey.active ? 'Yes' : 'No'}</span>
              </div>
              {address && (
                <div className="flex justify-between">
                  <span className="text-gray-500">You are owner:</span>
                  <span className={isOwner ? 'text-green-600' : 'text-gray-400'}>{isOwner ? 'Yes' : 'No'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Valid Providers */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-900">Valid Providers</h4>
          <button
            onClick={refreshProviders}
            className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {PROVIDERS.map(name => (
            <span key={name} className={`px-3 py-1 rounded-full text-sm ${providers[name] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {providers[name] ? '✓' : '✗'} {name}
            </span>
          ))}
        </div>
      </div>

      {/* Admin Controls - Only visible to owner */}
      {isOwner && (
        <>
          {/* Set Gateway */}
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="font-semibold text-gray-900 mb-4">
              Set Gateway
              <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Owner</span>
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gateway Address</label>
                <input
                  type="text"
                  value={gatewayAddr}
                  onChange={(e) => setGatewayAddr(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={handleSetGateway}
                disabled={loading || !gatewayAddr}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#004f4f' }}
              >
                {loading ? 'Setting...' : 'Set Gateway'}
              </button>
            </div>
          </div>

          {/* Set ROFL Key */}
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="font-semibold text-gray-900 mb-4">
              Set ROFL Key
              <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Owner</span>
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Public Key (hex)</label>
                  <input
                    type="text"
                    value={roflPubkey}
                    onChange={(e) => setRoflPubkey(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <input
                    type="number"
                    value={roflVersion}
                    onChange={(e) => setRoflVersion(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="roflActive"
                  checked={roflActive}
                  onChange={(e) => setRoflActive(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="roflActive" className="text-sm text-gray-700">Active</label>
              </div>
              <button
                onClick={handleSetRoflKey}
                disabled={loading}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#004f4f' }}
              >
                {loading ? 'Setting...' : 'Set ROFL Key'}
              </button>
            </div>
          </div>

          {/* Manage Providers */}
          <div className="bg-white p-6 rounded-lg border">
            <h4 className="font-semibold text-gray-900 mb-4">
              Manage Providers
              <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">Owner</span>
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as Provider)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleAddProvider}
                  disabled={loading}
                  className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#004f4f' }}
                >
                  Add Provider
                </button>
                <button
                  onClick={handleRemoveProvider}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove Provider
                </button>
                <button
                  onClick={handleAddAllProviders}
                  disabled={loading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add All Providers
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
