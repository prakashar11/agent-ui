/**
 * Node Context Menu - Right-click context menu for graph nodes
 */

import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Eye, Pencil, Link, Trash2, Search, ScanSearch, Copy, Target } from 'lucide-react';
import { NODE_COLORS } from '../types';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

export interface NodeContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onViewDetails: () => void;
  onEditProperties: () => void;
  onAddRelationship: () => void;
  onDeleteNode: () => void;
  onSearchByLabel: () => void;
  onCopyNodeId?: () => void;
  onExpandNeighbors?: () => void;
  onRunCVEAnalysis?: () => void;
  editMode: boolean;
  nodeName?: string;
  nodeType?: string;
}

export function NodeContextMenu({
  state,
  onClose,
  onViewDetails,
  onEditProperties,
  onAddRelationship,
  onDeleteNode,
  onSearchByLabel,
  onCopyNodeId,
  onExpandNeighbors,
  onRunCVEAnalysis,
  editMode,
  nodeName,
  nodeType,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Close on outside click (delayed to prevent immediate close on the triggering right-click)
  useEffect(() => {
    if (!state.isOpen) {
      isFirstRender.current = true;
      return;
    }

    // Delay attaching the listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      isFirstRender.current = false;
    }, 100);

    const handleClick = (e: MouseEvent) => {
      // Ignore the initial right-click that opened the menu
      if (isFirstRender.current) return;
      
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Close menu on right-click outside
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen) return null;

  const color = NODE_COLORS[nodeType || ''] || NODE_COLORS.default;

  // Calculate position to keep menu in viewport
  const menuWidth = 200;
  const menuHeight = 300;
  const padding = 10;
  
  let x = state.x;
  let y = state.y;
  
  if (typeof window !== 'undefined') {
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
  }

  // Use portal to render context menu at document body level
  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-[9999] bg-neutral-900 rounded-lg border border-neutral-700 shadow-2xl py-1 min-w-[180px]"
      style={{ 
        left: x, 
        top: y,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Node Header */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{nodeName || 'Unknown'}</div>
            <div className="text-[10px] text-neutral-500 uppercase">{nodeType || 'Node'}</div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-1">
        {/* View Details */}
        <button
          onClick={() => {
            onViewDetails();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Eye className="w-4 h-4 text-neutral-400" />
          <span>View Details</span>
          <span className="ml-auto text-xs text-neutral-600">Enter</span>
        </button>

        {/* Search by Label */}
        <button
          onClick={() => {
            onSearchByLabel();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Search className="w-4 h-4 text-neutral-400" />
          <span>Search by Label</span>
        </button>

        {/* Copy Node ID */}
        {onCopyNodeId && (
          <button
            onClick={() => {
              onCopyNodeId();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4 text-neutral-400" />
            <span>Copy Node ID</span>
          </button>
        )}

        {/* Expand Neighbors */}
        {onExpandNeighbors && (
          <button
            onClick={() => {
              onExpandNeighbors();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Expand Neighbors</span>
          </button>
        )}

        {/* Run CVE Analysis - only for Vulnerability nodes */}
        {nodeType === 'Vulnerability' && onRunCVEAnalysis && (
          <button
            onClick={() => {
              onRunCVEAnalysis();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <ScanSearch className="w-4 h-4 text-amber-400" />
            <span>Run CVE Analysis</span>
          </button>
        )}

        {/* Separator */}
        <div className="my-1 border-t border-neutral-700" />

        {/* Edit Properties */}
        <button
          onClick={() => {
            onEditProperties();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Pencil className="w-4 h-4 text-neutral-400" />
          <span>Edit Properties</span>
        </button>

        {/* Add Relationship */}
        <button
          onClick={() => {
            onAddRelationship();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Link className="w-4 h-4 text-blue-400" />
          <span>Add Relationship</span>
        </button>

        {/* Delete Node - only in edit mode */}
        {editMode && (
          <>
            <div className="my-1 border-t border-neutral-700" />
            <button
              onClick={() => {
                onDeleteNode();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Node</span>
              <span className="ml-auto text-xs text-neutral-600">⌫</span>
            </button>
          </>
        )}
      </div>
    </motion.div>,
    document.body
  );
}

export default NodeContextMenu;
