/**
 * Edge utilities for graph visualization
 * Includes handle optimization and A* pathfinding for smart edges
 */

import type { Node, Edge } from '@xyflow/react';
import { getNodeRank } from './hierarchyUtils';

// =============================================================================
// TYPES
// =============================================================================

interface NodePosition {
  x: number;
  y: number;
  level: number;
}

interface NodeData {
  label: string;
  nodeType: string;
  properties: Record<string, unknown>;
  [key: string]: unknown;
}

// =============================================================================
// HANDLE OPTIMIZATION
// =============================================================================

/**
 * Get optimal source/target handles based on node positions
 * Chooses handles that create the most direct path without visual overlap
 */
export const getOptimalHandles = (
  sourcePos: NodePosition,
  targetPos: NodePosition,
  _relType: string,
  edgeIndex: number,
  totalEdgesForPair: number,
  _sourceOutDegree?: number,
  _targetInDegree?: number
): { source: string; target: string } => {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const levelDiff = targetPos.level - sourcePos.level;
  
  // Determine primary direction based on relative positions
  // For hierarchy graphs, vertical relationships are primary
  
  if (levelDiff !== 0) {
    // Different hierarchy levels - use vertical handles primarily
    if (levelDiff > 0) {
      // Target is below source (higher level number = lower in graph)
      if (absDx < 100) {
        // Mostly vertical - use straight bottom->top
        return { source: 'source-bottom', target: 'target-top' };
      } else if (dx > 0) {
        // Target is down-right
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-bottom', target: 'target-top' }
            : { source: 'source-right', target: 'target-left' };
        }
        return { source: 'source-bottom', target: 'target-top' };
      } else {
        // Target is down-left
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-bottom', target: 'target-top' }
            : { source: 'source-left', target: 'target-right' };
        }
        return { source: 'source-bottom', target: 'target-top' };
      }
    } else {
      // Target is above source
      if (absDx < 100) {
        return { source: 'source-top', target: 'target-bottom' };
      } else if (dx > 0) {
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-top', target: 'target-bottom' }
            : { source: 'source-right', target: 'target-left' };
        }
        return { source: 'source-top', target: 'target-bottom' };
      } else {
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-top', target: 'target-bottom' }
            : { source: 'source-left', target: 'target-right' };
        }
        return { source: 'source-top', target: 'target-bottom' };
      }
    }
  } else {
    // Same hierarchy level - use horizontal handles primarily
    if (dx > 0) {
      // Target is to the right
      if (absDy < 50) {
        return { source: 'source-right', target: 'target-left' };
      } else if (dy > 0) {
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-right', target: 'target-left' }
            : { source: 'source-bottom', target: 'target-top' };
        }
        return { source: 'source-right', target: 'target-left' };
      } else {
        return { source: 'source-right', target: 'target-left' };
      }
    } else {
      // Target is to the left
      if (absDy < 50) {
        return { source: 'source-left', target: 'target-right' };
      } else if (dy > 0) {
        if (totalEdgesForPair > 1) {
          const handleVariant = edgeIndex % 2;
          return handleVariant === 0
            ? { source: 'source-left', target: 'target-right' }
            : { source: 'source-bottom', target: 'target-top' };
        }
        return { source: 'source-left', target: 'target-right' };
      } else {
        return { source: 'source-left', target: 'target-right' };
      }
    }
  }
};

/**
 * Optimize edge handles based on actual node positions after layout
 */
export const optimizeEdgeHandles = (
  positionedNodes: Node[],
  edgesToOptimize: Edge[]
): Edge[] => {
  // Build position map from actual layouted positions
  const actualPositions = new Map<string, NodePosition>();
  positionedNodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const level = getNodeRank(nodeData.nodeType);
    actualPositions.set(node.id, { 
      x: node.position.x, 
      y: node.position.y, 
      level 
    });
  });
  
  // Count edges between pairs for spreading
  const pairCounts = new Map<string, number>();
  const pairIndices = new Map<string, number>();
  edgesToOptimize.forEach(edge => {
    const pairKey = [edge.source, edge.target].sort().join('|');
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
  });
  
  // Optimize each edge's handles based on actual positions
  return edgesToOptimize.map(edge => {
    const sourcePos = actualPositions.get(edge.source);
    const targetPos = actualPositions.get(edge.target);
    
    if (!sourcePos || !targetPos) return edge;
    
    // Get edge index for spreading
    const pairKey = [edge.source, edge.target].sort().join('|');
    const edgeIndex = pairIndices.get(pairKey) || 0;
    pairIndices.set(pairKey, edgeIndex + 1);
    const totalEdges = pairCounts.get(pairKey) || 1;
    
    // Calculate optimal handles based on actual positions
    const handles = getOptimalHandles(sourcePos, targetPos, '', edgeIndex, totalEdges);
    
    return {
      ...edge,
      sourceHandle: handles.source,
      targetHandle: handles.target,
    };
  });
};

// =============================================================================
// A* PATHFINDING FOR SMART EDGES (Currently disabled for performance)
// =============================================================================

// A* pathfinding constants
export const SMART_EDGE_GRID_SIZE = 10;
export const SMART_EDGE_NODE_PADDING = 25;
export const SMART_EDGE_NODE_WIDTH = 200;
export const SMART_EDGE_NODE_HEIGHT = 60;

/**
 * Simple priority queue for A* algorithm
 */
export class SmartEdgePriorityQueue {
  private items: Array<{ gx: number; gy: number; priority: number }> = [];
  
  push(gx: number, gy: number, priority: number) {
    this.items.push({ gx, gy, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }
  
  pop() {
    return this.items.shift();
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
}

/**
 * A* pathfinding for smart edges
 * Finds a path around obstacles (nodes) from start to end
 */
export function findSmartEdgePath(
  startX: number, startY: number,
  endX: number, endY: number,
  obstacles: Array<{ x: number; y: number; width: number; height: number }>
): Array<{ x: number; y: number }> | null {
  const gridSize = SMART_EDGE_GRID_SIZE;
  const padding = SMART_EDGE_NODE_PADDING;
  
  const toGrid = (x: number, y: number) => ({
    gx: Math.round(x / gridSize),
    gy: Math.round(y / gridSize)
  });
  
  const fromGrid = (gx: number, gy: number) => ({
    x: gx * gridSize,
    y: gy * gridSize
  });
  
  const startGrid = toGrid(startX, startY);
  const endGrid = toGrid(endX, endY);
  
  // Build obstacle set
  const obstacleSet = new Set<string>();
  obstacles.forEach(obs => {
    const minGx = Math.floor((obs.x - padding) / gridSize);
    const maxGx = Math.ceil((obs.x + obs.width + padding) / gridSize);
    const minGy = Math.floor((obs.y - padding) / gridSize);
    const maxGy = Math.ceil((obs.y + obs.height + padding) / gridSize);
    
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        obstacleSet.add(`${gx},${gy}`);
      }
    }
  });
  
  const heuristic = (gx: number, gy: number) => 
    Math.abs(gx - endGrid.gx) + Math.abs(gy - endGrid.gy);
  
  const openSet = new SmartEdgePriorityQueue();
  const cameFrom = new Map<string, { gx: number; gy: number }>();
  const gScore = new Map<string, number>();
  
  const key = (gx: number, gy: number) => `${gx},${gy}`;
  
  gScore.set(key(startGrid.gx, startGrid.gy), 0);
  openSet.push(startGrid.gx, startGrid.gy, heuristic(startGrid.gx, startGrid.gy));
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];
  
  // Calculate bounds
  const allX = [startX, endX, ...obstacles.flatMap(o => [o.x, o.x + o.width])];
  const allY = [startY, endY, ...obstacles.flatMap(o => [o.y, o.y + o.height])];
  const minGx = Math.floor((Math.min(...allX) - 300) / gridSize);
  const maxGx = Math.ceil((Math.max(...allX) + 300) / gridSize);
  const minGy = Math.floor((Math.min(...allY) - 300) / gridSize);
  const maxGy = Math.ceil((Math.max(...allY) + 300) / gridSize);
  
  let iterations = 0;
  const maxIterations = 5000;
  
  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.pop()!;
    
    if (current.gx === endGrid.gx && current.gy === endGrid.gy) {
      const path: Array<{ x: number; y: number }> = [];
      let curr: { gx: number; gy: number } | undefined = current;
      
      while (curr) {
        path.unshift(fromGrid(curr.gx, curr.gy));
        curr = cameFrom.get(key(curr.gx, curr.gy));
      }
      
      // Simplify path
      const simplified: Array<{ x: number; y: number }> = [path[0]];
      for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const currPath = path[i];
        const next = path[i + 1];
        
        const dx1 = currPath.x - prev.x;
        const dy1 = currPath.y - prev.y;
        const dx2 = next.x - currPath.x;
        const dy2 = next.y - currPath.y;
        
        if (dx1 !== dx2 || dy1 !== dy2) {
          simplified.push(currPath);
        }
      }
      simplified.push(path[path.length - 1]);
      
      return simplified;
    }
    
    for (const dir of directions) {
      const nx = current.gx + dir.dx;
      const ny = current.gy + dir.dy;
      
      if (nx < minGx || nx > maxGx || ny < minGy || ny > maxGy) continue;
      
      const nKey = key(nx, ny);
      if (obstacleSet.has(nKey) && !(nx === endGrid.gx && ny === endGrid.gy)) continue;
      
      const tentativeG = (gScore.get(key(current.gx, current.gy)) || Infinity) + 1;
      
      if (tentativeG < (gScore.get(nKey) || Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        openSet.push(nx, ny, tentativeG + heuristic(nx, ny));
      }
    }
  }
  
  return null;
}

/**
 * Convert path to SVG path string
 */
export function pathToSvgD(path: Array<{ x: number; y: number }>): string {
  if (path.length === 0) return '';
  
  let d = `M ${path[0].x} ${path[0].y}`;
  
  for (let i = 1; i < path.length; i++) {
    d += ` L ${path[i].x} ${path[i].y}`;
  }
  
  return d;
}
