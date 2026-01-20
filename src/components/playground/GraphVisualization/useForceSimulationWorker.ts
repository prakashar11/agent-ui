/**
 * React Hook for Force Simulation Web Worker
 * 
 * Provides a clean interface for running force-directed graph layout
 * simulations off the main thread using Web Workers.
 * 
 * Features:
 * - Automatic worker lifecycle management
 * - Progress callbacks for UI updates
 * - Graceful fallback to main-thread execution
 * - Support for simulation cancellation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type {
  WorkerSimNode,
  WorkerSimEdge,
  WorkerForceConfig,
  ForceWorkerResponse,
  ForceWorkerProgressPayload,
  ForceWorkerCompletePayload,
  ForceWorkerErrorPayload,
} from './forceSimulation.types';
import { getNodeRank, SEED_NODE_TYPES } from './hierarchyUtils';
import { FORCE_CONFIG, runForceSimulation, simNodesToLayout, type SimNode } from './forceSimulation';

// =============================================================================
// TYPES
// =============================================================================

interface NodeData {
  label: string;
  nodeType: string;
  properties: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SimulationProgress {
  currentIteration: number;
  totalIterations: number;
  percentage: number;
  maxVelocity: number;
}

export interface SimulationResult {
  nodes: Node[];
  width: number;
  height: number;
  iterations: number;
  convergedEarly: boolean;
  elapsedMs: number;
}

export interface UseForceSimulationWorkerOptions {
  /** Enable Web Worker (default: true, falls back to main thread if workers unavailable) */
  useWorker?: boolean;
  /** Progress update interval in iterations (default: 10) */
  progressInterval?: number;
  /** Callback for progress updates */
  onProgress?: (progress: SimulationProgress) => void;
  /** Callback when simulation completes */
  onComplete?: (result: SimulationResult) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export interface UseForceSimulationWorkerReturn {
  /** Start a new simulation */
  startSimulation: (
    nodes: Node[],
    edges: Edge[],
    iterations?: number,
    config?: Partial<WorkerForceConfig>
  ) => void;
  /** Stop the current simulation */
  stopSimulation: () => void;
  /** Whether a simulation is currently running */
  isSimulating: boolean;
  /** Current simulation progress (0-100) */
  progress: number;
  /** Whether Web Worker is supported and being used */
  isUsingWorker: boolean;
  /** Latest simulation result (updated during and after simulation) */
  result: SimulationResult | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert React Flow nodes to worker-compatible format
 */
const nodesToWorkerNodes = (
  nodes: Node[],
  levelSpacing: number
): { workerNodes: WorkerSimNode[]; nodeDataMap: Map<string, NodeData> } => {
  const nodeDataMap = new Map<string, NodeData>();
  
  // Group nodes by hierarchy level for initial positioning
  const nodesByLevel: Map<number, Node[]> = new Map();
  nodes.forEach(node => {
    const nodeData = node.data as NodeData;
    const level = getNodeRank(nodeData.nodeType);
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });
  
  const minNodeSpacing = FORCE_CONFIG.minNodeSpacing;
  const effectiveSpacing = minNodeSpacing + 160; // NODE_WIDTH
  
  const workerNodes: WorkerSimNode[] = nodes.map((node, globalIndex) => {
    const nodeData = node.data as NodeData;
    nodeDataMap.set(node.id, nodeData);
    
    const nodeType = nodeData.nodeType || 'Unknown';
    const isSeed = SEED_NODE_TYPES.has(nodeType);
    const hierarchyLevel = getNodeRank(nodeType);
    
    const nodesAtLevel = nodesByLevel.get(hierarchyLevel) || [];
    const indexAtLevel = nodesAtLevel.indexOf(node);
    const countAtLevel = Math.max(1, nodesAtLevel.length);
    
    // Calculate initial X position
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
      fy: initialY, // Constrain to hierarchy Y level
      mass: isSeed ? 2.5 : 1.5,
      isSeed,
      hierarchyLevel,
      originalPosition: { x: node.position.x, y: node.position.y },
    };
  });
  
  return { workerNodes, nodeDataMap };
};

/**
 * Convert edges to worker-compatible format
 */
const edgesToWorkerEdges = (edges: Edge[], nodeIds: Set<string>): WorkerSimEdge[] => {
  return edges
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(e => ({
      sourceId: e.source,
      targetId: e.target,
    }));
};

/**
 * Convert worker nodes back to React Flow nodes
 */
const workerNodesToLayout = (
  workerNodes: WorkerSimNode[],
  originalNodes: Node[],
  nodeWidth: number = 160,
  nodeHeight: number = 55
): { nodes: Node[]; width: number; height: number } => {
  if (workerNodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }
  
  const originalNodeMap = new Map(originalNodes.map(n => [n.id, n]));
  const minNodeSpacing = FORCE_CONFIG.minNodeSpacing;
  const levelSpacing = FORCE_CONFIG.levelSpacing;
  
  // Validate positions
  workerNodes.forEach((n, idx) => {
    if (!Number.isFinite(n.x)) {
      n.x = idx * minNodeSpacing;
    }
    if (!Number.isFinite(n.y)) {
      n.y = n.hierarchyLevel * levelSpacing;
    }
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
  
  // Create layouted nodes
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
  
  const width = Math.max(nodeWidth, maxX - minX + nodeWidth);
  const height = Math.max(nodeHeight, maxY - minY + nodeHeight);
  
  return { nodes: layoutedNodes, width, height };
};

/**
 * Check if Web Workers are supported
 */
const isWorkerSupported = (): boolean => {
  return typeof Worker !== 'undefined';
};

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export const useForceSimulationWorker = (
  options: UseForceSimulationWorkerOptions = {}
): UseForceSimulationWorkerReturn => {
  const {
    useWorker = true,
    progressInterval = 10,
    onProgress,
    onComplete,
    onError,
  } = options;
  
  const workerRef = useRef<Worker | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isUsingWorker, setIsUsingWorker] = useState(false);
  
  // Initialize worker
  useEffect(() => {
    if (!useWorker || !isWorkerSupported()) {
      setIsUsingWorker(false);
      return;
    }
    
    try {
      // Create worker using Vite/Webpack worker URL pattern
      workerRef.current = new Worker(
        new URL('./forceSimulation.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      setIsUsingWorker(true);
      
      // Set up message handler
      workerRef.current.onmessage = (event: MessageEvent<ForceWorkerResponse>) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'SIMULATION_PROGRESS': {
            const progressPayload = payload as ForceWorkerProgressPayload;
            const percentage = Math.round(
              (progressPayload.currentIteration / progressPayload.totalIterations) * 100
            );
            setProgress(percentage);
            
            // Update result with current positions for live preview
            const currentResult = workerNodesToLayout(
              progressPayload.nodes,
              nodesRef.current
            );
            setResult({
              ...currentResult,
              iterations: progressPayload.currentIteration,
              convergedEarly: false,
              elapsedMs: 0,
            });
            
            onProgress?.({
              currentIteration: progressPayload.currentIteration,
              totalIterations: progressPayload.totalIterations,
              percentage,
              maxVelocity: progressPayload.maxVelocity,
            });
            break;
          }
          
          case 'SIMULATION_COMPLETE': {
            const completePayload = payload as ForceWorkerCompletePayload;
            setIsSimulating(false);
            setProgress(100);
            
            const finalResult = workerNodesToLayout(
              completePayload.nodes,
              nodesRef.current
            );
            const simulationResult: SimulationResult = {
              ...finalResult,
              iterations: completePayload.iterations,
              convergedEarly: completePayload.convergedEarly,
              elapsedMs: completePayload.elapsedMs,
            };
            setResult(simulationResult);
            
            console.log(
              `[ForceWorker] Simulation complete: ${completePayload.iterations} iterations in ${completePayload.elapsedMs.toFixed(1)}ms` +
              (completePayload.convergedEarly ? ' (converged early)' : '')
            );
            
            onComplete?.(simulationResult);
            break;
          }
          
          case 'SIMULATION_ERROR': {
            const errorPayload = payload as ForceWorkerErrorPayload;
            setIsSimulating(false);
            console.error('[ForceWorker] Error:', errorPayload.error);
            onError?.(new Error(errorPayload.error));
            break;
          }
        }
      };
      
      workerRef.current.onerror = (event) => {
        console.error('[ForceWorker] Worker error:', event);
        setIsSimulating(false);
        onError?.(new Error(event.message));
      };
      
    } catch (error) {
      console.warn('[ForceWorker] Failed to create worker, falling back to main thread:', error);
      setIsUsingWorker(false);
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [useWorker, onProgress, onComplete, onError]);
  
  // Start simulation
  const startSimulation = useCallback((
    nodes: Node[],
    edges: Edge[],
    iterations?: number,
    config?: Partial<WorkerForceConfig>
  ) => {
    if (nodes.length === 0) {
      const emptyResult: SimulationResult = {
        nodes: [],
        width: 0,
        height: 0,
        iterations: 0,
        convergedEarly: true,
        elapsedMs: 0,
      };
      setResult(emptyResult);
      onComplete?.(emptyResult);
      return;
    }
    
    nodesRef.current = nodes;
    const mergedConfig: WorkerForceConfig = { ...FORCE_CONFIG, ...config };
    const actualIterations = iterations ?? mergedConfig.maxIterations;
    
    setIsSimulating(true);
    setProgress(0);
    
    // Use worker if available
    if (isUsingWorker && workerRef.current) {
      const { workerNodes } = nodesToWorkerNodes(nodes, mergedConfig.levelSpacing);
      const nodeIds = new Set(nodes.map(n => n.id));
      const workerEdges = edgesToWorkerEdges(edges, nodeIds);
      
      workerRef.current.postMessage({
        type: 'START_SIMULATION',
        payload: {
          nodes: workerNodes,
          edges: workerEdges,
          iterations: actualIterations,
          config: mergedConfig,
          progressInterval,
        },
      });
    } else {
      // Fallback to main thread
      console.log('[ForceWorker] Running on main thread (worker unavailable)');
      
      const startTime = performance.now();
      
      // Convert to SimNodes for the synchronous simulation
      const simNodes: SimNode[] = nodes.map((node, globalIndex) => {
        const nodeData = node.data as NodeData;
        const nodeType = nodeData.nodeType || 'Unknown';
        const isSeed = SEED_NODE_TYPES.has(nodeType);
        const hierarchyLevel = getNodeRank(nodeType);
        
        return {
          id: node.id,
          x: node.position.x || globalIndex * mergedConfig.minNodeSpacing,
          y: node.position.y || hierarchyLevel * mergedConfig.levelSpacing,
          vx: 0,
          vy: 0,
          fx: null,
          fy: hierarchyLevel * mergedConfig.levelSpacing,
          mass: isSeed ? 2.5 : 1.5,
          isSeed,
          hierarchyLevel,
          node,
        };
      });
      
      const nodeMap = new Map(simNodes.map(n => [n.id, n]));
      const simEdges = edges
        .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
        .map(e => ({
          source: nodeMap.get(e.source)!,
          target: nodeMap.get(e.target)!,
        }));
      
      // Run synchronous simulation
      runForceSimulation(simNodes, simEdges, actualIterations, mergedConfig);
      
      const elapsed = performance.now() - startTime;
      const layoutResult = simNodesToLayout(simNodes, 160, 55, mergedConfig);
      
      const simulationResult: SimulationResult = {
        ...layoutResult,
        iterations: actualIterations,
        convergedEarly: false,
        elapsedMs: elapsed,
      };
      
      setIsSimulating(false);
      setProgress(100);
      setResult(simulationResult);
      onComplete?.(simulationResult);
    }
  }, [isUsingWorker, progressInterval, onComplete]);
  
  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (workerRef.current && isSimulating) {
      workerRef.current.postMessage({ type: 'STOP_SIMULATION', payload: {} });
    }
    setIsSimulating(false);
  }, [isSimulating]);
  
  return {
    startSimulation,
    stopSimulation,
    isSimulating,
    progress,
    isUsingWorker,
    result,
  };
};

export default useForceSimulationWorker;
