/**
 * Keyboard Shortcuts Hook - Handles keyboard navigation and shortcuts for the graph
 */

import { useEffect, useCallback } from 'react';
import type { CustomNode } from '../types';

export interface KeyboardShortcutsConfig {
  enabled: boolean;
  editMode: boolean;
  selectedNode: CustomNode | null;
  nodes: CustomNode[];
  onSelectNode: (node: CustomNode | null) => void;
  onDeleteSelectedNode: () => void;
  onFocusSearch: () => void;
  onCenterOnNode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleFilters: () => void;
  onEscape: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useKeyboardShortcuts({
  enabled,
  editMode,
  selectedNode,
  nodes,
  onSelectNode,
  onDeleteSelectedNode,
  onFocusSearch,
  onCenterOnNode,
  onUndo,
  onRedo,
  onToggleFilters,
  onEscape,
  canUndo,
  canRedo,
}: KeyboardShortcutsConfig) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't handle shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow escape to blur inputs
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    // Escape - close panels/deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
      return;
    }

    // Cmd/Ctrl + F - Focus search
    if (isMeta && e.key === 'f') {
      e.preventDefault();
      onFocusSearch();
      return;
    }

    // Cmd/Ctrl + Z - Undo (only in edit mode)
    if (isMeta && !isShift && e.key === 'z' && editMode && canUndo) {
      e.preventDefault();
      onUndo();
      return;
    }

    // Cmd/Ctrl + Shift + Z - Redo (only in edit mode)
    if (isMeta && isShift && e.key === 'z' && editMode && canRedo) {
      e.preventDefault();
      onRedo();
      return;
    }

    // Delete/Backspace - Delete selected node (only in edit mode)
    if ((e.key === 'Delete' || e.key === 'Backspace') && editMode && selectedNode) {
      e.preventDefault();
      onDeleteSelectedNode();
      return;
    }

    // Space - Center on selected node
    if (e.key === ' ' && selectedNode) {
      e.preventDefault();
      onCenterOnNode();
      return;
    }

    // Enter - View details of selected node (handled by parent)
    if (e.key === 'Enter' && selectedNode) {
      // Let parent handle this
      return;
    }

    // Tab / Shift+Tab - Navigate between nodes
    if (e.key === 'Tab' && nodes.length > 0) {
      e.preventDefault();
      
      if (!selectedNode) {
        // Select first node
        onSelectNode(nodes[0]);
      } else {
        const currentIndex = nodes.findIndex(n => n.id === selectedNode.id);
        let nextIndex: number;
        
        if (isShift) {
          // Previous node
          nextIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1;
        } else {
          // Next node
          nextIndex = currentIndex >= nodes.length - 1 ? 0 : currentIndex + 1;
        }
        
        onSelectNode(nodes[nextIndex]);
      }
      return;
    }

    // F - Toggle filters
    if (e.key === 'f' && !isMeta) {
      e.preventDefault();
      onToggleFilters();
      return;
    }

    // Number keys 1-9 - Quick filter by node type (future enhancement)
    // if (e.key >= '1' && e.key <= '9') {
    //   const typeIndex = parseInt(e.key) - 1;
    //   // Implementation depends on node types list
    // }
  }, [
    enabled,
    editMode,
    selectedNode,
    nodes,
    onSelectNode,
    onDeleteSelectedNode,
    onFocusSearch,
    onCenterOnNode,
    onUndo,
    onRedo,
    onToggleFilters,
    onEscape,
    canUndo,
    canRedo,
  ]);

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

export default useKeyboardShortcuts;
