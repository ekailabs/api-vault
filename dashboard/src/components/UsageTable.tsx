'use client';

import { useState } from 'react';
import { UsageRecord } from '@/lib/api';
import { formatCurrency, formatNumber, getProviderName } from '@/lib/utils';
import { UsageDataResult } from '@/hooks/useUsageData';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';

interface UsageTableProps {
  className?: string;
  usageData: UsageDataResult;
}

export default function UsageTable({ className = '', usageData }: UsageTableProps) {
  const { records, loading, error, refetch } = usageData;
  const [sortField, setSortField] = useState<keyof UsageRecord>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


  const handleSort = (field: keyof UsageRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...records].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });

  if (loading) {
    return <LoadingSkeleton className={className} variant="table" count={6} />;
  }

  if (error) {
    return <ErrorState className={className} message={error} onRetry={refetch} />;
  }

  if (records.length === 0) {
    return (
      <EmptyState 
        className={className}
        title="Usage History"
        description="No usage data available yet."
        suggestion="Make some API requests to see usage history."
      />
    );
  }

  const SortIcon = ({ field }: { field: keyof UsageRecord }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>;
    }
    return <span className="text-blue-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className={`card p-8 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-900">Usage History</h3>
        <p className="text-gray-600">{records.length} total requests</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200">
              <th 
                className="px-4 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('timestamp')}
              >
                <div className="flex items-center gap-1">
                  Timestamp <SortIcon field="timestamp" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('provider')}
              >
                <div className="flex items-center gap-1">
                  Provider <SortIcon field="provider" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('model')}
              >
                <div className="flex items-center gap-1">
                  Model <SortIcon field="model" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('input_tokens')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Input Tokens <SortIcon field="input_tokens" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('cache_write_input_tokens')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Cache Write <SortIcon field="cache_write_input_tokens" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('cache_read_input_tokens')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Cache Read <SortIcon field="cache_read_input_tokens" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('output_tokens')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Output Tokens <SortIcon field="output_tokens" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('total_cost')}
              >
                <div className="flex items-center gap-1 justify-end">
                  Total Cost <SortIcon field="total_cost" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(record.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {getProviderName(record.provider)}
                    </span>
                    {record.payment_method === 'x402' && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        x402
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                  {record.model}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(record.input_tokens)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(record.cache_write_input_tokens)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(record.cache_read_input_tokens)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(record.output_tokens)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                  {formatCurrency(record.total_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {records.length}
            </p>
            <p className="text-sm text-gray-600">Requests</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatNumber(records.reduce((sum, r) => sum + r.input_tokens, 0))}
            </p>
            <p className="text-sm text-gray-600">Input Tokens</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-blue-600">
              {formatNumber(records.reduce((sum, r) => sum + r.cache_write_input_tokens, 0))}
            </p>
            <p className="text-sm text-gray-600">Cache Write</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-green-600">
              {formatNumber(records.reduce((sum, r) => sum + r.cache_read_input_tokens, 0))}
            </p>
            <p className="text-sm text-gray-600">Cache Read</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatNumber(records.reduce((sum, r) => sum + r.output_tokens, 0))}
            </p>
            <p className="text-sm text-gray-600">Output Tokens</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(records.reduce((sum, r) => sum + r.total_cost, 0))}
            </p>
            <p className="text-sm text-gray-600">Total Cost</p>
          </div>
        </div>
      </div>
    </div>
  );
}
