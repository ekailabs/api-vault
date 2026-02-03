'use client';

import { useMemo, useState, useEffect } from 'react';
import { ModelCatalogEntry } from '@/lib/api';
import { useModels } from '@/hooks/useModels';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import { getProviderName } from '@/lib/utils';
import { ModelEndpoint } from '@/lib/modelFilters';

const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

export default function ModelsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [endpoint, setEndpoint] = useState<ModelEndpoint | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const { items, loading, error, refetch } = useModels();

  const providers = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => set.add(item.provider));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return items.filter(item => {
      const matchesProvider = provider ? item.provider === provider : true;
      const matchesEndpoint = endpoint ? item.endpoint === endpoint : true;
      const matchesSearch = query
        ? item.id.toLowerCase().includes(query) ||
          getProviderName(item.provider).toLowerCase().includes(query)
        : true;
      return matchesProvider && matchesEndpoint && matchesSearch;
    });
  }, [items, debouncedSearch, provider, endpoint]);

  // Client-side pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Ensure current page stays within bounds when filtered results shrink
  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, totalPages));
  }, [totalPages]);

  // Reset to page 1 when filters change
  const handleFilterChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const copy = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => undefined);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFCEC' }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: '#e5e5e5' }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Link 
                href="/" 
                className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
              <h1 className="text-3xl font-semibold text-gray-900 mt-2">Model Catalog</h1>
              <p className="text-gray-600 mt-1">Browse available models across all providers</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <div className="card p-8">
            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Available Models</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredItems.length > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} of {filteredItems.length} models
                      {loading && (
                        <svg className="animate-spin h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                    </span>
                  ) : loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    `No models found`
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 min-w-[200px]"
                />
                <select
                  value={provider}
                  onChange={e => handleFilterChange(setProvider)(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All providers</option>
                  {providers.map(p => (
                    <option key={p} value={p}>{getProviderName(p)}</option>
                  ))}
                </select>
                <select
                  value={endpoint}
                  onChange={e => handleFilterChange(setEndpoint)(e.target.value as 'chat_completions' | 'messages' | 'responses' | '')}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">All endpoints</option>
                  <option value="chat_completions">chat_completions</option>
                  <option value="messages">messages</option>
                  <option value="responses">responses</option>
                </select>
              </div>
            </div>

            {/* Table */}
              {filteredItems.length === 0 && !loading ? (
              <EmptyState
                title="No models found"
                description="No models match your search criteria."
                suggestion="Try adjusting your filters or search term."
              />
              ) : loading && filteredItems.length === 0 ? (
              <ModelTableSkeleton />
            ) : (
              <div className="overflow-x-auto relative">
                {/* Subtle overlay when loading new results */}
                {loading && filteredItems.length > 0 && (
                  <div className="absolute inset-0 bg-white bg-opacity-50 z-10 flex items-center justify-center pointer-events-none">
                    <svg className="animate-spin h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                <table className="min-w-full table-auto">
                  <thead className="sticky top-0 bg-white z-20">
                    <tr className="border-b-2 border-gray-200">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Model</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Provider</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Endpoint</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Pricing (Input / Output per 1M tokens)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedItems.map((item, index) => (
                      <ModelRow 
                        key={`${item.provider}-${item.id}-${item.endpoint}`} 
                        entry={item} 
                        onCopy={copy}
                        isEven={index % 2 === 0}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredItems.length > ITEMS_PER_PAGE && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-6">
                <div className="text-sm text-gray-600">
                  Page <span className="font-semibold text-gray-900">{currentPage}</span> of{' '}
                  <span className="font-semibold text-gray-900">{totalPages}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {/* Always show page 1 if not in first few pages */}
                    {currentPage > 4 && totalPages > 7 && (
                      <>
                        <button
                          onClick={() => setCurrentPage(1)}
                          className="min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                        >
                          1
                        </button>
                        {currentPage > 5 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                      </>
                    )}

                    {/* Show pages around current page */}
                    {(() => {
                      const pages: number[] = [];
                      let start = Math.max(1, currentPage - 2);
                      let end = Math.min(totalPages, currentPage + 2);

                      // Adjust if we're near the beginning
                      if (currentPage <= 4) {
                        start = 1;
                        end = Math.min(5, totalPages);
                      }
                      // Adjust if we're near the end
                      else if (currentPage >= totalPages - 3) {
                        start = Math.max(1, totalPages - 4);
                        end = totalPages;
                      }

                      for (let i = start; i <= end; i++) {
                        pages.push(i);
                      }

                      return pages.map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                            currentPage === pageNum
                              ? 'text-white shadow-md'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm'
                          }`}
                          style={currentPage === pageNum ? { backgroundColor: '#004f4f' } : {}}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}

                    {/* Always show last page if not in last few pages */}
                    {currentPage < totalPages - 3 && totalPages > 7 && (
                      <>
                        {currentPage < totalPages - 4 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 shadow-sm"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ModelTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-auto">
        <thead className="sticky top-0 bg-white z-20">
          <tr className="border-b-2 border-gray-200">
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Model</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Provider</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Endpoint</th>
            <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Pricing (Input / Output per 1M tokens)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {[...Array(10)].map((_, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
              <td className="px-6 py-5">
                <div className="animate-pulse flex items-center gap-3">
                  <div className="h-5 bg-gray-200 rounded w-48"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded"></div>
                </div>
              </td>
              <td className="px-6 py-5">
                <div className="animate-pulse h-5 bg-gray-200 rounded w-24"></div>
              </td>
              <td className="px-6 py-5">
                <div className="animate-pulse h-6 bg-gray-200 rounded-full w-32"></div>
              </td>
              <td className="px-6 py-5 text-right">
                <div className="animate-pulse flex flex-col items-end gap-2">
                  <div className="h-5 bg-gray-200 rounded w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelRow({ entry, onCopy, isEven }: { entry: ModelCatalogEntry; onCopy: (id: string) => void; isEven: boolean }) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const priceText =
    entry.pricing && typeof entry.pricing.input === 'number' && typeof entry.pricing.output === 'number'
      ? `$${entry.pricing.input.toFixed(2)} / $${entry.pricing.output.toFixed(2)}`
      : '—';

  const handleCopy = () => {
    onCopy(entry.id);
    setCopied(true);
    setShowTooltip(true);
    setTimeout(() => {
      setCopied(false);
      setShowTooltip(false);
    }, 2000);
  };

  return (
    <tr className={`transition-colors duration-150 ${isEven ? 'bg-gray-50/50' : 'bg-white'} hover:bg-gray-100`}>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3 relative group">
          <span className="font-mono text-base font-semibold text-gray-900 tracking-tight">{entry.id}</span>
          <div className="relative">
            <button
              onClick={handleCopy}
              onMouseEnter={() => !copied && setShowTooltip(true)}
              onMouseLeave={() => !copied && setShowTooltip(false)}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-all duration-150"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            
            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                  <div className="text-gray-300 mb-1">Copy model id:</div>
                  <div className="font-mono text-white">{entry.id}</div>
                  {/* Arrow */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full">
                    <div className="border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <span className="text-base font-medium text-gray-900">{getProviderName(entry.provider)}</span>
      </td>
      <td className="px-6 py-5">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
          {entry.endpoint}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <span className="text-base font-semibold text-gray-900">{priceText}</span>
      </td>
    </tr>
  );
}
