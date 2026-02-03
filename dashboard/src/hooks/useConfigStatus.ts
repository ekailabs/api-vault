import { useEffect, useState, useCallback } from 'react';
import { apiService, ConfigStatusResponse } from '@/lib/api';

export const useConfigStatus = () => {
  const [data, setData] = useState<ConfigStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await apiService.getConfigStatus();
      setData(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { data, loading, error, refetch: fetchStatus };
};
