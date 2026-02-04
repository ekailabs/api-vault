import { useEffect, useState, useRef, useMemo } from 'react';
import { apiService, ModelCatalogEntry, ModelsResponse } from '@/lib/api';
import { ModelsFilter, normalizeModelsFilter, filterKey } from '@/lib/modelFilters';

const PAGE_SIZE = 500;

async function fetchAllModels(filter: ModelsFilter) {
  const baseParams = {
    provider: filter.provider,
    endpoint: filter.endpoint,
    search: filter.search,
    limit: PAGE_SIZE,
  } as const;

  const firstPage = await apiService.getModels({
    ...baseParams,
    offset: 0,
  });

  // Defensive check in case response structure is unexpected
  if (!firstPage || !Array.isArray(firstPage.items)) {
    console.error('Unexpected API response:', firstPage);
    return { total: 0, limit: 0, offset: 0, items: [] };
  }

  const combinedItems: ModelCatalogEntry[] = [...firstPage.items];
  let offset = combinedItems.length;

  while (offset < firstPage.total) {
    const nextPage = await apiService.getModels({
      ...baseParams,
      offset,
    });

    if (!nextPage.items.length) {
      break;
    }

    combinedItems.push(...nextPage.items);
    offset += nextPage.items.length;
  }

  return {
    ...firstPage,
    items: combinedItems,
    limit: combinedItems.length,
    offset: 0,
    total: Math.max(firstPage.total, combinedItems.length),
  };
}

export const useModels = (filter: ModelsFilter = {}) => {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const dataRef = useRef<ModelsResponse | null>(null);

  const normalizedFilter = useMemo(() => normalizeModelsFilter(filter), [filter]);
  const normalizedKey = useMemo(() => filterKey(normalizedFilter), [normalizedFilter]);

  useEffect(() => {
    const fetchModels = async () => {
      const hasExistingData = dataRef.current !== null && dataRef.current.items.length > 0;
      const isInitial = isInitialLoadRef.current;

      try {
        // Only show full loading state on initial load or when we have no data
        // For subsequent searches, keep existing data visible (optimistic updates)
        if (isInitial || !hasExistingData) {
          setLoading(true);
        }
        setError(null);
        const resp = await fetchAllModels(normalizedFilter);
        setData(resp);
        dataRef.current = resp;
        isInitialLoadRef.current = false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- normalizedKey is a stable string representation of normalizedFilter
  }, [normalizedKey]);

  return {
    data,
    items: data?.items || [],
    total: data?.total || 0,
    loading,
    error,
    refetch: async () => {
      isInitialLoadRef.current = false;
      setLoading(true);
      try {
        const resp = await fetchAllModels(normalizedFilter);
        setData(resp);
        dataRef.current = resp;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      } finally {
        setLoading(false);
      }
    }
  };
};
