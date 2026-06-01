'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber } from '@/lib/utils';
import { CHART_COLORS } from '@/lib/constants';
import { UsageDataResult } from '@/hooks/useUsageData';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import ChartTooltip from '@/components/ui/ChartTooltip';

interface ModelChartProps {
  className?: string;
  usageData: UsageDataResult;
}

export default function ModelChart({ className = '', usageData }: ModelChartProps) {
  const { totalTokens, modelUsage, topModelsByTokens, loading, error, refetch } = usageData;
  const [expanded, setExpanded] = useState(false);

  const topModels = topModelsByTokens.length > 0 ? topModelsByTokens : modelUsage.slice(0, 5);
  const chartData = topModels.map(model => ({
    name: model.model,
    value: model.totalTokens,
    percentage: totalTokens > 0 ? ((model.totalTokens / totalTokens) * 100).toFixed(1) : '0'
  }));
  const listData = (expanded ? modelUsage : topModels).map(model => ({
    name: model.model,
    value: model.totalTokens,
    requests: model.totalRequests,
    percentage: totalTokens > 0 ? ((model.totalTokens / totalTokens) * 100).toFixed(1) : '0'
  }));
  const hiddenCount = Math.max(modelUsage.length - topModels.length, 0);

  if (loading) {
    return <LoadingSkeleton className={className} variant="chart" height={220} />;
  }

  if (error) {
    return <ErrorState className={className} message={error} onRetry={refetch} />;
  }

  if (chartData.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Tokens by Model"
        description="No model data available yet."
        suggestion="Make some API requests to see model breakdown."
      />
    );
  }

  return (
    <div className={`card p-8 ${className}`}>
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900">Tokens by Model</h3>
        <p className="text-gray-600">Top models by token volume across all runs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-center">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={104}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((model, index) => (
                  <Cell key={model.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip type="model" />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0">
          <div className="space-y-3">
            {listData.map((model, index) => (
              <div key={model.name} className="grid grid-cols-[1fr_auto] gap-4 items-center">
                <div className="flex items-center min-w-0">
                  <div
                    className="w-3 h-3 rounded-full mr-3 shrink-0"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  ></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.requests} requests</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatNumber(model.value)}</p>
                  <p className="text-xs text-gray-500">{model.percentage}%</p>
                </div>
              </div>
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700"
              onClick={() => setExpanded(current => !current)}
            >
              {expanded ? 'Show top 5' : `Show all models (${modelUsage.length})`}
            </button>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center gap-4">
              <span className="text-lg font-medium text-gray-600">Total Tokens:</span>
              <span className="text-2xl font-semibold text-gray-900">{formatNumber(totalTokens)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
