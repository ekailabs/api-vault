'use client';

import { useState, useMemo, useEffect } from 'react';
import TrendChart from '@/components/TrendChart';
import ProviderChart from '@/components/ProviderChart';
import ModelChart from '@/components/ModelChart';
import StatsCards from '@/components/StatsCards';
import SetupModal from '@/components/SetupModal';
import PreferencesModal from '@/components/PreferencesModal';
import ControlPlanePage from '@/components/control-plane/ControlPlanePage';
import ModelCatalog from '@/components/ModelCatalog';
import { useUsageData } from '@/hooks/useUsageData';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { generateDemoData, aggregateDemoData } from '@/lib/demo-data';
import { shortenAddress } from '@/lib/contract';
import { apiService } from '@/lib/api';

type MainTab = 'control-plane' | 'dashboard' | 'models';

export default function Dashboard() {
  const [mainTab, setMainTab] = useState<MainTab>('control-plane');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [userModels, setUserModels] = useState<string[]>([]);
  const auth = useAuth();
  const wallet = useWallet();

  // Fetch user preferences when authenticated
  useEffect(() => {
    if (auth.token) {
      apiService.getPreferences()
        .then(prefs => {
          if (prefs.model_preferences) {
            setUserModels(prefs.model_preferences);
          }
        })
        .catch(() => {
          // Ignore errors - user may not have preferences yet
        });
    } else {
      setUserModels([]);
    }
  }, [auth.token, showPreferences]); // Re-fetch when preferences modal closes

  // All time - no date filtering
  const realUsageData = useUsageData(undefined, undefined);

  // Generate demo data once and memoize it
  const demoData = useMemo(() => {
    if (!isDemoMode) return null;
    const records = generateDemoData();
    return aggregateDemoData(records);
  }, [isDemoMode]);

  // Use demo or real data based on toggle
  const usageData = isDemoMode && demoData ? demoData : realUsageData;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFCEC' }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: '#e5e5e5' }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-8">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Ekai Gateway</h1>
              </div>
              {/* Main Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMainTab('control-plane')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    mainTab === 'control-plane'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Control Plane
                </button>
                <button
                  onClick={() => setMainTab('dashboard')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    mainTab === 'dashboard'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setMainTab('models')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    mainTab === 'models'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Models
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Dashboard-specific: Live/Demo Toggle */}
              {mainTab === 'dashboard' && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setIsDemoMode(false)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      !isDemoMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Live
                  </button>
                  <button
                    onClick={() => setIsDemoMode(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      isDemoMode
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Demo
                  </button>
                </div>
              )}

              {/* Wallet Connection Status - shown on both tabs */}
              {wallet.address ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    {shortenAddress(wallet.address)}
                  </span>
                  {!auth.token && (
                    <button
                      onClick={wallet.disconnect}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Disconnect wallet"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={wallet.connect}
                  disabled={wallet.isConnecting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}

              {/* Auth Controls - shown on both tabs */}
              {auth.token ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreferences(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Preferences"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowSetup(true)}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#004f4f' }}
                  >
                    Setup
                  </button>
                  <button
                    onClick={() => { auth.logout(); wallet.disconnect(); }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSetup(true)}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#004f4f' }}
                >
                  Use Gateway
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* User's Selected Models Banner */}
      {auth.token && userModels.length > 0 && (
        <div className="bg-white border-b" style={{ borderColor: '#e5e5e5' }}>
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Your models:</span>
              <div className="flex flex-wrap gap-2">
                {userModels.map((model) => (
                  <span
                    key={model}
                    className="px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded-full border border-teal-200"
                  >
                    {model}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setShowPreferences(true)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demo Mode Banner */}
      {mainTab === 'dashboard' && isDemoMode && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-6 py-2">
            <p className="text-amber-800 text-sm text-center">
              Viewing sample data. Switch to <button onClick={() => setIsDemoMode(false)} className="font-semibold underline">Live</button> to see real usage.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {mainTab === 'dashboard' && (
          <>
            {/* Stats Cards */}
            <StatsCards usageData={usageData} />

            {/* Charts Section */}
            <div className="space-y-12">
              {/* Token Usage Trend */}
              <TrendChart usageData={usageData} />

              {/* Model & Provider Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ModelChart usageData={usageData} />
                <ProviderChart usageData={usageData} />
              </div>
            </div>
          </>
        )}
        {mainTab === 'control-plane' && <ControlPlanePage />}
        {mainTab === 'models' && <ModelCatalog />}
      </main>

      <SetupModal
        open={showSetup}
        onClose={() => setShowSetup(false)}
      />

      {auth.token && auth.address && (
        <PreferencesModal
          open={showPreferences}
          onClose={() => setShowPreferences(false)}
          userAddress={auth.address}
        />
      )}
    </div>
  );
}
