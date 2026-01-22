/**
 * Filter Panel - Type filter for graph nodes
 */

import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { NODE_COLORS } from '../types';
import { PRIMARY_SEED_TYPES, NODE_TYPE_HIERARCHY } from '../hierarchyUtils';

export interface FilterPanelProps {
  nodeTypes: string[];
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  stats: Record<string, number>;
  onClose: () => void;
  onRefresh?: () => void;
  primaryAnchorType?: string | null;
  currentDepth?: number;
  onDepthChange?: (depth: number) => void;
}

export function FilterPanel({ 
  nodeTypes, 
  activeFilters, 
  onToggleFilter, 
  stats, 
  onClose, 
  onRefresh, 
  primaryAnchorType, 
  currentDepth, 
  onDepthChange 
}: FilterPanelProps) {
  // Sort node types by hierarchy, with primary seed types (Threat, Vulnerability, Asset) first
  const sortedTypes = [...nodeTypes].sort((a, b) => {
    // First sort by whether it's a primary seed type
    const aIsSeed = PRIMARY_SEED_TYPES.has(a);
    const bIsSeed = PRIMARY_SEED_TYPES.has(b);
    if (aIsSeed && !bIsSeed) return -1;
    if (!aIsSeed && bIsSeed) return 1;
    
    // Then sort by hierarchy
    const rankA = NODE_TYPE_HIERARCHY[a] ?? 99;
    const rankB = NODE_TYPE_HIERARCHY[b] ?? 99;
    return rankA - rankB;
  });

  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs text-neutral-400 uppercase font-medium">Filter by Type</h4>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-neutral-700 rounded transition-colors group"
              title="Refresh graph with current filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 mb-2">
        {primaryAnchorType
          ? <>Anchor: <span className="text-green-400 font-medium">{primaryAnchorType}</span> (date-filtered seed)</>
          : 'Select a primary type to set anchor'
        }
      </p>
      <div className="flex flex-wrap gap-2 max-w-xs">
        {sortedTypes.map((type) => {
          const isPrimarySeed = PRIMARY_SEED_TYPES.has(type);
          const isAnchor = type === primaryAnchorType;
          const isSelected = activeFilters.has(type);
          const isActive = activeFilters.size === 0 || isSelected;
          const color = NODE_COLORS[type] || NODE_COLORS.default;
          const count = stats[type] || 0;

          return (
            <button
              key={type}
              onClick={() => onToggleFilter(type)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all
                ${isActive
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800/50 text-neutral-500 opacity-50'
                }
                ${isAnchor ? 'ring-2 ring-green-500' : isPrimarySeed ? 'ring-1 ring-blue-500/30' : ''}
              `}
              title={isAnchor ? `${type} (anchor - date filter applies)` : isSelected && isPrimarySeed ? `${type} (connected to anchor)` : isPrimarySeed ? `${type} (primary seed type)` : `${type} (via hop expansion)`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span>{type}</span>
              {isAnchor && <span className="text-green-400 text-[10px]">⚓</span>}
              <span className="text-neutral-500">({count})</span>
            </button>
          );
        })}
      </div>
      
      {/* Footnote hint: suggest increasing depth when many types selected with low hops */}
      {activeFilters.size >= 3 && currentDepth !== undefined && currentDepth < activeFilters.size - 1 && onDepthChange && (
        <div 
          className="mt-3 pt-2 border-t border-neutral-700/50 text-[10px] text-amber-400 cursor-pointer hover:text-amber-300 transition-colors"
          onClick={() => onDepthChange(activeFilters.size - 1)}
        >
          💡 Tip: With {activeFilters.size} types, increase depth to {activeFilters.size - 1}+ hops to see full chain
        </div>
      )}
    </div>
  );
}

export default FilterPanel;
