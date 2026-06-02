'use client';

import { UsageDataResult } from '@/hooks/useUsageData';
import { UsersResult } from '@/hooks/useUsers';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import type { ModelUsageSummary } from '@/lib/api';

interface StatsCardsProps {
  usageData: UsageDataResult;
  userCount: UsersResult;
}

// Format number with K/M suffix
const formatCompactNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
};

// Top model by all-time token volume. Use the server-side aggregate
// (already sorted descending) so this matches the Tokens by Model chart —
// the `records` array is only a recent subset, not all-time.
const getTopModel = (topModelsByTokens: ModelUsageSummary[]) => {
  const top = topModelsByTokens[0];
  return { model: top?.model ?? '', tokens: top?.totalTokens ?? 0 };
};

export default function StatsCards({ usageData, userCount }: StatsCardsProps) {
  const { topModelsByTokens, totalTokens, totalRequests, loading, error, refetch } = usageData;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <LoadingSkeleton variant="card" height={120} />
        <LoadingSkeleton variant="card" height={120} />
        <LoadingSkeleton variant="card" height={120} />
        <LoadingSkeleton variant="card" height={120} />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const topModel = getTopModel(topModelsByTokens);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Tokens */}
      <div className="card p-6 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Tokens</p>
            <p className="text-4xl font-bold text-gray-900">
              {formatCompactNumber(totalTokens)}
            </p>
          </div>
          <div className="text-4xl">📊</div>
        </div>
        <p className="text-xs text-gray-500 mt-3">All time</p>
      </div>

      {/* Total Requests */}
      <div className="card p-6 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Total Requests</p>
            <p className="text-4xl font-bold text-gray-900">
              {totalRequests.toLocaleString()}
            </p>
          </div>
          <div className="text-4xl">🔄</div>
        </div>
        <p className="text-xs text-gray-500 mt-3">All time</p>
      </div>

      {/* Top Model */}
      <div className="card p-6 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Top Model</p>
            <p className="text-lg font-bold text-gray-900 break-words">
              {topModel.model || '—'}
            </p>
            {topModel.tokens > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {formatCompactNumber(topModel.tokens)} tokens
              </p>
            )}
          </div>
          <div className="text-4xl">⭐</div>
        </div>
        <p className="text-xs text-gray-500 mt-3">All time</p>
      </div>

      {/* Unique Users */}
      <div className="card p-6 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-600 text-sm font-medium mb-1">Unique Users</p>
            <p className="text-4xl font-bold text-gray-900">
              {userCount.loading
                ? '…'
                : userCount.error
                  ? '—'
                  : (userCount.count ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="text-4xl">👥</div>
        </div>
        <p className="text-xs text-gray-500 mt-3">On-chain addresses</p>
      </div>
    </div>
  );
}
