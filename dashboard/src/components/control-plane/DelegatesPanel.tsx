'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/contexts/WalletContext';
import { getReadContract } from '@/lib/contract';

export default function DelegatesPanel() {
  const { address, contract } = useWallet();
  const [addDelegateAddr, setAddDelegateAddr] = useState('');
  const [removeDelegateAddr, setRemoveDelegateAddr] = useState('');
  const [checkMyDelegateAddr, setCheckMyDelegateAddr] = useState('');
  const [checkImDelegateOwner, setCheckImDelegateOwner] = useState('');
  const [myDelegateResult, setMyDelegateResult] = useState<{ permitted: boolean; message: string } | null>(null);
  const [imDelegateResult, setImDelegateResult] = useState<{ permitted: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddDelegate = async () => {
    if (!contract || !addDelegateAddr) return;
    if (!ethers.isAddress(addDelegateAddr)) {
      setError('Invalid address');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.addDelegate(addDelegateAddr);
      await tx.wait();
      setAddDelegateAddr('');
      setSuccess('Delegate added - they can now access your secrets');
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDelegate = async () => {
    if (!contract || !removeDelegateAddr) return;
    if (!ethers.isAddress(removeDelegateAddr)) {
      setError('Invalid address');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tx = await contract.removeDelegate(removeDelegateAddr);
      await tx.wait();
      setRemoveDelegateAddr('');
      setSuccess('Delegate removed');
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMyDelegate = async () => {
    if (!address || !checkMyDelegateAddr) return;
    if (!ethers.isAddress(checkMyDelegateAddr)) {
      setError('Invalid address');
      return;
    }
    try {
      const readContract = getReadContract();
      const permitted = await readContract.isDelegatePermitted(address, checkMyDelegateAddr);
      setMyDelegateResult({
        permitted,
        message: permitted
          ? 'Yes - this address can access your secrets'
          : 'No - this address cannot access your secrets'
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setMyDelegateResult({ permitted: false, message: err.message || 'Error checking delegate' });
    }
  };

  const handleCheckImDelegate = async () => {
    if (!address || !checkImDelegateOwner) return;
    if (!ethers.isAddress(checkImDelegateOwner)) {
      setError('Invalid address');
      return;
    }
    try {
      const readContract = getReadContract();
      const permitted = await readContract.isDelegatePermitted(checkImDelegateOwner, address);
      setImDelegateResult({
        permitted,
        message: permitted
          ? 'Yes - you can access their secrets'
          : 'No - you cannot access their secrets'
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      setImDelegateResult({ permitted: false, message: err.message || 'Error checking delegate' });
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

      {/* Add Delegate */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-1">Add Delegate</h4>
        <p className="text-sm text-gray-500 mb-4">Delegates can access ALL your secrets across all providers</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delegate Address</label>
            <input
              type="text"
              value={addDelegateAddr}
              onChange={(e) => setAddDelegateAddr(e.target.value)}
              placeholder="0x..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleAddDelegate}
            disabled={loading || !contract || !addDelegateAddr}
            className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#004f4f' }}
          >
            {loading ? 'Adding...' : 'Add Delegate'}
          </button>
        </div>
      </div>

      {/* Remove Delegate */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-4">Remove Delegate</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delegate Address</label>
            <input
              type="text"
              value={removeDelegateAddr}
              onChange={(e) => setRemoveDelegateAddr(e.target.value)}
              placeholder="0x..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleRemoveDelegate}
            disabled={loading || !contract || !removeDelegateAddr}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Removing...' : 'Remove Delegate'}
          </button>
        </div>
      </div>

      {/* Check if someone is my delegate */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-1">Can they access my secrets?</h4>
        <p className="text-sm text-gray-500 mb-4">Check if an address is your delegate</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address to check</label>
            <input
              type="text"
              value={checkMyDelegateAddr}
              onChange={(e) => setCheckMyDelegateAddr(e.target.value)}
              placeholder="0x..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleCheckMyDelegate}
            disabled={!address || !checkMyDelegateAddr}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check
          </button>
          {myDelegateResult && (
            <div className={`p-3 rounded-lg ${myDelegateResult.permitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {myDelegateResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Check if I am a delegate */}
      <div className="bg-white p-6 rounded-lg border">
        <h4 className="font-semibold text-gray-900 mb-1">Can I access their secrets?</h4>
        <p className="text-sm text-gray-500 mb-4">Check if you&apos;re a delegate for an owner</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner address</label>
            <input
              type="text"
              value={checkImDelegateOwner}
              onChange={(e) => setCheckImDelegateOwner(e.target.value)}
              placeholder="0x..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={handleCheckImDelegate}
            disabled={!address || !checkImDelegateOwner}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check
          </button>
          {imDelegateResult && (
            <div className={`p-3 rounded-lg ${imDelegateResult.permitted ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {imDelegateResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
