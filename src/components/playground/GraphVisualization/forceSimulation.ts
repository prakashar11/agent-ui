/**
 * Force-directed layout simulation with seed anchoring
 * Uses Barnes-Hut quadtree for efficient O(n log n) repulsion calculation
 */

import type { Node } from '@xyflow/react';
import { 
  type SimNode, 
  type QuadTreeNode,
  buildQuadTree, 
  calculateRepulsionFromQuadTree 
} from './quadtree';

// Re-export SimNode for convenience
export type { SimNode } from './quadtree';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Force simulation configuration - tuned for security graphs
export const FORCE_CONFIG = {
  // Repulsion between all nodes (electrostatic) - very high to prevent overlap
  repulsion: 3000,
  // Ideal spring length for edges - generous space for readability
  springLength: 350,
  // Spring strength (edge attraction) - weak to prioritize spacing
  springStrength: 0.04,
  // Extra attraction for non-seeds toward seeds
  seedAttractionBoost: 1.3,
  // Velocity damping per iteration (0-1)
  damping: 0.8,
  // Force pulling nodes toward their hierarchy Y-level
  hierarchyForce: 0.15,
  // Spacing between hierarchy levels - generous
  levelSpacing: 350,
  // Barnes-Hut theta (accuracy vs speed tradeoff, lower = more accurate)
  theta: 0.6,
  // Maximum iterations for simulation - more iterations for better spread
  maxIterations: 120,
  // Convergence threshold (stop when max velocity < this)
  convergenceThreshold: 0.3,
  // Node count thresholds for adaptive behavior
  fastModeThreshold: 80,       // Use reduced iterations above this
  gridFallbackThreshold: 250,  // Fall back to grid layout above this
  // Minimum spacing between nodes in same row - accounts for node width
  minNodeSpacing: 250,
  // Extra repulsion multiplier for nodes at same hierarchy level
  sameLevelRepulsionBoost: 2.5,
} as const;

export type ForceConfig = typeof FORCE_CONFIG;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Ensure a number is finite, with fallback
 */
export const safeNumber = (value: number, fallback: number = 0): number => {
  return Number.isFinite(value) ? value : fallback;
};

/**
 * Clamp force magnitude to prevent explosion
 */
export const clampForce = (fx: number, fy: number, maxMagnitude: number = 100): { fx: number; fy: number } => {
  const magnitude = Math.sqrt(fx * fx + fy * fy);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return { fx: 0, fy: 0 };
  }
  if (magnitude > maxMagnitude) {
    const scale = maxMagnitude / magnitude;
    return { fx: fx * scale, fy: fy * scale };
  }
  return { fx, fy };
};

// =============================================================================
// SIMULATION FUNCTIONS
// =============================================================================

/**
 * Run force simulation for a batch of iterations
 * Modifies simNodes in place
 */
export const runForceSimulation = (
  simNodes: SimNode[],
  simEdges: Array<{ source: SimNode; target: SimNode }>,
  iterations: number,
  config: ForceConfig = FORCE_CONFIG
): void => {
  const { repulsion, springLength, springStrength, seedAttractionBoost, 
          damping, hierarchyForce, levelSpacing, theta, convergenceThreshold,
          sameLevelRepulsionBoost, minNodeSpacing } = config;
  
  // Validate initial positions
  for (const node of simNodes) {
    node.x = safeNumber(node.x, 0);
    node.y = safeNumber(node.y, node.hierarchyLevel * levelSpacing);
    node.vx = safeNumber(node.vx, 0);
    node.vy = safeNumber(node.vy, 0);
  }
  
  // Group nodes by hierarchy level for same-level repulsion
  const nodesByLevel: Map<number, SimNode[]> = new Map();
  for (const node of simNodes) {
    if (!nodesByLevel.has(node.hierarchyLevel)) {
      nodesByLevel.set(node.hierarchyLevel, []);
    }
    nodesByLevel.get(node.hierarchyLevel)!.push(node);
  }
  
  for (let iter = 0; iter < iterations; iter++) {
    // Build quadtree for this iteration
    const quadTree = buildQuadTree(simNodes);
    
    // Apply forces to each node
    for (const node of simNodes) {
      // Skip fully fixed nodes
      if (node.fx !== null && node.fy !== null) continue;
      
      // Calculate repulsion using Barnes-Hut (with safety)
      let repulsionForce = { fx: 0, fy: 0 };
      if (quadTree) {
        repulsionForce = calculateRepulsionFromQuadTree(node, quadTree, theta, repulsion);
        repulsionForce = clampForce(repulsionForce.fx, repulsionForce.fy, 200);
      }
      
      node.vx += safeNumber(repulsionForce.fx / node.mass, 0);
      node.vy += safeNumber(repulsionForce.fy / node.mass, 0);
      
      // Hierarchy force - pull toward target Y level
      const targetY = node.hierarchyLevel * levelSpacing;
      const hierarchyDiff = safeNumber(targetY - node.y, 0);
      node.vy += hierarchyDiff * hierarchyForce;
    }
    
    // Apply EXTRA same-level horizontal repulsion (critical for preventing overlap)
    // This runs in O(n²) for nodes at the same level, but levels are typically small
    for (const [, nodesAtLevel] of nodesByLevel) {
      if (nodesAtLevel.length < 2) continue;
      
      for (let i = 0; i < nodesAtLevel.length; i++) {
        const nodeA = nodesAtLevel[i];
        if (nodeA.fx !== null) continue; // Skip if X is fixed
        
        for (let j = i + 1; j < nodesAtLevel.length; j++) {
          const nodeB = nodesAtLevel[j];
          
          // Calculate horizontal distance
          const dx = nodeA.x - nodeB.x;
          const absDx = Math.abs(dx);
          
          // If nodes are too close horizontally, push them apart
          if (absDx < minNodeSpacing) {
            // Strong horizontal repulsion force
            const overlap = minNodeSpacing - absDx;
            const pushForce = overlap * sameLevelRepulsionBoost;
            
            // Direction: push away from each other
            const direction = dx >= 0 ? 1 : -1;
            
            if (nodeA.fx === null) nodeA.vx += direction * pushForce / nodeA.mass;
            if (nodeB.fx === null) nodeB.vx -= direction * pushForce / nodeB.mass;
          }
        }
      }
    }
    
    // Apply spring forces (edge attraction)
    for (const edge of simEdges) {
      const { source, target } = edge;
      
      const dx = safeNumber(target.x - source.x, 0.1);
      const dy = safeNumber(target.y - source.y, 0.1);
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      
      // Skip if nodes are at same position (avoid division by zero)
      if (dist < 0.01) continue;
      
      const displacement = dist - springLength;
      
      // Calculate spring force
      let force = displacement * springStrength;
      
      // Boost attraction for non-seed nodes toward seeds
      if (!source.isSeed && target.isSeed) {
        force *= seedAttractionBoost;
      } else if (source.isSeed && !target.isSeed) {
        force *= seedAttractionBoost;
      }
      
      const rawFx = (dx / dist) * force;
      const rawFy = (dy / dist) * force;
      const clamped = clampForce(rawFx, rawFy, 80);
      
      // Apply to both nodes (unless fixed)
      if (source.fx === null) source.vx += safeNumber(clamped.fx / source.mass, 0);
      if (source.fy === null) source.vy += safeNumber(clamped.fy / source.mass, 0);
      if (target.fx === null) target.vx -= safeNumber(clamped.fx / target.mass, 0);
      if (target.fy === null) target.vy -= safeNumber(clamped.fy / target.mass, 0);
    }
    
    // Apply velocities and damping
    let maxVelocity = 0;
    for (const node of simNodes) {
      // Apply damping
      node.vx = safeNumber(node.vx * damping, 0);
      node.vy = safeNumber(node.vy * damping, 0);
      
      // Clamp velocity to prevent explosion
      const velMagnitude = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      const maxVel = 50;
      if (velMagnitude > maxVel) {
        node.vx = (node.vx / velMagnitude) * maxVel;
        node.vy = (node.vy / velMagnitude) * maxVel;
      }
      
      // Update position (respect fixed coordinates)
      if (node.fx === null) {
        node.x = safeNumber(node.x + node.vx, node.x);
      } else {
        node.x = node.fx;
        node.vx = 0;
      }
      
      if (node.fy === null) {
        node.y = safeNumber(node.y + node.vy, node.y);
      } else {
        node.y = node.fy;
        node.vy = 0;
      }
      
      // Track max velocity for convergence check
      const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (Number.isFinite(velocity)) {
        maxVelocity = Math.max(maxVelocity, velocity);
      }
    }
    
    // Early termination if converged
    if (maxVelocity < convergenceThreshold) {
      // Early convergence - log for debugging
      if (iter < iterations - 1) {
        console.log(`[ForceLayout] Converged early at iteration ${iter + 1}/${iterations} (maxVelocity: ${maxVelocity.toFixed(2)})`);
      }
      break;
    }
  }
};

/**
 * Convert SimNodes back to positioned Nodes
 */
export const simNodesToLayout = (
  simNodes: SimNode[],
  nodeWidth: number,
  nodeHeight: number,
  config: ForceConfig = FORCE_CONFIG
): { nodes: Node[]; width: number; height: number } => {
  if (simNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }
  
  const { minNodeSpacing, levelSpacing } = config;
  
  // First pass: validate and fix any NaN positions
  simNodes.forEach((n, idx) => {
    if (!Number.isFinite(n.x)) {
      console.warn(`[ForceLayout] Node ${n.id} has invalid x position, using fallback`);
      n.x = idx * minNodeSpacing;
    }
    if (!Number.isFinite(n.y)) {
      console.warn(`[ForceLayout] Node ${n.id} has invalid y position, using fallback`);
      n.y = n.hierarchyLevel * levelSpacing;
    }
  });
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  simNodes.forEach(n => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  });
  
  // Ensure min values are finite
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxX)) maxX = simNodes.length * minNodeSpacing;
  if (!Number.isFinite(maxY)) maxY = 5 * levelSpacing;
  
  const layoutedNodes: Node[] = simNodes.map((simNode, idx) => {
    const posX = simNode.x - minX;
    const posY = simNode.y - minY;
    
    return {
      ...simNode.node,
      position: {
        x: Number.isFinite(posX) ? posX : idx * minNodeSpacing,
        y: Number.isFinite(posY) ? posY : simNode.hierarchyLevel * levelSpacing,
      },
    };
  });
  
  const width = Math.max(nodeWidth, maxX - minX + nodeWidth);
  const height = Math.max(nodeHeight, maxY - minY + nodeHeight);
  
  return { nodes: layoutedNodes, width, height };
};

/**
 * Calculate optimal iteration count based on node count
 */
export const getOptimalIterations = (nodeCount: number, config: ForceConfig = FORCE_CONFIG): number => {
  if (nodeCount > config.fastModeThreshold) {
    return Math.max(30, config.maxIterations - Math.floor(nodeCount / 5));
  }
  return config.maxIterations;
};

/**
 * Check if should fall back to grid layout
 */
export const shouldUseGridFallback = (nodeCount: number, config: ForceConfig = FORCE_CONFIG): boolean => {
  return nodeCount > config.gridFallbackThreshold;
};
