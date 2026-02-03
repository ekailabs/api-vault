'use client';

import { useState, useMemo } from 'react';
import TrendChart from '@/components/TrendChart';
import ProviderChart from '@/components/ProviderChart';
import ModelChart from '@/components/ModelChart';
import StatsCards from '@/components/StatsCards';
import SetupModal from '@/components/SetupModal';
import { useUsageData } from '@/hooks/useUsageData';
import { useAuth } from '@/contexts/AuthContext';
import { generateDemoData, aggregateDemoData } from '@/lib/demo-data';
import Link from 'next/link';

export default function Dashboard() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const auth = useAuth();

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
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-1">Ekai Gateway</h1>
              <p className="text-gray-600">Model & Token Analytics · All Time</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Live/Demo Toggle */}
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

              {/* Use Gateway / Connected State */}
              {auth.token ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Connected
                  </span>
                  <button
                    onClick={() => setShowSetup(true)}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#004f4f' }}
                  >
                    Setup
                  </button>
                  <button
                    onClick={() => auth.logout()}
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

      {/* Demo Mode Banner */}
      {isDemoMode && (
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

        {/* Model Catalog Link */}
        <div className="mt-12">
          <Link
            href="/models"
            className="inline-flex items-center gap-2 px-8 py-4 text-white rounded-lg hover:opacity-90 transition-opacity font-semibold text-lg"
            style={{ backgroundColor: '#004f4f' }}
          >
            View Model Catalog
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </main>

      <SetupModal
        open={showSetup}
        onClose={() => setShowSetup(false)}
      />
    </div>
  );
}
