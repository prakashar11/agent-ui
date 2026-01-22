/**
 * Empty State - Shown when the graph has no nodes
 */

import React from 'react';
import { Network, Plus, Database } from 'lucide-react';

export interface EmptyStateProps {
  onAddNode: () => void;
  onLoadDemoData: () => void;
  isLoading?: boolean;
}

export function EmptyState({ onAddNode, onLoadDemoData, isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Animated skeleton graph */}
        <div className="relative w-64 h-48 mb-4">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              {/* Top row */}
              <div className="flex gap-12">
                <div className="w-20 h-10 bg-neutral-800 rounded-lg border border-neutral-700" />
                <div className="w-20 h-10 bg-neutral-800 rounded-lg border border-neutral-700" />
              </div>
              
              {/* Connecting lines */}
              <div className="flex items-center gap-4">
                <div className="w-8 h-0.5 bg-neutral-700 -rotate-45" />
                <div className="w-8 h-0.5 bg-neutral-700 rotate-45" />
              </div>
              
              {/* Center node */}
              <div className="w-24 h-12 bg-neutral-700 rounded-lg border border-neutral-600" />
              
              {/* Bottom lines */}
              <div className="flex items-center gap-4">
                <div className="w-8 h-0.5 bg-neutral-700 rotate-45" />
                <div className="w-8 h-0.5 bg-neutral-700 -rotate-45" />
              </div>
              
              {/* Bottom row */}
              <div className="flex gap-8">
                <div className="w-16 h-8 bg-neutral-800 rounded-lg border border-neutral-700" />
                <div className="w-16 h-8 bg-neutral-800 rounded-lg border border-neutral-700" />
                <div className="w-16 h-8 bg-neutral-800 rounded-lg border border-neutral-700" />
              </div>
            </div>
          </div>
        </div>
        <span className="text-sm text-neutral-400">Loading graph data...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Network className="w-20 h-20 text-neutral-700 mb-6" />
      
      <h3 className="text-xl font-semibold text-white mb-2">No Assets in Graph</h3>
      <p className="text-sm text-neutral-400 mb-6 text-center max-w-md">
        Get started by adding your first asset or load demo data to explore the graph visualization.
      </p>
      
      <div className="flex gap-3">
        <button
          onClick={onAddNode}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
        
        <button
          onClick={onLoadDemoData}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-sm font-medium rounded-lg transition-colors"
        >
          <Database className="w-4 h-4" />
          Load Demo Data
        </button>
      </div>
      
      <div className="mt-8 text-xs text-neutral-600 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono">⌘F</kbd>
          Search
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono">Tab</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono">Esc</kbd>
          Close
        </span>
      </div>
    </div>
  );
}

export default EmptyState;
