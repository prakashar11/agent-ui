/**
 * Undo/Redo Hook - Manages undo/redo history for graph edits
 */

import { useState, useCallback, useRef } from 'react';
import type { Edge } from '@xyflow/react';
import type { CustomNode } from '../types';

export interface GraphHistoryState {
  nodes: CustomNode[];
  edges: Edge[];
  timestamp: number;
}

export interface UseUndoRedoOptions {
  maxHistorySize?: number;
}

export interface UseUndoRedoReturn {
  pushHistory: (nodes: CustomNode[], edges: Edge[]) => void;
  undo: () => GraphHistoryState | null;
  redo: () => GraphHistoryState | null;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  historySize: number;
  currentIndex: number;
}

export function useUndoRedo(options: UseUndoRedoOptions = {}): UseUndoRedoReturn {
  const { maxHistorySize = 50 } = options;
  
  const [history, setHistory] = useState<GraphHistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Use ref to track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((nodes: CustomNode[], edges: Edge[]) => {
    // Don't push if we're in the middle of undo/redo
    if (isUndoRedoRef.current) {
      return;
    }
    
    // Deep clone to preserve state
    const newState: GraphHistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now(),
    };
    
    setHistory(prev => {
      // Remove any future history if we're not at the end
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new state
      newHistory.push(newState);
      
      // Trim to max size
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  }, [currentIndex, maxHistorySize]);

  const undo = useCallback((): GraphHistoryState | null => {
    if (currentIndex <= 0) {
      return null;
    }
    
    isUndoRedoRef.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    
    // Use setTimeout to reset the flag after the state update
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
    
    return history[newIndex] || null;
  }, [currentIndex, history]);

  const redo = useCallback((): GraphHistoryState | null => {
    if (currentIndex >= history.length - 1) {
      return null;
    }
    
    isUndoRedoRef.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    
    // Use setTimeout to reset the flag after the state update
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
    
    return history[newIndex] || null;
  }, [currentIndex, history]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    pushHistory,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    clearHistory,
    historySize: history.length,
    currentIndex,
  };
}

export default useUndoRedo;
