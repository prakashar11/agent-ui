/**
 * A* Pathfinding utilities for smart edge routing
 */

import { NODE_WIDTH, NODE_HEIGHT } from './layoutUtils';

// Priority Queue implementation using a sorted array (simple and fast for small graphs)
export interface GridCell {
  gx: number;
  gy: number;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A* pathfinding algorithm for edge routing around nodes
 */
export function findPathAStar(
  start: Point,
  end: Point,
  obstacles: Obstacle[],
  bounds: Bounds
): Point[] | null {
  const GRID_SIZE = 20;
  
  // Convert world coordinates to grid
  const toGrid = (x: number, y: number): GridCell => ({
    gx: Math.round(x / GRID_SIZE),
    gy: Math.round(y / GRID_SIZE),
  });
  
  const fromGrid = (gx: number, gy: number): Point => ({
    x: gx * GRID_SIZE,
    y: gy * GRID_SIZE,
  });
  
  const startGrid = toGrid(start.x, start.y);
  const endGrid = toGrid(end.x, end.y);
  
  // Create obstacle grid (cells that are blocked)
  const obstacleSet = new Set<string>();
  obstacles.forEach(obs => {
    const padding = GRID_SIZE / 2;
    const startGx = Math.floor((obs.x - padding) / GRID_SIZE);
    const endGx = Math.ceil((obs.x + obs.width + padding) / GRID_SIZE);
    const startGy = Math.floor((obs.y - padding) / GRID_SIZE);
    const endGy = Math.ceil((obs.y + obs.height + padding) / GRID_SIZE);
    
    for (let gx = startGx; gx <= endGx; gx++) {
      for (let gy = startGy; gy <= endGy; gy++) {
        obstacleSet.add(`${gx},${gy}`);
      }
    }
  });
  
  // Heuristic: Manhattan distance
  const heuristic = (gx: number, gy: number): number => {
    return Math.abs(gx - endGrid.gx) + Math.abs(gy - endGrid.gy);
  };
  
  // A* implementation
  const key = (gx: number, gy: number): string => `${gx},${gy}`;
  
  // Simple sorted array for priority queue
  const openSet: Array<{ cell: GridCell; f: number }> = [];
  const addToOpenSet = (cell: GridCell, f: number) => {
    // Insert maintaining sort order
    const idx = openSet.findIndex(item => item.f > f);
    if (idx === -1) {
      openSet.push({ cell, f });
    } else {
      openSet.splice(idx, 0, { cell, f });
    }
  };
  
  const cameFrom = new Map<string, GridCell>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  const startKey = key(startGrid.gx, startGrid.gy);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(startGrid.gx, startGrid.gy));
  addToOpenSet(startGrid, fScore.get(startKey)!);
  
  // Direction vectors (8-way movement)
  const directions = [
    { dx: 0, dy: -1 },  // up
    { dx: 1, dy: 0 },   // right
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 },  // left
    { dx: 1, dy: -1 },  // up-right
    { dx: 1, dy: 1 },   // down-right
    { dx: -1, dy: 1 },  // down-left
    { dx: -1, dy: -1 }, // up-left
  ];
  
  // Bounds for search area
  const minGx = Math.floor(bounds.minX / GRID_SIZE);
  const maxGx = Math.ceil(bounds.maxX / GRID_SIZE);
  const minGy = Math.floor(bounds.minY / GRID_SIZE);
  const maxGy = Math.ceil(bounds.maxY / GRID_SIZE);
  
  let iterations = 0;
  const maxIterations = 5000;
  
  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    
    // Get cell with lowest f score
    const currentItem = openSet.shift()!;
    const current = currentItem.cell;
    
    // Check if we reached the goal
    if (current.gx === endGrid.gx && current.gy === endGrid.gy) {
      // Reconstruct path
      const path: Point[] = [];
      let curr: GridCell | undefined = current;
      
      while (curr) {
        path.unshift(fromGrid(curr.gx, curr.gy));
        curr = cameFrom.get(key(curr.gx, curr.gy));
      }
      
      // Simplify path (remove intermediate points on straight lines)
      const simplified: Point[] = [path[0]];
      for (let i = 1; i < path.length - 1; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const next = path[i + 1];
        
        // Check if direction changes
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;
        
        if (dx1 !== dx2 || dy1 !== dy2) {
          simplified.push(curr);
        }
      }
      simplified.push(path[path.length - 1]);
      
      return simplified;
    }
    
    // Explore neighbors
    for (const dir of directions) {
      const nx = current.gx + dir.dx;
      const ny = current.gy + dir.dy;
      
      // Bounds check
      if (nx < minGx || nx > maxGx || ny < minGy || ny > maxGy) continue;
      
      // Obstacle check (allow end position even if in obstacle)
      const nKey = key(nx, ny);
      if (obstacleSet.has(nKey) && !(nx === endGrid.gx && ny === endGrid.gy)) continue;
      
      const tentativeG = (gScore.get(key(current.gx, current.gy)) || Infinity) + 1;
      
      if (tentativeG < (gScore.get(nKey) || Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        const f = tentativeG + heuristic(nx, ny);
        fScore.set(nKey, f);
        addToOpenSet({ gx: nx, gy: ny }, f);
      }
    }
  }
  
  // No path found
  return null;
}

/**
 * Get handle position offset relative to node
 */
export function getHandleOffset(handle: string): Point {
  switch (handle) {
    case 'source-top':
    case 'target-top':
      return { x: NODE_WIDTH / 2, y: 0 };
    case 'source-bottom':
    case 'target-bottom':
      return { x: NODE_WIDTH / 2, y: NODE_HEIGHT };
    case 'source-left':
    case 'target-left':
      return { x: 0, y: NODE_HEIGHT / 2 };
    case 'source-right':
    case 'target-right':
      return { x: NODE_WIDTH, y: NODE_HEIGHT / 2 };
    default:
      return { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 };
  }
}

/**
 * Calculate optimal handles based on relative positions using A* pathfinding
 */
export function getOptimalHandlesAStar(
  sourceId: string,
  targetId: string,
  sourcePos: Point,
  targetPos: Point,
  allNodePositions: Map<string, Point>
): { sourceHandle: string; targetHandle: string; path?: Point[] } {
  // Calculate center positions for angle-based default
  const sourceCenterX = sourcePos.x + NODE_WIDTH / 2;
  const sourceCenterY = sourcePos.y + NODE_HEIGHT / 2;
  const targetCenterX = targetPos.x + NODE_WIDTH / 2;
  const targetCenterY = targetPos.y + NODE_HEIGHT / 2;
  
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // Get initial angle-based handles
  let defaultHandles: { source: string; target: string };
  if (angle >= -45 && angle < 45) {
    defaultHandles = { source: 'source-right', target: 'target-left' };
  } else if (angle >= 45 && angle < 135) {
    defaultHandles = { source: 'source-bottom', target: 'target-top' };
  } else if (angle >= 135 || angle < -135) {
    defaultHandles = { source: 'source-left', target: 'target-right' };
  } else {
    defaultHandles = { source: 'source-top', target: 'target-bottom' };
  }
  
  // Build obstacle list (other nodes)
  const obstacles = [...allNodePositions.entries()]
    .filter(([id]) => id !== sourceId && id !== targetId)
    .map(([, pos]) => ({
      x: pos.x,
      y: pos.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    }));
  
  // If no obstacles, return default handles
  if (obstacles.length === 0) {
    return { sourceHandle: defaultHandles.source, targetHandle: defaultHandles.target };
  }
  
  // Calculate start/end points based on default handles
  const srcOffset = getHandleOffset(defaultHandles.source);
  const tgtOffset = getHandleOffset(defaultHandles.target);
  const start = { x: sourcePos.x + srcOffset.x, y: sourcePos.y + srcOffset.y };
  const end = { x: targetPos.x + tgtOffset.x, y: targetPos.y + tgtOffset.y };
  
  // Calculate bounds for A* search - generous margins for routing around obstacles
  const allX = [start.x, end.x, ...obstacles.flatMap(o => [o.x, o.x + o.width])];
  const allY = [start.y, end.y, ...obstacles.flatMap(o => [o.y, o.y + o.height])];
  const bounds = {
    minX: Math.min(...allX) - 300,
    maxX: Math.max(...allX) + 300,
    minY: Math.min(...allY) - 300,
    maxY: Math.max(...allY) + 300
  };
  
  // Try A* pathfinding
  const path = findPathAStar(start, end, obstacles, bounds);
  
  if (path && path.length > 0) {
    // Determine best handles based on the A* path direction
    const firstMove = path.length > 1 
      ? { dx: path[1].x - path[0].x, dy: path[1].y - path[0].y }
      : { dx, dy };
    const lastMove = path.length > 1
      ? { dx: path[path.length - 1].x - path[path.length - 2].x, dy: path[path.length - 1].y - path[path.length - 2].y }
      : { dx, dy };
    
    // Choose source handle based on first move direction
    let sourceHandle: string;
    if (Math.abs(firstMove.dx) > Math.abs(firstMove.dy)) {
      sourceHandle = firstMove.dx > 0 ? 'source-right' : 'source-left';
    } else {
      sourceHandle = firstMove.dy > 0 ? 'source-bottom' : 'source-top';
    }
    
    // Choose target handle based on last move direction
    let targetHandle: string;
    if (Math.abs(lastMove.dx) > Math.abs(lastMove.dy)) {
      targetHandle = lastMove.dx > 0 ? 'target-left' : 'target-right';
    } else {
      targetHandle = lastMove.dy > 0 ? 'target-top' : 'target-bottom';
    }
    
    return { sourceHandle, targetHandle, path };
  }
  
  // Fall back to default handles if no path found
  return { sourceHandle: defaultHandles.source, targetHandle: defaultHandles.target };
}

export default findPathAStar;
