/**
 * Navigation Breadcrumbs - Shows navigation history with back/forward
 */

import React from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import type { CustomNode, CustomNodeData } from '../types';
import { NODE_COLORS } from '../types';

export interface NavigationBreadcrumbsProps {
  history: string[];
  currentIndex: number;
  nodes: CustomNode[];
  onGoBack: () => void;
  onGoForward: () => void;
  onNavigateTo: (nodeId: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function NavigationBreadcrumbs({
  history,
  currentIndex,
  nodes,
  onGoBack,
  onGoForward,
  onNavigateTo,
  canGoBack,
  canGoForward,
}: NavigationBreadcrumbsProps) {
  if (history.length === 0) return null;

  // Get node info by ID
  const getNodeInfo = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { label: 'Unknown', nodeType: 'Node' };
    const data = node.data as CustomNodeData;
    return { label: data.label, nodeType: data.nodeType };
  };

  // Show last 5 entries in breadcrumb
  const visibleHistory = history.slice(Math.max(0, currentIndex - 4), currentIndex + 1);
  const startOffset = Math.max(0, currentIndex - 4);

  return (
    <div className="flex items-center gap-1 text-xs">
      {/* Back Button */}
      <button
        onClick={onGoBack}
        disabled={!canGoBack}
        className={`p-1 rounded transition-colors ${
          canGoBack
            ? 'hover:bg-neutral-700 text-neutral-400 hover:text-white'
            : 'text-neutral-600 cursor-not-allowed'
        }`}
        title="Go back (Alt+←)"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Forward Button */}
      <button
        onClick={onGoForward}
        disabled={!canGoForward}
        className={`p-1 rounded transition-colors ${
          canGoForward
            ? 'hover:bg-neutral-700 text-neutral-400 hover:text-white'
            : 'text-neutral-600 cursor-not-allowed'
        }`}
        title="Go forward (Alt+→)"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* History Icon */}
      <History className="w-3.5 h-3.5 text-neutral-500 ml-1" />

      {/* Breadcrumb Trail */}
      <div className="flex items-center gap-0.5 ml-1">
        {startOffset > 0 && (
          <span className="text-neutral-600 px-1">...</span>
        )}
        
        {visibleHistory.map((nodeId, idx) => {
          const actualIndex = startOffset + idx;
          const isActive = actualIndex === currentIndex;
          const { label, nodeType } = getNodeInfo(nodeId);
          const color = NODE_COLORS[nodeType] || NODE_COLORS.default;

          return (
            <React.Fragment key={`${nodeId}-${actualIndex}`}>
              {idx > 0 && (
                <span className="text-neutral-600 px-0.5">›</span>
              )}
              <button
                onClick={() => onNavigateTo(nodeId)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  isActive
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate max-w-[80px]">{label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Position indicator */}
      <span className="text-neutral-600 ml-2">
        {currentIndex + 1}/{history.length}
      </span>
    </div>
  );
}

export default NavigationBreadcrumbs;
