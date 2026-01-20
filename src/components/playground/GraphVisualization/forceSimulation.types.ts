/**
 * Types for Force Simulation Web Worker Communication
 * 
 * These types define the serializable data structures used for communication
 * between the main thread and the Web Worker running force simulation.
 */

// =============================================================================
// WORKER SIMULATION NODE (Serializable - no React/DOM references)
// =============================================================================

/**
 * Serializable node data for worker communication.
 * This is a subset of SimNode that can be passed to Web Workers.
 */
export interface WorkerSimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;  // Fixed X (null = free)
  fy: number | null;  // Fixed Y for hierarchy constraint
  mass: number;       // Higher mass = more inertia
  isSeed: boolean;    // Is this a seed node type?
  hierarchyLevel: number;
  // Original position data for reconstruction
  originalPosition: { x: number; y: number };
}

/**
 * Serializable edge for worker communication
 */
export interface WorkerSimEdge {
  sourceId: string;
  targetId: string;
}

// =============================================================================
// FORCE CONFIGURATION (Mirrors FORCE_CONFIG)
// =============================================================================

export interface WorkerForceConfig {
  repulsion: number;
  springLength: number;
  springStrength: number;
  seedAttractionBoost: number;
  damping: number;
  hierarchyForce: number;
  levelSpacing: number;
  theta: number;
  maxIterations: number;
  convergenceThreshold: number;
  fastModeThreshold: number;
  gridFallbackThreshold: number;
  minNodeSpacing: number;
  sameLevelRepulsionBoost: number;
}

// =============================================================================
// WORKER MESSAGES
// =============================================================================

export type ForceWorkerMessageType = 
  | 'START_SIMULATION'
  | 'STOP_SIMULATION'
  | 'UPDATE_CONFIG';

export type ForceWorkerResponseType = 
  | 'SIMULATION_PROGRESS'
  | 'SIMULATION_COMPLETE'
  | 'SIMULATION_ERROR';

/**
 * Message sent from main thread to worker
 */
export interface ForceWorkerMessage {
  type: ForceWorkerMessageType;
  payload: ForceWorkerStartPayload | ForceWorkerStopPayload | ForceWorkerConfigPayload;
}

export interface ForceWorkerStartPayload {
  nodes: WorkerSimNode[];
  edges: WorkerSimEdge[];
  iterations: number;
  config: WorkerForceConfig;
  progressInterval?: number;  // How often to send progress updates (in iterations)
}

export interface ForceWorkerStopPayload {
  // Empty - just signals to stop
}

export interface ForceWorkerConfigPayload {
  config: Partial<WorkerForceConfig>;
}

/**
 * Message sent from worker to main thread
 */
export interface ForceWorkerResponse {
  type: ForceWorkerResponseType;
  payload: ForceWorkerProgressPayload | ForceWorkerCompletePayload | ForceWorkerErrorPayload;
}

export interface ForceWorkerProgressPayload {
  currentIteration: number;
  totalIterations: number;
  maxVelocity: number;
  nodes: WorkerSimNode[];  // Current node positions for live preview
}

export interface ForceWorkerCompletePayload {
  nodes: WorkerSimNode[];
  iterations: number;
  convergedEarly: boolean;
  finalMaxVelocity: number;
  elapsedMs: number;
}

export interface ForceWorkerErrorPayload {
  error: string;
  stack?: string;
}

// =============================================================================
// WORKER STATE
// =============================================================================

export interface WorkerSimulationState {
  isRunning: boolean;
  nodes: WorkerSimNode[];
  edges: WorkerSimEdge[];
  currentIteration: number;
  totalIterations: number;
  config: WorkerForceConfig;
  startTime: number;
}

// =============================================================================
// QUADTREE TYPES (Duplicated for worker isolation)
// =============================================================================

/**
 * Quadtree node for Barnes-Hut approximation (worker-local)
 */
export interface WorkerQuadTreeNode {
  x: number;           // Center of mass X
  y: number;           // Center of mass Y
  mass: number;        // Total mass in this quad
  size: number;        // Width/height of this quad
  centerX: number;     // Quad center X
  centerY: number;     // Quad center Y
  depth: number;       // Current depth in tree
  children: (WorkerQuadTreeNode | null)[];  // NW, NE, SW, SE
  bodies: WorkerSimNode[];   // Bodies in this leaf
}

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

export function isStartPayload(payload: unknown): payload is ForceWorkerStartPayload {
  return payload !== null && 
         typeof payload === 'object' && 
         'nodes' in payload && 
         'edges' in payload;
}

export function isProgressPayload(payload: unknown): payload is ForceWorkerProgressPayload {
  return payload !== null && 
         typeof payload === 'object' && 
         'currentIteration' in payload;
}

export function isCompletePayload(payload: unknown): payload is ForceWorkerCompletePayload {
  return payload !== null && 
         typeof payload === 'object' && 
         'convergedEarly' in payload;
}

export function isErrorPayload(payload: unknown): payload is ForceWorkerErrorPayload {
  return payload !== null && 
         typeof payload === 'object' && 
         'error' in payload;
}
