/**
 * Batch Operations Bar - Shown when multiple nodes are selected
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Link } from 'lucide-react';

export interface BatchOperationsBarProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onLinkSelected: () => void;
  onClearSelection: () => void;
  editMode: boolean;
}

export function BatchOperationsBar({
  selectedCount,
  onDeleteSelected,
  onLinkSelected,
  onClearSelection,
  editMode,
}: BatchOperationsBarProps) {
  if (selectedCount <= 1) return null;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="bg-neutral-800/95 backdrop-blur-sm rounded-lg border border-neutral-700 shadow-xl px-4 py-2 flex items-center gap-4">
        <span className="text-sm text-neutral-300">
          <span className="font-medium text-white">{selectedCount}</span> nodes selected
        </span>
        
        <div className="h-4 w-px bg-neutral-700" />
        
        <div className="flex items-center gap-2">
          {/* Link Selected */}
          <button
            onClick={onLinkSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            <Link className="w-3.5 h-3.5" />
            <span>Link Selected</span>
          </button>
          
          {/* Delete Selected - only in edit mode */}
          {editMode && (
            <button
              onClick={onDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
          )}
          
          {/* Clear Selection */}
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs font-medium rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default BatchOperationsBar;
