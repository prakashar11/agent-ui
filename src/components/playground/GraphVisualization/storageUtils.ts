/**
 * Browser storage utilities for graph visualization layout persistence
 * Stores node positions, edge handles, and UI preferences in localStorage
 */

// =============================================================================
// STORAGE CONFIGURATION
// =============================================================================

export const STORAGE_KEY = 'asset-graph-visualization-layout';
export const LAYOUT_VERSION = 6; // v6: position-based edge handle optimization for cleaner edge routing

// =============================================================================
// TYPES
// =============================================================================

export interface StoredLayout {
  // Layout version - used to invalidate cache when algorithm changes
  version?: number;
  // Node positions (id -> {x, y})
  nodePositions: Record<string, { x: number; y: number }>;
  // Edge handle positions (id -> {sourceHandle, targetHandle})
  edgeHandles: Record<string, { sourceHandle: string; targetHandle: string }>;
  // UI preferences
  preferences: {
    showMinimap: boolean;
    showLegend: boolean;
    lastZoom?: number;
  };
  // Timestamp for cache invalidation
  savedAt: number;
}

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

/**
 * Get stored layout from localStorage
 * Returns null if no valid layout exists or if it's expired/outdated
 */
export const getStoredLayout = (): StoredLayout | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const layout = JSON.parse(stored) as StoredLayout;
      
      // Check layout version - invalidate if algorithm changed
      if ((layout.version || 1) !== LAYOUT_VERSION) {
        console.log(`[AssetGraph] Layout version changed (${layout.version || 1} -> ${LAYOUT_VERSION}), clearing cache`);
        clearStoredLayout();
        return null;
      }
      
      // Cache valid for 7 days
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - layout.savedAt < sevenDays) {
        return layout;
      }
    }
  } catch (e) {
    console.warn('[AssetGraph] Failed to load stored layout:', e);
  }
  return null;
};

/**
 * Save layout to localStorage
 * Merges with existing layout data
 */
export const saveLayout = (layout: Partial<StoredLayout>): void => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredLayout() || {
      version: LAYOUT_VERSION,
      nodePositions: {},
      edgeHandles: {},
      preferences: { showMinimap: true, showLegend: false },
      savedAt: Date.now(),
    };
    const updated: StoredLayout = {
      ...existing,
      ...layout,
      version: LAYOUT_VERSION,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('[AssetGraph] Layout saved to browser storage');
  } catch (e) {
    console.warn('[AssetGraph] Failed to save layout:', e);
  }
};

/**
 * Clear stored layout from localStorage
 */
export const clearStoredLayout = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[AssetGraph] Layout cleared from browser storage');
  } catch (e) {
    console.warn('[AssetGraph] Failed to clear layout:', e);
  }
};

/**
 * Check if stored layout is valid for current nodes
 * Returns percentage of nodes that have stored positions
 */
export const validateStoredLayout = (
  stored: StoredLayout | null,
  currentNodeIds: string[]
): { isValid: boolean; matchPercentage: number; staleCount: number } => {
  if (!stored?.nodePositions) {
    return { isValid: false, matchPercentage: 0, staleCount: 0 };
  }
  
  const storedNodeIds = new Set(Object.keys(stored.nodePositions));
  const currentNodeIdSet = new Set(currentNodeIds);
  
  // Count matching nodes
  const matchingNodes = currentNodeIds.filter(id => storedNodeIds.has(id)).length;
  const matchPercentage = currentNodeIds.length > 0 ? matchingNodes / currentNodeIds.length : 0;
  
  // Count stale positions (stored but no longer exist)
  const staleCount = [...storedNodeIds].filter(id => !currentNodeIdSet.has(id)).length;
  
  // Valid if >50% match and stale positions don't outnumber valid ones
  const isValid = matchPercentage > 0.5 && staleCount < matchingNodes;
  
  return { isValid, matchPercentage, staleCount };
};
