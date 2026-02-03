import { useState, useEffect, useCallback } from 'react';
import { apiService, BudgetResponse } from '@/lib/api';

export interface BudgetResult {
  data: BudgetResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveBudget: (payload: { amountUsd: number | null; alertOnly?: boolean }) => Promise<void>;
}

export const useBudget = (): BudgetResult => {
  const [data, setData] = useState<BudgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getBudget();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch budget');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBudget = useCallback(async (payload: { amountUsd: number | null; alertOnly?: boolean }) => {
    try {
      setError(null);
      await apiService.updateBudget(payload);
      await fetchBudget();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
      throw err;
    }
  }, [fetchBudget]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  return { data, loading, error, refetch: fetchBudget, saveBudget };
};
