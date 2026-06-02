import { useState, useEffect, useCallback } from 'react';
import { fetchUsers, NexusUser } from '@/lib/nexus';

export interface UsersResult {
  users: NexusUser[];
  count: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Unique on-chain users: distinct addresses that have signed a transaction to
 * the contract, sourced from the Oasis Nexus indexer. Backs both the "Unique
 * Users" stat card (count) and the user list (addresses).
 */
export const useUsers = (): UsersResult => {
  const [users, setUsers] = useState<NexusUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchUsers();
      setUsers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    users,
    count: loading || error ? null : users.length,
    loading,
    error,
    refetch: fetchData,
  };
};
