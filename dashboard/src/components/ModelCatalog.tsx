'use client';

import { useMemo, useState } from 'react';
import { ModelCatalogEntry } from '@/lib/api';
import { useModels } from '@/hooks/useModels';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useCopy } from '@/hooks/useCopy';
import { ModelEndpoint } from '@/lib/modelFilters';
import { getProviderName } from '@/lib/utils';

interface ModelCatalogProps {
  className?: string;
}

export default function ModelCatalog({ className = '' }: ModelCatalogProps) {
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [endpoint, setEndpoint] = useState<ModelEndpoint | ''>('');

  const { items, loading, error, refetch, total } = useModels({
    search: search.trim() || undefined,
    provider: provider || undefined,
    endpoint: endpoint || undefined
  });

  const providers = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => set.add(item.provider));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = items; // server-side filters already applied

  if (loading) {
    return <LoadingSkeleton className={className} variant="table" count={8} />;
  }

  if (error) {
    return <ErrorState className={className} message={error} onRetry={refetch} />;
  }

  if (filteredItems.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Model Catalog"
        description="No models match your filters."
        suggestion="Try clearing search or provider filters."
      />
    );
  }

  return (
    <Card className={`p-8 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Model Catalog</p>
          <h3 className="text-2xl font-semibold text-gray-900">Browse available models</h3>
          <p className="text-sm text-gray-600">Total available: {total}</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All providers</option>
            {providers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={endpoint}
            onChange={e => setEndpoint(e.target.value as 'chat_completions' | 'messages' | '')}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All endpoints</option>
            <option value="chat_completions">chat_completions</option>
            <option value="messages">messages</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-900">
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Endpoint</th>
              <th className="px-4 py-3 text-right">Input / Output</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <ModelRow key={`${item.provider}-${item.id}-${item.endpoint}`} entry={item} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ModelRow({ entry }: { entry: ModelCatalogEntry }) {
  const { copied, copy } = useCopy();
  const priceText =
    entry.pricing && typeof entry.pricing.input === 'number' && typeof entry.pricing.output === 'number'
      ? `${entry.pricing.input.toFixed(4)} / ${entry.pricing.output.toFixed(4)} ${entry.pricing.currency}`
      : '—';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-mono text-gray-900">{entry.id}</td>
      <td className="px-4 py-3 text-sm text-gray-900">{getProviderName(entry.provider)}</td>
      <td className="px-4 py-3 text-sm">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {entry.endpoint}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-right text-gray-900">
        {priceText}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => {
            copy(entry.id);
          }}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 underline"
        >
          {copied ? 'Copied' : 'Copy ID'}
        </button>
      </td>
    </tr>
  );
}
