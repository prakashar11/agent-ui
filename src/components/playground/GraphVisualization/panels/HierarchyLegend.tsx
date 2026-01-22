/**
 * Hierarchy Legend Panel - Shows the node type hierarchy levels
 */

import React from 'react';
import { NODE_COLORS } from '../types';
import { HIERARCHY_LEVELS } from '../constants';

export function HierarchyLegend() {
  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl">
      <h4 className="text-xs text-neutral-400 uppercase mb-3 font-medium flex items-center gap-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Hierarchy (Top → Bottom)
      </h4>
      <div className="space-y-1.5">
        {HIERARCHY_LEVELS.map((level) => (
          <div key={level.rank} className="flex items-center gap-2">
            <div className="w-5 text-[10px] text-neutral-500 font-mono">{level.rank + 1}.</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {level.types.map((type) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[type] || NODE_COLORS.default }}
                  />
                  <span className="text-xs text-neutral-300">{type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HierarchyLegend;
