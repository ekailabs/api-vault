'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import SecretsPanel from './SecretsPanel';
import DelegatesPanel from './DelegatesPanel';
import ModelsPanel from './ModelsPanel';
import AdminPanel from './AdminPanel';

type Tab = 'secrets' | 'delegates' | 'models' | 'admin';

export default function ControlPlanePage() {
  const [activeTab, setActiveTab] = useState<Tab>('secrets');
  const { address, isConnecting, connect, error, clearError } = useWallet();

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
            {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
          </button>
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
