'use client';

import { useMemo, useState } from 'react';
import { UsageRecord } from '@/lib/api';
import { groupByDate } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface ActivityHeatmapProps {
  records: UsageRecord[];
  fromDate?: Date;
  toDate?: Date;
  className?: string;
  showFullYear?: boolean; // If true, show last 52 weeks regardless of date range
}

// Color levels for activity intensity (GitHub-style)
const getActivityLevel = (requests: number, maxRequests: number): number => {
  if (requests === 0) return 0;
  if (requests === 1) return 1;
  if (requests <= maxRequests * 0.25) return 1;
  if (requests <= maxRequests * 0.5) return 2;
  if (requests <= maxRequests * 0.75) return 3;
  return 4;
};

const getActivityColor = (level: number): string => {
  // Using the same teal color scheme as the Edit budget button (#004f4f)
  const colors = [
    'bg-stone-100 hover:bg-stone-200', // Level 0: No activity
    'bg-[#e0f2f2] hover:bg-[#c0e5e5]', // Level 1: Light activity (very light teal)
    'bg-[#80cccc] hover:bg-[#66b8b8]', // Level 2: Medium activity (medium teal)
    'bg-[#006666] hover:bg-[#005555]',  // Level 3: High activity (teal-light from globals)
    'bg-[#004f4f] hover:bg-[#003333]', // Level 4: Very high activity (main teal - matches Edit budget button)
  ];
  return colors[level] || colors[0];
};

interface DayData {
  date: Date;
  dateKey: string;
  requests: number;
  cost: number;
  tokens: number;
  level: number;
}

export default function ActivityHeatmap({ records, fromDate, toDate, className = '', showFullYear = true }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const { days } = useMemo(() => {
    // If showFullYear is true, always show last 52 weeks (GitHub-style)
    let startDate: Date;
    let endDate: Date;

    if (showFullYear) {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (52 * 7 - 1)); // 52 weeks back
      startDate.setHours(0, 0, 0, 0);
    } else {
      if (!fromDate || !toDate) return { days: [] };
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
    }

    // Group records by day
    const grouped = groupByDate(records, 'day');

    // Create array of all days in the date range
    const days: DayData[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    let maxRequests = 0;

    while (current <= end) {
      const dateKey = current.toISOString().slice(0, 10);
      const dayData = grouped[dateKey] || {
        cost: 0,
        tokens: 0,
        requests: 0,
        inputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        outputTokens: 0
      };

      const level = getActivityLevel(dayData.requests, Math.max(maxRequests, dayData.requests));

      days.push({
        date: new Date(current),
        dateKey,
        requests: dayData.requests,
        cost: dayData.cost,
        tokens: dayData.tokens,
        level
      });

      maxRequests = Math.max(maxRequests, dayData.requests);
      current.setDate(current.getDate() + 1);
    }

    // Recalculate levels now that we know maxRequests
    days.forEach(day => {
      day.level = getActivityLevel(day.requests, maxRequests);
    });

    return { days };
  }, [records, fromDate, toDate, showFullYear]);

  // Group days by week (starting Monday)
  const weeks = useMemo(() => {
    const weeks: DayData[][] = [];
    let currentWeek: DayData[] = [];

    days.forEach(day => {
      // Monday = 1, Sunday = 0, so we adjust
      const dayOfWeek = day.date.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Monday, 6=Sunday

      if (adjustedDay === 0 && currentWeek.length > 0) {
        // Start new week on Monday
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [days]);

  const handleMouseEnter = (day: DayData, event: React.MouseEvent) => {
    setHoveredDay(day);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  if (days.length === 0) {
    return (
      <div className={`card p-8 ${className}`}>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Activity Overview</h3>
        <p className="text-gray-600 mb-6">Daily API request activity visualization</p>
        <div className="text-center text-gray-500 py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No activity data for the selected period</p>
        </div>
      </div>
    );
  }

  const totalRequests = days.reduce((sum, d) => sum + d.requests, 0);
  const activeDays = days.filter(d => d.requests > 0).length;
  const currentYear = new Date().getFullYear();

  return (
    <div className={`card p-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-2">Activity Overview</h3>
          <p className="text-gray-600">
            {totalRequests > 0 ? (
              <>
                <span className="font-semibold text-gray-900">{totalRequests}</span> request{totalRequests !== 1 ? 's' : ''} in {currentYear}
                {' • '}
                <span className="font-semibold text-gray-900">{activeDays}</span> active day{activeDays !== 1 ? 's' : ''}
              </>
            ) : (
              'Daily API request activity visualization'
            )}
          </p>
        </div>
      </div>

      {/* Calendar Container */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-6 border border-gray-200">
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="inline-flex gap-1">
            {/* Day labels - GitHub style: only Mon, Wed, Fri */}
            <div className="flex flex-col gap-1 mr-2 flex-shrink-0">
              <div className="h-4 mb-1"></div> {/* Spacer for month labels */}
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((day, index) => (
                <div key={`day-${index}`} className="h-3 text-[10px] text-gray-600 font-semibold leading-3 flex items-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => {
                const showMonth = week[0] && (
                  weekIndex === 0 || 
                  weeks[weekIndex - 1][0]?.date.getMonth() !== week[0].date.getMonth()
                );
                
                return (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {/* Month label (show on first day of month) */}
                    {showMonth ? (
                      <div className="h-4 mb-1 text-[11px] text-gray-700 font-bold text-center leading-4">
                        {week[0].date.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    ) : (
                      <div className="h-4 mb-1"></div>
                    )}

                    {/* Days */}
                    {week.map(day => (
                      <button
                        key={day.dateKey}
                        className={`
                          w-3 h-3 rounded transition-all duration-150
                          ${getActivityColor(day.level)}
                          ${day.requests > 0 
                            ? 'cursor-pointer hover:scale-150 hover:z-10 hover:shadow-lg border border-gray-300 hover:border-gray-400' 
                            : 'cursor-default border border-gray-200'
                          }
                          focus:outline-none focus:ring-2 focus:ring-[#004f4f] focus:ring-offset-1
                        `}
                        onMouseEnter={(e) => handleMouseEnter(day, e)}
                        onMouseLeave={handleMouseLeave}
                        aria-label={`${day.dateKey}: ${day.requests} requests`}
                      />
                    ))}

                    {/* Fill week to 7 days if needed */}
                    {Array.from({ length: 7 - week.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="w-3 h-3" />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend at the bottom - GitHub style */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
          <span className="text-xs text-gray-500">Less</span>
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`w-3 h-3 rounded ${getActivityColor(level)} border border-gray-300`}
            />
          ))}
          <span className="text-xs text-gray-500">More</span>
        </div>
      </div>

      {/* Enhanced Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-50 bg-white text-gray-900 text-sm rounded-xl px-4 py-3 shadow-2xl pointer-events-none max-w-xs border-2 border-gray-200"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="font-bold text-base mb-2 text-gray-900 border-b border-gray-200 pb-2">
            {hoveredDay.date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600 text-xs font-medium">Requests:</span>
              <span className="font-bold text-[#004f4f]">{hoveredDay.requests}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600 text-xs font-medium">Tokens:</span>
              <span className="font-semibold text-gray-900">{formatNumber(hoveredDay.tokens)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-600 text-xs font-medium">Cost:</span>
              <span className="font-semibold text-gray-900">{formatCurrency(hoveredDay.cost)}</span>
            </div>
          </div>
          {/* Tooltip arrow */}
          <div 
            className="absolute w-3 h-3 bg-white border-r-2 border-b-2 border-gray-200 transform rotate-45"
            style={{
              bottom: '-7px',
              left: '50%',
              marginLeft: '-6px'
            }}
          />
        </div>
      )}
    </div>
  );
}

