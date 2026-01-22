/**
 * Navigation History Hook - Tracks navigation through nodes for back/forward
 */

import { useState, useCallback } from 'react';

export interface UseNavigationHistoryReturn {
  history: string[];
  currentIndex: number;
  push: (nodeId: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  clear: () => void;
  current: string | null;
}

export function useNavigationHistory(maxSize: number = 50): UseNavigationHistoryReturn {
  const [history, setHistory] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const push = useCallback((nodeId: string) => {
    setHistory(prev => {
      // If we're not at the end, truncate forward history
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Don't add duplicate consecutive entries
      if (newHistory[newHistory.length - 1] === nodeId) {
        return newHistory;
      }
      
      // Add new entry
      newHistory.push(nodeId);
      
      // Trim to max size
      if (newHistory.length > maxSize) {
        newHistory.shift();
      }
      
      return newHistory;
    });
    
    setCurrentIndex(prev => {
      const newIndex = Math.min(prev + 1, maxSize - 1);
      return newIndex;
    });
  }, [currentIndex, maxSize]);

  const goBack = useCallback((): string | null => {
    if (currentIndex <= 0) {
      return null;
    }
    
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const goForward = useCallback((): string | null => {
    if (currentIndex >= history.length - 1) {
      return null;
    }
    
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    history,
    currentIndex,
    push,
    goBack,
    goForward,
    canGoBack: currentIndex > 0,
    canGoForward: currentIndex < history.length - 1,
    clear,
    current: currentIndex >= 0 ? history[currentIndex] : null,
  };
}

export default useNavigationHistory;
