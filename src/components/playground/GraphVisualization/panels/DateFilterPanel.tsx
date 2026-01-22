/**
 * Date Filter Panel - Filter nodes by creation date
 */

import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';

export interface DateFilterState {
  mode: 'off' | 'single' | 'range';
  singleDate: string; // YYYY-MM-DD format
  startDate: string;  // YYYY-MM-DD format
  endDate: string;    // YYYY-MM-DD format
  applied: boolean;   // Whether the filter has been applied
}

export interface DateFilterPanelProps {
  dateFilter: DateFilterState;
  onDateFilterChange: (filter: DateFilterState) => void;
  onClose: () => void;
  filteredCount: number;
  totalCount: number;
}

export function DateFilterPanel({ dateFilter, onDateFilterChange, onClose, filteredCount, totalCount }: DateFilterPanelProps) {
  // Local state for editing (not applied until user clicks Apply)
  const [localMode, setLocalMode] = useState<'off' | 'single' | 'range'>(dateFilter.mode);
  const [localSingleDate, setLocalSingleDate] = useState(dateFilter.singleDate);
  const [localStartDate, setLocalStartDate] = useState(dateFilter.startDate);
  const [localEndDate, setLocalEndDate] = useState(dateFilter.endDate);

  // Check if there are pending changes
  const hasChanges = localMode !== dateFilter.mode ||
    localSingleDate !== dateFilter.singleDate ||
    localStartDate !== dateFilter.startDate ||
    localEndDate !== dateFilter.endDate ||
    !dateFilter.applied;

  // Check if the current selection is valid for applying
  const canApply = localMode === 'off' ||
    (localMode === 'single' && localSingleDate) ||
    (localMode === 'range' && localStartDate && localEndDate);

  const handleApply = () => {
    onDateFilterChange({
      mode: localMode,
      singleDate: localSingleDate,
      startDate: localStartDate,
      endDate: localEndDate,
      applied: true,
    });
    onClose(); // Close the panel after applying
  };

  const handleClear = () => {
    setLocalMode('off');
    setLocalSingleDate('');
    setLocalStartDate('');
    setLocalEndDate('');
    onDateFilterChange({
      mode: 'off',
      singleDate: '',
      startDate: '',
      endDate: '',
      applied: true,
    });
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs text-neutral-400 uppercase font-medium">Filter by Created Date</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-700 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>

      {/* Mode Selection */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setLocalMode('off')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'off'
              ? 'bg-neutral-700 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Off
        </button>
        <button
          onClick={() => setLocalMode('single')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'single'
              ? 'bg-cyan-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Specific Date
        </button>
        <button
          onClick={() => setLocalMode('range')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'range'
              ? 'bg-cyan-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Date Range
        </button>
      </div>

      {/* Single Date Input */}
      {localMode === 'single' && (
        <div className="space-y-2">
          <label className="text-xs text-neutral-500">Select Date</label>
          <input
            type="date"
            value={localSingleDate}
            onChange={(e) => setLocalSingleDate(e.target.value)}
            max={today}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
          />
        </div>
      )}

      {/* Date Range Inputs */}
      {localMode === 'range' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-neutral-500">From</label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => setLocalStartDate(e.target.value)}
              max={localEndDate || today}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">To</label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => setLocalEndDate(e.target.value)}
              min={localStartDate}
              max={today}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      {/* Apply and Clear Buttons */}
      {localMode !== 'off' && (
        <div className="mt-3 pt-3 border-t border-neutral-700/50 flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              canApply && hasChanges
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            Apply Filter
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filter Stats */}
      {dateFilter.applied && dateFilter.mode !== 'off' && (
        <div className="mt-2 text-xs text-neutral-400">
          Showing <span className="text-cyan-400 font-medium">{filteredCount}</span> of {totalCount} nodes
        </div>
      )}

      {/* Help text */}
      <p className="mt-3 text-[10px] text-neutral-500 leading-relaxed">
        Filter nodes by their creation date. Note: Nodes only have a created date (not updated date).
      </p>
    </div>
  );
}

export default DateFilterPanel;
