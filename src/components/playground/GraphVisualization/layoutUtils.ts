/**
 * Layout utilities for graph visualization
 * Includes cluster-based layout, grid layout, and force-directed layout integration
 */

import type { Node, Edge } from '@xyflow/react';
import { getNodeRank, SEED_NODE_TYPES } from './hierarchyUtils';
import { 
  FORCE_CONFIG, 
  runForceSimulation, 
  simNodesToLayout,
  type SimNode 
} from './forceSimulation';

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
  nodesPerRow: number;
  clustersPerRow: number;
  nodeSpacing: number;       // Horizontal gap between nodes
  clusterSpacing: number;    // Gap between clusters
  verticalSpacing: number;   // Vertical gap between levels
}

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  nodesPerRow: 12,       // Optimized for large graphs
  clustersPerRow: 5,     // Good balance for screen width
  nodeSpacing: 80,       // Comfortable spacing between nodes
  clusterSpacing: 120,   // Clear separation between clusters
  verticalSpacing: 95,   // Readable vertical hierarchy
};

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
  maxNodesPerRow?: number;
  maxClustersPerRow?: number;
  nodeSpacing?: number;
  clusterSpacing?: number;
  verticalSpacing?: number;
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
  const nodeSpacing = options.nodeSpacing ?? DEFAULT_HORIZONTAL_GAP;
  const clusterSpacing = options.clusterSpacing ?? DEFAULT_CLUSTER_GAP_X;
  
  // If user specified values, use them directly
  if (options.maxNodesPerRow && options.maxNodesPerRow > 0) {
    const maxNodesPerRow = options.maxNodesPerRow;
    const maxClustersPerRow = options.maxClustersPerRow && options.maxClustersPerRow > 0 
      ? options.maxClustersPerRow 
      : Math.max(2, Math.floor(containerWidth / (maxNodesPerRow * (NODE_WIDTH + nodeSpacing) + clusterSpacing)));
    return { maxNodesPerRow, maxClustersPerRow, nodeSpacing, clusterSpacing };
  }
  
  // Auto-calculate based on container width
  const avgClusterWidth = 3 * NODE_WIDTH + 2 * nodeSpacing + clusterSpacing;
  let maxClustersPerRow = Math.max(2, Math.floor(containerWidth / avgClusterWidth));
  if (options.maxClustersPerRow && options.maxClustersPerRow > 0) {
    maxClustersPerRow = options.maxClustersPerRow;
  } else {
    maxClustersPerRow = Math.min(maxClustersPerRow, 6);
  }
  
  // Calculate max nodes per row within a cluster
  const targetClusterWidth = containerWidth / maxClustersPerRow - clusterSpacing;
  let maxNodesPerRow = Math.max(2, Math.floor(targetClusterWidth / (NODE_WIDTH + nodeSpacing)));
  maxNodesPerRow = Math.min(maxNodesPerRow, 8);
  
  return { maxNodesPerRow, maxClustersPerRow, nodeSpacing, clusterSpacing };
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
  maxNodesPerRow: number,
  nodeSpacing: number = DEFAULT_HORIZONTAL_GAP,
  _verticalSpacing: number = DEFAULT_VERTICAL_GAP
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
  const minSpacing = FORCE_CONFIG.minNodeSpacing;
  const baseSpacing = Math.max(minSpacing, 300 - nodeCount * 0.2);
  const horizontalGap = Math.max(nodeSpacing, baseSpacing, minSpacing);
  const verticalGap = Math.max(180, baseSpacing * 0.8, FORCE_CONFIG.levelSpacing * 0.6);
  
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
  
  const effectiveNodesPerRow = Math.max(maxNodesPerRow, Math.ceil(Math.sqrt(nodeCount) * 1.5));
  
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
 */
export const layoutCluster = (
  clusterNodes: Node[],
  clusterEdges: Edge[],
  maxNodesPerRow: number,
  nodeSpacing: number = DEFAULT_HORIZONTAL_GAP,
  verticalSpacing: number = DEFAULT_VERTICAL_GAP
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
  
  // Adaptive strategy based on node count
  if (nodeCount > FORCE_CONFIG.gridFallbackThreshold) {
    console.log(`[ForceLayout] Cluster with ${nodeCount} nodes exceeds threshold, using grid fallback`);
    return layoutClusterGrid(clusterNodes, clusterEdges, maxNodesPerRow, nodeSpacing, verticalSpacing);
  }
  
  // Determine iterations based on cluster size
  const iterations = nodeCount > FORCE_CONFIG.fastModeThreshold 
    ? Math.max(30, FORCE_CONFIG.maxIterations - Math.floor(nodeCount / 5))
    : FORCE_CONFIG.maxIterations;
  
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
  const minSpacing = FORCE_CONFIG.minNodeSpacing;
  const effectiveSpacing = minSpacing + NODE_WIDTH;
  
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
    const initialY = hierarchyLevel * FORCE_CONFIG.levelSpacing;
    
    const safeX = Number.isFinite(initialX + jitterX) ? initialX + jitterX : globalIndex * effectiveSpacing;
    const safeY = Number.isFinite(initialY + jitterY) ? initialY + jitterY : hierarchyLevel * FORCE_CONFIG.levelSpacing;
    
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
  
  runForceSimulation(simNodes, simEdges, iterations);
  
  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`[ForceLayout] Cluster: ${nodeCount} nodes (${seedCount} seeds), ${simEdges.length} edges, ${iterations} iterations in ${elapsed}ms`);
  
  return simNodesToLayout(simNodes, NODE_WIDTH, NODE_HEIGHT);
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
  
  const { maxNodesPerRow, maxClustersPerRow, nodeSpacing, clusterSpacing } = getResponsiveParams(options);
  const verticalSpacing = options.verticalSpacing ?? DEFAULT_VERTICAL_GAP;
  const clusterGapY = Math.max(100, clusterSpacing + 20);
  
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
      maxNodesPerRow,
      nodeSpacing,
      verticalSpacing
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
