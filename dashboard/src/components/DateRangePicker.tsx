'use client';

import { useState } from 'react';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

const presets = [
  {
    label: 'Today',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { from: start, to: end };
    }
  },
  {
    label: 'Yesterday',
    getValue: () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      return { from: start, to: end };
    }
  },
  {
    label: 'Last 7 Days',
    getValue: () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    }
  },
  {
    label: 'Last 30 Days',
    getValue: () => {
      const now = new Date();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: end };
    }
  },
  {
    label: 'This Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: start, to: end };
    }
  },
  {
    label: 'Last Month',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: start, to: end };
    }
  }
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<string>(value?.from ? formatDateForInput(value.from) : '');
  const [tempTo, setTempTo] = useState<string>(value?.to ? formatDateForInput(value.to) : '');

  function formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    onChange(range);
    setTempFrom(formatDateForInput(range.from));
    setTempTo(formatDateForInput(range.to));
    setIsOpen(false);
  };

  const handleCustomRangeApply = () => {
    if (tempFrom && tempTo) {
      const fromDate = new Date(tempFrom);
      const toDate = new Date(tempTo);
      toDate.setHours(23, 59, 59, 999);
      
      if (fromDate <= toDate) {
        onChange({ from: fromDate, to: toDate });
        setIsOpen(false);
      }
    }
  };

  const handleClear = () => {
    onChange(null);
    setTempFrom('');
    setTempTo('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-64 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span>
          {value 
            ? `${formatDateForDisplay(value.from)} - ${formatDateForDisplay(value.to)}`
            : 'Select date range'
          }
        </span>
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg w-80">
          <div className="p-4">
            {/* Presets */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Select</h4>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className="px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Custom Range</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={handleClear}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomRangeApply}
                  className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}