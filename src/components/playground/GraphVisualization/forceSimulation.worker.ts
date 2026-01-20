/**
 * Force Simulation Web Worker
 * 
 * Runs force-directed layout simulation off the main thread for better performance.
 * Uses Barnes-Hut quadtree for efficient O(n log n) repulsion calculation.
 * 
 * This file is self-contained and doesn't import from modules that use DOM/React.
 */

import type {
  WorkerSimNode,
  WorkerSimEdge,
  WorkerForceConfig,
  WorkerQuadTreeNode,
  WorkerSimulationState,
  ForceWorkerMessage,
  ForceWorkerStartPayload,
} from './forceSimulation.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const QUADTREE_MAX_DEPTH = 20;

const DEFAULT_CONFIG: WorkerForceConfig = {
  repulsion: 3000,
  springLength: 350,
  springStrength: 0.04,
  seedAttractionBoost: 1.3,
  damping: 0.8,
  hierarchyForce: 0.15,
  levelSpacing: 350,
  theta: 0.6,
  maxIterations: 120,
  convergenceThreshold: 0.3,
  fastModeThreshold: 80,
  gridFallbackThreshold: 250,
  minNodeSpacing: 250,
  sameLevelRepulsionBoost: 2.5,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const safeNumber = (value: number, fallback: number = 0): number => {
  return Number.isFinite(value) ? value : fallback;
};

const clampForce = (fx: number, fy: number, maxMagnitude: number = 100): { fx: number; fy: number } => {
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
// QUADTREE FUNCTIONS
// =============================================================================

const buildQuadTree = (nodes: WorkerSimNode[]): WorkerQuadTreeNode | null => {
  if (nodes.length === 0) return null;
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  
  const size = Math.max(maxX - minX, maxY - minY, 100) * 1.2 + 10;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  const root: WorkerQuadTreeNode = {
    x: 0, y: 0, mass: 0,
    size,
    centerX,
    centerY,
    depth: 0,
    children: [null, null, null, null],
    bodies: [],
  };
  
  for (const node of nodes) {
    insertIntoQuadTree(root, node);
  }
  
  calculateCenterOfMass(root);
  
  return root;
};

const getQuadrant = (quad: WorkerQuadTreeNode, x: number, y: number): number => {
  const isEast = x >= quad.centerX;
  const isSouth = y >= quad.centerY;
  return (isSouth ? 2 : 0) + (isEast ? 1 : 0);
};

const createChildQuad = (parent: WorkerQuadTreeNode, quadrant: number): WorkerQuadTreeNode => {
  const halfSize = parent.size / 2;
  const quarterSize = halfSize / 2;
  
  const offsetX = (quadrant % 2 === 1) ? quarterSize : -quarterSize;
  const offsetY = (quadrant >= 2) ? quarterSize : -quarterSize;
  
  return {
    x: 0, y: 0, mass: 0,
    size: halfSize,
    centerX: parent.centerX + offsetX,
    centerY: parent.centerY + offsetY,
    depth: parent.depth + 1,
    children: [null, null, null, null],
    bodies: [],
  };
};

const insertIntoQuadTree = (quad: WorkerQuadTreeNode, node: WorkerSimNode): void => {
  quad.mass += node.mass;
  
  if (quad.depth >= QUADTREE_MAX_DEPTH) {
    quad.bodies.push(node);
    return;
  }
  
  if (quad.bodies.length === 0 && !quad.children.some(c => c !== null)) {
    quad.bodies.push(node);
    return;
  }
  
  if (quad.bodies.length === 1 && !quad.children.some(c => c !== null)) {
    const existingBody = quad.bodies[0];
    quad.bodies = [];
    
    const existingQuadrant = getQuadrant(quad, existingBody.x, existingBody.y);
    if (!quad.children[existingQuadrant]) {
      quad.children[existingQuadrant] = createChildQuad(quad, existingQuadrant);
    }
    insertIntoQuadTree(quad.children[existingQuadrant]!, existingBody);
  }
  
  const quadrant = getQuadrant(quad, node.x, node.y);
  if (!quad.children[quadrant]) {
    quad.children[quadrant] = createChildQuad(quad, quadrant);
  }
  insertIntoQuadTree(quad.children[quadrant]!, node);
};

const calculateCenterOfMass = (quad: WorkerQuadTreeNode): void => {
  const hasChildren = quad.children.some(c => c !== null);
  
  if (!hasChildren && quad.bodies.length > 0) {
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;
    
    for (const body of quad.bodies) {
      totalMass += body.mass;
      weightedX += body.x * body.mass;
      weightedY += body.y * body.mass;
    }
    
    if (totalMass > 0) {
      quad.mass = totalMass;
      quad.x = weightedX / totalMass;
      quad.y = weightedY / totalMass;
    }
    return;
  }
  
  let totalMass = 0;
  let weightedX = 0;
  let weightedY = 0;
  
  for (const child of quad.children) {
    if (child !== null) {
      calculateCenterOfMass(child);
      totalMass += child.mass;
      weightedX += child.x * child.mass;
      weightedY += child.y * child.mass;
    }
  }
  
  if (totalMass > 0) {
    quad.mass = totalMass;
    quad.x = weightedX / totalMass;
    quad.y = weightedY / totalMass;
  }
};

const isLeafQuad = (quad: WorkerQuadTreeNode): boolean => {
  return quad.bodies.length > 0 && !quad.children.some(c => c !== null);
};

const quadContainsNode = (quad: WorkerQuadTreeNode, node: WorkerSimNode): boolean => {
  return quad.bodies.some(b => b.id === node.id);
};

const calculateRepulsionFromQuadTree = (
  node: WorkerSimNode,
  quad: WorkerQuadTreeNode | null,
  theta: number,
  repulsion: number
): { fx: number; fy: number } => {
  if (quad === null || quad.mass === 0) {
    return { fx: 0, fy: 0 };
  }
  
  const dx = node.x - quad.x;
  const dy = node.y - quad.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq) || 0.01;
  
  const isLeaf = isLeafQuad(quad);
  
  if (isLeaf && quad.bodies.length === 1 && quad.bodies[0].id === node.id) {
    return { fx: 0, fy: 0 };
  }
  
  if (isLeaf || (quad.size / dist) < theta) {
    if (isLeaf && quadContainsNode(quad, node)) {
      let fx = 0, fy = 0;
      for (const body of quad.bodies) {
        if (body.id === node.id) continue;
        
        const bdx = node.x - body.x;
        const bdy = node.y - body.y;
        const bdistSq = bdx * bdx + bdy * bdy;
        const bdist = Math.sqrt(bdistSq) || 0.01;
        
        const softening = 50;
        const force = repulsion * node.mass * body.mass / (bdistSq + softening);
        fx += (bdx / bdist) * force;
        fy += (bdy / bdist) * force;
      }
      return { fx, fy };
    }
    
    const softening = 50;
    const force = repulsion * node.mass * quad.mass / (distSq + softening);
    return {
      fx: (dx / dist) * force,
      fy: (dy / dist) * force,
    };
  }
  
  let fx = 0, fy = 0;
  for (const child of quad.children) {
    if (child !== null) {
      const childForce = calculateRepulsionFromQuadTree(node, child, theta, repulsion);
      fx += childForce.fx;
      fy += childForce.fy;
    }
  }
  
  return { fx, fy };
};

// =============================================================================
// SIMULATION CORE
// =============================================================================

interface SimulationResult {
  nodes: WorkerSimNode[];
  iteration: number;
  maxVelocity: number;
  converged: boolean;
}

/**
 * Run a single iteration of the force simulation
 */
const runSimulationIteration = (
  simNodes: WorkerSimNode[],
  simEdges: Array<{ source: WorkerSimNode; target: WorkerSimNode }>,
  config: WorkerForceConfig
): number => {
  const { repulsion, springLength, springStrength, seedAttractionBoost, 
          damping, hierarchyForce, levelSpacing, theta,
          sameLevelRepulsionBoost, minNodeSpacing } = config;
  
  // Build quadtree
  const quadTree = buildQuadTree(simNodes);
  
  // Group nodes by hierarchy level for same-level repulsion
  const nodesByLevel: Map<number, WorkerSimNode[]> = new Map();
  for (const node of simNodes) {
    if (!nodesByLevel.has(node.hierarchyLevel)) {
      nodesByLevel.set(node.hierarchyLevel, []);
    }
    nodesByLevel.get(node.hierarchyLevel)!.push(node);
  }
  
  // Apply forces to each node
  for (const node of simNodes) {
    if (node.fx !== null && node.fy !== null) continue;
    
    let repulsionForce = { fx: 0, fy: 0 };
    if (quadTree) {
      repulsionForce = calculateRepulsionFromQuadTree(node, quadTree, theta, repulsion);
      repulsionForce = clampForce(repulsionForce.fx, repulsionForce.fy, 200);
    }
    
    node.vx += safeNumber(repulsionForce.fx / node.mass, 0);
    node.vy += safeNumber(repulsionForce.fy / node.mass, 0);
    
    const targetY = node.hierarchyLevel * levelSpacing;
    const hierarchyDiff = safeNumber(targetY - node.y, 0);
    node.vy += hierarchyDiff * hierarchyForce;
  }
  
  // Apply same-level horizontal repulsion
  for (const [, nodesAtLevel] of nodesByLevel) {
    if (nodesAtLevel.length < 2) continue;
    
    for (let i = 0; i < nodesAtLevel.length; i++) {
      const nodeA = nodesAtLevel[i];
      if (nodeA.fx !== null) continue;
      
      for (let j = i + 1; j < nodesAtLevel.length; j++) {
        const nodeB = nodesAtLevel[j];
        
        const dx = nodeA.x - nodeB.x;
        const absDx = Math.abs(dx);
        
        if (absDx < minNodeSpacing) {
          const overlap = minNodeSpacing - absDx;
          const pushForce = overlap * sameLevelRepulsionBoost;
          const direction = dx >= 0 ? 1 : -1;
          
          if (nodeA.fx === null) nodeA.vx += direction * pushForce / nodeA.mass;
          if (nodeB.fx === null) nodeB.vx -= direction * pushForce / nodeB.mass;
        }
      }
    }
  }
  
  // Apply spring forces
  for (const edge of simEdges) {
    const { source, target } = edge;
    
    const dx = safeNumber(target.x - source.x, 0.1);
    const dy = safeNumber(target.y - source.y, 0.1);
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);
    
    if (dist < 0.01) continue;
    
    const displacement = dist - springLength;
    let force = displacement * springStrength;
    
    if (!source.isSeed && target.isSeed) {
      force *= seedAttractionBoost;
    } else if (source.isSeed && !target.isSeed) {
      force *= seedAttractionBoost;
    }
    
    const rawFx = (dx / dist) * force;
    const rawFy = (dy / dist) * force;
    const clamped = clampForce(rawFx, rawFy, 80);
    
    if (source.fx === null) source.vx += safeNumber(clamped.fx / source.mass, 0);
    if (source.fy === null) source.vy += safeNumber(clamped.fy / source.mass, 0);
    if (target.fx === null) target.vx -= safeNumber(clamped.fx / target.mass, 0);
    if (target.fy === null) target.vy -= safeNumber(clamped.fy / target.mass, 0);
  }
  
  // Apply velocities and damping
  let maxVelocity = 0;
  for (const node of simNodes) {
    node.vx = safeNumber(node.vx * damping, 0);
    node.vy = safeNumber(node.vy * damping, 0);
    
    const velMagnitude = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    const maxVel = 50;
    if (velMagnitude > maxVel) {
      node.vx = (node.vx / velMagnitude) * maxVel;
      node.vy = (node.vy / velMagnitude) * maxVel;
    }
    
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
    
    const velocity = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (Number.isFinite(velocity)) {
      maxVelocity = Math.max(maxVelocity, velocity);
    }
  }
  
  return maxVelocity;
};

/**
 * Run simulation for multiple iterations with progress callbacks
 */
const runSimulation = (
  state: WorkerSimulationState,
  progressInterval: number
): void => {
  const { nodes, edges, config, totalIterations } = state;
  const { convergenceThreshold, levelSpacing } = config;
  
  // Build simulation edges with node references
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const simEdges = edges
    .filter(e => nodeMap.has(e.sourceId) && nodeMap.has(e.targetId))
    .map(e => ({
      source: nodeMap.get(e.sourceId)!,
      target: nodeMap.get(e.targetId)!,
    }));
  
  // Validate initial positions
  for (const node of nodes) {
    node.x = safeNumber(node.x, 0);
    node.y = safeNumber(node.y, node.hierarchyLevel * levelSpacing);
    node.vx = safeNumber(node.vx, 0);
    node.vy = safeNumber(node.vy, 0);
  }
  
  let convergedEarly = false;
  
  while (state.isRunning && state.currentIteration < totalIterations) {
    const maxVelocity = runSimulationIteration(nodes, simEdges, config);
    state.currentIteration++;
    
    // Send progress update at intervals
    if (state.currentIteration % progressInterval === 0) {
      self.postMessage({
        type: 'SIMULATION_PROGRESS',
        payload: {
          currentIteration: state.currentIteration,
          totalIterations,
          maxVelocity,
          nodes: nodes.map(n => ({ ...n })), // Clone for transfer
        },
      });
    }
    
    // Check for convergence
    if (maxVelocity < convergenceThreshold) {
      convergedEarly = true;
      break;
    }
  }
  
  // Send completion message
  const elapsed = performance.now() - state.startTime;
  self.postMessage({
    type: 'SIMULATION_COMPLETE',
    payload: {
      nodes: nodes.map(n => ({ ...n })),
      iterations: state.currentIteration,
      convergedEarly,
      finalMaxVelocity: 0,
      elapsedMs: elapsed,
    },
  });
  
  state.isRunning = false;
};

// =============================================================================
// WORKER MESSAGE HANDLER
// =============================================================================

let currentState: WorkerSimulationState | null = null;

self.onmessage = (event: MessageEvent<ForceWorkerMessage>) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'START_SIMULATION': {
      // Stop any existing simulation
      if (currentState) {
        currentState.isRunning = false;
      }
      
      const startPayload = payload as ForceWorkerStartPayload;
      const { nodes, edges, iterations, config, progressInterval = 10 } = startPayload;
      
      currentState = {
        isRunning: true,
        nodes: nodes.map(n => ({ ...n })), // Clone nodes
        edges: edges.map(e => ({ ...e })), // Clone edges
        currentIteration: 0,
        totalIterations: iterations,
        config: { ...DEFAULT_CONFIG, ...config },
        startTime: performance.now(),
      };
      
      // Run simulation (will post progress and completion messages)
      try {
        runSimulation(currentState, progressInterval);
      } catch (error) {
        self.postMessage({
          type: 'SIMULATION_ERROR',
          payload: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      break;
    }
    
    case 'STOP_SIMULATION': {
      if (currentState) {
        currentState.isRunning = false;
      }
      break;
    }
    
    case 'UPDATE_CONFIG': {
      // Config updates for future simulations (not applied to running)
      break;
    }
    
    default:
      console.warn('[ForceWorker] Unknown message type:', type);
  }
};

// Export empty object for TypeScript module resolution
export {};
