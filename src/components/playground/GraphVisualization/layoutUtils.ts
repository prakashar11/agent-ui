/**
 * Layout utilities for graph visualization
 * Includes cluster-based layout, grid layout, and force-directed layout integration
 * 
 * Web Worker Support:
 * - Use `layoutClusterAsync` for off-main-thread simulation (recommended for large graphs)
 * - Use `layoutCluster` for synchronous simulation (smaller graphs or when workers unavailable)
 */

import type { Node, Edge } from '@xyflow/react';
import { getNodeRank, SEED_NODE_TYPES } from './hierarchyUtils';
import { 
  FORCE_CONFIG, 
  runForceSimulation, 
  simNodesToLayout,
  type SimNode,
  type ForceConfig,
} from './forceSimulation';
import type { 
  WorkerSimNode, 
  WorkerSimEdge, 
  WorkerForceConfig,
  ForceWorkerResponse,
  ForceWorkerCompletePayload,
  ForceWorkerErrorPayload,
} from './forceSimulation.types';

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 55;
export const DEFAULT_HORIZONTAL_GAP = 30;  // Gap between nodes in same row
export const DEFAULT_VERTICAL_GAP = 70;    // Gap between hierarchy levels within cluster
export const DEFAULT_CLUSTER_GAP_X = 120;  // Gap between clusters horizontally
export const MARGIN_X = 30;
export const MARGIN_Y = 30;

// =============================================================================
// TYPES
// =============================================================================

export interface LayoutSettings {
  // Cluster arrangement
  clustersPerRow: number;      // Max clusters per row (0 = auto)
  clusterSpacing: number;      // Gap between clusters horizontally
  
  // Force simulation parameters (these actually control node layout)
  minNodeSpacing: number;      // Minimum spacing between nodes at same level (px)
  levelSpacing: number;        // Vertical spacing between hierarchy levels (px)
  forceIterations: number;     // Number of simulation iterations (more = better but slower)
  
  // Performance options
  useWebWorker: boolean;       // Run simulation off main thread
  gridFallbackThreshold: number; // Fall back to grid layout above this node count
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  clustersPerRow: 5,           // Good balance for screen width
  clusterSpacing: 120,         // Clear separation between clusters
  minNodeSpacing: 250,         // Matches FORCE_CONFIG.minNodeSpacing
  levelSpacing: 350,           // Matches FORCE_CONFIG.levelSpacing
  forceIterations: 120,        // Matches FORCE_CONFIG.maxIterations
  useWebWorker: true,          // Enable web worker by default
  gridFallbackThreshold: 250,  // Use grid layout for very large graphs
};

/**
 * Create a merged ForceConfig from LayoutSettings
 */
export const layoutSettingsToForceConfig = (settings: LayoutSettings): ForceConfig => ({
  ...FORCE_CONFIG,
  minNodeSpacing: settings.minNodeSpacing,
  levelSpacing: settings.levelSpacing,
  maxIterations: settings.forceIterations,
  gridFallbackThreshold: settings.gridFallbackThreshold,
});

export interface ClusterNode {
  id: string;
  node: Node;
  level: number;
}

export interface Cluster {
  id: string;
  nodes: ClusterNode[];
  anchorNodeId: string; // The "root" node of this cluster
  width: number;
  height: number;
}

export interface LayoutOptions {
  containerWidth?: number;
  containerHeight?: number;
  maxClustersPerRow?: number;
  clusterSpacing?: number;
  // Force simulation overrides
  minNodeSpacing?: number;
  levelSpacing?: number;
  forceIterations?: number;
  useWebWorker?: boolean;
  gridFallbackThreshold?: number;
}

// Node data interface (matches CustomNodeData in main component)
interface NodeData {
  label: string;
  nodeType: string;
  properties: Record<string, unknown>;
  [key: string]: unknown;
}

// =============================================================================
// RESPONSIVE LAYOUT PARAMETERS
// =============================================================================

/**
 * Calculate responsive layout parameters based on container size and user settings
 */
export const getResponsiveParams = (options: LayoutOptions) => {
  const containerWidth = options.containerWidth || 1200;
  const clusterSpacing = options.clusterSpacing ?? DEFAULT_CLUSTER_GAP_X;
  const minNodeSpacing = options.minNodeSpacing ?? FORCE_CONFIG.minNodeSpacing;
  
  // Auto-calculate clusters per row based on container width
  const avgClusterWidth = 3 * NODE_WIDTH + 2 * minNodeSpacing + clusterSpacing;
  let maxClustersPerRow = Math.max(2, Math.floor(containerWidth / avgClusterWidth));
  if (options.maxClustersPerRow && options.maxClustersPerRow > 0) {
    maxClustersPerRow = options.maxClustersPerRow;
  } else {
    maxClustersPerRow = Math.min(maxClustersPerRow, 6);
  }
  
  return { 
    maxClustersPerRow, 
    clusterSpacing,
    minNodeSpacing,
    levelSpacing: options.levelSpacing ?? FORCE_CONFIG.levelSpacing,
    forceIterations: options.forceIterations ?? FORCE_CONFIG.maxIterations,
    useWebWorker: options.useWebWorker ?? true,
    gridFallbackThreshold: options.gridFallbackThreshold ?? FORCE_CONFIG.gridFallbackThreshold,
  };
};

// =============================================================================
// CLUSTER DETECTION (Union-Find)
// =============================================================================

/**
 * Find connected components using Union-Find algorithm
 */
export const findClusters = (nodes: Node[], edges: Edge[]): Map<string, Set<string>> => {
  const parent: Map<string, string> = new Map();
  
  // Initialize each node as its own parent
  nodes.forEach(n => parent.set(n.id, n.id));
  
  // Find with path compression
  const find = (x: string): string => {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  };
  
  // Union
  const union = (x: string, y: string) => {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent.set(rootX, rootY);
    }
  };
  
  // Connect nodes based on edges
  edges.forEach(edge => {
    if (parent.has(edge.source) && parent.has(edge.target)) {
      union(edge.source, edge.target);
    }
  });
  
  // Group nodes by their root
  const clusters = new Map<string, Set<string>>();
  nodes.forEach(n => {
    const root = find(n.id);
    if (!clusters.has(root)) {
      clusters.set(root, new Set());
    }
    clusters.get(root)!.add(n.id);
  });
  
  return clusters;
};

// =============================================================================
// GRID LAYOUT (Fallback for large graphs)
// =============================================================================

/**
 * Fast grid-based layout for very large graphs
 * Groups nodes by type and arranges in rows
 */
export const layoutClusterGrid = (
  clusterNodes: Node[],
  clusterEdges: Edge[],
  config: ForceConfig = FORCE_CONFIG
): { nodes: Node[]; width: number; height: number } => {
  if (clusterNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }
  
  if (clusterNodes.length === 1) {
    return {
      nodes: [{ ...clusterNodes[0], position: { x: 0, y: 0 } }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  }
  
  const nodeCount = clusterNodes.length;
  const { minNodeSpacing, levelSpacing } = config;
  const baseSpacing = Math.max(minNodeSpacing, 300 - nodeCount * 0.2);
  const horizontalGap = Math.max(baseSpacing, minNodeSpacing);
  const verticalGap = Math.max(180, baseSpacing * 0.8, levelSpacing * 0.6);
  
  // Group nodes by type for organized layout
  const nodesByType: Record<string, Node[]> = {};
  clusterNodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const type = nodeData.nodeType || 'Unknown';
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(node);
  });
  
  // Sort types by hierarchy rank
  const sortedTypes = Object.keys(nodesByType).sort((a, b) => getNodeRank(a) - getNodeRank(b));
  
  // Build adjacency for connected node ordering
  const adjacency = new Map<string, Set<string>>();
  clusterNodes.forEach(n => adjacency.set(n.id, new Set()));
  clusterEdges.forEach(e => {
    if (adjacency.has(e.source) && adjacency.has(e.target)) {
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    }
  });
  
  // Auto-calculate nodes per row based on node count
  const effectiveNodesPerRow = Math.max(8, Math.ceil(Math.sqrt(nodeCount) * 1.5));
  
  const layoutedNodes: Node[] = [];
  let currentY = 0;
  let maxWidth = 0;
  
  sortedTypes.forEach((type, typeIndex) => {
    const nodesOfType = nodesByType[type];
    
    nodesOfType.sort((a, b) => {
      const aConnections = adjacency.get(a.id)?.size || 0;
      const bConnections = adjacency.get(b.id)?.size || 0;
      return bConnections - aConnections;
    });
    
    const numRows = Math.ceil(nodesOfType.length / effectiveNodesPerRow);
    
    nodesOfType.forEach((node, nodeIndex) => {
      const rowIndex = Math.floor(nodeIndex / effectiveNodesPerRow);
      const colIndex = nodeIndex % effectiveNodesPerRow;
      const nodesInThisRow = Math.min(effectiveNodesPerRow, nodesOfType.length - rowIndex * effectiveNodesPerRow);
      const rowWidth = nodesInThisRow * NODE_WIDTH + (nodesInThisRow - 1) * horizontalGap;
      maxWidth = Math.max(maxWidth, rowWidth);
      const startX = -rowWidth / 2;
      
      layoutedNodes.push({
        ...node,
        position: {
          x: startX + colIndex * (NODE_WIDTH + horizontalGap),
          y: currentY + rowIndex * (NODE_HEIGHT + verticalGap * 0.6),
        },
      });
    });
    
    const typeHeight = numRows * NODE_HEIGHT + (numRows - 1) * verticalGap * 0.6;
    if (typeIndex < sortedTypes.length - 1) {
      currentY += typeHeight + verticalGap;
    } else {
      currentY += typeHeight;
    }
  });
  
  return { nodes: layoutedNodes, width: maxWidth, height: currentY };
};

// =============================================================================
// FORCE-DIRECTED CLUSTER LAYOUT
// =============================================================================

/**
 * Main cluster layout function - uses force-directed with adaptive fallback
 * @param clusterNodes - Nodes to layout
 * @param clusterEdges - Edges between nodes
 * @param config - Force simulation configuration (use layoutSettingsToForceConfig to convert from LayoutSettings)
 */
export const layoutCluster = (
  clusterNodes: Node[],
  clusterEdges: Edge[],
  config: ForceConfig = FORCE_CONFIG
): { nodes: Node[]; width: number; height: number } => {
  if (clusterNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }
  
  if (clusterNodes.length === 1) {
    return {
      nodes: [{ ...clusterNodes[0], position: { x: 0, y: 0 } }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  }
  
  const nodeCount = clusterNodes.length;
  const { minNodeSpacing, levelSpacing, maxIterations, fastModeThreshold, gridFallbackThreshold } = config;
  
  // Adaptive strategy based on node count
  if (nodeCount > gridFallbackThreshold) {
    console.log(`[ForceLayout] Cluster with ${nodeCount} nodes exceeds threshold, using grid fallback`);
    return layoutClusterGrid(clusterNodes, clusterEdges, config);
  }
  
  // Determine iterations based on cluster size
  const iterations = nodeCount > fastModeThreshold 
    ? Math.max(30, maxIterations - Math.floor(nodeCount / 5))
    : maxIterations;
  
  // Group nodes by hierarchy level for initial positioning
  const nodesByLevel: Map<number, Node[]> = new Map();
  clusterNodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const level = getNodeRank(nodeData.nodeType);
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });
  
  // Initialize SimNodes with smart initial positions
  const effectiveSpacing = minNodeSpacing + NODE_WIDTH;
  
  const simNodes: SimNode[] = clusterNodes.map((node, globalIndex) => {
    const nodeData = node.data as NodeData;
    const nodeType = nodeData.nodeType || 'Unknown';
    const isSeed = SEED_NODE_TYPES.has(nodeType);
    const hierarchyLevel = getNodeRank(nodeType);
    
    const nodesAtLevel = nodesByLevel.get(hierarchyLevel) || [];
    const indexAtLevel = nodesAtLevel.indexOf(node);
    const countAtLevel = Math.max(1, nodesAtLevel.length);
    
    // Initial X: spread ALL nodes horizontally with generous spacing
    let initialX: number;
    if (countAtLevel === 1) {
      initialX = 0;
    } else {
      const totalWidth = (countAtLevel - 1) * effectiveSpacing;
      initialX = (indexAtLevel * effectiveSpacing) - (totalWidth / 2);
    }
    
    const jitterX = (Math.random() - 0.5) * 20;
    const jitterY = (Math.random() - 0.5) * 10;
    const initialY = hierarchyLevel * levelSpacing;
    
    const safeX = Number.isFinite(initialX + jitterX) ? initialX + jitterX : globalIndex * effectiveSpacing;
    const safeY = Number.isFinite(initialY + jitterY) ? initialY + jitterY : hierarchyLevel * levelSpacing;
    
    return {
      id: node.id,
      x: safeX,
      y: safeY,
      vx: 0,
      vy: 0,
      fx: null,
      fy: initialY, // ALL nodes constrained to hierarchy Y level
      mass: isSeed ? 2.5 : 1.5,
      isSeed,
      hierarchyLevel,
      node,
    };
  });
  
  // Build simulation edges
  const nodeMap = new Map(simNodes.map(n => [n.id, n]));
  const simEdges = clusterEdges
    .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map(e => ({
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
    }));
  
  const seedCount = simNodes.filter(n => n.isSeed).length;
  const startTime = performance.now();
  
  runForceSimulation(simNodes, simEdges, iterations, config);
  
  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`[ForceLayout] Cluster: ${nodeCount} nodes (${seedCount} seeds), ${simEdges.length} edges, ${iterations} iterations in ${elapsed}ms`);
  
  return simNodesToLayout(simNodes, NODE_WIDTH, NODE_HEIGHT, config);
};

// =============================================================================
// ASYNC FORCE-DIRECTED CLUSTER LAYOUT (Web Worker)
// =============================================================================

// Worker singleton for async layout operations
let layoutWorker: Worker | null = null;
let workerPromise: Promise<Worker> | null = null;

/**
 * Initialize or get the force simulation worker
 */
const getLayoutWorker = (): Promise<Worker> => {
  if (workerPromise) return workerPromise;
  
  workerPromise = new Promise((resolve, reject) => {
    try {
      layoutWorker = new Worker(
        new URL('./forceSimulation.worker.ts', import.meta.url),
        { type: 'module' }
      );
      resolve(layoutWorker);
    } catch (error) {
      console.warn('[LayoutUtils] Failed to create worker:', error);
      reject(error);
    }
  });
  
  return workerPromise;
};

/**
 * Terminate the layout worker (cleanup)
 */
export const terminateLayoutWorker = (): void => {
  if (layoutWorker) {
    layoutWorker.terminate();
    layoutWorker = null;
    workerPromise = null;
  }
};

/**
 * Convert nodes to worker-compatible format
 */
const prepareNodesForWorker = (
  clusterNodes: Node[],
  config: ForceConfig
): WorkerSimNode[] => {
  const { minNodeSpacing, levelSpacing } = config;
  const effectiveSpacing = minNodeSpacing + NODE_WIDTH;
  
  // Group nodes by hierarchy level
  const nodesByLevel: Map<number, Node[]> = new Map();
  clusterNodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const level = getNodeRank(nodeData.nodeType);
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });
  
  return clusterNodes.map((node, globalIndex) => {
    const nodeData = node.data as NodeData;
    const nodeType = nodeData.nodeType || 'Unknown';
    const isSeed = SEED_NODE_TYPES.has(nodeType);
    const hierarchyLevel = getNodeRank(nodeType);
    
    const nodesAtLevel = nodesByLevel.get(hierarchyLevel) || [];
    const indexAtLevel = nodesAtLevel.indexOf(node);
    const countAtLevel = Math.max(1, nodesAtLevel.length);
    
    let initialX: number;
    if (countAtLevel === 1) {
      initialX = 0;
    } else {
      const totalWidth = (countAtLevel - 1) * effectiveSpacing;
      initialX = (indexAtLevel * effectiveSpacing) - (totalWidth / 2);
    }
    
    const jitterX = (Math.random() - 0.5) * 20;
    const jitterY = (Math.random() - 0.5) * 10;
    const initialY = hierarchyLevel * levelSpacing;
    
    const safeX = Number.isFinite(initialX + jitterX) ? initialX + jitterX : globalIndex * effectiveSpacing;
    const safeY = Number.isFinite(initialY + jitterY) ? initialY + jitterY : hierarchyLevel * levelSpacing;
    
    return {
      id: node.id,
      x: safeX,
      y: safeY,
      vx: 0,
      vy: 0,
      fx: null,
      fy: initialY,
      mass: isSeed ? 2.5 : 1.5,
      isSeed,
      hierarchyLevel,
      originalPosition: { x: node.position.x, y: node.position.y },
    };
  });
};

/**
 * Convert worker results back to React Flow nodes
 */
const workerResultToLayout = (
  workerNodes: WorkerSimNode[],
  originalNodes: Node[],
  config: ForceConfig
): { nodes: Node[]; width: number; height: number } => {
  if (workerNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }
  
  const { minNodeSpacing, levelSpacing } = config;
  const originalNodeMap = new Map(originalNodes.map(n => [n.id, n]));
  
  // Validate positions
  workerNodes.forEach((n, idx) => {
    if (!Number.isFinite(n.x)) n.x = idx * minNodeSpacing;
    if (!Number.isFinite(n.y)) n.y = n.hierarchyLevel * levelSpacing;
  });
  
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  workerNodes.forEach(n => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  });
  
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxX)) maxX = workerNodes.length * minNodeSpacing;
  if (!Number.isFinite(maxY)) maxY = 5 * levelSpacing;
  
  const layoutedNodes: Node[] = workerNodes.map((workerNode, idx) => {
    const originalNode = originalNodeMap.get(workerNode.id);
    const posX = workerNode.x - minX;
    const posY = workerNode.y - minY;
    
    return {
      ...originalNode!,
      position: {
        x: Number.isFinite(posX) ? posX : idx * minNodeSpacing,
        y: Number.isFinite(posY) ? posY : workerNode.hierarchyLevel * levelSpacing,
      },
    };
  });
  
  const width = Math.max(NODE_WIDTH, maxX - minX + NODE_WIDTH);
  const height = Math.max(NODE_HEIGHT, maxY - minY + NODE_HEIGHT);
  
  return { nodes: layoutedNodes, width, height };
};

export interface AsyncLayoutResult {
  nodes: Node[];
  width: number;
  height: number;
  iterations: number;
  convergedEarly: boolean;
  elapsedMs: number;
}

export interface AsyncLayoutOptions {
  /** Progress callback (called during simulation) */
  onProgress?: (current: number, total: number) => void;
  /** Whether to use worker (default: true, falls back to sync if unavailable) */
  useWorker?: boolean;
  /** Force simulation configuration */
  config?: ForceConfig;
}

/**
 * Async cluster layout using Web Worker for off-main-thread simulation
 * Recommended for large graphs (50+ nodes) to prevent UI blocking
 */
export const layoutClusterAsync = async (
  clusterNodes: Node[],
  clusterEdges: Edge[],
  options: AsyncLayoutOptions = {}
): Promise<AsyncLayoutResult> => {
  const { onProgress, useWorker = true, config = FORCE_CONFIG } = options;
  
  if (clusterNodes.length === 0) {
    return { nodes: [], width: 0, height: 0, iterations: 0, convergedEarly: true, elapsedMs: 0 };
  }
  
  if (clusterNodes.length === 1) {
    return {
      nodes: [{ ...clusterNodes[0], position: { x: 0, y: 0 } }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      iterations: 0,
      convergedEarly: true,
      elapsedMs: 0,
    };
  }
  
  const nodeCount = clusterNodes.length;
  const { gridFallbackThreshold, fastModeThreshold, maxIterations } = config;
  
  // Use grid fallback for very large graphs
  if (nodeCount > gridFallbackThreshold) {
    const startTime = performance.now();
    const result = layoutClusterGrid(clusterNodes, clusterEdges, config);
    return {
      ...result,
      iterations: 0,
      convergedEarly: true,
      elapsedMs: performance.now() - startTime,
    };
  }
  
  // Determine iterations
  const iterations = nodeCount > fastModeThreshold
    ? Math.max(30, maxIterations - Math.floor(nodeCount / 5))
    : maxIterations;
  
  // Try to use worker
  if (useWorker && typeof Worker !== 'undefined') {
    try {
      const worker = await getLayoutWorker();
      
      return new Promise<AsyncLayoutResult>((resolve, reject) => {
        const workerNodes = prepareNodesForWorker(clusterNodes, config);
        const nodeIds = new Set(clusterNodes.map(n => n.id));
        const workerEdges: WorkerSimEdge[] = clusterEdges
          .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
          .map(e => ({ sourceId: e.source, targetId: e.target }));
        
        const workerConfig: WorkerForceConfig = { ...config };
        
        const handleMessage = (event: MessageEvent<ForceWorkerResponse>) => {
          const { type, payload } = event.data;
          
          if (type === 'SIMULATION_PROGRESS') {
            const progress = payload as { currentIteration: number; totalIterations: number };
            onProgress?.(progress.currentIteration, progress.totalIterations);
          } else if (type === 'SIMULATION_COMPLETE') {
            const complete = payload as ForceWorkerCompletePayload;
            worker.removeEventListener('message', handleMessage);
            
            const result = workerResultToLayout(complete.nodes, clusterNodes, config);
            console.log(`[ForceLayout] Worker: ${nodeCount} nodes, ${iterations} iterations in ${complete.elapsedMs.toFixed(1)}ms` +
              (complete.convergedEarly ? ' (converged early)' : ''));
            
            resolve({
              ...result,
              iterations: complete.iterations,
              convergedEarly: complete.convergedEarly,
              elapsedMs: complete.elapsedMs,
            });
          } else if (type === 'SIMULATION_ERROR') {
            const error = payload as ForceWorkerErrorPayload;
            worker.removeEventListener('message', handleMessage);
            reject(new Error(error.error));
          }
        };
        
        worker.addEventListener('message', handleMessage);
        
        worker.postMessage({
          type: 'START_SIMULATION',
          payload: {
            nodes: workerNodes,
            edges: workerEdges,
            iterations,
            config: workerConfig,
            progressInterval: 10,
          },
        });
      });
    } catch (error) {
      console.warn('[ForceLayout] Worker failed, falling back to sync:', error);
    }
  }
  
  // Fallback to synchronous execution
  const startTime = performance.now();
  const result = layoutCluster(clusterNodes, clusterEdges, config);
  
  return {
    ...result,
    iterations,
    convergedEarly: false,
    elapsedMs: performance.now() - startTime,
  };
};

/**
 * Async version of getLayoutedElements that uses Web Workers
 */
export const getLayoutedElementsAsync = async (
  nodes: Node[],
  edges: Edge[],
  _direction: 'TB' | 'LR' = 'TB',
  options: LayoutOptions & AsyncLayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  void _direction;
  
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }
  
  const params = getResponsiveParams(options);
  const { maxClustersPerRow, clusterSpacing, minNodeSpacing, levelSpacing, forceIterations, gridFallbackThreshold } = params;
  const clusterGapY = Math.max(100, clusterSpacing + 20);
  
  // Build config from options
  const config: ForceConfig = {
    ...FORCE_CONFIG,
    minNodeSpacing,
    levelSpacing,
    maxIterations: forceIterations,
    gridFallbackThreshold,
  };
  
  // Step 1: Find connected clusters
  const clusterMap = findClusters(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Step 2: Layout each cluster (in parallel for workers)
  const clusterPromises: Promise<Cluster>[] = [];
  
  clusterMap.forEach((nodeIds, clusterId) => {
    const clusterNodes = [...nodeIds].map(id => nodeMap.get(id)!).filter(Boolean);
    
    // Find anchor node
    let anchorNode = clusterNodes[0];
    let anchorRank = getNodeRank((anchorNode.data as NodeData).nodeType);
    
    clusterNodes.forEach(node => {
      const nodeData = node.data as NodeData;
      const rank = getNodeRank(nodeData.nodeType);
      if (rank < anchorRank) {
        anchorRank = rank;
        anchorNode = node;
      }
    });
    
    const clusterEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    
    const promise = layoutClusterAsync(
      clusterNodes,
      clusterEdges,
      { useWorker: params.useWebWorker, onProgress: options.onProgress, config }
    ).then(result => ({
      id: clusterId,
      nodes: result.nodes.map(n => ({
        id: n.id,
        node: n,
        level: getNodeRank((n.data as NodeData).nodeType),
      })),
      anchorNodeId: anchorNode.id,
      width: result.width,
      height: result.height,
    }));
    
    clusterPromises.push(promise);
  });
  
  // Wait for all clusters to complete
  const clusters = await Promise.all(clusterPromises);
  
  // Step 3: Sort and arrange clusters
  clusters.sort((a, b) => b.nodes.length - a.nodes.length);
  
  const layoutedNodes: Node[] = [];
  let clusterX = MARGIN_X;
  let clusterY = MARGIN_Y;
  let rowMaxHeight = 0;
  let clustersInRow = 0;
  let currentRowWidth = 0;
  const containerWidth = options.containerWidth || 1600;
  
  clusters.forEach((cluster) => {
    const wouldExceedWidth = currentRowWidth + cluster.width + clusterSpacing > containerWidth - MARGIN_X * 2;
    const exceededClusterCount = clustersInRow >= maxClustersPerRow;
    
    if ((wouldExceedWidth || exceededClusterCount) && clustersInRow > 0) {
      clusterX = MARGIN_X;
      clusterY += rowMaxHeight + clusterGapY;
      rowMaxHeight = 0;
      clustersInRow = 0;
      currentRowWidth = 0;
    }
    
    cluster.nodes.forEach(({ node }) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: clusterX + node.position.x + cluster.width / 2,
          y: clusterY + node.position.y,
        },
      });
    });
    
    clusterX += cluster.width + clusterSpacing;
    currentRowWidth += cluster.width + clusterSpacing;
    rowMaxHeight = Math.max(rowMaxHeight, cluster.height);
    clustersInRow++;
  });
  
  return { nodes: layoutedNodes, edges };
};

// =============================================================================
// MAIN LAYOUT FUNCTION
// =============================================================================

/**
 * Get layouted elements - main entry point for graph layout
 * Finds clusters and positions them in a grid
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  _direction: 'TB' | 'LR' = 'TB',
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } => {
  void _direction;
  
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }
  
  const params = getResponsiveParams(options);
  const { maxClustersPerRow, clusterSpacing, minNodeSpacing, levelSpacing, forceIterations, gridFallbackThreshold } = params;
  const clusterGapY = Math.max(100, clusterSpacing + 20);
  
  // Build config from options
  const config: ForceConfig = {
    ...FORCE_CONFIG,
    minNodeSpacing,
    levelSpacing,
    maxIterations: forceIterations,
    gridFallbackThreshold,
  };
  
  // Step 1: Find connected clusters
  const clusterMap = findClusters(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Step 2: Create cluster objects and layout each cluster internally
  const clusters: Cluster[] = [];
  
  clusterMap.forEach((nodeIds, clusterId) => {
    const clusterNodes = [...nodeIds].map(id => nodeMap.get(id)!).filter(Boolean);
    
    // Find the anchor node (highest in hierarchy)
    let anchorNode = clusterNodes[0];
    let anchorRank = getNodeRank((anchorNode.data as NodeData).nodeType);
    
    clusterNodes.forEach(node => {
      const nodeData = node.data as NodeData;
      const rank = getNodeRank(nodeData.nodeType);
      if (rank < anchorRank) {
        anchorRank = rank;
        anchorNode = node;
      }
    });
    
    // Layout this cluster's nodes
    const clusterEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    const { nodes: layoutedClusterNodes, width, height } = layoutCluster(
      clusterNodes, 
      clusterEdges,
      config
    );
    
    clusters.push({
      id: clusterId,
      nodes: layoutedClusterNodes.map(n => ({
        id: n.id,
        node: n,
        level: getNodeRank((n.data as NodeData).nodeType),
      })),
      anchorNodeId: anchorNode.id,
      width,
      height,
    });
  });
  
  // Step 3: Sort clusters by size (larger clusters first)
  clusters.sort((a, b) => b.nodes.length - a.nodes.length);
  
  // Step 4: Arrange clusters in a responsive grid pattern
  const layoutedNodes: Node[] = [];
  let clusterX = MARGIN_X;
  let clusterY = MARGIN_Y;
  let rowMaxHeight = 0;
  let clustersInRow = 0;
  let currentRowWidth = 0;
  const containerWidth = options.containerWidth || 1600;
  
  clusters.forEach((cluster) => {
    const wouldExceedWidth = currentRowWidth + cluster.width + clusterSpacing > containerWidth - MARGIN_X * 2;
    const exceededClusterCount = clustersInRow >= maxClustersPerRow;
    
    if ((wouldExceedWidth || exceededClusterCount) && clustersInRow > 0) {
      clusterX = MARGIN_X;
      clusterY += rowMaxHeight + clusterGapY;
      rowMaxHeight = 0;
      clustersInRow = 0;
      currentRowWidth = 0;
    }
    
    cluster.nodes.forEach(({ node }) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: clusterX + node.position.x + cluster.width / 2,
          y: clusterY + node.position.y,
        },
      });
    });
    
    clusterX += cluster.width + clusterSpacing;
    currentRowWidth += cluster.width + clusterSpacing;
    rowMaxHeight = Math.max(rowMaxHeight, cluster.height);
    clustersInRow++;
  });
  
  return { nodes: layoutedNodes, edges };
};

// =============================================================================
// DYNAMIC SPACING - Spread nodes in the same row when focusing
// =============================================================================

/**
 * Spread nodes in the same hierarchy level (row) to ensure proper spacing
 * Called when a node is focused/selected to prevent overlap
 * 
 * @param focusedNodeId - The ID of the node that was focused
 * @param allNodes - All current nodes in the graph
 * @param minSpacing - Minimum horizontal spacing between nodes (default: 200)
 * @returns Updated nodes with adjusted positions
 */
export const spreadNodesInRow = (
  focusedNodeId: string,
  allNodes: Node[],
  minSpacing: number = 200
): Node[] => {
  // Find the focused node
  const focusedNode = allNodes.find(n => n.id === focusedNodeId);
  if (!focusedNode) return allNodes;
  
  const focusedData = focusedNode.data as NodeData;
  const focusedLevel = getNodeRank(focusedData.nodeType);
  const focusedY = focusedNode.position.y;
  
  // Find all nodes at the same level (within a Y tolerance)
  const yTolerance = 50; // Nodes within 50px Y are considered same row
  const nodesInRow = allNodes.filter(n => {
    const nodeData = n.data as NodeData;
    const nodeLevel = getNodeRank(nodeData.nodeType);
    return nodeLevel === focusedLevel && 
           Math.abs(n.position.y - focusedY) < yTolerance;
  });
  
  if (nodesInRow.length <= 1) return allNodes;
  
  // Sort nodes by X position
  nodesInRow.sort((a, b) => a.position.x - b.position.x);
  
  // Check for overlaps and spread if needed
  const effectiveSpacing = minSpacing + NODE_WIDTH;
  let needsSpread = false;
  
  for (let i = 0; i < nodesInRow.length - 1; i++) {
    const currentX = nodesInRow[i].position.x;
    const nextX = nodesInRow[i + 1].position.x;
    if (nextX - currentX < effectiveSpacing) {
      needsSpread = true;
      break;
    }
  }
  
  if (!needsSpread) return allNodes;
  
  // Calculate new positions centered around the focused node
  const focusedIndex = nodesInRow.findIndex(n => n.id === focusedNodeId);
  const focusedX = focusedNode.position.x;
  
  // Build position map for nodes in this row
  const newPositions = new Map<string, number>();
  
  // Spread nodes from focused node outward
  nodesInRow.forEach((node, index) => {
    const offset = index - focusedIndex;
    const newX = focusedX + (offset * effectiveSpacing);
    newPositions.set(node.id, newX);
  });
  
  // Apply new positions
  return allNodes.map(node => {
    const newX = newPositions.get(node.id);
    if (newX !== undefined) {
      return {
        ...node,
        position: {
          ...node.position,
          x: newX,
        },
      };
    }
    return node;
  });
};

/**
 * Spread all overlapping nodes in the graph
 * Useful as a "fix layout" button
 * 
 * @param allNodes - All current nodes in the graph
 * @param minSpacing - Minimum horizontal spacing between nodes
 * @returns Updated nodes with adjusted positions
 */
export const spreadAllOverlappingNodes = (
  allNodes: Node[],
  minSpacing: number = 200
): Node[] => {
  const effectiveSpacing = minSpacing + NODE_WIDTH;
  
  // Group nodes by hierarchy level and approximate Y position
  const nodesByRow = new Map<string, Node[]>();
  
  allNodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const level = getNodeRank(nodeData.nodeType);
    const rowY = Math.round(node.position.y / 100) * 100; // Group by 100px Y bands
    const rowKey = `${level}-${rowY}`;
    
    if (!nodesByRow.has(rowKey)) {
      nodesByRow.set(rowKey, []);
    }
    nodesByRow.get(rowKey)!.push(node);
  });
  
  // Build position adjustments
  const newPositions = new Map<string, number>();
  
  nodesByRow.forEach((nodesInRow) => {
    if (nodesInRow.length <= 1) return;
    
    // Sort by X position
    nodesInRow.sort((a, b) => a.position.x - b.position.x);
    
    // Check for overlaps
    let hasOverlap = false;
    for (let i = 0; i < nodesInRow.length - 1; i++) {
      if (nodesInRow[i + 1].position.x - nodesInRow[i].position.x < effectiveSpacing) {
        hasOverlap = true;
        break;
      }
    }
    
    if (!hasOverlap) return;
    
    // Calculate center and spread evenly
    const centerX = nodesInRow.reduce((sum, n) => sum + n.position.x, 0) / nodesInRow.length;
    const totalWidth = (nodesInRow.length - 1) * effectiveSpacing;
    const startX = centerX - totalWidth / 2;
    
    nodesInRow.forEach((node, index) => {
      newPositions.set(node.id, startX + index * effectiveSpacing);
    });
  });
  
  // Apply new positions
  return allNodes.map(node => {
    const newX = newPositions.get(node.id);
    if (newX !== undefined) {
      return {
        ...node,
        position: {
          ...node.position,
          x: newX,
        },
      };
    }
    return node;
  });
};
