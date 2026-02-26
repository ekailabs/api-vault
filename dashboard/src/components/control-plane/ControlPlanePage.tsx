'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import SecretsPanel from './SecretsPanel';
import DelegatesPanel from './DelegatesPanel';
import ModelsPanel from './ModelsPanel';
import AdminPanel from './AdminPanel';

type Tab = 'secrets' | 'delegates' | 'models' | 'admin';

export default function ControlPlanePage() {
  const [activeTab, setActiveTab] = useState<Tab>('secrets');
  const { address, isConnecting, connect, error, clearError, dripStatus } = useWallet();
  const [showDripBanner, setShowDripBanner] = useState(false);

  useEffect(() => {
    if (dripStatus === 'dripping' || dripStatus === 'funded' || dripStatus === 'error') {
      setShowDripBanner(true);
    }
    if (dripStatus === 'funded') {
      const timer = setTimeout(() => setShowDripBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [dripStatus]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'secrets', label: 'Secrets' },
    { id: 'delegates', label: 'Delegates' },
    { id: 'models', label: 'Models' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <div className="space-y-6">
      {/* Wallet Connection Banner */}
      {!address && (
        <div className="bg-white p-6 rounded-lg border text-center">
          <p className="text-gray-600 mb-4">Connect your wallet to interact with the Ekai Control Plane smart contract</p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm cursor-pointer" onClick={clearError}>
              {error}
            </div>
          )}
          <button
            onClick={connect}
            disabled={isConnecting}
            className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#004f4f' }}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      )}

      {/* Drip Status Banner */}
      {showDripBanner && dripStatus === 'dripping' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          Funding your wallet with gas...
        </div>
      )}
      {showDripBanner && dripStatus === 'funded' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm cursor-pointer" onClick={() => setShowDripBanner(false)}>
          Wallet funded! You&apos;re ready to transact.
        </div>
      )}
      {showDripBanner && dripStatus === 'error' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm cursor-pointer" onClick={() => setShowDripBanner(false)}>
          Could not auto-fund wallet. You may need to add ROSE manually.
        </div>
      )}

      {/* Sub-tabs Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div>
        {activeTab === 'secrets' && <SecretsPanel />}
        {activeTab === 'delegates' && <DelegatesPanel />}
        {activeTab === 'models' && <ModelsPanel />}
        {activeTab === 'admin' && <AdminPanel />}
      </div>
    </div>
  );
}
