import { useState, useEffect, useCallback } from 'react';
import { apiService, UsageResponse, UsageRecord } from '@/lib/api';

export interface UsageDataResult {
  data: UsageResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  records: UsageRecord[];
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
}

export const useUsageData = (fromDate?: Date, toDate?: Date): UsageDataResult => {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUsage(fromDate, toDate);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData,
    records: data?.records || [],
    totalCost: data?.totalCost || 0,
    totalTokens: data?.totalTokens || 0,
    totalRequests: data?.totalRequests || 0,
    costByProvider: data?.costByProvider || {},
    costByModel: data?.costByModel || {}
  };
};
