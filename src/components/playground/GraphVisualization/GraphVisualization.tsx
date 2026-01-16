'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, Info, Maximize2, Minimize2, Edit3, Save, XCircle, Plus, Trash2, Link, Eye, Pencil, RotateCcw, Shield, AlertTriangle, Target, Activity, ChevronDown, ChevronUp, Zap, Copy, ExternalLink, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  Connection,
  addEdge,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  type GraphNode as ApiGraphNode,
  type GraphEdge as ApiGraphEdge,
  type GraphData,
  type GraphStats,
  NODE_COLORS,
  EDGE_COLORS,
  type GraphVisualizationProps,
  type ExploitabilityScore,
  type RemediationRecommendation,
  type AttackPathStep,
} from './types';

// =============================================================================
// HIERARCHY CONFIGURATION
// =============================================================================

// Define the logical hierarchy for node types (lower number = higher in graph)
// Consolidated to 9 node types to avoid schema bloat
const NODE_TYPE_HIERARCHY: Record<string, number> = {
  AssetCategory: 0,   // Top level - categories and groups
  Asset: 1,           // Core assets - infrastructure, applications, endpoints
  Service: 1,         // Services same level as assets
  Identity: 1,        // Identities (embeds credentials) same level as assets
  Vulnerability: 2,   // CVEs and security weaknesses
  Control: 2,         // Security controls / hygiene essentials
  Threat: 3,          // Consolidated threat (embeds: actor, campaign, tools, malware)
  Indicator: 3,       // IOCs (IP, domain, hash) same level as threats
  Attack: 4,          // Consolidated MITRE ATT&CK (embeds: technique + tactic)
  LogEvent: 4,        // Security logs for detection correlation
};

// Helper to detect if a string is a URL
const isUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Helper to render a property value (handles URLs, arrays, etc.)
const renderPropertyValue = (key: string, value: unknown): React.ReactNode => {
  if (Array.isArray(value)) {
    // For arrays, check if any item is a URL
    return value.map((item, idx) => (
      <span key={idx}>
        {isUrl(item) ? (
          <a
            href={String(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {String(item).length > 50 ? `${String(item).substring(0, 50)}...` : String(item)}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          String(item)
        )}
        {idx < value.length - 1 ? ', ' : ''}
      </span>
    ));
  }
  
  const strValue = String(value);
  
  // Check if this is a URL
  if (isUrl(value)) {
    return (
      <a
        href={strValue}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {strValue.length > 60 ? `${strValue.substring(0, 60)}...` : strValue}
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>
    );
  }
  
  return strValue;
};

const getNodeRank = (nodeType: string): number => {
  return NODE_TYPE_HIERARCHY[nodeType] ?? 6; // Default to bottom for unknown types
};

// =============================================================================
// BROWSER STORAGE FOR VISUALIZATION LAYOUT
// =============================================================================
// Stores visualization preferences in localStorage (browser-side only)
// This does NOT affect backend storage - only UI preferences

const STORAGE_KEY = 'asset-graph-visualization-layout';
const LAYOUT_VERSION = 2; // Increment this when layout algorithm changes significantly

interface StoredLayout {
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

const getStoredLayout = (): StoredLayout | null => {
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

const saveLayout = (layout: Partial<StoredLayout>) => {
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

const clearStoredLayout = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[AssetGraph] Layout cleared from browser storage');
  } catch (e) {
    console.warn('[AssetGraph] Failed to clear layout:', e);
  }
};

// =============================================================================
// HIERARCHICAL LAYOUT (Manual positioning by node type)
// =============================================================================

const NODE_WIDTH = 160;
const NODE_HEIGHT = 55;
const DEFAULT_HORIZONTAL_GAP = 30;  // Gap between nodes in same row
const DEFAULT_VERTICAL_GAP = 70;    // Gap between hierarchy levels within cluster
const DEFAULT_CLUSTER_GAP_X = 120;  // Gap between clusters horizontally
const MARGIN_X = 30;
const MARGIN_Y = 30;

// Note: Previously had DATE_FILTER_EXEMPT_LABELS but removed for simplicity
// All filters now apply uniformly to all node types

// Layout settings interface for user customization
interface LayoutSettings {
  nodesPerRow: number;
  clustersPerRow: number;
  nodeSpacing: number;       // Horizontal gap between nodes
  clusterSpacing: number;    // Gap between clusters
  verticalSpacing: number;   // Vertical gap between levels
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  nodesPerRow: 12,       // Optimized for large graphs
  clustersPerRow: 5,     // Good balance for screen width
  nodeSpacing: 80,       // Comfortable spacing between nodes
  clusterSpacing: 120,   // Clear separation between clusters
  verticalSpacing: 95,   // Readable vertical hierarchy
};

// =============================================================================
// CLUSTER-BASED LAYOUT (Groups connected nodes together)
// =============================================================================

interface ClusterNode {
  id: string;
  node: Node;
  level: number;
}

interface Cluster {
  id: string;
  nodes: ClusterNode[];
  anchorNodeId: string; // The "root" node of this cluster (usually Asset or AssetCategory)
  width: number;
  height: number;
}

interface LayoutOptions {
  containerWidth?: number;
  containerHeight?: number;
  maxNodesPerRow?: number;
  maxClustersPerRow?: number;
  // User-customizable spacing settings
  nodeSpacing?: number;
  clusterSpacing?: number;
  verticalSpacing?: number;
}

// Calculate responsive layout parameters based on container size and user settings
const getResponsiveParams = (options: LayoutOptions) => {
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

// Find connected components using Union-Find
const findClusters = (nodes: Node[], edges: Edge[]): Map<string, Set<string>> => {
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

// Layout nodes within a single cluster (hierarchical with wrapping)
const layoutCluster = (
  clusterNodes: Node[],
  _edges: Edge[],
  maxNodesPerRow: number,
  nodeSpacing: number = DEFAULT_HORIZONTAL_GAP,
  verticalSpacing: number = DEFAULT_VERTICAL_GAP
): { nodes: Node[]; width: number; height: number } => {
  void _edges; // Reserved for future edge-aware layout
  
  const subRowGap = Math.max(40, verticalSpacing - 5); // Slightly less than vertical for sub-rows
  
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
  
  // Group by hierarchy level
  const nodesByLevel: Record<number, Node[]> = {};
  clusterNodes.forEach(node => {
    const nodeData = node.data as CustomNodeData;
    const level = getNodeRank(nodeData.nodeType);
    if (!nodesByLevel[level]) {
      nodesByLevel[level] = [];
    }
    nodesByLevel[level].push(node);
  });
  
  const sortedLevels = Object.keys(nodesByLevel)
    .map(Number)
    .sort((a, b) => a - b);
  
  const layoutedNodes: Node[] = [];
  let maxWidth = 0;
  let currentY = 0;
  
  sortedLevels.forEach((level, levelIndex) => {
    const nodesInLevel = nodesByLevel[level];
    
    // Calculate how many rows needed for this level
    const numRows = Math.ceil(nodesInLevel.length / maxNodesPerRow);
    
    // Track the max width for this level (across all rows)
    let levelMaxWidth = 0;
    
    nodesInLevel.forEach((node, nodeIndex) => {
      const rowIndex = Math.floor(nodeIndex / maxNodesPerRow);
      const colIndex = nodeIndex % maxNodesPerRow;
      
      // Calculate nodes in this specific row
      const nodesInThisRow = Math.min(
        maxNodesPerRow,
        nodesInLevel.length - rowIndex * maxNodesPerRow
      );
      
      // Calculate row width and center it (using customizable nodeSpacing)
      const rowWidth = nodesInThisRow * NODE_WIDTH + (nodesInThisRow - 1) * nodeSpacing;
      levelMaxWidth = Math.max(levelMaxWidth, rowWidth);
      
      const startX = -rowWidth / 2;
      
      layoutedNodes.push({
        ...node,
        position: {
          x: startX + colIndex * (NODE_WIDTH + nodeSpacing),
          y: currentY + rowIndex * (NODE_HEIGHT + subRowGap),
        },
      });
    });
    
    maxWidth = Math.max(maxWidth, levelMaxWidth);
    
    // Move to next level
    const levelHeight = numRows * NODE_HEIGHT + (numRows - 1) * subRowGap;
    if (levelIndex < sortedLevels.length - 1) {
      currentY += levelHeight + verticalSpacing;
    } else {
      currentY += levelHeight - NODE_HEIGHT; // Last level, just add height
    }
  });
  
  return {
    nodes: layoutedNodes,
    width: maxWidth,
    height: currentY + NODE_HEIGHT,
  };
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  _direction: 'TB' | 'LR' = 'TB',
  options: LayoutOptions = {}
) => {
  void _direction;
  
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }
  
  // Get responsive layout parameters (includes spacing)
  const { maxNodesPerRow, maxClustersPerRow, nodeSpacing, clusterSpacing } = getResponsiveParams(options);
  const verticalSpacing = options.verticalSpacing ?? DEFAULT_VERTICAL_GAP;
  const clusterGapY = Math.max(100, clusterSpacing + 20); // Slightly more vertical gap between cluster rows
  
  // Step 1: Find connected clusters
  const clusterMap = findClusters(nodes, edges);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Step 2: Create cluster objects and layout each cluster internally
  const clusters: Cluster[] = [];
  
  clusterMap.forEach((nodeIds, clusterId) => {
    const clusterNodes = [...nodeIds].map(id => nodeMap.get(id)!).filter(Boolean);
    
    // Find the anchor node (highest in hierarchy, preferring AssetCategory/Asset)
    let anchorNode = clusterNodes[0];
    let anchorRank = getNodeRank((anchorNode.data as CustomNodeData).nodeType);
    
    clusterNodes.forEach(node => {
      const nodeData = node.data as CustomNodeData;
      const rank = getNodeRank(nodeData.nodeType);
      if (rank < anchorRank) {
        anchorRank = rank;
        anchorNode = node;
      }
    });
    
    // Layout this cluster's nodes with wrapping (pass spacing parameters)
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
        level: getNodeRank((n.data as CustomNodeData).nodeType),
      })),
      anchorNodeId: anchorNode.id,
      width,
      height,
    });
  });
  
  // Step 3: Sort clusters by size (larger clusters first) for better packing
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
    // Check if we need to wrap to next row (either by count or by width)
    const wouldExceedWidth = currentRowWidth + cluster.width + clusterSpacing > containerWidth - MARGIN_X * 2;
    const exceededClusterCount = clustersInRow >= maxClustersPerRow;
    
    if ((wouldExceedWidth || exceededClusterCount) && clustersInRow > 0) {
      clusterX = MARGIN_X;
      clusterY += rowMaxHeight + clusterGapY;
      rowMaxHeight = 0;
      clustersInRow = 0;
      currentRowWidth = 0;
    }
    
    // Position each node in the cluster, offset by cluster position
    cluster.nodes.forEach(({ node }) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: clusterX + node.position.x + cluster.width / 2,
          y: clusterY + node.position.y,
        },
      });
    });
    
    // Update for next cluster
    clusterX += cluster.width + clusterSpacing;
    currentRowWidth += cluster.width + clusterSpacing;
    rowMaxHeight = Math.max(rowMaxHeight, cluster.height);
    clustersInRow++;
  });
  
  return { nodes: layoutedNodes, edges };
};

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

interface CustomNodeData {
  label: string;
  nodeType: string;
  properties: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties for ReactFlow
}

type CustomNode = Node<CustomNodeData>;

const CustomNodeComponent = ({ data, selected }: NodeProps<CustomNode>) => {
  const nodeData = data as unknown as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;
  
  const handleCopyLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nodeData.label).then(() => {
      toast.success(`Copied: ${nodeData.label}`);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };
  
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-lg min-w-[140px] max-w-[200px]
        transition-all duration-200
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''}
      `}
      style={{
        backgroundColor: `${color}20`,
        borderColor: color,
      }}
    >
      {/* Top handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      
      {/* Bottom handles */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      
      {/* Left handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      
      {/* Right handles */}
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!bg-neutral-400 !w-2 !h-2 !opacity-60 hover:!opacity-100"
      />
      
      <div className="flex flex-col gap-1">
        <div
          className="text-[10px] uppercase font-medium tracking-wider"
          style={{ color }}
        >
          {nodeData.nodeType}
        </div>
        <div 
          className="text-sm font-semibold text-white truncate flex items-center gap-1.5 group cursor-pointer hover:text-blue-300 transition-colors" 
          title={`Double-click to copy: ${nodeData.label}`}
          onDoubleClick={handleCopyLabel}
        >
          <span className="truncate">{nodeData.label}</span>
          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNodeComponent,
};

// =============================================================================
// NODE DETAILS PANEL
// =============================================================================

interface NodeDetailsPanelProps {
  node: CustomNode | null;
  edges: Edge[];
  nodes: CustomNode[];
  onNavigate: (nodeId: string) => void;
  onClose: () => void;
  editMode?: boolean;
  onDeleteNode?: (nodeId: string) => void;
  onAddRelationship?: () => void;
  onEditProperties?: () => void;
  onDeleteEdge?: (edgeId: string) => void;
  onEditEdge?: (edge: Edge) => void;
}

function NodeDetailsPanel({ node, edges, nodes, onNavigate, onClose, editMode, onDeleteNode, onAddRelationship, onEditProperties, onDeleteEdge, onEditEdge }: NodeDetailsPanelProps) {
  if (!node) return null;

  const nodeData = node.data as unknown as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;
  const hasProperties = nodeData.properties && Object.keys(nodeData.properties).length > 0;

  // Find connected nodes
  const connectedEdges = edges.filter(
    e => e.source === node.id || e.target === node.id
  );
  
  const neighbors = connectedEdges.map(edge => {
    const neighborId = edge.source === node.id ? edge.target : edge.source;
    const neighborNode = nodes.find(n => n.id === neighborId);
    return {
      node: neighborNode,
      edge,
      direction: edge.source === node.id ? 'outgoing' : 'incoming',
    };
  }).filter(n => n.node);

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="absolute right-0 top-0 h-full w-80 bg-neutral-900/95 backdrop-blur-sm border-l border-neutral-700 overflow-y-auto z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-neutral-400 uppercase">{nodeData.nodeType}</span>
          </div>
          <div className="flex items-center gap-1">
            {editMode && onDeleteNode && (
              <button
                onClick={() => onDeleteNode(node.id)}
                className="p-1 hover:bg-red-600 rounded transition-colors text-red-400 hover:text-white"
                title="Delete Node"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Node Name - Copyable */}
        <div className="mb-4 flex items-center gap-2 group">
          <h3 className="text-lg font-semibold text-white break-words flex-1">
            {nodeData.label}
          </h3>
          <button
            onClick={() => {
              navigator.clipboard.writeText(nodeData.label).then(() => {
                toast.success(`Copied: ${nodeData.label}`);
              }).catch(() => {
                toast.error('Failed to copy');
              });
            }}
            className="p-1.5 hover:bg-neutral-700 rounded transition-colors opacity-50 group-hover:opacity-100"
            title="Copy node name"
          >
            <Copy className="w-4 h-4 text-neutral-400 hover:text-white" />
          </button>
        </div>

        {/* Properties Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-neutral-400 uppercase">
              Properties {hasProperties && `(${Object.keys(nodeData.properties).length})`}
            </h4>
            {onEditProperties && (
              <button
                onClick={onEditProperties}
                className="p-1 hover:bg-neutral-700 rounded transition-colors text-neutral-500 hover:text-blue-400"
                title="Edit Properties"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {hasProperties ? (
            <div className="space-y-2 bg-neutral-800/50 rounded-lg p-3">
              {Object.entries(nodeData.properties).map(([key, value]) => {
                if (value === null || value === undefined || value === '' ||
                    (Array.isArray(value) && value.length === 0)) {
                  return null;
                }
                return (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-neutral-500">{key}</span>
                    <span className="text-sm text-neutral-200 break-words">
                      {renderPropertyValue(key, value)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic bg-neutral-800/30 rounded-lg p-3">
              No properties defined
            </div>
          )}
        </div>

        {/* Connections Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-neutral-400 uppercase">
              Connections ({neighbors.length})
            </h4>
            {onAddRelationship && (
              <button
                onClick={onAddRelationship}
                className="p-1 hover:bg-neutral-700 rounded transition-colors text-neutral-500 hover:text-blue-400"
                title="Add Relationship"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {neighbors.length > 0 ? (
            <div className="space-y-2">
              {neighbors.map(({ node: neighborNode, edge, direction }) => {
                if (!neighborNode) return null;
                const neighborNodeData = neighborNode.data as unknown as CustomNodeData;
                const neighborNodeColor = NODE_COLORS[neighborNodeData.nodeType] || NODE_COLORS.default;

                return (
                  <div
                    key={edge.id}
                    className="group relative p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                  >
                    <button
                      onClick={() => onNavigate(neighborNode.id)}
                      className="w-full text-left pr-12"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: neighborNodeColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{neighborNodeData.label}</div>
                          <div className="text-xs text-neutral-400 flex items-center gap-1">
                            <span>{neighborNodeData.nodeType}</span>
                            <span>•</span>
                            <span className="text-neutral-500">
                              {direction === 'outgoing' ? '→' : '←'} {edge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                    {/* Edit/Delete buttons - visible on hover */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      {onEditEdge && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEdge(edge);
                          }}
                          className="p-1.5 rounded hover:bg-blue-600/20 text-neutral-500 hover:text-blue-400 transition-colors"
                          title="Edit Relationship"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {editMode && onDeleteEdge && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEdge(edge.id);
                          }}
                          className="p-1.5 rounded hover:bg-red-600/20 text-neutral-500 hover:text-red-400 transition-colors"
                          title="Delete Relationship"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 italic bg-neutral-800/30 rounded-lg p-3">
              No connections
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// HIERARCHY LEGEND PANEL
// =============================================================================

// Hierarchy levels for the consolidated 9-node schema
const HIERARCHY_LEVELS = [
  { rank: 0, label: 'Categories', types: ['AssetCategory'], description: 'Asset categories & groups' },
  { rank: 1, label: 'Assets', types: ['Asset', 'Service', 'Identity'], description: 'Assets, services, identities (Identity embeds credentials)' },
  { rank: 2, label: 'Vulnerabilities', types: ['Vulnerability', 'Control'], description: 'Weaknesses & security controls' },
  { rank: 3, label: 'Threats', types: ['Threat', 'Indicator'], description: 'Threats (embeds actor/campaign/tools) & IOCs' },
  { rank: 4, label: 'Attacks', types: ['Attack', 'LogEvent'], description: 'MITRE ATT&CK (embeds technique+tactic) & logs' },
];

function HierarchyLegend() {
  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl">
      <h4 className="text-xs text-neutral-400 uppercase mb-3 font-medium flex items-center gap-2">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Hierarchy (Top → Bottom)
      </h4>
      <div className="space-y-1.5">
        {HIERARCHY_LEVELS.map((level) => (
          <div key={level.rank} className="flex items-center gap-2">
            <div className="w-5 text-[10px] text-neutral-500 font-mono">{level.rank + 1}.</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {level.types.map((type) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[type] || NODE_COLORS.default }}
                  />
                  <span className="text-xs text-neutral-300">{type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// FILTER PANEL
// =============================================================================

// Primary seed node types - Threat, Vulnerability & Asset are the main seed types
// These enable use cases like threat hunting, vulnerability management, or asset hygiene verification
const PRIMARY_SEED_TYPES = new Set(['Threat', 'Vulnerability', 'Asset']);

interface FilterPanelProps {
  nodeTypes: string[];
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  stats: Record<string, number>;
  onClose: () => void;
  onRefresh?: () => void;
  primaryAnchorType?: string | null;
  currentDepth?: number;
  onDepthChange?: (depth: number) => void;
}

function FilterPanel({ nodeTypes, activeFilters, onToggleFilter, stats, onClose, onRefresh, primaryAnchorType, currentDepth, onDepthChange }: FilterPanelProps) {
  // Sort node types by hierarchy, with primary seed types (Threat, Vulnerability, Asset) first
  const sortedTypes = [...nodeTypes].sort((a, b) => {
    // First sort by whether it's a primary seed type
    const aIsSeed = PRIMARY_SEED_TYPES.has(a);
    const bIsSeed = PRIMARY_SEED_TYPES.has(b);
    if (aIsSeed && !bIsSeed) return -1;
    if (!aIsSeed && bIsSeed) return 1;
    
    // Then sort by hierarchy
    const rankA = NODE_TYPE_HIERARCHY[a] ?? 99;
    const rankB = NODE_TYPE_HIERARCHY[b] ?? 99;
    return rankA - rankB;
  });

  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs text-neutral-400 uppercase font-medium">Filter by Type</h4>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-neutral-700 rounded transition-colors group"
              title="Refresh graph with current filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-400 transition-colors" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 mb-2">
        {primaryAnchorType
          ? <>Anchor: <span className="text-green-400 font-medium">{primaryAnchorType}</span> (date-filtered seed)</>
          : 'Select a primary type to set anchor'
        }
      </p>
      <div className="flex flex-wrap gap-2 max-w-xs">
        {sortedTypes.map((type) => {
          const isPrimarySeed = PRIMARY_SEED_TYPES.has(type);
          const isAnchor = type === primaryAnchorType;
          const isSelected = activeFilters.has(type);
          const isActive = activeFilters.size === 0 || isSelected;
          const color = NODE_COLORS[type] || NODE_COLORS.default;
          const count = stats[type] || 0;

          return (
            <button
              key={type}
              onClick={() => onToggleFilter(type)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all
                ${isActive
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800/50 text-neutral-500 opacity-50'
                }
                ${isAnchor ? 'ring-2 ring-green-500' : isPrimarySeed ? 'ring-1 ring-blue-500/30' : ''}
              `}
              title={isAnchor ? `${type} (anchor - date filter applies)` : isSelected && isPrimarySeed ? `${type} (connected to anchor)` : isPrimarySeed ? `${type} (primary seed type)` : `${type} (via hop expansion)`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span>{type}</span>
              {isAnchor && <span className="text-green-400 text-[10px]">⚓</span>}
              <span className="text-neutral-500">({count})</span>
            </button>
          );
        })}
      </div>
      
      {/* Footnote hint: suggest increasing depth when many types selected with low hops */}
      {activeFilters.size >= 3 && currentDepth !== undefined && currentDepth < activeFilters.size - 1 && onDepthChange && (
        <div 
          className="mt-3 pt-2 border-t border-neutral-700/50 text-[10px] text-amber-400 cursor-pointer hover:text-amber-300 transition-colors"
          onClick={() => onDepthChange(activeFilters.size - 1)}
        >
          💡 Tip: With {activeFilters.size} types, increase depth to {activeFilters.size - 1}+ hops to see full chain
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DATE FILTER PANEL
// =============================================================================

interface DateFilterState {
  mode: 'off' | 'single' | 'range';
  singleDate: string; // YYYY-MM-DD format
  startDate: string;  // YYYY-MM-DD format
  endDate: string;    // YYYY-MM-DD format
  applied: boolean;   // Whether the filter has been applied
}

interface DateFilterPanelProps {
  dateFilter: DateFilterState;
  onDateFilterChange: (filter: DateFilterState) => void;
  onClose: () => void;
  filteredCount: number;
  totalCount: number;
}

function DateFilterPanel({ dateFilter, onDateFilterChange, onClose, filteredCount, totalCount }: DateFilterPanelProps) {
  // Local state for editing (not applied until user clicks Apply)
  const [localMode, setLocalMode] = useState<'off' | 'single' | 'range'>(dateFilter.mode);
  const [localSingleDate, setLocalSingleDate] = useState(dateFilter.singleDate);
  const [localStartDate, setLocalStartDate] = useState(dateFilter.startDate);
  const [localEndDate, setLocalEndDate] = useState(dateFilter.endDate);

  // Check if there are pending changes
  const hasChanges = localMode !== dateFilter.mode ||
    localSingleDate !== dateFilter.singleDate ||
    localStartDate !== dateFilter.startDate ||
    localEndDate !== dateFilter.endDate ||
    !dateFilter.applied;

  // Check if the current selection is valid for applying
  const canApply = localMode === 'off' ||
    (localMode === 'single' && localSingleDate) ||
    (localMode === 'range' && localStartDate && localEndDate);

  const handleApply = () => {
    onDateFilterChange({
      mode: localMode,
      singleDate: localSingleDate,
      startDate: localStartDate,
      endDate: localEndDate,
      applied: true,
    });
    onClose(); // Close the panel after applying
  };

  const handleClear = () => {
    setLocalMode('off');
    setLocalSingleDate('');
    setLocalStartDate('');
    setLocalEndDate('');
    onDateFilterChange({
      mode: 'off',
      singleDate: '',
      startDate: '',
      endDate: '',
      applied: true,
    });
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-3 border border-neutral-700 shadow-xl min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs text-neutral-400 uppercase font-medium">Filter by Created Date</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-neutral-700 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      </div>

      {/* Mode Selection */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setLocalMode('off')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'off'
              ? 'bg-neutral-700 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Off
        </button>
        <button
          onClick={() => setLocalMode('single')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'single'
              ? 'bg-cyan-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Specific Date
        </button>
        <button
          onClick={() => setLocalMode('range')}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            localMode === 'range'
              ? 'bg-cyan-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          Date Range
        </button>
      </div>

      {/* Single Date Input */}
      {localMode === 'single' && (
        <div className="space-y-2">
          <label className="text-xs text-neutral-500">Select Date</label>
          <input
            type="date"
            value={localSingleDate}
            onChange={(e) => setLocalSingleDate(e.target.value)}
            max={today}
            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
          />
        </div>
      )}

      {/* Date Range Inputs */}
      {localMode === 'range' && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-neutral-500">From</label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => setLocalStartDate(e.target.value)}
              max={localEndDate || today}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">To</label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => setLocalEndDate(e.target.value)}
              min={localStartDate}
              max={today}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
            />
          </div>
        </div>
      )}

      {/* Apply and Clear Buttons */}
      {localMode !== 'off' && (
        <div className="mt-3 pt-3 border-t border-neutral-700/50 flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={!canApply}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              canApply && hasChanges
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            Apply Filter
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filter Stats */}
      {dateFilter.applied && dateFilter.mode !== 'off' && (
        <div className="mt-2 text-xs text-neutral-400">
          Showing <span className="text-cyan-400 font-medium">{filteredCount}</span> of {totalCount} nodes
        </div>
      )}

      {/* Help text */}
      <p className="mt-3 text-[10px] text-neutral-500 leading-relaxed">
        Filter nodes by their creation date. Note: Nodes only have a created date (not updated date).
      </p>
    </div>
  );
}

// =============================================================================
// EXPLOITABILITY ANALYSIS PANEL
// =============================================================================

interface ExploitabilityPanelProps {
  scores: ExploitabilityScore[];
  loading: boolean;
  onSelectAsset: (assetId: string) => void;
  onClose: () => void;
}

function ExploitabilityPanel({ scores, loading, onSelectAsset, onClose }: ExploitabilityPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-400 bg-red-500/20';
    if (score >= 40) return 'text-amber-400 bg-amber-500/20';
    return 'text-green-400 bg-green-500/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Critical';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      className="absolute left-0 top-0 h-full w-80 bg-neutral-900/95 backdrop-blur-sm border-r border-neutral-700 overflow-y-auto z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Exploitability Analysis</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-red-400 rounded-full" />
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No assets to analyze. Add assets to the graph first.
          </div>
        ) : (
          <div className="space-y-2">
            {scores.map((score) => (
              <div
                key={score.asset_id}
                className="bg-neutral-800/50 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === score.asset_id ? null : score.asset_id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(score.overall_score)}`}>
                      {Math.round(score.overall_score)}
                    </div>
                    <div className="text-left">
                      <div className="text-sm text-white font-medium truncate max-w-[160px]">
                        {score.asset_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {getScoreLabel(score.overall_score)} Risk
                      </div>
                    </div>
                  </div>
                  {expanded === score.asset_id ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                <AnimatePresence>
                  {expanded === score.asset_id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-3 border-t border-neutral-700/50">
                        {/* Component Scores */}
                        <div className="pt-3">
                          <div className="text-xs text-neutral-400 uppercase mb-2">Scores</div>
                          <div className="space-y-1.5">
                            {Object.entries(score.component_scores).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between">
                                <span className="text-xs text-neutral-400 capitalize">
                                  {key.replace(/_/g, ' ')}
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        value >= 70 ? 'bg-red-500' : value >= 40 ? 'bg-amber-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${value}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-neutral-300 w-8 text-right">{Math.round(value)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Threats */}
                        {score.top_threats.length > 0 && (
                          <div>
                            <div className="text-xs text-neutral-400 uppercase mb-1">Top Threats</div>
                            <div className="flex flex-wrap gap-1">
                              {score.top_threats.slice(0, 3).map((threat, i) => (
                                <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">
                                  {threat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Critical Vulnerabilities */}
                        {score.critical_vulnerabilities.length > 0 && (
                          <div>
                            <div className="text-xs text-neutral-400 uppercase mb-1">Critical Vulns</div>
                            <div className="flex flex-wrap gap-1">
                              {score.critical_vulnerabilities.slice(0, 3).map((vuln, i) => (
                                <span key={i} className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
                                  {vuln}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Missing Controls */}
                        {score.missing_controls.length > 0 && (
                          <div>
                            <div className="text-xs text-neutral-400 uppercase mb-1">Missing Controls</div>
                            <div className="flex flex-wrap gap-1">
                              {score.missing_controls.slice(0, 2).map((control, i) => (
                                <span key={i} className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs truncate max-w-full">
                                  {control}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Navigate Button */}
                        <button
                          onClick={() => onSelectAsset(score.asset_id)}
                          className="w-full mt-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
                        >
                          <Target className="w-3 h-3" />
                          Focus in Graph
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// REMEDIATION PRIORITIES PANEL
// =============================================================================

interface RemediationPanelProps {
  recommendations: RemediationRecommendation[];
  loading: boolean;
  onSelectTarget: (targetId: string) => void;
  onClose: () => void;
}

function RemediationPanel({ recommendations, loading, onSelectTarget, onClose }: RemediationPanelProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'patch': return <Zap className="w-3 h-3" />;
      case 'control': return <Shield className="w-3 h-3" />;
      case 'architecture': return <Activity className="w-3 h-3" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'patch': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'control': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'architecture': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      className="absolute left-0 top-0 h-full w-96 bg-neutral-900/95 backdrop-blur-sm border-r border-neutral-700 overflow-y-auto z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Remediation Priorities</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-amber-400 rounded-full" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">
            No remediation recommendations available.
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="bg-neutral-800/50 rounded-lg p-3 border border-neutral-700/50"
              >
                {/* Priority Badge & Type */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-white">
                      {rec.priority_rank}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border ${getTypeColor(rec.remediation_type)}`}>
                      {getTypeIcon(rec.remediation_type)}
                      {rec.remediation_type}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    Score: <span className="text-white font-medium">{Math.round(rec.priority_score)}</span>
                  </div>
                </div>

                {/* Target */}
                <div className="mb-2">
                  <div className="text-xs text-neutral-500 uppercase">Target</div>
                  <div className="text-sm text-white font-medium">{rec.target.name}</div>
                  <div className="text-xs text-neutral-400">{rec.target.type}</div>
                </div>

                {/* Action */}
                <div className="mb-2">
                  <div className="text-xs text-neutral-500 uppercase">Action</div>
                  <div className="text-sm text-neutral-200">{rec.action}</div>
                </div>

                {/* Rationale */}
                <div className="mb-3">
                  <div className="text-xs text-neutral-500 uppercase">Rationale</div>
                  <div className="text-xs text-neutral-400">{rec.rationale}</div>
                </div>

                {/* Impact & Effort */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {rec.impact.affected_assets.length > 0 && (
                      <span className="text-neutral-400">
                        <span className="text-blue-400">{rec.impact.affected_assets.length}</span> assets
                      </span>
                    )}
                    {rec.impact.mitigated_vulnerabilities.length > 0 && (
                      <span className="text-neutral-400">
                        <span className="text-orange-400">{rec.impact.mitigated_vulnerabilities.length}</span> vulns
                      </span>
                    )}
                  </div>
                  <span className={`${getEffortColor(rec.effort_level)} capitalize`}>
                    {rec.effort_level} effort
                  </span>
                </div>

                {/* Navigate Button */}
                {rec.target.id && (
                  <button
                    onClick={() => onSelectTarget(rec.target.id)}
                    className="w-full mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Target className="w-3 h-3" />
                    Focus Target in Graph
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// ATTACK PATH PANEL
// =============================================================================

interface AttackPathPanelProps {
  paths: AttackPathStep[][];
  threatId: string;
  targetAssetId: string;
  loading: boolean;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

function AttackPathPanel({ paths, loading, onSelectNode, onClose }: AttackPathPanelProps) {
  const getStepColor = (type: string) => {
    switch (type) {
      case 'threat': return 'bg-red-500';
      case 'attack': return 'bg-yellow-500';
      case 'category': return 'bg-purple-500';
      case 'asset': return 'bg-blue-500';
      default: return 'bg-neutral-500';
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] max-h-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl overflow-hidden z-10"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Attack Paths</span>
            <span className="text-xs text-neutral-400">({paths.length} found)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-600 border-t-yellow-400 rounded-full" />
          </div>
        ) : paths.length === 0 ? (
          <div className="text-center py-6 text-neutral-500 text-sm">
            No attack paths found between selected threat and asset.
          </div>
        ) : (
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {paths.map((path, pathIndex) => (
              <div key={pathIndex} className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400 mb-2">Path {pathIndex + 1}</div>
                <div className="flex items-center gap-1 flex-wrap">
                  {path.map((step, stepIndex) => (
                    <React.Fragment key={step.step}>
                      <button
                        onClick={() => onSelectNode(step.node_id)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition-colors"
                      >
                        <div className={`w-2 h-2 rounded-full ${getStepColor(step.type)}`} />
                        <span className="text-white">{step.name || step.node_id}</span>
                        <span className="text-neutral-500 capitalize">({step.type})</span>
                      </button>
                      {stepIndex < path.length - 1 && (
                        <span className="text-neutral-500 text-xs px-1">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// RELATIONSHIP TYPE SELECTOR MODAL
// =============================================================================

// Relationship types for consolidated schema
const RELATIONSHIP_TYPES = [
  // Category relationships
  { value: 'BELONGS_TO_CATEGORY', label: 'Belongs to Category', color: EDGE_COLORS.BELONGS_TO_CATEGORY },
  { value: 'APPLIES_TO_CATEGORY', label: 'Applies to Category', color: EDGE_COLORS.APPLIES_TO_CATEGORY },
  // Asset relationships
  { value: 'CONNECTED_TO', label: 'Connected To', color: EDGE_COLORS.CONNECTED_TO },
  { value: 'DEPENDS_ON', label: 'Depends On', color: EDGE_COLORS.DEPENDS_ON },
  { value: 'HAS_SERVICE', label: 'Has Service', color: EDGE_COLORS.HAS_SERVICE },
  { value: 'HAS_IDENTITY', label: 'Has Identity', color: EDGE_COLORS.HAS_IDENTITY },
  // Control relationships
  { value: 'HAS_CONTROL', label: 'Has Control', color: EDGE_COLORS.HAS_CONTROL },
  { value: 'IMPLEMENTS_CONTROL', label: 'Implements Control', color: EDGE_COLORS.IMPLEMENTS_CONTROL },
  { value: 'MITIGATED_BY', label: 'Mitigated By', color: EDGE_COLORS.MITIGATED_BY },
  // Vulnerability relationships
  { value: 'VULNERABLE_TO', label: 'Vulnerable To', color: EDGE_COLORS.VULNERABLE_TO },
  // Threat relationships
  { value: 'HAS_THREAT', label: 'Has Threat', color: EDGE_COLORS.HAS_THREAT },
  { value: 'EXPLOITS', label: 'Exploits', color: EDGE_COLORS.EXPLOITS },
  { value: 'TARGETS', label: 'Targets', color: EDGE_COLORS.TARGETS },
  // Attack relationships (MITRE ATT&CK)
  { value: 'USES_ATTACK', label: 'Uses Attack', color: EDGE_COLORS.USES_ATTACK },
  { value: 'ATTACK_TARGETS', label: 'Attack Targets', color: EDGE_COLORS.ATTACK_TARGETS },
  { value: 'RELATED_ATTACK', label: 'Related Attack', color: EDGE_COLORS.RELATED_ATTACK },
  // Detection relationships
  { value: 'HAS_INDICATOR', label: 'Has Indicator', color: EDGE_COLORS.HAS_INDICATOR },
  { value: 'DETECTED_BY_LOG', label: 'Detected By Log', color: EDGE_COLORS.DETECTED_BY_LOG },
];

// Consolidated 9 node types + LogEvent
const NODE_TYPES = [
  { value: 'AssetCategory', label: 'Asset Category', color: NODE_COLORS.AssetCategory },
  { value: 'Asset', label: 'Asset', color: NODE_COLORS.Asset },
  { value: 'Service', label: 'Service', color: NODE_COLORS.Service },
  { value: 'Identity', label: 'Identity', color: NODE_COLORS.Identity },
  { value: 'Vulnerability', label: 'Vulnerability', color: NODE_COLORS.Vulnerability },
  { value: 'Control', label: 'Security Control', color: NODE_COLORS.Control },
  { value: 'Threat', label: 'Threat', color: NODE_COLORS.Threat },
  { value: 'Indicator', label: 'Indicator (IOC)', color: NODE_COLORS.Indicator },
  { value: 'Attack', label: 'Attack (MITRE)', color: NODE_COLORS.Attack },
  { value: 'LogEvent', label: 'Log Event', color: NODE_COLORS.LogEvent },
];

// =============================================================================
// ADD NODE MODAL
// =============================================================================

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, nodeType: string) => void;
}

function AddNodeModal({ isOpen, onClose, onAdd }: AddNodeModalProps) {
  const [name, setName] = useState('');
  const [nodeType, setNodeType] = useState('Asset');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name.trim(), nodeType);
      setName('');
      setNodeType('Asset');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-green-400" />
            Add New Node
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Select a node type and enter a name for the new node.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Node Type */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Node Type</label>
            <div className="grid grid-cols-3 gap-2">
              {NODE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNodeType(type.value)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    nodeType === type.value
                      ? 'bg-neutral-700 text-white ring-1 ring-white/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Node Name */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Enter ${nodeType.toLowerCase()} name...`}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-2 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
          >
            Add Node
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// ADD RELATIONSHIP MODAL
// =============================================================================

interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sourceId: string, targetId: string, relType: string) => void;
  nodes: CustomNode[];
  selectedNodeId?: string;
}

function AddRelationshipModal({ isOpen, onClose, onAdd, nodes, selectedNodeId }: AddRelationshipModalProps) {
  const [sourceId, setSourceId] = useState(selectedNodeId || '');
  const [targetId, setTargetId] = useState('');
  const [relType, setRelType] = useState('CONNECTED_TO');
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');

  useEffect(() => {
    if (selectedNodeId) {
      setSourceId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const filteredSourceNodes = nodes.filter(n => {
    const data = n.data as CustomNodeData;
    return data.label.toLowerCase().includes(searchSource.toLowerCase()) ||
           data.nodeType.toLowerCase().includes(searchSource.toLowerCase());
  });

  const filteredTargetNodes = nodes.filter(n => {
    const data = n.data as CustomNodeData;
    return n.id !== sourceId && (
      data.label.toLowerCase().includes(searchTarget.toLowerCase()) ||
      data.nodeType.toLowerCase().includes(searchTarget.toLowerCase())
    );
  });

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node ? (node.data as CustomNodeData).label : '';
  };

  const handleSubmit = () => {
    if (sourceId && targetId && relType) {
      onAdd(sourceId, targetId, relType);
      setSourceId('');
      setTargetId('');
      setRelType('CONNECTED_TO');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] max-h-[80vh] bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-blue-400" />
            Add Relationship
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Connect two nodes with a relationship type.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Source Node */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">From Node</label>
            <input
              type="text"
              value={searchSource}
              onChange={(e) => setSearchSource(e.target.value)}
              placeholder="Search source node..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="max-h-32 overflow-y-auto space-y-1 bg-neutral-800/50 rounded-lg p-2">
              {filteredSourceNodes.slice(0, 10).map(node => {
                const data = node.data as CustomNodeData;
                return (
                  <button
                    key={node.id}
                    onClick={() => setSourceId(node.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${
                      sourceId === node.id ? 'bg-blue-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[data.nodeType] || NODE_COLORS.default }} />
                    <span className="truncate">{data.label}</span>
                    <span className="text-xs text-neutral-500 ml-auto">{data.nodeType}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">Relationship</label>
            <div className="flex flex-wrap gap-1.5">
              {RELATIONSHIP_TYPES.map(rel => (
                <button
                  key={rel.value}
                  onClick={() => setRelType(rel.value)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                    relType === rel.value
                      ? 'bg-neutral-700 text-white ring-1 ring-white/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rel.color }} />
                  {rel.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Node */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">To Node</label>
            <input
              type="text"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              placeholder="Search target node..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 mb-2"
            />
            <div className="max-h-32 overflow-y-auto space-y-1 bg-neutral-800/50 rounded-lg p-2">
              {filteredTargetNodes.slice(0, 10).map(node => {
                const data = node.data as CustomNodeData;
                return (
                  <button
                    key={node.id}
                    onClick={() => setTargetId(node.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${
                      targetId === node.id ? 'bg-green-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NODE_COLORS[data.nodeType] || NODE_COLORS.default }} />
                    <span className="truncate">{data.label}</span>
                    <span className="text-xs text-neutral-500 ml-auto">{data.nodeType}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {sourceId && targetId && (
            <div className="bg-neutral-800 rounded-lg p-3 text-center">
              <span className="text-blue-400">{getNodeLabel(sourceId)}</span>
              <span className="text-neutral-500 mx-2">→</span>
              <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: EDGE_COLORS[relType], color: 'white' }}>
                {relType.replace(/_/g, ' ')}
              </span>
              <span className="text-neutral-500 mx-2">→</span>
              <span className="text-green-400">{getNodeLabel(targetId)}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sourceId || !targetId}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
          >
            Add Relationship
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// HANDLE POSITION OPTIONS
// =============================================================================

const HANDLE_POSITIONS = [
  { value: 'top', label: 'Top', icon: '↑' },
  { value: 'bottom', label: 'Bottom', icon: '↓' },
  { value: 'left', label: 'Left', icon: '←' },
  { value: 'right', label: 'Right', icon: '→' },
];

// =============================================================================
// EDIT RELATIONSHIP MODAL
// =============================================================================

interface EditRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (edgeId: string, newRelType: string, sourceHandle?: string, targetHandle?: string) => void;
  edge: Edge | null;
  sourceNodeName?: string;
  targetNodeName?: string;
}

function EditRelationshipModal({ isOpen, onClose, onSave, edge, sourceNodeName, targetNodeName }: EditRelationshipModalProps) {
  const [relType, setRelType] = useState('');
  const [sourceHandle, setSourceHandle] = useState('bottom');
  const [targetHandle, setTargetHandle] = useState('top');
  
  // Track original values to show what's changing
  const [originalSourceHandle, setOriginalSourceHandle] = useState('bottom');
  const [originalTargetHandle, setOriginalTargetHandle] = useState('top');
  const [originalRelType, setOriginalRelType] = useState('');

  // Initialize with current values when edge changes
  useEffect(() => {
    if (edge) {
      // Get the original relationship type from edge data or label
      const currentType = (edge.data as { relationType?: string })?.relationType || 
        (typeof edge.label === 'string' ? edge.label.replace(/ /g, '_') : 'CONNECTED_TO');
      setRelType(currentType);
      setOriginalRelType(currentType);
      
      // Get current handle positions
      const srcHandle = edge.sourceHandle?.replace('source-', '') || 'bottom';
      const tgtHandle = edge.targetHandle?.replace('target-', '') || 'top';
      setSourceHandle(srcHandle);
      setTargetHandle(tgtHandle);
      setOriginalSourceHandle(srcHandle);
      setOriginalTargetHandle(tgtHandle);
    }
  }, [edge]);

  if (!edge) return null;

  const handleSubmit = () => {
    if (relType) {
      onSave(edge.id, relType, `source-${sourceHandle}`, `target-${targetHandle}`);
      onClose();
    }
  };
  
  // Check if anything has changed
  const hasSourceHandleChanged = sourceHandle !== originalSourceHandle;
  const hasTargetHandleChanged = targetHandle !== originalTargetHandle;
  const hasRelTypeChanged = relType !== originalRelType;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[440px] bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Pencil className="w-5 h-5 text-blue-400" />
            Edit Relationship
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            <span className="text-blue-400">{sourceNodeName || 'Source'}</span>
            {' → '}
            <span className="text-green-400">{targetNodeName || 'Target'}</span>
          </DialogDescription>
        </DialogHeader>
        
        {/* Relationship Type */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-400 uppercase mb-2">Relationship Type</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {RELATIONSHIP_TYPES.map(rel => (
              <button
                key={rel.value}
                onClick={() => setRelType(rel.value)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  relType === rel.value
                    ? 'bg-neutral-700 text-white ring-1 ring-white/30'
                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rel.color }} />
                {rel.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connection Points */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {/* Source Handle */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">
              Source Exit Point
            </label>
            <div className="flex gap-1">
              {HANDLE_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => setSourceHandle(pos.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    sourceHandle === pos.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={pos.label}
                >
                  <span className="text-sm">{pos.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Handle */}
          <div>
            <label className="block text-xs text-neutral-400 uppercase mb-2">
              Target Entry Point
            </label>
            <div className="flex gap-1">
              {HANDLE_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => setTargetHandle(pos.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    targetHandle === pos.value
                      ? 'bg-green-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={pos.label}
                >
                  <span className="text-sm">{pos.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Preview with Actual Node Names */}
        <div className="bg-neutral-800 rounded-lg p-4 mb-4">
          <p className="text-[10px] text-neutral-500 uppercase text-center mb-3">Connection Preview</p>
          
          <div className="flex items-center justify-center gap-3">
            {/* Source Node - with all 4 handle positions shown */}
            <div className="relative">
              <div className={`w-24 h-14 bg-blue-600/20 border-2 rounded-lg flex flex-col items-center justify-center ${
                hasSourceHandleChanged ? 'border-blue-400' : 'border-blue-600/50'
              }`}>
                <span className="text-[8px] text-blue-400 uppercase">Source</span>
                <span className="text-[10px] text-blue-300 font-medium truncate px-1 max-w-full">
                  {sourceNodeName || 'Node'}
                </span>
              </div>
              
              {/* All 4 handle positions for source */}
              {/* Top */}
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'top' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'top'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'top' && sourceHandle !== 'top' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Bottom */}
              <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'bottom' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'bottom'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'bottom' && sourceHandle !== 'bottom' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Left */}
              <div className={`absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'left' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'left'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'left' && sourceHandle !== 'left' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Right */}
              <div className={`absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                sourceHandle === 'right' 
                  ? 'bg-blue-500 border-blue-300 scale-110' 
                  : originalSourceHandle === 'right'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalSourceHandle === 'right' && sourceHandle !== 'right' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
            </div>
            
            {/* Arrow with relationship label */}
            <div className="flex flex-col items-center gap-1">
              <div className={`px-2 py-1 rounded text-[9px] font-medium whitespace-nowrap transition-all ${
                hasRelTypeChanged ? 'ring-2 ring-white/30' : ''
              }`}
                   style={{ backgroundColor: EDGE_COLORS[relType] || EDGE_COLORS.default, color: 'white' }}>
                {relType.replace(/_/g, ' ')}
              </div>
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-neutral-500" />
                <div className="w-0 h-0 border-l-4 border-l-neutral-500 border-y-3 border-y-transparent" />
              </div>
            </div>

            {/* Target Node - with all 4 handle positions shown */}
            <div className="relative">
              <div className={`w-24 h-14 bg-green-600/20 border-2 rounded-lg flex flex-col items-center justify-center ${
                hasTargetHandleChanged ? 'border-green-400' : 'border-green-600/50'
              }`}>
                <span className="text-[8px] text-green-400 uppercase">Target</span>
                <span className="text-[10px] text-green-300 font-medium truncate px-1 max-w-full">
                  {targetNodeName || 'Node'}
                </span>
              </div>
              
              {/* All 4 handle positions for target */}
              {/* Top */}
              <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'top' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'top'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'top' && targetHandle !== 'top' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Bottom */}
              <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'bottom' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'bottom'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'bottom' && targetHandle !== 'bottom' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Left */}
              <div className={`absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'left' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'left'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'left' && targetHandle !== 'left' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
              {/* Right */}
              <div className={`absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all ${
                targetHandle === 'right' 
                  ? 'bg-green-500 border-green-300 scale-110' 
                  : originalTargetHandle === 'right'
                    ? 'bg-neutral-600 border-neutral-400'
                    : 'bg-neutral-700 border-neutral-600 opacity-40'
              }`}>
                {originalTargetHandle === 'right' && targetHandle !== 'right' && (
                  <span className="text-[6px] text-neutral-400">○</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Legend and status */}
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center justify-center gap-4 text-[9px]">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Current selection
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-neutral-600 border border-neutral-400" /> Original
              </span>
            </div>
            {(hasSourceHandleChanged || hasTargetHandleChanged) && (
              <p className="text-[10px] text-amber-400 text-center">
                ⚡ Exit: {originalSourceHandle} → {sourceHandle} | Entry: {originalTargetHandle} → {targetHandle}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// NODE CONTEXT MENU
// =============================================================================

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

interface NodeContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onViewDetails: () => void;
  onEditProperties: () => void;
  onAddRelationship: () => void;
  onDeleteNode: () => void;
  onSearchByLabel: () => void;
  editMode: boolean;
  nodeName?: string;
  nodeType?: string;
}

function NodeContextMenu({
  state,
  onClose,
  onViewDetails,
  onEditProperties,
  onAddRelationship,
  onDeleteNode,
  onSearchByLabel,
  editMode,
  nodeName,
  nodeType,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Close on outside click (delayed to prevent immediate close on the triggering right-click)
  useEffect(() => {
    if (!state.isOpen) {
      isFirstRender.current = true;
      return;
    }

    // Delay attaching the listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      isFirstRender.current = false;
    }, 100);

    const handleClick = (e: MouseEvent) => {
      // Ignore the initial right-click that opened the menu
      if (isFirstRender.current) return;
      
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Close menu on right-click outside
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen) return null;

  const color = NODE_COLORS[nodeType || ''] || NODE_COLORS.default;

  // Use portal to render context menu at document body level
  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed z-[9999] bg-neutral-900 rounded-lg border border-neutral-700 shadow-2xl py-1 min-w-[180px]"
      style={{ 
        left: state.x, 
        top: state.y,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Node Header */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{nodeName || 'Unknown'}</div>
            <div className="text-[10px] text-neutral-500 uppercase">{nodeType || 'Node'}</div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-1">
        {/* View Details */}
        <button
          onClick={() => {
            onViewDetails();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Eye className="w-4 h-4 text-neutral-400" />
          <span>View Details</span>
        </button>

        {/* Search by Label */}
        <button
          onClick={() => {
            onSearchByLabel();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Search className="w-4 h-4 text-neutral-400" />
          <span>Search by Label</span>
        </button>

        {/* Edit Properties */}
        <button
          onClick={() => {
            onEditProperties();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Pencil className="w-4 h-4 text-neutral-400" />
          <span>Edit Properties</span>
        </button>

        {/* Add Relationship - only in edit mode or always available */}
        <button
          onClick={() => {
            onAddRelationship();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          <Link className="w-4 h-4 text-blue-400" />
          <span>Add Relationship</span>
        </button>

        {/* Separator */}
        <div className="my-1 border-t border-neutral-700" />

        {/* Delete Node - only in edit mode */}
        {editMode && (
          <button
            onClick={() => {
              onDeleteNode();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Node</span>
          </button>
        )}
      </div>
    </motion.div>,
    document.body
  );
}

// =============================================================================
// EDIT NODE PROPERTIES MODAL
// =============================================================================

interface EditNodePropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, properties: Record<string, unknown>) => void;
  node: CustomNode | null;
}

function EditNodePropertiesModal({ isOpen, onClose, onSave, node }: EditNodePropertiesModalProps) {
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Initialize properties when node changes
  useEffect(() => {
    if (node) {
      const nodeData = node.data as CustomNodeData;
      const props: Record<string, string> = {};
      if (nodeData.properties) {
        Object.entries(nodeData.properties).forEach(([key, value]) => {
          props[key] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
        });
      }
      setProperties(props);
    }
  }, [node]);

  if (!node) return null;

  const nodeData = node.data as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;

  const handlePropertyChange = (key: string, value: string) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handleRemoveProperty = (key: string) => {
    setProperties(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleAddProperty = () => {
    if (newKey.trim()) {
      setProperties(prev => ({ ...prev, [newKey.trim()]: newValue }));
      setNewKey('');
      setNewValue('');
    }
  };

  const handleSave = () => {
    // Convert string values back to appropriate types
    const typedProperties: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, value]) => {
      // Try to parse as JSON for arrays/objects
      try {
        if (value.startsWith('[') || value.startsWith('{')) {
          typedProperties[key] = JSON.parse(value);
        } else if (value.includes(',') && !value.includes(':')) {
          // Treat comma-separated values as arrays
          typedProperties[key] = value.split(',').map(v => v.trim());
        } else if (!isNaN(Number(value)) && value !== '') {
          typedProperties[key] = Number(value);
        } else if (value === 'true') {
          typedProperties[key] = true;
        } else if (value === 'false') {
          typedProperties[key] = false;
        } else {
          typedProperties[key] = value;
        }
      } catch {
        typedProperties[key] = value;
      }
    });

    onSave(node.id, typedProperties);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px] max-h-[80vh] bg-neutral-900 border-neutral-700 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-white">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            Edit Properties
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {nodeData.label} - {nodeData.nodeType}
          </DialogDescription>
        </DialogHeader>

        {/* Properties List */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {Object.entries(properties).map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">{key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handlePropertyChange(key, e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => handleRemoveProperty(key)}
                className="mt-6 p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-600/10 rounded transition-colors"
                title="Remove property"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {Object.keys(properties).length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">No properties defined</p>
          )}
        </div>

        {/* Add New Property */}
        <div className="border-t border-neutral-700 pt-4 mb-4">
          <p className="text-xs text-neutral-400 uppercase mb-2">Add New Property</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Property name"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
            />
            <button
              onClick={handleAddProperty}
              disabled={!newKey.trim()}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Properties
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RelationshipSelectorProps {
  isOpen: boolean;
  connection: Connection | null;
  onSelect: (relType: string) => void;
  onCancel: () => void;
  sourceNodeName?: string;
  targetNodeName?: string;
}

function RelationshipSelector({ 
  isOpen, 
  connection, 
  onSelect, 
  onCancel,
  sourceNodeName,
  targetNodeName,
}: RelationshipSelectorProps) {
  if (!connection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-xs bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="text-white">Select Relationship Type</DialogTitle>
          <DialogDescription className="text-neutral-400">
            <span className="text-blue-400">{sourceNodeName}</span>
            {' → '}
            <span className="text-green-400">{targetNodeName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
          {RELATIONSHIP_TYPES.map((rel) => (
            <button
              key={rel.value}
              onClick={() => onSelect(rel.value)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors text-left"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: rel.color }}
              />
              <span className="text-sm text-white">{rel.label}</span>
            </button>
          ))}
        </div>
        
        <button
          onClick={onCancel}
          className="mt-4 w-full py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// PENDING CHANGES TRACKER
// =============================================================================

interface PendingNodeData {
  id: string;
  name: string;
  nodeType: string;
}

interface PendingChanges {
  addedEdges: Edge[];
  deletedEdgeIds: string[];
  deletedNodeIds: string[];
  addedNodes: PendingNodeData[];
}

// =============================================================================
// DEMO/SAMPLE DATA (shown when backend has no data)
// =============================================================================

const DEMO_GRAPH_DATA: GraphData = {
  nodes: [
    // Asset Category - created 5 days ago
    { id: 'cat-web', name: 'Web Servers', label: 'AssetCategory', properties: { description: 'Web application servers' }, created_at: '2026-01-06T10:00:00Z' },
    { id: 'cat-db', name: 'Databases', label: 'AssetCategory', properties: { description: 'Database systems' }, created_at: '2026-01-06T10:00:00Z' },
    // Assets - created 4 days ago
    { id: 'asset-web1', name: 'web-prod-01', label: 'Asset', properties: { asset_type: 'web_server', criticality: 'high', ip_addresses: ['10.0.1.10'] }, created_at: '2026-01-07T14:30:00Z' },
    { id: 'asset-db1', name: 'db-prod-01', label: 'Asset', properties: { asset_type: 'database', criticality: 'critical', ip_addresses: ['10.0.2.10'] }, created_at: '2026-01-07T14:30:00Z' },
    // Identity - created 3 days ago
    { id: 'id-admin', name: 'admin@company.com', label: 'Identity', properties: { identity_type: 'user', privileged: true, roles: ['admin'], has_mfa: true }, created_at: '2026-01-08T09:00:00Z' },
    { id: 'id-svc', name: 'svc-webapp', label: 'Identity', properties: { identity_type: 'service_account', privileged: false, roles: ['read'] }, created_at: '2026-01-08T09:00:00Z' },
    // Vulnerability - created 2 days ago
    { id: 'vuln-1', name: 'CVE-2024-1234', label: 'Vulnerability', properties: { severity: 'critical', cvss: 9.8, description: 'Remote code execution' }, created_at: '2026-01-09T16:00:00Z' },
    // Control - created yesterday
    { id: 'ctrl-1', name: 'Enable TLS 1.3', label: 'Control', properties: { control_type: 'preventive', maturity_level: 'basic', status: 'implemented' }, created_at: '2026-01-10T11:00:00Z' },
    { id: 'ctrl-2', name: 'Database Encryption', label: 'Control', properties: { control_type: 'preventive', maturity_level: 'intermediate', status: 'not_implemented' }, created_at: '2026-01-10T11:00:00Z' },
    // Threat - created today
    { id: 'threat-1', name: 'APT29 Campaign', label: 'Threat', properties: { threat_actor: 'APT29', threat_actor_type: 'nation-state', campaign: 'SolarWinds', tools: ['Cobalt Strike'], malware: ['SUNBURST'] }, created_at: '2026-01-11T08:00:00Z' },
    // Attack (MITRE ATT&CK) - created today
    { id: 'attack-1', name: 'T1566', label: 'Attack', properties: { technique_id: 'T1566', technique_name: 'Phishing', tactic: 'Initial Access', tactic_id: 'TA0001' }, created_at: '2026-01-11T08:30:00Z' },
    { id: 'attack-2', name: 'T1059', label: 'Attack', properties: { technique_id: 'T1059', technique_name: 'Command and Scripting Interpreter', tactic: 'Execution', tactic_id: 'TA0002' }, created_at: '2026-01-11T08:30:00Z' },
    // Indicator - created today
    { id: 'ioc-1', name: '192.168.1.100', label: 'Indicator', properties: { indicator_type: 'ip', source: 'threat_intel' }, created_at: '2026-01-11T09:00:00Z' },
    { id: 'ioc-2', name: 'malware.evil.com', label: 'Indicator', properties: { indicator_type: 'domain', source: 'threat_intel' }, created_at: '2026-01-11T09:00:00Z' },
    // LogEvent - created today
    { id: 'log-1', name: 'EVT-4625', label: 'LogEvent', properties: { event_type: 'authentication', source: 'windows_security', description: 'Failed login attempt' }, created_at: '2026-01-11T09:30:00Z' },
  ],
  edges: [
    // Asset -> Category
    { id: 'e1', source: 'asset-web1', target: 'cat-web', label: 'BELONGS_TO_CATEGORY', properties: {} },
    { id: 'e2', source: 'asset-db1', target: 'cat-db', label: 'BELONGS_TO_CATEGORY', properties: {} },
    // Asset -> Identity
    { id: 'e3', source: 'asset-db1', target: 'id-admin', label: 'HAS_IDENTITY', properties: {} },
    { id: 'e4', source: 'asset-web1', target: 'id-svc', label: 'HAS_IDENTITY', properties: {} },
    // Asset -> Vulnerability
    { id: 'e5', source: 'asset-web1', target: 'vuln-1', label: 'VULNERABLE_TO', properties: {} },
    // Asset -> Control
    { id: 'e6', source: 'asset-web1', target: 'ctrl-1', label: 'HAS_CONTROL', properties: {} },
    { id: 'e7', source: 'asset-db1', target: 'ctrl-2', label: 'HAS_CONTROL', properties: {} },
    // Control -> Category
    { id: 'e8', source: 'ctrl-1', target: 'cat-web', label: 'APPLIES_TO_CATEGORY', properties: {} },
    // Asset -> Threat
    { id: 'e9', source: 'asset-web1', target: 'threat-1', label: 'HAS_THREAT', properties: {} },
    // Threat -> Attack
    { id: 'e10', source: 'threat-1', target: 'attack-1', label: 'USES_ATTACK', properties: {} },
    { id: 'e11', source: 'threat-1', target: 'attack-2', label: 'USES_ATTACK', properties: {} },
    // Attack -> Indicator
    { id: 'e12', source: 'attack-1', target: 'ioc-1', label: 'HAS_INDICATOR', properties: {} },
    { id: 'e13', source: 'attack-1', target: 'ioc-2', label: 'HAS_INDICATOR', properties: {} },
    // Attack -> LogEvent
    { id: 'e14', source: 'attack-1', target: 'log-1', label: 'DETECTED_BY_LOG', properties: {} },
    // Attack -> Category
    { id: 'e15', source: 'attack-1', target: 'cat-web', label: 'ATTACK_TARGETS', properties: {} },
    // Related attacks (kill chain)
    { id: 'e16', source: 'attack-1', target: 'attack-2', label: 'RELATED_ATTACK', properties: {} },
  ],
};

const DEMO_STATS: GraphStats = {
  node_count: DEMO_GRAPH_DATA.nodes.length,
  edge_count: DEMO_GRAPH_DATA.edges.length,
  nodes_by_label: DEMO_GRAPH_DATA.nodes.reduce((acc, n) => {
    acc[n.label] = (acc[n.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  edges_by_label: DEMO_GRAPH_DATA.edges.reduce((acc, e) => {
    acc[e.label] = (acc[e.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
};

// =============================================================================
// INTERNAL FLOW COMPONENT
// =============================================================================

interface InternalFlowProps {
  graphData: GraphData | null;
  stats: GraphStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;  // Simple refresh - data is cached, filtering is client-side
  endpoint?: string;
  isShowingDemoData?: boolean;
  onLoadDemoData?: () => void;
  loadingProgress?: { current: number; total: number } | null;
  isBackgroundFetching?: boolean;
}

// Minimum zoom level to ensure nodes are readable
const MIN_READABLE_ZOOM = 0.4;
const MAX_INITIAL_ZOOM = 1.2;
const IDEAL_ZOOM = 0.8;

function InternalFlow({ graphData, stats, loading, error, onRefresh, endpoint, isShowingDemoData, onLoadDemoData, loadingProgress, isBackgroundFetching }: InternalFlowProps) {
  const { fitView, setCenter, getNode, setViewport, getViewport } = useReactFlow();
  
  // Track current zoom level for display
  const [currentZoom, setCurrentZoom] = useState(1);
  
  // Load stored layout preferences on mount
  const storedLayout = useMemo(() => getStoredLayout(), []);
  
  // Track container dimensions for responsive layout
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
  
  // Observe container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth || 1200,
        height: container.clientHeight || 800,
      });
    };
    
    // Initial size
    updateSize();
    
    // Observe resize
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<CustomNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilteredNodeIds, setSearchFilteredNodeIds] = useState<Set<string> | null>(null);
  const [filterMaxHops, setFilterMaxHops] = useState<number | undefined>(1); // Default to 1 hop for directly connected nodes
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(storedLayout?.preferences?.showLegend ?? false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  // Primary anchor seed type - the FIRST selected primary seed type
  // Only this type is used as seeds for date filtering
  // All other selected types (including other primary types) only appear via hop expansion
  const [primaryAnchorType, setPrimaryAnchorType] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(storedLayout?.preferences?.showMinimap ?? true);
  
  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    mode: 'off',
    singleDate: '',
    startDate: '',
    endDate: '',
    applied: true,
  });
  
  // Quick time range presets - start with 'today' for fast initial load
  type TimeRangePreset = 'today' | '3d' | 'week' | 'month' | 'all';
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRangePreset>('today');
  const [initialFilterApplied, setInitialFilterApplied] = useState(false);
  
  // Layout settings state for customizing graph appearance
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>({
    ...DEFAULT_LAYOUT_SETTINGS,
  });
  
  // Update a single layout setting
  const updateLayoutSetting = useCallback(<K extends keyof LayoutSettings>(
    key: K,
    value: LayoutSettings[K]
  ) => {
    setLayoutSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Helper to get date string N days ago
  const getDateDaysAgo = useCallback((days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }, []);
  
  // Apply quick time range - filtering is done client-side using cached data
  const applyTimeRange = useCallback((range: TimeRangePreset) => {
    setActiveTimeRange(range);
    const today = new Date().toISOString().split('T')[0];
    
    if (range === 'all') {
      setDateFilter({
        mode: 'off',
        singleDate: '',
        startDate: '',
        endDate: '',
        applied: true,
      });
    } else if (range === 'today') {
      setDateFilter({
        mode: 'single',
        singleDate: today,
        startDate: '',
        endDate: '',
        applied: true,
      });
    } else {
      const daysMap: Record<TimeRangePreset, number> = {
        'today': 0,
        '3d': 3,
        'week': 7,
        'month': 30,
        'all': 0,
      };
      const startDate = getDateDaysAgo(daysMap[range]);
      setDateFilter({
        mode: 'range',
        singleDate: '',
        startDate: startDate,
        endDate: today,
        applied: true,
      });
    }
    // No backend call needed - filtering is applied client-side to cached data
  }, [getDateDaysAgo]);
  
  // Apply initial 'today' filter on first load
  useEffect(() => {
    if (initialFilterApplied) return;
    
    // Apply 'today' filter as default for fast initial load
    const today = new Date().toISOString().split('T')[0];
    setDateFilter({
      mode: 'single',
      singleDate: today,
      startDate: '',
      endDate: '',
      applied: true,
    });
    setInitialFilterApplied(true);
    console.log('[AssetGraph] Applied initial "today" filter for fast load');
  }, [initialFilterApplied]);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [showRelationshipSelector, setShowRelationshipSelector] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    addedEdges: [],
    deletedEdgeIds: [],
    deletedNodeIds: [],
    addedNodes: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    nodeId: null,
  });
  const [showEditPropertiesModal, setShowEditPropertiesModal] = useState(false);
  const [editingNode, setEditingNode] = useState<CustomNode | null>(null);
  
  // Edit relationship state
  const [showEditRelationshipModal, setShowEditRelationshipModal] = useState(false);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  
  // Analysis panels state
  const [showExploitabilityPanel, setShowExploitabilityPanel] = useState(false);
  const [showRemediationPanel, setShowRemediationPanel] = useState(false);
  const [showAttackPathPanel, setShowAttackPathPanel] = useState(false);
  const [exploitabilityScores, setExploitabilityScores] = useState<ExploitabilityScore[]>([]);
  const [remediationRecommendations, setRemediationRecommendations] = useState<RemediationRecommendation[]>([]);
  const [attackPaths, setAttackPaths] = useState<AttackPathStep[][]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedThreatForPath, setSelectedThreatForPath] = useState<string>('');
  const [selectedAssetForPath, setSelectedAssetForPath] = useState<string>('');
  
  // Track if there are unsaved changes
  const hasUnsavedChanges = pendingChanges.addedEdges.length > 0 || 
    pendingChanges.deletedEdgeIds.length > 0 || 
    pendingChanges.deletedNodeIds.length > 0 ||
    (pendingChanges.addedNodes?.length || 0) > 0;

  // Helper function to check if a node matches the date filter
  // All node types are filtered uniformly by date
  const nodeMatchesDateFilter = useCallback((node: { label?: string; created_at?: string; properties?: Record<string, unknown> }) => {
    // Only filter if applied flag is true
    if (!dateFilter.applied) return true;
    if (dateFilter.mode === 'off') return true;
    
    // Try to get created_at from node directly or from properties
    let nodeCreatedAt = node.created_at;
    
    // If no direct created_at, check if it's in properties (some APIs embed it there)
    if (!nodeCreatedAt && node.properties) {
      nodeCreatedAt = node.properties.created_at as string | undefined;
    }
    
    if (!nodeCreatedAt) {
      // If no created_at field anywhere, include the node (don't filter it out)
      return true;
    }
    
    // Parse the node's created_at date (ISO format)
    try {
      const nodeDate = new Date(nodeCreatedAt);
      if (isNaN(nodeDate.getTime())) {
        // Invalid date, include the node
        return true;
      }
      const nodeDateStr = nodeDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (dateFilter.mode === 'single' && dateFilter.singleDate) {
        return nodeDateStr === dateFilter.singleDate;
      }
      
      if (dateFilter.mode === 'range' && dateFilter.startDate && dateFilter.endDate) {
        return nodeDateStr >= dateFilter.startDate && nodeDateStr <= dateFilter.endDate;
      }
    } catch {
      // Date parsing failed, include the node
      return true;
    }
    
    return true; // If filter is incomplete, show all nodes
  }, [dateFilter]);

  // Convert API data to ReactFlow format
  // Helper function to get nodes within N hops using BFS
  // Optional typeFilter: if provided, only traverse through nodes of these types
  const getNodesWithinHops = useCallback((
    startNodeIds: Set<string>,
    maxHops: number,
    allNodes: GraphData['nodes'],
    allEdges: GraphData['edges'],
    typeFilter?: Set<string>
  ): Set<string> => {
    if (!allNodes || !allEdges) return startNodeIds;
    
    const result = new Set(startNodeIds);
    let frontier = new Set(startNodeIds);
    
    // Build a map of node id -> node label for type checking
    const nodeLabels = new Map<string, string>();
    allNodes.forEach(n => nodeLabels.set(n.id, n.label));
    
    // Build adjacency list for faster traversal
    const adjacency = new Map<string, Set<string>>();
    allEdges.forEach(edge => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    });
    
    // BFS up to maxHops
    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier = new Set<string>();
      frontier.forEach(nodeId => {
        const neighbors = adjacency.get(nodeId);
        if (neighbors) {
          neighbors.forEach(neighborId => {
            if (!result.has(neighborId)) {
              // Check if neighbor exists in our node set
              const neighborLabel = nodeLabels.get(neighborId);
              if (neighborLabel) {
                // If type filter is active, only include nodes of selected types
                if (typeFilter && typeFilter.size > 0) {
                  if (!typeFilter.has(neighborLabel)) {
                    return; // Skip nodes that don't match type filter
                  }
                }
                result.add(neighborId);
                nextFrontier.add(neighborId);
              }
            }
          });
        }
      });
      frontier = nextFrontier;
      if (frontier.size === 0) break;
    }
    
    return result;
  }, []);

  useEffect(() => {
    if (!graphData) return;

    // Get stored layout for position restoration
    const stored = getStoredLayout();

    // ==========================================================================
    // GRAPH NAVIGATION LOGIC
    // Two navigation modes:
    // 1. Date Filter Navigation: Get primary seed nodes (Threat, Vulnerability, Asset)
    //    matching date filter, then expand by hops to get connected nodes of ANY type
    // 2. Search Navigation: Find nodes by label, ignore date filter, respect depth & type
    // ==========================================================================
    
    const filtersActive: string[] = [];
    const isDateFilterActive = dateFilter.applied && dateFilter.mode !== 'off';
    const isSearchActive = searchFilteredNodeIds !== null && searchFilteredNodeIds.size > 0;
    
    let filteredApiNodes: typeof graphData.nodes;
    
    if (isSearchActive) {
      // =======================================================================
      // SEARCH NAVIGATION MODE
      // When user searches by node label:
      // - Ignore date filter
      // - Respect depth (hops) configuration
      // - Respect filter by type for display filtering
      // =======================================================================
      filtersActive.push('search');
      
      // Get all nodes from search results (already includes connected nodes via backend)
      const searchResultNodes = graphData.nodes.filter(n => searchFilteredNodeIds.has(n.id));
      
      // Apply type filter if active (filters displayed nodes from search results)
      if (activeFilters.size > 0) {
        filtersActive.push(`type(${activeFilters.size})`);
        filteredApiNodes = searchResultNodes.filter(n => activeFilters.has(n.label));
      } else {
        filteredApiNodes = searchResultNodes;
      }
      
      console.log(`[AssetGraph] Search navigation: ${searchFilteredNodeIds.size} search results -> ${filteredApiNodes.length} nodes displayed (type filter: ${activeFilters.size > 0 ? 'active' : 'off'})`);
      
    } else if (isDateFilterActive) {
      // =======================================================================
      // DATE FILTER NAVIGATION MODE
      // Primary seed types: Threat, Vulnerability, Asset
      // - When type filter is active: use FIRST selected primary type as anchor seed
      // - Other types (including other primary types) only appear if connected via hops
      // - This ensures e.g., Threats only show if connected to Vulnerabilities
      // =======================================================================
      filtersActive.push('date');
      
      // Use primary anchor type from state (the FIRST selected primary seed type)
      // Only the primary anchor type nodes are seeds for date filtering
      // All other selected types only appear if connected via hops
      
      // Step 1: Get seed nodes - ONLY primary anchor type matching date filter
      const seedNodes = graphData.nodes.filter(n => {
        // Apply date filter first
        if (!nodeMatchesDateFilter(n)) return false;
        
        if (primaryAnchorType) {
          // Only the primary anchor type nodes are seeds
          return n.label === primaryAnchorType;
        } else {
          // No anchor set - use all primary seed types as seeds
          return PRIMARY_SEED_TYPES.has(n.label);
        }
      });
      
      const seedNodeIds = new Set(seedNodes.map(n => n.id));
      console.log(`[AssetGraph] Date filter: ${seedNodes.length} seed nodes (primary anchor: ${primaryAnchorType || 'all primary types'})`);
      
      // Step 2: CHAINED EXPANSION
      // Expand from visible nodes, adding nodes of selected types only
      // This creates a chain: Anchor → Type2 → Type3 (each connected via hops)
      // filterMaxHops: undefined = 'all', 0 = no expansion, N = N hops
      const shouldExpand = seedNodeIds.size > 0 && filterMaxHops !== 0;
      
      if (shouldExpand && activeFilters.size > 0) {
        const effectiveHops = filterMaxHops ?? 100;
        
        // Build adjacency list for efficient traversal
        const adjacency = new Map<string, Set<string>>();
        graphData.edges.forEach(edge => {
          if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
          if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
          adjacency.get(edge.source)!.add(edge.target);
          adjacency.get(edge.target)!.add(edge.source);
        });
        
        // Node labels map for type checking
        const nodeLabels = new Map<string, string>();
        graphData.nodes.forEach(n => nodeLabels.set(n.id, n.label));
        
        // Start with seed nodes (anchor type)
        const visibleNodeIds = new Set(seedNodeIds);
        
        // Chained BFS: at each hop, expand from ALL visible nodes
        // but only ADD nodes of SELECTED types
        for (let hop = 0; hop < effectiveHops; hop++) {
          const newNodes = new Set<string>();
          
          visibleNodeIds.forEach(nodeId => {
            const neighbors = adjacency.get(nodeId);
            if (neighbors) {
              neighbors.forEach(neighborId => {
                if (!visibleNodeIds.has(neighborId)) {
                  const neighborLabel = nodeLabels.get(neighborId);
                  // Only add if it's a selected type
                  if (neighborLabel && activeFilters.has(neighborLabel)) {
                    newNodes.add(neighborId);
                  }
                }
              });
            }
          });
          
          if (newNodes.size === 0) break;
          newNodes.forEach(id => visibleNodeIds.add(id));
        }
        
        filtersActive.push(`type(${activeFilters.size})`);
        filteredApiNodes = graphData.nodes.filter(n => visibleNodeIds.has(n.id));
        console.log(`[AssetGraph] Chained expansion ${filterMaxHops ?? 'all'} hop(s): ${seedNodes.length} seeds -> ${filteredApiNodes.length} nodes (types: ${[...activeFilters].join(', ')})`);
        
      } else if (shouldExpand) {
        // No type filter - expand to ALL connected nodes
        const effectiveHops = filterMaxHops ?? 100;
        const expandedNodeIds = getNodesWithinHops(
          seedNodeIds,
          effectiveHops,
          graphData.nodes,
          graphData.edges
        );
        filteredApiNodes = graphData.nodes.filter(n => expandedNodeIds.has(n.id));
        console.log(`[AssetGraph] Expanded ${filterMaxHops ?? 'all'} hop(s): ${filteredApiNodes.length} total nodes`);
        
      } else {
        // No hop expansion (hops = 0) - just show seed nodes (with optional type filter)
        if (activeFilters.size > 0) {
          filtersActive.push(`type(${activeFilters.size})`);
          filteredApiNodes = seedNodes.filter(n => activeFilters.has(n.label));
        } else {
          filteredApiNodes = seedNodes;
        }
      }
      
      console.log(`[AssetGraph] Filters [${filtersActive.join(', ')}] with ${filterMaxHops ?? 'all'} hops: ${filteredApiNodes.length} nodes displayed`);
      
    } else {
      // =======================================================================
      // NO DATE FILTER ACTIVE
      // Show all nodes with optional type filter
      // =======================================================================
      if (activeFilters.size > 0) {
        filtersActive.push(`type(${activeFilters.size})`);
        filteredApiNodes = graphData.nodes.filter(n => activeFilters.has(n.label));
        console.log(`[AssetGraph] Type filter only: ${filteredApiNodes.length} nodes`);
      } else {
        // No filters - show all nodes
        filteredApiNodes = graphData.nodes;
        console.log(`[AssetGraph] No filters: showing all ${filteredApiNodes.length} nodes`);
      }
    }

    // Create filteredNodeIds for edge filtering
    const filteredNodeIds = new Set(filteredApiNodes.map(n => n.id));

    // Convert to ReactFlow nodes - use stored positions if available
    const flowNodes: CustomNode[] = filteredApiNodes.map((node) => {
      const storedPosition = stored?.nodePositions?.[node.id];
      return {
        id: node.id,
        type: 'custom',
        position: storedPosition || { x: 0, y: 0 }, // Use stored or default
        data: {
          label: node.name,
          nodeType: node.label,
          properties: node.properties,
        },
      };
    });

    // Build a map of node positions for edge handle calculation
    const nodePositionMap = new Map<string, { x: number; y: number; level: number }>();
    filteredApiNodes.forEach((node) => {
      const level = getNodeRank(node.label);
      nodePositionMap.set(node.id, { x: 0, y: 0, level });
    });

    // Relationship type to handle side mapping
    // This spreads edges across different sides of nodes based on relationship semantics
    const getHandlesByRelationship = (relType: string, levelDiff: number): { source: string; target: string } => {
      // Category relationships - use top/bottom (hierarchical)
      if (relType.includes('CATEGORY') || relType === 'BELONGS_TO') {
        return levelDiff >= 0 
          ? { source: 'source-bottom', target: 'target-top' }
          : { source: 'source-top', target: 'target-bottom' };
      }
      
      // Vulnerability/Threat relationships - use right side
      if (relType.includes('VULNERABILITY') || relType.includes('VULNERABLE') || 
          relType === 'EXPLOITS' || relType === 'HAS_THREAT' || relType === 'TARGETS') {
        return { source: 'source-right', target: 'target-left' };
      }
      
      // Control/Mitigation relationships - use left side
      if (relType.includes('CONTROL') || relType.includes('MITIGATED') || relType.includes('IMPLEMENTS')) {
        return { source: 'source-left', target: 'target-right' };
      }
      
      // Attack/MITRE relationships - use bottom-right diagonal
      if (relType.includes('ATTACK') || relType === 'USES_ATTACK') {
        return levelDiff >= 0
          ? { source: 'source-bottom', target: 'target-left' }
          : { source: 'source-right', target: 'target-top' };
      }
      
      // Indicator/Detection relationships - use left
      if (relType.includes('INDICATOR') || relType.includes('DETECTED') || relType.includes('LOG')) {
        return { source: 'source-left', target: 'target-right' };
      }
      
      // Asset connections - based on hierarchy level
      if (relType === 'CONNECTED_TO' || relType === 'DEPENDS_ON' || relType.includes('SERVICE') || relType.includes('IDENTITY')) {
        if (levelDiff > 0) return { source: 'source-bottom', target: 'target-top' };
        if (levelDiff < 0) return { source: 'source-top', target: 'target-bottom' };
        return { source: 'source-right', target: 'target-left' };
      }
      
      // Default: based on hierarchy level
      if (levelDiff > 0) return { source: 'source-bottom', target: 'target-top' };
      if (levelDiff < 0) return { source: 'source-top', target: 'target-bottom' };
      return { source: 'source-right', target: 'target-left' };
    };

    // Convert to ReactFlow edges with relationship-based colors and smart handle selection
    const flowEdges: Edge[] = graphData.edges
      .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      .map((edge) => {
        const edgeColor = EDGE_COLORS[edge.label] || EDGE_COLORS.default;
        
        // Check for stored handle positions first
        const storedHandles = stored?.edgeHandles?.[edge.id];
        let sourceHandle = storedHandles?.sourceHandle || 'source-bottom';
        let targetHandle = storedHandles?.targetHandle || 'target-top';
        
        // If no stored handles, determine based on relationship type and hierarchy
        if (!storedHandles) {
          const sourceNode = nodePositionMap.get(edge.source);
          const targetNode = nodePositionMap.get(edge.target);
          
          if (sourceNode && targetNode) {
            const levelDiff = targetNode.level - sourceNode.level;
            const handles = getHandlesByRelationship(edge.label, levelDiff);
            sourceHandle = handles.source;
            targetHandle = handles.target;
          }
        }
        
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle,
          targetHandle,
          label: edge.label.replace(/_/g, ' '), // Make labels more readable
          type: 'smoothstep',
          animated: false,
          pathOptions: {
            offset: 15,
            borderRadius: 20,
          },
          style: { 
            stroke: edgeColor, 
            strokeWidth: 2,
            strokeOpacity: 0.8,
          },
          labelStyle: { 
            fill: edgeColor, 
            fontSize: 9, 
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
          },
          labelBgStyle: { 
            fill: '#111827', 
            fillOpacity: 0.9,
          },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: edgeColor,
          },
        };
      });

    // Check if any filters are active - if so, always recalculate layout
    // to properly arrange the filtered subset of nodes
    const hasActiveFilters = activeFilters.size > 0 || 
      searchFilteredNodeIds !== null || 
      (dateFilter.applied && dateFilter.mode !== 'off');

    // Check if stored positions are valid and match current nodes
    // This detects schema migrations where node IDs have changed
    let useStoredLayout = false;
    
    // Only consider stored layout when no filters are active
    if (!hasActiveFilters && stored?.nodePositions) {
      const storedNodeIds = new Set(Object.keys(stored.nodePositions));
      const currentNodeIds = new Set(flowNodes.map(n => n.id));
      
      // Count how many current nodes have stored positions
      const matchingNodes = flowNodes.filter(n => storedNodeIds.has(n.id)).length;
      const matchPercentage = flowNodes.length > 0 ? matchingNodes / flowNodes.length : 0;
      
      // Count how many stored positions reference non-existent nodes (stale data)
      const stalePositions = [...storedNodeIds].filter(id => !currentNodeIds.has(id)).length;
      
      console.log(`[AssetGraph] Layout cache check: ${matchingNodes}/${flowNodes.length} nodes have stored positions (${(matchPercentage * 100).toFixed(0)}%), ${stalePositions} stale positions`);
      
      // Use stored layout if:
      // - More than 50% of current nodes have stored positions
      // - AND stale positions don't outnumber valid ones (indicates schema change)
      if (matchPercentage > 0.5 && stalePositions < matchingNodes) {
        useStoredLayout = true;
      } else if (stalePositions > 0) {
        // Auto-clear stale layout cache (e.g., after schema migration)
        console.log(`[AssetGraph] Clearing stale layout cache (${stalePositions} orphaned positions detected)`);
        clearStoredLayout();
      }
    }

    if (useStoredLayout) {
      // Use stored positions directly
      setNodes(flowNodes);
      setEdges(flowEdges);
      console.log('[AssetGraph] Restored layout from browser storage');
    } else {
      // Apply hierarchical layout for new/changed graphs or when filters are active
      // Pass container dimensions and user layout settings for responsive layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes as Node[],
        flowEdges,
        'TB',
        {
          containerWidth: containerSize.width,
          containerHeight: containerSize.height,
          // Pass user-customizable layout settings (0 = auto)
          maxNodesPerRow: layoutSettings.nodesPerRow > 0 ? layoutSettings.nodesPerRow : undefined,
          maxClustersPerRow: layoutSettings.clustersPerRow > 0 ? layoutSettings.clustersPerRow : undefined,
          nodeSpacing: layoutSettings.nodeSpacing,
          clusterSpacing: layoutSettings.clusterSpacing,
          verticalSpacing: layoutSettings.verticalSpacing,
        }
      );
      setNodes(layoutedNodes as CustomNode[]);
      setEdges(layoutedEdges);
      console.log(`[AssetGraph] Applied fresh hierarchical layout${hasActiveFilters ? ' (filters active)' : ''} (container: ${containerSize.width}x${containerSize.height}, nodesPerRow: ${layoutSettings.nodesPerRow || 'auto'})`);
    }

    // Fit view after layout with smart zoom constraints
    // Ensure nodes are readable (not too small) while fitting as much as possible
    setTimeout(() => {
      fitView({ 
        padding: 0.2,
        minZoom: MIN_READABLE_ZOOM,  // Don't zoom out too far - keeps nodes readable
        maxZoom: MAX_INITIAL_ZOOM,   // Don't zoom in too much on small graphs
        duration: 300,
      });
      // Update zoom display
      setTimeout(() => {
        setCurrentZoom(getViewport().zoom);
      }, 350);
    }, 100);
  }, [graphData, activeFilters, primaryAnchorType, searchFilteredNodeIds, nodeMatchesDateFilter, dateFilter, containerSize, layoutSettings, filterMaxHops, getNodesWithinHops, setNodes, setEdges, fitView, getViewport]);

  // ==========================================================================
  // SAVE LAYOUT TO BROWSER STORAGE
  // ==========================================================================
  
  // Save node positions when they change (debounced)
  const saveNodePositionsRef = useRef<NodeJS.Timeout | null>(null);
  
  // Custom onNodesChange handler that also saves positions
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    
    // Check if any position changed
    const hasPositionChange = changes.some(
      (change) => change.type === 'position' && change.position
    );
    
    if (hasPositionChange) {
      // Debounce the save to avoid too many writes
      if (saveNodePositionsRef.current) {
        clearTimeout(saveNodePositionsRef.current);
      }
      saveNodePositionsRef.current = setTimeout(() => {
        // Get current node positions
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((node) => {
          nodePositions[node.id] = { x: node.position.x, y: node.position.y };
        });
        saveLayout({ nodePositions });
      }, 500); // Save 500ms after last move
    }
  }, [nodes, onNodesChange]);

  // Save UI preferences when they change
  useEffect(() => {
    saveLayout({
      preferences: {
        showMinimap,
        showLegend,
      },
    });
  }, [showMinimap, showLegend]);

  // ==========================================================================
  // UNIFIED NODE INTERACTION HANDLER
  // ==========================================================================
  // Handles both left-click (show details) and right-click (context menu)
  
  const handleNodeInteraction = useCallback((event: React.MouseEvent, node: CustomNode, isContextMenu: boolean) => {
    if (isContextMenu) {
      // Right-click: Show context menu
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate position to ensure menu stays within viewport
      const x = Math.min(event.clientX, window.innerWidth - 200);
      const y = Math.min(event.clientY, window.innerHeight - 250);
      
      setContextMenu({
        isOpen: true,
        x,
        y,
        nodeId: node.id,
      });
    } else {
      // Left-click: Show details panel
      // Close context menu if open
      setContextMenu(prev => ({ ...prev, isOpen: false }));
      
      setSelectedNode(node);
      // Center on the clicked node
      const nodeData = getNode(node.id);
      if (nodeData) {
        setCenter(nodeData.position.x + 90, nodeData.position.y + 30, { zoom: 1.2, duration: 500 });
      }
    }
  }, [getNode, setCenter]);

  // Left-click handler (bound to onNodeClick)
  const onNodeClick = useCallback((event: React.MouseEvent, node: CustomNode) => {
    handleNodeInteraction(event, node, false);
  }, [handleNodeInteraction]);

  // Right-click handler (bound to onNodeContextMenu)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: CustomNode) => {
    handleNodeInteraction(event, node, true);
  }, [handleNodeInteraction]);

  // Handle background click to deselect
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    // Close context menu if open
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Navigate to a node
  const navigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setCenter(node.position.x + 90, node.position.y + 30, { zoom: 1.2, duration: 500 });
    }
  }, [nodes, setCenter]);

  // Local fallback for multi-hop collection (when API unavailable)
  const collectMultiHopNodesLocal = useCallback((
    startNodeIds: string[],
    maxHops: number = 2
  ): Set<string> => {
    const collectedNodeIds = new Set<string>(startNodeIds);
    let currentFrontier = new Set<string>(startNodeIds);
    
    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier = new Set<string>();
      
      currentFrontier.forEach(nodeId => {
        // Find all edges connected to this node
        graphData?.edges.forEach(edge => {
          if (edge.source === nodeId && !collectedNodeIds.has(edge.target)) {
            nextFrontier.add(edge.target);
            collectedNodeIds.add(edge.target);
          }
          if (edge.target === nodeId && !collectedNodeIds.has(edge.source)) {
            nextFrontier.add(edge.source);
            collectedNodeIds.add(edge.source);
          }
        });
      });
      
      currentFrontier = nextFrontier;
      
      // Stop if no new nodes found
      if (currentFrontier.size === 0) break;
    }
    
    return collectedNodeIds;
  }, [graphData]);

  // Fetch connected nodes from backend using graph traversal utility with pagination support
  const fetchConnectedNodes = useCallback(async (
    nodeId: string,
    maxHops?: number,
    options?: { page?: number; per_page?: number }
  ): Promise<Set<string>> => {
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      
      // Build query params
      const params = new URLSearchParams();
      if (maxHops !== undefined) params.append('max_hops', String(maxHops));
      // Default to per_page=50 for faster response, use 0 to get all
      const perPage = options?.per_page ?? 50;
      params.append('per_page', String(perPage));
      if (options?.page) params.append('page', String(options.page));
      
      const queryString = params.toString();
      const url = `${baseUrl}/v1/asset-graph/metapath/connected/${nodeId}${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // Fallback to local computation if API fails
        console.warn('Connected nodes API failed, using local fallback');
        return collectMultiHopNodesLocal([nodeId], maxHops ?? 10);
      }
      
      const data = await response.json();
      if (data.success && data.node_ids) {
        // Log pagination info for debugging
        if (data.pagination) {
          console.log(`[AssetGraph] Connected nodes: ${data.node_count} of ${data.pagination.total} (page ${data.pagination.page}/${data.pagination.total_pages})`);
        }
        return new Set<string>(data.node_ids);
      }
      
      return collectMultiHopNodesLocal([nodeId], maxHops ?? 10);
    } catch (error) {
      console.warn('Connected nodes API error, using local fallback:', error);
      return collectMultiHopNodesLocal([nodeId], maxHops ?? 10);
    }
  }, [endpoint, collectMultiHopNodesLocal]);

  // Search for nodes - filters graph to show searched node and connected nodes (multi-hop via backend)
  // maxHopsOverride allows passing a specific value when state hasn't updated yet
  const handleSearch = useCallback(async (query: string, maxHopsOverride?: number | null) => {
    setSearchQuery(query);
    // Use override if provided, otherwise use state (null means use undefined for "all")
    const effectiveMaxHops = maxHopsOverride !== undefined 
      ? (maxHopsOverride === null ? undefined : maxHopsOverride)
      : filterMaxHops;
    
    // If search is cleared, reset filter and show all nodes
    if (!query.trim()) {
      setSearchFilteredNodeIds(null);
      // Fit view to show all nodes after clearing filter
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 200);
      return;
    }

    // Find all nodes matching the query
    const matchingNodes = graphData?.nodes.filter(n => 
      n.name.toLowerCase().includes(query.toLowerCase())
    ) || [];

    if (matchingNodes.length === 0) {
      // No matches found - keep showing current graph
      toast.info('No matching nodes found');
      return;
    }

    // Use backend graph traversal to get connected nodes (respecting max hops filter)
    // This includes the security context: vulnerabilities, threats, controls, etc.
    // For multiple matching nodes, collect from each and merge
    const allConnectedNodeIds = new Set<string>();
    
    for (const matchedNode of matchingNodes) {
      const nodeNeighbors = await fetchConnectedNodes(matchedNode.id, effectiveMaxHops);
      nodeNeighbors.forEach(id => allConnectedNodeIds.add(id));
    }

    // Update the filter state - this will trigger graph re-render
    setSearchFilteredNodeIds(allConnectedNodeIds);

    // Wait for layout to complete, then fit view and select the first matched node
    setTimeout(() => {
      // First fit the view to show all filtered nodes
      fitView({ padding: 0.3, duration: 300 });
      
      // Then after fitView completes, find and select the first matched node
      setTimeout(() => {
        const firstMatch = matchingNodes[0];
        if (firstMatch) {
          const node = nodes.find(n => n.id === firstMatch.id);
          if (node) {
            setSelectedNode(node);
          }
        }
      }, 350);
    }, 200);
  }, [graphData, nodes, fitView, fetchConnectedNodes, filterMaxHops]);

  // Toggle filter - manages primary anchor dynamically
  // Only the FIRST selected primary seed type becomes the anchor
  // All other selected types only appear if connected to anchor via hops
  const toggleFilter = useCallback((type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Removing a type
        next.delete(type);
        
        // If removing the primary anchor, find next available primary seed type
        if (type === primaryAnchorType) {
          const remainingPrimaryTypes = [...next].filter(t => PRIMARY_SEED_TYPES.has(t));
          setPrimaryAnchorType(remainingPrimaryTypes.length > 0 ? remainingPrimaryTypes[0] : null);
        }
      } else {
        // Adding a type
        next.add(type);
        
        // If this is a primary seed type and no anchor is set, make it the anchor
        if (PRIMARY_SEED_TYPES.has(type) && !primaryAnchorType) {
          setPrimaryAnchorType(type);
        }
      }
      
      // If all filters cleared, clear anchor
      if (next.size === 0) {
        setPrimaryAnchorType(null);
      }
      
      return next;
    });
  }, [primaryAnchorType]);

  // Get unique node types
  const nodeTypesList = useMemo(() => {
    if (!graphData) return [];
    return [...new Set(graphData.nodes.map(n => n.label))];
  }, [graphData]);

  // Node type stats - calculated from currently displayed nodes (after all filters)
  // This shows the actual count of nodes visible on the graph
  const nodeTypeStats = useMemo(() => {
    if (!graphData) return {};
    
    const isAnyFilterActive = 
      (dateFilter.applied && dateFilter.mode !== 'off') ||
      activeFilters.size > 0 ||
      searchFilteredNodeIds !== null;
    
    // If any filter is active, calculate stats from currently displayed nodes
    if (isAnyFilterActive && nodes.length > 0) {
      const counts: Record<string, number> = {};
      nodes.forEach(node => {
        const nodeType = (node.data as CustomNodeData).nodeType;
        counts[nodeType] = (counts[nodeType] || 0) + 1;
      });
      return counts;
    }
    
    // Otherwise use the original stats (no filters active)
    if (!stats) return {};
    return stats.nodes_by_label || {};
  }, [graphData, stats, dateFilter, activeFilters, searchFilteredNodeIds, nodes]);

  // MiniMap node color
  const minimapNodeColor = useCallback((node: CustomNode) => {
    const data = node.data as unknown as CustomNodeData;
    return NODE_COLORS[data.nodeType] || NODE_COLORS.default;
  }, []);

  // ==========================================================================
  // EDIT MODE HANDLERS
  // ==========================================================================

  // Handle new connection (edge creation)
  const onConnect: OnConnect = useCallback((connection) => {
    if (!editMode) return;
    
    // Store the pending connection and show relationship selector
    setPendingConnection(connection);
    setShowRelationshipSelector(true);
  }, [editMode]);

  // Handle relationship type selection
  const handleRelationshipSelect = useCallback((relType: string) => {
    if (!pendingConnection) return;
    
    const edgeColor = EDGE_COLORS[relType] || EDGE_COLORS.default;
    const newEdgeId = `new-edge-${Date.now()}`;
    
    const newEdge: Edge = {
      id: newEdgeId,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      sourceHandle: pendingConnection.sourceHandle,
      targetHandle: pendingConnection.targetHandle,
      label: relType.replace(/_/g, ' '),
      type: 'smoothstep',
      data: { relationType: relType }, // Store original type for saving
      style: { 
        stroke: edgeColor, 
        strokeWidth: 2,
        strokeOpacity: 0.8,
        strokeDasharray: '5,5', // Dashed to indicate pending
      },
      labelStyle: { 
        fill: edgeColor, 
        fontSize: 9, 
        fontWeight: 600,
      },
      labelBgStyle: { 
        fill: '#111827', 
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: edgeColor,
      },
    };

    setEdges((eds) => addEdge(newEdge, eds));
    setPendingChanges((prev) => ({
      ...prev,
      addedEdges: [...prev.addedEdges, newEdge],
    }));
    
    setPendingConnection(null);
    setShowRelationshipSelector(false);
  }, [pendingConnection, setEdges]);

  // Cancel relationship selection
  const handleRelationshipCancel = useCallback(() => {
    setPendingConnection(null);
    setShowRelationshipSelector(false);
  }, []);

  // Delete selected edge
  const handleDeleteEdge = useCallback((edgeId: string) => {
    if (!editMode) return;
    
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    
    // Check if it's a new edge (not yet saved) or existing edge
    const isNewEdge = pendingChanges.addedEdges.some((e) => e.id === edgeId);
    
    if (isNewEdge) {
      // Remove from added edges
      setPendingChanges((prev) => ({
        ...prev,
        addedEdges: prev.addedEdges.filter((e) => e.id !== edgeId),
      }));
    } else {
      // Add to deleted edges
      setPendingChanges((prev) => ({
        ...prev,
        deletedEdgeIds: [...prev.deletedEdgeIds, edgeId],
      }));
    }
  }, [editMode, setEdges, pendingChanges.addedEdges]);

  // Handle editing a relationship (change type)
  const handleEditEdge = useCallback((edgeId: string, newRelType: string, sourceHandle?: string, targetHandle?: string) => {
    const edgeColor = EDGE_COLORS[newRelType] || EDGE_COLORS.default;
    
    setEdges((eds) => eds.map((e) => {
      if (e.id === edgeId) {
        return {
          ...e,
          label: newRelType.replace(/_/g, ' '),
          data: { ...e.data, relationType: newRelType },
          // Update handle positions if provided
          sourceHandle: sourceHandle || e.sourceHandle,
          targetHandle: targetHandle || e.targetHandle,
          style: {
            ...e.style,
            stroke: edgeColor,
          },
          labelStyle: {
            ...e.labelStyle,
            fill: edgeColor,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: edgeColor,
          },
        };
      }
      return e;
    }));

    // Save edge handle positions to browser storage
    if (sourceHandle || targetHandle) {
      const stored = getStoredLayout();
      const edgeHandles = stored?.edgeHandles || {};
      edgeHandles[edgeId] = {
        sourceHandle: sourceHandle || 'source-bottom',
        targetHandle: targetHandle || 'target-top',
      };
      saveLayout({ edgeHandles });
    }

    // If we have an endpoint, update on backend
    if (endpoint) {
      const baseUrl = endpoint || 'http://localhost:7777';
      fetch(`${baseUrl}/v1/asset-graph/edges/${edgeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label: newRelType,
          source_handle: sourceHandle,
          target_handle: targetHandle,
        }),
      }).catch(() => {
        toast.error('Failed to update edge connection', { duration: 3000 });
      });
    }
  }, [setEdges, endpoint]);

  // Open edit relationship modal
  const handleOpenEditRelationship = useCallback((edge: Edge) => {
    setEditingEdge(edge);
    setShowEditRelationshipModal(true);
  }, []);

  // Handle edge click for deletion in edit mode
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (editMode) {
      setSelectedEdges((prev) => {
        const next = new Set(prev);
        if (next.has(edge.id)) {
          next.delete(edge.id);
        } else {
          next.add(edge.id);
        }
        return next;
      });
    }
  }, [editMode]);

  // Delete selected node
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!editMode) return;
    
    // Remove node and all connected edges
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    
    setPendingChanges((prev) => ({
      ...prev,
      deletedNodeIds: [...prev.deletedNodeIds, nodeId],
    }));
    
    setSelectedNode(null);
  }, [editMode, setNodes, setEdges]);

  // Save changes to backend
  const handleSaveChanges = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    setIsSaving(true);
    
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      
      // Save new nodes first (so edges can reference them)
      for (const node of pendingChanges.addedNodes || []) {
        await fetch(`${baseUrl}/v1/asset-graph/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: node.name,
            label: node.nodeType,
            properties: {},
          }),
        });
      }
      
      // Save new edges
      for (const edge of pendingChanges.addedEdges) {
        const labelStr = typeof edge.label === 'string' ? edge.label : '';
        const relationType = (edge.data as { relationType?: string })?.relationType || labelStr.replace(/ /g, '_');
        await fetch(`${baseUrl}/v1/asset-graph/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_id: edge.source,
            to_id: edge.target,
            label: relationType,
            properties: {},
          }),
        });
      }
      
      // Delete edges
      for (const edgeId of pendingChanges.deletedEdgeIds) {
        await fetch(`${baseUrl}/v1/asset-graph/edges/${edgeId}`, {
          method: 'DELETE',
        });
      }
      
      // Delete nodes
      for (const nodeId of pendingChanges.deletedNodeIds) {
        await fetch(`${baseUrl}/v1/asset-graph/nodes/${nodeId}`, {
          method: 'DELETE',
        });
      }
      
      // Clear pending changes
      setPendingChanges({
        addedEdges: [],
        deletedEdgeIds: [],
        deletedNodeIds: [],
        addedNodes: [],
      });
      
      // Exit edit mode and refresh
      setEditMode(false);
      onRefresh();
      
    } catch {
      toast.error('Failed to save changes. Please try again.', { duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, endpoint, pendingChanges, onRefresh]);

  // Cancel edit mode and discard changes
  const handleCancelEdit = useCallback(() => {
    setPendingChanges({
      addedEdges: [],
      deletedEdgeIds: [],
      deletedNodeIds: [],
      addedNodes: [],
    });
    setSelectedEdges(new Set());
    setShowAddNodeModal(false);
    setShowAddRelationshipModal(false);
    setEditMode(false);
    onRefresh(); // Reload original data
  }, [onRefresh]);

  // Delete selected edges
  const handleDeleteSelectedEdges = useCallback(() => {
    selectedEdges.forEach((edgeId) => {
      handleDeleteEdge(edgeId);
    });
    setSelectedEdges(new Set());
  }, [selectedEdges, handleDeleteEdge]);

  // ==========================================================================
  // ANALYSIS FUNCTIONS (MetaPath Walker Integration)
  // ==========================================================================

  // Fetch exploitability scores for all assets
  const fetchExploitabilityScores = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      const response = await fetch(`${baseUrl}/v1/asset-graph/exploitability?limit=50`);
      
      if (!response.ok) {
        toast.error('Failed to fetch exploitability scores. Check if backend is running.', { duration: 3000 });
        return;
      }
      
      const data = await response.json();
      setExploitabilityScores(data.assets || []);
      if (data.assets?.length === 0) {
        toast('No exploitability data available. Add assets with threats/vulnerabilities first.', { duration: 4000 });
      }
    } catch {
      toast.error('Unable to connect to analysis service. Ensure backend is running.', { duration: 3000 });
    } finally {
      setAnalysisLoading(false);
    }
  }, [endpoint]);

  // Fetch global remediation priorities
  const fetchRemediationPriorities = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      const response = await fetch(`${baseUrl}/v1/asset-graph/remediation?limit=20`);
      
      if (!response.ok) {
        toast.error('Failed to fetch remediation priorities. Check if backend is running.', { duration: 3000 });
        return;
      }
      
      const data = await response.json();
      setRemediationRecommendations(data.recommendations || []);
      if (data.recommendations?.length === 0) {
        toast('No remediation recommendations available. Add vulnerabilities or threats first.', { duration: 4000 });
      }
    } catch {
      toast.error('Unable to connect to analysis service. Ensure backend is running.', { duration: 3000 });
    } finally {
      setAnalysisLoading(false);
    }
  }, [endpoint]);

  // Fetch attack paths between threat and asset
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchAttackPaths = useCallback(async (threatId: string, assetId: string) => {
    if (!threatId || !assetId) return;
    
    setAnalysisLoading(true);
    setSelectedThreatForPath(threatId);
    setSelectedAssetForPath(assetId);
    
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      const response = await fetch(
        `${baseUrl}/v1/asset-graph/attack-paths?threat_id=${encodeURIComponent(threatId)}&target_asset_id=${encodeURIComponent(assetId)}&max_paths=5`
      );
      
      if (!response.ok) {
        toast.error('Failed to fetch attack paths. Check if backend is running.', { duration: 3000 });
        return;
      }
      
      const data = await response.json();
      setAttackPaths(data.paths || []);
      setShowAttackPathPanel(true);
      if (data.paths?.length === 0) {
        toast('No attack paths found between selected threat and asset.', { duration: 3000 });
      }
    } catch {
      toast.error('Unable to connect to analysis service. Ensure backend is running.', { duration: 3000 });
    } finally {
      setAnalysisLoading(false);
    }
  }, [endpoint]);

  // Toggle exploitability panel
  const toggleExploitabilityPanel = useCallback(() => {
    if (!showExploitabilityPanel) {
      fetchExploitabilityScores();
    }
    setShowExploitabilityPanel(!showExploitabilityPanel);
    setShowRemediationPanel(false);
  }, [showExploitabilityPanel, fetchExploitabilityScores]);

  // Toggle remediation panel
  const toggleRemediationPanel = useCallback(() => {
    if (!showRemediationPanel) {
      fetchRemediationPriorities();
    }
    setShowRemediationPanel(!showRemediationPanel);
    setShowExploitabilityPanel(false);
  }, [showRemediationPanel, fetchRemediationPriorities]);

  // Navigate to a node from analysis panels - uses backend MetaPath Walker for multi-hop walk
  const handleAnalysisNavigate = useCallback(async (nodeId: string) => {
    // Find the target node in graphData
    const targetNode = graphData?.nodes.find(n => n.id === nodeId);
    if (!targetNode) {
      toast.info('Node not found in graph');
      return;
    }

    // Use backend graph traversal to get all connected nodes (no hop limit)
    // This provides the security context for the focused node (respecting max hops)
    const connectedNodeIds = await fetchConnectedNodes(nodeId, filterMaxHops);

    // Update the filter state - this will trigger graph re-render
    setSearchFilteredNodeIds(connectedNodeIds);
    
    // Update search query to show visual feedback
    setSearchQuery(targetNode.name);

    // Wait for layout to complete, then fit view and select the target node
    setTimeout(() => {
      // First fit the view to show all filtered nodes
      fitView({ padding: 0.3, duration: 300 });
      
      // Then after fitView completes, find and select the target node
      setTimeout(() => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          setSelectedNode(node);
        }
      }, 350);
    }, 200);
  }, [graphData, nodes, fitView, fetchConnectedNodes, filterMaxHops]);

  // Get node name by ID (for relationship selector)
  const getNodeName = useCallback((nodeId: string | null) => {
    if (!nodeId) return 'Unknown';
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return 'Unknown';
    return (node.data as CustomNodeData).label;
  }, [nodes]);

  // ==========================================================================
  // SIMPLE ADD NODE HANDLER
  // ==========================================================================
  const handleAddNode = useCallback((name: string, nodeType: string) => {
    const nodeId = `new-${nodeType.toLowerCase()}-${Date.now()}`;
    const _color = NODE_COLORS[nodeType] || NODE_COLORS.default;
    void _color; // Intentionally unused - reserved for future use
    const level = getNodeRank(nodeType);
    
    // Calculate position based on hierarchy level
    const existingNodesAtLevel = nodes.filter(n => {
      const data = n.data as CustomNodeData;
      return getNodeRank(data.nodeType) === level;
    });
    
    const x = existingNodesAtLevel.length * 260;
    const y = level * 210 + 80;
    
    const newNode: CustomNode = {
      id: nodeId,
      type: 'custom',
      position: { x, y },
      data: {
        label: name,
        nodeType: nodeType,
        properties: {},
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setPendingChanges((prev) => ({
      ...prev,
      addedNodes: [...(prev.addedNodes || []), { id: nodeId, name, nodeType }],
    }));
  }, [nodes, setNodes]);

  // ==========================================================================
  // SIMPLE ADD RELATIONSHIP HANDLER
  // ==========================================================================
  const handleAddRelationship = useCallback((sourceId: string, targetId: string, relType: string) => {
    const edgeColor = EDGE_COLORS[relType] || EDGE_COLORS.default;
    const newEdgeId = `new-edge-${Date.now()}`;
    
    const newEdge: Edge = {
      id: newEdgeId,
      source: sourceId,
      target: targetId,
      label: relType.replace(/_/g, ' '),
      type: 'smoothstep',
      data: { relationType: relType },
      style: { 
        stroke: edgeColor, 
        strokeWidth: 2,
        strokeOpacity: 0.8,
        strokeDasharray: '5,5',
      },
      labelStyle: { 
        fill: edgeColor, 
        fontSize: 9, 
        fontWeight: 600,
      },
      labelBgStyle: { 
        fill: '#111827', 
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: edgeColor,
      },
    };

    setEdges((eds) => [...eds, newEdge]);
    setPendingChanges((prev) => ({
      ...prev,
      addedEdges: [...prev.addedEdges, newEdge],
    }));
  }, [setEdges]);

  // ==========================================================================
  // CONTEXT MENU HELPERS
  // ==========================================================================

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Get node for context menu
  const contextMenuNode = useMemo(() => {
    if (!contextMenu.nodeId) return null;
    return nodes.find(n => n.id === contextMenu.nodeId) || null;
  }, [contextMenu.nodeId, nodes]);

  // Context menu actions
  const handleContextViewDetails = useCallback(() => {
    if (contextMenuNode) {
      setSelectedNode(contextMenuNode);
      const nodeData = getNode(contextMenuNode.id);
      if (nodeData) {
        setCenter(nodeData.position.x + 90, nodeData.position.y + 30, { zoom: 1.2, duration: 500 });
      }
    }
  }, [contextMenuNode, getNode, setCenter]);

  const handleContextEditProperties = useCallback(() => {
    if (contextMenuNode) {
      setEditingNode(contextMenuNode);
      setShowEditPropertiesModal(true);
    }
  }, [contextMenuNode]);

  const handleContextAddRelationship = useCallback(() => {
    if (contextMenuNode) {
      setSelectedNode(contextMenuNode);
      // Enable edit mode if not already enabled
      if (!editMode) {
        setEditMode(true);
      }
      setShowAddRelationshipModal(true);
    }
  }, [contextMenuNode, editMode]);

  const handleContextDeleteNode = useCallback(() => {
    if (contextMenuNode && editMode) {
      handleDeleteNode(contextMenuNode.id);
    }
  }, [contextMenuNode, editMode, handleDeleteNode]);

  const handleContextSearchByLabel = useCallback(() => {
    if (contextMenuNode) {
      const nodeData = contextMenuNode.data as CustomNodeData;
      const label = nodeData.label;
      if (label) {
        handleSearch(label);
      }
    }
  }, [contextMenuNode, handleSearch]);

  // Handle saving node properties
  const handleSaveNodeProperties = useCallback(async (nodeId: string, properties: Record<string, unknown>) => {
    // Update the node in local state
    setNodes((nds) => 
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              properties,
            },
          };
        }
        return n;
      })
    );

    // If we have an endpoint, save to backend
    if (endpoint) {
      try {
        const baseUrl = endpoint || 'http://localhost:7777';
        await fetch(`${baseUrl}/v1/asset-graph/nodes/${nodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties }),
        });
      } catch {
        toast.error('Failed to save node properties to server', { duration: 3000 });
        // Properties are still updated locally even if backend fails
      }
    }

    // Close the modal
    setShowEditPropertiesModal(false);
    setEditingNode(null);
  }, [setNodes, endpoint]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-400">
            {loadingProgress 
              ? `Loading graph... (page ${loadingProgress.current}/${loadingProgress.total})`
              : 'Loading graph...'
            }
          </span>
          {loadingProgress && loadingProgress.total > 1 && (
            <div className="w-48 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <Info className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-400">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-950">
        <div className="text-center max-w-md">
          <Info className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-2">No Graph Data</h3>
          <p className="text-neutral-400 mb-4">
            Import assets through the Asset Management agent to populate the graph.
            Assets, threats, vulnerabilities, and MITRE techniques will appear here.
          </p>
          {onLoadDemoData && (
            <button
              onClick={onLoadDemoData}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              Load Sample Data
            </button>
          )}
          <p className="text-xs text-neutral-500 mt-3">
            Sample data helps you explore the graph visualization features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 relative">
      {/* Demo Data Banner - Prominent notification */}
      {isShowingDemoData && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-r from-amber-600 to-orange-600 backdrop-blur-sm px-4 py-3 flex items-center justify-center gap-3 shadow-lg border-b-2 border-amber-400/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full animate-pulse">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">
              ⚠️ DEMO DATA — This is sample data for demonstration purposes only
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors font-medium border border-white/30"
          >
            Load Real Data
          </button>
        </div>
      )}
      
      {/* Floating Demo Badge on Graph */}
      {isShowingDemoData && (
        <div className="absolute bottom-4 left-4 z-20 bg-amber-600/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-amber-400/50 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-white uppercase tracking-wide">
            Demo Mode
          </span>
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges.map(e => ({
          ...e,
          selected: selectedEdges.has(e.id),
          style: {
            ...e.style,
            strokeWidth: selectedEdges.has(e.id) ? 4 : (e.style?.strokeWidth || 2),
            stroke: selectedEdges.has(e.id) ? '#ef4444' : (e.style?.stroke || '#6b7280'),
          },
        }))}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onMoveEnd={(_, viewport) => setCurrentZoom(viewport.zoom)}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: '#22c55e', strokeWidth: 2, strokeDasharray: '5,5' }}
        fitView
        fitViewOptions={{ 
          padding: 0.15, 
          minZoom: MIN_READABLE_ZOOM, 
          maxZoom: MAX_INITIAL_ZOOM 
        }}
        minZoom={0.1}
        maxZoom={3}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-950"
        nodesDraggable={true}
        nodesConnectable={editMode}
        elementsSelectable={editMode}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="bottom-left"
          className="!bg-neutral-800 !border-neutral-700 !rounded-lg !shadow-xl [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-300 [&>button:hover]:!bg-neutral-700"
        />
        
        {/* Zoom Percentage Indicator */}
        <Panel position="bottom-left" className="!bottom-28 !left-3">
          <div className="bg-neutral-800/95 backdrop-blur-sm rounded-lg border border-neutral-700 shadow-xl px-3 py-2 flex items-center gap-2">
            <button
              onClick={() => {
                const newZoom = Math.max(0.1, currentZoom - 0.2);
                setViewport({ ...getViewport(), zoom: newZoom }, { duration: 200 });
                setCurrentZoom(newZoom);
              }}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <div 
              className="text-sm font-mono text-neutral-300 min-w-[50px] text-center cursor-pointer hover:text-white"
              onClick={() => {
                // Reset to ideal zoom
                setViewport({ ...getViewport(), zoom: IDEAL_ZOOM }, { duration: 200 });
                setCurrentZoom(IDEAL_ZOOM);
              }}
              title="Click to reset zoom to 80%"
            >
              {Math.round(currentZoom * 100)}%
            </div>
            <button
              onClick={() => {
                const newZoom = Math.min(3, currentZoom + 0.2);
                setViewport({ ...getViewport(), zoom: newZoom }, { duration: 200 });
                setCurrentZoom(newZoom);
              }}
              className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </Panel>

        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-neutral-900 !border-neutral-700 !rounded-lg"
          />
        )}

        {/* Top Controls Panel */}
        <Panel position="top-left" className="flex flex-wrap items-center gap-2 max-w-[calc(100%-120px)] bg-neutral-900/95 backdrop-blur-sm rounded-lg p-2 border border-neutral-700/50 shadow-lg">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 ${searchFilteredNodeIds ? 'text-green-400' : 'text-neutral-500'}`} />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className={`w-40 pl-8 pr-7 py-1.5 bg-neutral-800 border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none ${
                searchFilteredNodeIds 
                  ? 'border-green-500/50 ring-1 ring-green-500/20' 
                  : 'border-neutral-700 focus:border-blue-500'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchFilteredNodeIds(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Depth Selector */}
          <div 
            className="flex items-center gap-1.5"
            title="Chain depth: Number of relationship hops from anchor type. Each selected type adds a link in the chain. Increase depth to traverse longer type chains."
          >
            <span className="text-xs text-neutral-500">Depth:</span>
            <select
              value={filterMaxHops ?? 'all'}
              onChange={(e) => {
                const val = e.target.value;
                const newMaxHops = val === 'all' ? undefined : parseInt(val, 10);
                setFilterMaxHops(newMaxHops);
                if (searchQuery.trim()) {
                  handleSearch(searchQuery, newMaxHops === undefined ? null : newMaxHops);
                }
              }}
              className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="1">1 hop</option>
              <option value="2">2 hops</option>
              <option value="3">3 hops</option>
              <option value="5">5 hops</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters 
                ? 'bg-blue-600 text-white' 
                : activeFilters.size > 0
                  ? 'bg-blue-600/30 border border-blue-500/50 text-blue-400'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'
            }`}
            title="Filter by Node Type"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Type filter indicator */}
          {activeFilters.size > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg text-xs text-blue-400">
              <span>{activeFilters.size} type{activeFilters.size > 1 ? 's' : ''}</span>
              <button
                onClick={() => {
                  setActiveFilters(new Set());
                  setPrimaryAnchorType(null);
                }}
                className="p-0.5 hover:bg-blue-500/30 rounded"
                title="Clear type filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Time Range Buttons */}
          <div className="flex items-center gap-1 bg-neutral-800/80 border border-neutral-700 rounded-lg p-1">
            <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1" />
            {(['today', '3d', 'week', 'month', 'all'] as const).map((range) => {
              const labels: Record<typeof range, string> = {
                today: 'Today',
                '3d': '3d',
                week: '7d',
                month: '30d',
                all: 'All',
              };
              const isActive = activeTimeRange === range;
              return (
                <button
                  key={range}
                  onClick={() => applyTimeRange(range)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-cyan-600 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                  title={`Show nodes from ${labels[range].toLowerCase()}`}
                >
                  {labels[range]}
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowDateFilter(!showDateFilter);
                if (showFilters) setShowFilters(false);
              }}
              className={`p-1 rounded transition-colors ${
                showDateFilter ? 'bg-cyan-600 text-white' : 'text-neutral-500 hover:text-white hover:bg-neutral-700'
              }`}
              title="Custom date range"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          
          {/* Background fetching indicator */}
          {isBackgroundFetching && loadingProgress && (
            <div className="flex items-center gap-1 px-2 py-1 bg-neutral-800/60 border border-neutral-700/50 rounded-lg text-xs text-neutral-400">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </div>
          )}

          {/* Layout Settings */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutSettings(!showLayoutSettings)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                showLayoutSettings
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-purple-500/50'
              }`}
              title="Layout Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <span className="text-xs font-medium">Layout</span>
            </button>

            {/* Layout Settings Panel */}
            {showLayoutSettings && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Layout Settings</h3>
                  <button
                    onClick={() => {
                      setLayoutSettings({ ...DEFAULT_LAYOUT_SETTINGS });
                    }}
                    className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                  >
                    Reset
                  </button>
                </div>

                {/* Nodes Per Row */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-400">Nodes per Row</label>
                    <span className="text-xs font-mono text-cyan-400">
                      {layoutSettings.nodesPerRow === 0 ? 'Auto' : layoutSettings.nodesPerRow}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={layoutSettings.nodesPerRow}
                    onChange={(e) => updateLayoutSetting('nodesPerRow', Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Auto</span>
                    <span>12</span>
                  </div>
                </div>

                {/* Clusters Per Row */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-400">Clusters per Row</label>
                    <span className="text-xs font-mono text-cyan-400">
                      {layoutSettings.clustersPerRow === 0 ? 'Auto' : layoutSettings.clustersPerRow}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={layoutSettings.clustersPerRow}
                    onChange={(e) => updateLayoutSetting('clustersPerRow', Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Auto</span>
                    <span>8</span>
                  </div>
                </div>

                {/* Node Spacing */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-400">Node Spacing</label>
                    <span className="text-xs font-mono text-purple-400">{layoutSettings.nodeSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={layoutSettings.nodeSpacing}
                    onChange={(e) => updateLayoutSetting('nodeSpacing', Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Compact</span>
                    <span>Spread</span>
                  </div>
                </div>

                {/* Cluster Spacing */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-400">Cluster Spacing</label>
                    <span className="text-xs font-mono text-purple-400">{layoutSettings.clusterSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="250"
                    step="10"
                    value={layoutSettings.clusterSpacing}
                    onChange={(e) => updateLayoutSetting('clusterSpacing', Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Tight</span>
                    <span>Wide</span>
                  </div>
                </div>

                {/* Vertical Spacing */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-400">Vertical Spacing</label>
                    <span className="text-xs font-mono text-purple-400">{layoutSettings.verticalSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    step="5"
                    value={layoutSettings.verticalSpacing}
                    onChange={(e) => updateLayoutSetting('verticalSpacing', Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Dense</span>
                    <span>Airy</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="mt-4 pt-3 border-t border-neutral-700">
                  <label className="text-xs text-neutral-500 mb-2 block">Quick Presets</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLayoutSettings({
                        nodesPerRow: 0,
                        clustersPerRow: 0,
                        nodeSpacing: 15,
                        clusterSpacing: 60,
                        verticalSpacing: 40,
                      })}
                      className="flex-1 px-2 py-1.5 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => setLayoutSettings({ ...DEFAULT_LAYOUT_SETTINGS })}
                      className="flex-1 px-2 py-1.5 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Default
                    </button>
                    <button
                      onClick={() => setLayoutSettings({
                        nodesPerRow: 8,
                        clustersPerRow: 4,
                        nodeSpacing: 60,
                        clusterSpacing: 180,
                        verticalSpacing: 100,
                      })}
                      className="flex-1 px-2 py-1.5 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Spacious
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend Toggle */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-2 rounded-lg transition-colors ${showLegend ? 'bg-blue-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'}`}
            title={showLegend ? 'Hide Legend' : 'Show Hierarchy Legend'}
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Analysis Separator */}
          <div className="w-px h-4 bg-neutral-700" />

          {/* Exploitability Analysis Button */}
          <button
            onClick={toggleExploitabilityPanel}
            className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
              showExploitabilityPanel 
                ? 'bg-red-600 text-white' 
                : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-red-500/50'
            }`}
            title="Exploitability Analysis"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">Risk</span>
          </button>

          {/* Remediation Priorities Button */}
          <button
            onClick={toggleRemediationPanel}
            className={`flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
              showRemediationPanel 
                ? 'bg-amber-600 text-white' 
                : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:border-amber-500/50'
            }`}
            title="Remediation Priorities"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">Remediate</span>
          </button>

          {/* Minimap Toggle */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className={`p-2 rounded-lg transition-colors ${showMinimap ? 'bg-blue-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'}`}
            title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
          >
            {showMinimap ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Reset Layout Button */}
          <button
            onClick={() => {
              clearStoredLayout();
              onRefresh();
            }}
            className="p-2 rounded-lg transition-colors bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-orange-400 hover:border-orange-600/50"
            title="Reset Layout (clears saved positions)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-neutral-700" />

          {/* Edit Mode Toggle */}
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
              title="Edit Graph"
            >
              <Edit3 className="w-4 h-4" />
              <span className="text-xs font-medium">Edit</span>
            </button>
          ) : (
            <>
              {/* Add Node Button */}
              <button
                onClick={() => setShowAddNodeModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                title="Add Node"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Node</span>
              </button>

              {/* Add Relationship Button */}
              <button
                onClick={() => setShowAddRelationshipModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Add Relationship"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Relationship</span>
              </button>

              {/* Delete Selected Edges */}
              {selectedEdges.size > 0 && (
                <button
                  onClick={handleDeleteSelectedEdges}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Delete ({selectedEdges.size})</span>
                </button>
              )}

              {/* Separator */}
              <div className="w-px h-6 bg-neutral-600" />

              {/* Save Button */}
              <button
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges || isSaving}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  hasUnsavedChanges && !isSaving
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed'
                }`}
                title="Save Changes"
              >
                <Save className="w-4 h-4" />
                <span className="text-xs font-medium">{isSaving ? 'Saving...' : 'Save'}</span>
              </button>

              {/* Cancel Button */}
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                title="Cancel Edit"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Cancel</span>
              </button>
            </>
          )}
        </Panel>

        {/* Filter Panel */}
        {showFilters && (
          <Panel position="top-left" className="!top-16">
            <FilterPanel
              nodeTypes={nodeTypesList}
              activeFilters={activeFilters}
              onToggleFilter={toggleFilter}
              onClose={() => setShowFilters(false)}
              stats={nodeTypeStats}
              onRefresh={onRefresh}
              primaryAnchorType={primaryAnchorType}
              currentDepth={filterMaxHops}
              onDepthChange={setFilterMaxHops}
            />
          </Panel>
        )}

        {/* Date Filter Panel */}
        {showDateFilter && (
          <Panel position="top-left" className="!top-16">
            <DateFilterPanel
              dateFilter={dateFilter}
              onDateFilterChange={setDateFilter}
              onClose={() => setShowDateFilter(false)}
              filteredCount={nodes.length}
              totalCount={graphData?.nodes?.length || 0}
            />
          </Panel>
        )}

        {/* Hierarchy Legend Panel */}
        {showLegend && (
          <Panel position="bottom-right" className="!bottom-4 !right-4">
            <HierarchyLegend />
          </Panel>
        )}

        {/* Stats Panel */}
        <Panel position="top-right" className="bg-neutral-900/95 backdrop-blur-sm rounded-lg p-1 border border-neutral-700/50 shadow-lg">
          <div className="flex items-center gap-2">
            {/* Edit Mode Indicator */}
            {editMode && (
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-lg px-3 py-2 text-xs text-white font-medium flex items-center gap-2">
                <Edit3 className="w-3 h-3" />
                <span>Editing</span>
                {hasUnsavedChanges && (
                  <span className="bg-black/20 px-2 py-0.5 rounded text-[10px]">
                    +{(pendingChanges.addedNodes?.length || 0) + pendingChanges.addedEdges.length} / -{pendingChanges.deletedEdgeIds.length + pendingChanges.deletedNodeIds.length}
                  </span>
                )}
              </div>
            )}
            <div className="px-2 py-1 text-xs text-neutral-400">
              <span className="text-white font-medium">{nodes.length}</span> nodes •{' '}
              <span className="text-white font-medium">{edges.length}</span> edges
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Node Details Panel */}
      <AnimatePresence>
        {selectedNode && (
          <NodeDetailsPanel
            node={selectedNode}
            edges={edges}
            nodes={nodes}
            onNavigate={navigateToNode}
            onClose={() => setSelectedNode(null)}
            editMode={editMode}
            onDeleteNode={handleDeleteNode}
            onAddRelationship={() => setShowAddRelationshipModal(true)}
            onEditProperties={() => {
              setEditingNode(selectedNode);
              setShowEditPropertiesModal(true);
            }}
            onDeleteEdge={handleDeleteEdge}
            onEditEdge={handleOpenEditRelationship}
          />
        )}
      </AnimatePresence>

      {/* Exploitability Analysis Panel */}
      <AnimatePresence>
        {showExploitabilityPanel && (
          <ExploitabilityPanel
            scores={exploitabilityScores}
            loading={analysisLoading}
            onSelectAsset={handleAnalysisNavigate}
            onClose={() => setShowExploitabilityPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Remediation Priorities Panel */}
      <AnimatePresence>
        {showRemediationPanel && (
          <RemediationPanel
            recommendations={remediationRecommendations}
            loading={analysisLoading}
            onSelectTarget={handleAnalysisNavigate}
            onClose={() => setShowRemediationPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Attack Path Panel */}
      <AnimatePresence>
        {showAttackPathPanel && (
          <AttackPathPanel
            paths={attackPaths}
            threatId={selectedThreatForPath}
            targetAssetId={selectedAssetForPath}
            loading={analysisLoading}
            onSelectNode={handleAnalysisNavigate}
            onClose={() => setShowAttackPathPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Relationship Type Selector Modal (for drag-connect) */}
      <RelationshipSelector
        isOpen={showRelationshipSelector}
        connection={pendingConnection}
        onSelect={handleRelationshipSelect}
        onCancel={handleRelationshipCancel}
        sourceNodeName={getNodeName(pendingConnection?.source ?? null)}
        targetNodeName={getNodeName(pendingConnection?.target ?? null)}
      />

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={showAddNodeModal}
        onClose={() => setShowAddNodeModal(false)}
        onAdd={handleAddNode}
      />

      {/* Add Relationship Modal */}
      <AddRelationshipModal
        isOpen={showAddRelationshipModal}
        onClose={() => setShowAddRelationshipModal(false)}
        onAdd={handleAddRelationship}
        nodes={nodes}
        selectedNodeId={selectedNode?.id}
      />

      {/* Node Context Menu (uses portal to render at document body level) */}
      {contextMenu.isOpen && contextMenuNode && (
        <NodeContextMenu
          state={contextMenu}
          onClose={handleCloseContextMenu}
          onViewDetails={handleContextViewDetails}
          onEditProperties={handleContextEditProperties}
          onAddRelationship={handleContextAddRelationship}
          onDeleteNode={handleContextDeleteNode}
          onSearchByLabel={handleContextSearchByLabel}
          editMode={editMode}
          nodeName={(contextMenuNode.data as CustomNodeData).label}
          nodeType={(contextMenuNode.data as CustomNodeData).nodeType}
        />
      )}

      {/* Edit Node Properties Modal */}
      <EditNodePropertiesModal
        isOpen={showEditPropertiesModal}
        onClose={() => {
          setShowEditPropertiesModal(false);
          setEditingNode(null);
        }}
        onSave={handleSaveNodeProperties}
        node={editingNode}
      />

      {/* Edit Relationship Modal */}
      <EditRelationshipModal
        isOpen={showEditRelationshipModal}
        onClose={() => {
          setShowEditRelationshipModal(false);
          setEditingEdge(null);
        }}
        onSave={handleEditEdge}
        edge={editingEdge}
        sourceNodeName={editingEdge ? getNodeName(editingEdge.source) : undefined}
        targetNodeName={editingEdge ? getNodeName(editingEdge.target) : undefined}
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

// Pagination info from backend
interface PaginationInfo {
  page: number;
  per_page: number;
  total_nodes: number;
  total_filtered_nodes: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  filters?: {
    since?: string;
    until?: string;
    node_type?: string;
  };
}

export function GraphVisualization({ isOpen, onClose, endpoint }: GraphVisualizationProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShowingDemoData, setIsShowingDemoData] = useState(false);
  
  // Cached complete graph data - fetched once, filtered client-side
  // Also persisted to localStorage for faster initial loads
  const GRAPH_CACHE_KEY = 'asset_graph_cache';
  const GRAPH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Check if we're in browser environment (not SSR)
  const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  
  // Load from localStorage on mount - wrapped in useCallback for stable reference
  const getPersistedCache = useCallback((): { data: GraphData; timestamp: number } | null => {
    if (!isBrowser) return null;
    try {
      const cached = window.localStorage.getItem(GRAPH_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && (Date.now() - parsed.timestamp) < GRAPH_CACHE_TTL) {
          return parsed;
        }
        // Cache expired, remove it
        window.localStorage.removeItem(GRAPH_CACHE_KEY);
      }
    } catch (e) {
      console.warn('[AssetGraph] Failed to read cache from localStorage:', e);
    }
    return null;
  }, [isBrowser, GRAPH_CACHE_KEY, GRAPH_CACHE_TTL]);
  
  const persistCache = useCallback((data: GraphData, timestamp: number) => {
    if (!isBrowser) return;
    try {
      // Only cache if data is reasonable size (< 5MB)
      const payload = JSON.stringify({ data, timestamp });
      if (payload.length < 5 * 1024 * 1024) {
        window.localStorage.setItem(GRAPH_CACHE_KEY, payload);
        console.log(`[AssetGraph] Persisted ${data.nodes.length} nodes to localStorage`);
      }
    } catch (e) {
      console.warn('[AssetGraph] Failed to persist cache to localStorage:', e);
    }
  }, [isBrowser, GRAPH_CACHE_KEY]);
  
  // Initialize from localStorage
  const persistedCache = useMemo(() => getPersistedCache(), [getPersistedCache]);
  const [cachedGraphData, setCachedGraphData] = useState<GraphData | null>(persistedCache?.data || null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(persistedCache?.timestamp || null);
  
  // Helper to update cache (both in-memory and localStorage)
  const updateCache = useCallback((data: GraphData | null) => {
    const now = Date.now();
    setCachedGraphData(data);
    setCacheTimestamp(now);
    if (data && data.nodes.length > 0) {
      persistCache(data, now);
    }
  }, [persistCache]);
  
  // Pagination state for server-side pagination
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);
  
  // Loading progress for paginated fetch
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number } | null>(null);

  // Load demo/sample data when backend has no data
  const loadDemoData = useCallback(() => {
    console.log('[AssetGraph] Loading demo/sample data');
    setGraphData(DEMO_GRAPH_DATA);
    setCachedGraphData(DEMO_GRAPH_DATA);
    setStats(DEMO_STATS);
    setIsShowingDemoData(true);
    setPaginationInfo(null);
    setCacheTimestamp(Date.now());
    setError(null);
  }, []);

  // Page size for paginated fetching
  const PAGE_SIZE = 50; // Fetch 50 nodes per request for better UX
  
  // Fetch a single page of graph data
  const fetchGraphPage = useCallback(async (page: number): Promise<{
    nodes: GraphData['nodes'];
    edges: GraphData['edges'];
    pagination: PaginationInfo | null;
    stats: GraphStats | null;
  }> => {
    const baseUrl = endpoint || 'http://localhost:7777';
    const params = new URLSearchParams();
    params.append('per_page', String(PAGE_SIZE));
    params.append('page', String(page));
    
    const url = `${baseUrl}/v1/asset-graph/data?${params.toString()}`;
    console.log(`[AssetGraph] Fetching: ${url}`);
    
    // Add timeout to prevent hanging (60 seconds for potentially slow queries)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log(`[AssetGraph] Response status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { nodes: [], edges: [], pagination: null, stats: null };
        }
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[AssetGraph] Page ${page} data received:`, {
        nodesCount: (data.graph?.nodes || data.nodes || []).length,
        edgesCount: (data.graph?.edges || data.edges || []).length,
        pagination: data.pagination,
      });
      
      const rawNodes = data.graph?.nodes || data.nodes || [];
      const rawEdges = data.graph?.edges || data.edges || [];
      
      const nodes = rawNodes.map((n: ApiGraphNode & { created_at?: string }) => ({
        id: n.id,
        name: n.name,
        label: n.label,
        properties: typeof n.properties === 'string' ? JSON.parse(n.properties) : (n.properties || {}),
        created_at: n.created_at,
      }));
      
      const edges = rawEdges.map((e: ApiGraphEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : (e.properties || {}),
      }));
      
      return {
        nodes,
        edges,
        pagination: data.pagination || null,
        stats: data.stats || null,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  }, [endpoint]);
  
  // Track if background fetch is in progress
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
  
  // Fetch graph data with progressive loading:
  // 1. First page loads immediately (user sees content fast)
  // 2. Remaining pages load in background without blocking
  const fetchAllGraphData = useCallback(async (forceRefresh: boolean = false) => {
    // Check in-memory cache first
    if (!forceRefresh && cachedGraphData && cacheTimestamp && (Date.now() - cacheTimestamp) < GRAPH_CACHE_TTL) {
      console.log('[AssetGraph] Using in-memory cached data');
      setGraphData(cachedGraphData);
      setLoading(false);
      return;
    }
    
    // Check localStorage cache if no in-memory cache
    if (!forceRefresh) {
      const persisted = getPersistedCache();
      if (persisted) {
        console.log('[AssetGraph] Using localStorage cached data');
        setCachedGraphData(persisted.data);
        setCacheTimestamp(persisted.timestamp);
        setGraphData(persisted.data);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    setIsShowingDemoData(false);
    setLoadingProgress({ current: 1, total: 1 }); // Start at page 1

    try {
      // Fetch first page immediately
      console.log('[AssetGraph] Fetching first page...');
      const firstResult = await fetchGraphPage(1);
      console.log('[AssetGraph] First page received:', firstResult.nodes.length, 'nodes');
      
      if (firstResult.nodes.length === 0) {
        // No data - show empty state
        setGraphData({ nodes: [], edges: [] });
        updateCache({ nodes: [], edges: [] });
        setStats({ node_count: 0, edge_count: 0, nodes_by_label: {}, edges_by_label: {} });
        setLoading(false);
        setLoadingProgress(null);
        return;
      }
      
      // Show first page immediately - user sees content fast
      const initialData: GraphData = { nodes: [...firstResult.nodes], edges: [...firstResult.edges] };
      setGraphData(initialData);
      updateCache(initialData);
      setLoading(false); // Stop blocking loading state
      
      // Build initial stats
      const initialStats: GraphStats = {
        node_count: firstResult.nodes.length,
        edge_count: firstResult.edges.length,
        nodes_by_label: firstResult.nodes.reduce((acc, n) => {
          acc[n.label] = (acc[n.label] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        edges_by_label: {},
      };
      setStats(initialStats);
      
      const totalPages = firstResult.pagination?.total_pages || 1;
      
      // If there are more pages, fetch them in background
      if (totalPages > 1) {
        setIsBackgroundFetching(true);
        setLoadingProgress({ current: 1, total: totalPages });
        
        // Fetch remaining pages in background (non-blocking)
        const allNodes = [...firstResult.nodes];
        const allEdges = [...firstResult.edges];
        const seenEdgeIds = new Set(firstResult.edges.map(e => e.id));
        
        // Use setTimeout to yield to the main thread between fetches
        const fetchRemainingPages = async () => {
          for (let page = 2; page <= totalPages; page++) {
            try {
              // Yield to main thread to prevent blocking
              await new Promise(resolve => setTimeout(resolve, 10));
              
              console.log(`[AssetGraph] Background fetch: page ${page}/${totalPages}`);
              setLoadingProgress({ current: page, total: totalPages });
              
              const pageResult = await fetchGraphPage(page);
              allNodes.push(...pageResult.nodes);
              pageResult.edges.forEach(e => {
                if (!seenEdgeIds.has(e.id)) {
                  seenEdgeIds.add(e.id);
                  allEdges.push(e);
                }
              });
              
              // Update graph data progressively every page
              const updatedData: GraphData = { nodes: [...allNodes], edges: [...allEdges] };
              setGraphData(updatedData);
              updateCache(updatedData);
              
              // Update stats
              setStats({
                node_count: allNodes.length,
                edge_count: allEdges.length,
                nodes_by_label: allNodes.reduce((acc, n) => {
                  acc[n.label] = (acc[n.label] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
                edges_by_label: {},
              });
            } catch (err) {
              console.warn(`[AssetGraph] Failed to fetch page ${page}:`, err);
              // Continue with partial data
            }
          }
          
          setCacheTimestamp(Date.now());
          setIsBackgroundFetching(false);
          setLoadingProgress(null);
          console.log(`[AssetGraph] Background fetch complete: ${allNodes.length} nodes, ${allEdges.length} edges`);
        };
        
        // Start background fetch without await (non-blocking)
        fetchRemainingPages();
      } else {
        // Only one page - we're done
        setCacheTimestamp(Date.now());
        setLoadingProgress(null);
        console.log(`[AssetGraph] Single page load complete: ${firstResult.nodes.length} nodes`);
      }
      
    } catch (err) {
      console.error('[AssetGraph] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
      setGraphData({ nodes: [], edges: [] });
      setStats(null);
      setCachedGraphData(null);
      setCacheTimestamp(null);
      setLoadingProgress(null);
      setLoading(false);
    }
  }, [cachedGraphData, cacheTimestamp, fetchGraphPage, updateCache, GRAPH_CACHE_TTL, getPersistedCache]);
  
  // Legacy fetchGraphData for compatibility - now just calls fetchAllGraphData
  const fetchGraphData = useCallback(async (options?: { 
    page?: number; 
    per_page?: number; 
    since?: string; 
    until?: string;
    node_type?: string;
  }) => {
    // Date filters are now applied client-side using cached data
    // Just refresh the cache if needed
    void options; // Options ignored - filtering done client-side
    await fetchAllGraphData(false);
  }, [fetchAllGraphData]);
  
  // Force refresh from backend
  const refreshFromBackend = useCallback(async () => {
    await fetchAllGraphData(true);
  }, [fetchAllGraphData]);

  useEffect(() => {
    if (isOpen) {
      fetchAllGraphData(false);
    }
  }, [isOpen, fetchAllGraphData]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="absolute inset-4 bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex flex-col"
        >
          {/* Compact Header - title and actions only */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Asset Graph</h2>
              {isShowingDemoData && (
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-600 text-white rounded font-bold border border-amber-400 animate-pulse">
                  DEMO
                </span>
              )}
              {stats && (
                <span className="text-xs text-neutral-500">
                  {stats.node_count} nodes • {stats.edge_count} relationships
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchGraphData()}
                className="p-1.5 bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ReactFlow Container */}
          <ReactFlowProvider>
            <InternalFlow
              graphData={graphData}
              stats={stats}
              loading={loading}
              error={error}
              onRefresh={refreshFromBackend}
              endpoint={endpoint}
              isShowingDemoData={isShowingDemoData}
              onLoadDemoData={loadDemoData}
              loadingProgress={loadingProgress}
              isBackgroundFetching={isBackgroundFetching}
            />
          </ReactFlowProvider>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GraphVisualization;
