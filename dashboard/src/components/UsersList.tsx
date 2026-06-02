'use client';

import { UsersResult } from '@/hooks/useUsers';
import { shortenAddress, getExplorerUrl } from '@/lib/contract';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';

interface UsersListProps {
  className?: string;
  users: UsersResult;
}

const TOP_COUNT = 5;

// Compact relative time, e.g. "3d ago". Falls back to a date for older activity.
const formatRelative = (iso: string | null): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export default function UsersList({ className = '', users }: UsersListProps) {
  const { users: list, loading, error, refetch } = users;

  if (loading) {
    return <LoadingSkeleton className={className} variant="chart" height={220} />;
  }

  if (error) {
    return <ErrorState className={className} message={error} onRetry={refetch} />;
  }

  if (list.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Users"
        description="No on-chain users yet."
        suggestion="Addresses that interact with the contract will appear here."
      />
    );
  }

  const visible = list.slice(0, TOP_COUNT);

  return (
    <div className={`card p-8 ${className}`}>
      <div className="mb-6">
        <h3 className="text-2xl font-semibold text-gray-900">Users</h3>
        <p className="text-gray-600">
          Most active addresses transacting with the contract
        </p>
      </div>

      <div className="space-y-2">
        {visible.map((user, index) => (
          <a
            key={user.address}
            href={getExplorerUrl(user.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="group grid grid-cols-[auto_1fr_auto] gap-4 items-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-400 w-6 text-right tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-mono text-gray-900 truncate group-hover:text-blue-600">
                {shortenAddress(user.address)}
              </p>
              {user.lastActive && (
                <p className="text-xs text-gray-500">Last active {formatRelative(user.lastActive)}</p>
              )}
            </div>
            <span className="text-sm font-medium text-gray-400 group-hover:text-blue-600">
              View ↗
            </span>
          </a>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center gap-4">
          <span className="text-lg font-medium text-gray-600">Total Users:</span>
          <span className="text-2xl font-semibold text-gray-900">
            {list.length.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
