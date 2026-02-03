'use client';

import { useState, useRef, useEffect } from 'react';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { BudgetResponse } from '@/lib/api';

interface BudgetCardProps {
  data: BudgetResponse | null;
  loading: boolean;
  error: string | null;
  onSave: (payload: { amountUsd: number | null; alertOnly?: boolean }) => Promise<void>;
  onRetry: () => Promise<void>;
}

export default function BudgetCard({ data, loading, error, onSave, onRetry }: BudgetCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [alertOnly, setAlertOnly] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const spent = data?.spentMonthToDate ?? 0;
  const budget = data?.amountUsd ?? 0;
  const usagePercent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  // Calculate days until month end
  const getDaysUntilReset = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysLeft = Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

  // Get month name
  const getMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long' });
  };

  // Get progress bar color - using teal theme
  const getProgressColor = () => {
    if (budget === 0) return 'bg-gray-300';
    if (usagePercent >= 100) return 'bg-red-500';
    if (usagePercent >= 80) return 'bg-amber-500';
    return '#004f4f'; // Teal
  };

  useEffect(() => {
    if (showModal && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showModal]);

  const handleOpenModal = () => {
    setFormError(null);
    setAmount(data?.amountUsd != null ? String(data.amountUsd) : '');
    setAlertOnly(data?.alertOnly ?? false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError(null);
  };

  const handleSave = async () => {
    const parsed = amount.trim() === '' ? null : Number(amount);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setFormError('Enter a non-negative number or leave blank to disable');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await onSave({ amountUsd: parsed, alertOnly });
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCloseModal();
    }
  };

  if (loading) {
    return <LoadingSkeleton variant="card" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Budget unavailable"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No budget found"
        description="We couldn't load your budget settings."
        suggestion="Retry or create a new budget."
      />
    );
  }

  return (
    <>
      <div className="card p-6 bg-white border-2 border-gray-200 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm text-gray-500 mb-2">{getMonthName()} budget</h3>
            
            <div className="mb-4">
              <div className="text-2xl font-bold text-gray-900 mb-3">
                {loading ? (
                  '…'
                ) : (
                  <>
                    ${spent.toFixed(2)} <span className="text-gray-500 font-normal">/ ${budget > 0 ? budget.toFixed(2) : '—'}</span>
                  </>
                )}
              </div>

              {/* Progress Bar */}
              {budget > 0 && (
                <div className="relative mb-2">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(usagePercent, 100)}%`,
                        backgroundColor: getProgressColor(),
                      }}
                    />
                  </div>
                  {usagePercent > 0 && usagePercent < 100 && (
                    <div
                      className="absolute top-0 w-0.5 h-2 bg-gray-400"
                      style={{ left: '100%', marginLeft: '-1px' }}
                    />
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500">Resets in {getDaysUntilReset()} {getDaysUntilReset() === 1 ? 'day' : 'days'}.</p>
            </div>
          </div>

          <button
            onClick={handleOpenModal}
            className="px-4 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: '#004f4f' }}
            disabled={loading}
          >
            Edit budget
          </button>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 flex items-center justify-between bg-red-50 p-3 rounded-md">
            <span>{error}</span>
            <button onClick={onRetry} className="underline font-medium">Retry</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCloseModal}
          onKeyDown={handleKeyDown}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Edit budget</h2>
            <p className="text-sm text-gray-600 mb-6">
              Your intended monthly budget. Your actual costs may exceed this budget based on usage.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly budget</label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                  placeholder="0.00"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-[#004f4f]"
                  style={{ '--tw-ring-color': '#004f4f' } as React.CSSProperties}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 mb-6">
              <input
                type="checkbox"
                checked={alertOnly}
                onChange={e => setAlertOnly(e.target.checked)}
                className="rounded border-gray-300"
                style={{ accentColor: '#004f4f' }}
              />
              <span>Alert only (allow overage but warn)</span>
            </label>

            {formError && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded-md">{formError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white rounded-md disabled:opacity-60 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#004f4f' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
