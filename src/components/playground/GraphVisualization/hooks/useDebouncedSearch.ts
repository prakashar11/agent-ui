/**
 * Debounced Search Hook - Provides debounced search functionality
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CustomNode, CustomNodeData } from '../types';

export interface SearchResult {
  nodeIds: Set<string>;
  matchCount: number;
}

export interface UseDebouncedSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

export interface UseDebouncedSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult | null;
  isSearching: boolean;
  clearSearch: () => void;
}

/**
 * Debounce utility function
 */
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, ms);
  };
}

/**
 * Perform search across nodes
 */
function searchNodes(
  nodes: CustomNode[],
  query: string,
  maxHops?: number | null
): SearchResult {
  const lowerQuery = query.toLowerCase();
  const matchingIds = new Set<string>();
  
  // Find direct matches
  nodes.forEach(node => {
    const data = node.data as CustomNodeData;
    const label = data.label?.toLowerCase() || '';
    const nodeType = data.nodeType?.toLowerCase() || '';
    const propsString = JSON.stringify(data.properties || {}).toLowerCase();
    
    if (
      label.includes(lowerQuery) ||
      nodeType.includes(lowerQuery) ||
      propsString.includes(lowerQuery)
    ) {
      matchingIds.add(node.id);
    }
  });
  
  // Note: Hop expansion would require edges, which could be passed in if needed
  // For now, we just return direct matches
  
  return {
    nodeIds: matchingIds,
    matchCount: matchingIds.size,
  };
}

export function useDebouncedSearch(
  nodes: CustomNode[],
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { debounceMs = 200, minQueryLength = 1 } = options;
  
  const [query, setQueryInternal] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Keep a ref to the latest nodes to avoid stale closures
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Debounced search function
  const debouncedSearchRef = useRef(
    debounce((searchQuery: string) => {
      if (searchQuery.length < minQueryLength) {
        setResults(null);
        setIsSearching(false);
        return;
      }
      
      const searchResult = searchNodes(nodesRef.current, searchQuery);
      setResults(searchResult);
      setIsSearching(false);
    }, debounceMs)
  );

  const setQuery = useCallback((newQuery: string) => {
    setQueryInternal(newQuery);
    
    if (newQuery.length === 0) {
      setResults(null);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    debouncedSearchRef.current(newQuery);
  }, []);

  const clearSearch = useCallback(() => {
    setQueryInternal('');
    setResults(null);
    setIsSearching(false);
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    clearSearch,
  };
}

export default useDebouncedSearch;
