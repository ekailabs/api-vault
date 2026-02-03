'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { groupByDate, formatForChart, formatNumber } from '@/lib/utils';
import { UsageDataResult } from '@/hooks/useUsageData';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import ChartTooltip from '@/components/ui/ChartTooltip';

interface TrendChartProps {
  className?: string;
  usageData: UsageDataResult;
}

export default function TrendChart({ className = '', usageData }: TrendChartProps) {
  const { records, loading, error, refetch } = usageData;

  // Filter to last 30 days and group by day
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRecords = records.filter(r => new Date(r.timestamp) >= thirtyDaysAgo);

  const grouped = groupByDate(recentRecords, 'day');
  const data = formatForChart(grouped);

  if (loading) {
    return <LoadingSkeleton className={className} />;
  }

  if (error) {
    return <ErrorState className={className} message={error} onRetry={refetch} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Token Usage Over Time"
        description="No usage data available yet."
        suggestion="Make some API requests to see token usage trends."
      />
    );
  }

  return (
    <div className={`card p-8 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Token Usage Over Time</h3>
        <p className="text-gray-600">Daily token consumption (last 30 days)</p>
      </div>

      {/* Token Usage Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<ChartTooltip type="tokens" />} />
            <Line
              type="monotone"
              dataKey="tokens"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
