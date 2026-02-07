'use client';

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, Info, Edit3, Save, XCircle, Plus, Trash2, RotateCcw, Calendar, Loader2, Table, Network, ExternalLink, Undo, Redo, Shield, AlertTriangle, Minimize2, Maximize2, Zap, Copy } from 'lucide-react';
import { toast } from 'sonner';
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
  EdgeProps,
  Handle,
  Position,
  useReactFlow,
  useNodes,
  Connection,
  addEdge,
  OnConnect,
  getSmoothStepPath,
  EdgeLabelRenderer,
  SelectionMode,
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
  type CustomNode,
  type CustomNodeData,
} from './types';

// Import from utility files
import {
  NODE_TYPE_HIERARCHY,
  getNodeRank,
  SEED_NODE_TYPES,
  PRIMARY_SEED_TYPES,
} from './hierarchyUtils';
import {
  getStoredLayout,
  saveLayout,
  clearStoredLayout,
  type StoredLayout,
  LAYOUT_VERSION,
} from './storageUtils';
import {
  getLayoutedElements,
  DEFAULT_LAYOUT_SETTINGS,
  NODE_WIDTH,
  NODE_HEIGHT,
  type LayoutSettings,
  type LayoutOptions,
  spreadNodesInRow,
  spreadAllOverlappingNodes,
} from './layoutUtils';
import {
  getOptimalHandles,
  optimizeEdgeHandles,
  findSmartEdgePath,
  pathToSvgD,
  SMART_EDGE_NODE_WIDTH,
  SMART_EDGE_NODE_HEIGHT,
} from './edgeUtils';
import {
  type SimNode,
  simNodesToLayout,
} from './forceSimulation';
import { useNodeAnalysis } from './useNodeAnalysis';

// Import from constants
import {
  HIERARCHY_LEVELS,
  RELATIONSHIP_TYPES,
  NODE_TYPES,
  HANDLE_POSITIONS,
} from './constants';

// Import panel components
import {
  HierarchyLegend,
  FilterPanel,
  DateFilterPanel,
  NodeDetailsPanel,
  ExploitabilityPanel,
  RemediationPanel,
  AttackPathPanel,
  type DateFilterState,
} from './panels';

// Import components
import { 
  TableView, 
  NodeContextMenu, 
  BatchOperationsBar, 
  EmptyState,
  NavigationBreadcrumbs,
  type ContextMenuState,
} from './components';

// Import modal components
import {
  AddNodeModal,
  AddRelationshipModal,
  EditPropertiesModal,
  EditRelationshipModal,
  RelationshipSelector,
} from './modals';

// Import custom hooks
import {
  useKeyboardShortcuts,
  useUndoRedo,
  useNavigationHistory,
} from './hooks';

// Import pathfinding utilities (for smart edge routing)
// Pathfinding utilities are available in ./pathfinding.ts if refactoring is needed

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

// =============================================================================
// SMART EDGE COMPONENT - Uses A* pathfinding to route around nodes
// DISABLED: A* pathfinding is expensive for large graphs. Using smoothstep instead.
// To re-enable: change edge type from 'smoothstep' to 'smart' in edge creation
// =============================================================================

// NOTE: A* pathfinding utilities (findSmartEdgePath, pathToSvgD) are in edgeUtils.ts
// Layout utilities (getLayoutedElements, layoutCluster, etc.) are in layoutUtils.ts
// Force simulation is in forceSimulation.ts and quadtree.ts
// Hierarchy and storage utilities are in their respective files

// =============================================================================
// SMART EDGE COMPONENT - Uses A* pathfinding to route around nodes
// DISABLED: A* pathfinding is expensive for large graphs. Using smoothstep instead.
// To re-enable: change edge type from 'smoothstep' to 'smart' in edge creation
// =============================================================================
function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const nodes = useNodes();
  
  // Build obstacles from all nodes
  const obstacles = useMemo(() => {
    return nodes.map(node => ({
      x: node.position.x,
      y: node.position.y,
      width: (node.measured?.width || node.width || SMART_EDGE_NODE_WIDTH) as number,
      height: (node.measured?.height || node.height || SMART_EDGE_NODE_HEIGHT) as number,
    }));
  }, [nodes]);
  
  // Find path using A*
  const path = useMemo(() => {
    // Filter out source and target nodes from obstacles
    const filteredObstacles = obstacles.filter(obs => {
      const isSource = Math.abs(obs.x + obs.width / 2 - sourceX) < obs.width && 
                       Math.abs(obs.y + obs.height / 2 - sourceY) < obs.height;
      const isTarget = Math.abs(obs.x + obs.width / 2 - targetX) < obs.width && 
                       Math.abs(obs.y + obs.height / 2 - targetY) < obs.height;
      return !isSource && !isTarget;
    });
    
    return findSmartEdgePath(sourceX, sourceY, targetX, targetY, filteredObstacles);
  }, [sourceX, sourceY, targetX, targetY, obstacles]);
  
  // Fallback to smoothstep if no path found
  const [edgePath, labelX, labelY] = useMemo(() => {
    if (path && path.length > 1) {
      const svgPath = pathToSvgD(path);
      // Calculate label position at midpoint
      const midIdx = Math.floor(path.length / 2);
      return [svgPath, path[midIdx].x, path[midIdx].y];
    }
    
    // Fallback to smoothstep
    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    });
  }, [path, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);
  
  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={style}
        markerEnd={markerEnd as string}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              padding: labelBgPadding ? `${(labelBgPadding as [number, number])[1]}px ${(labelBgPadding as [number, number])[0]}px` : '4px 6px',
              borderRadius: labelBgBorderRadius || 4,
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              ...(labelBgStyle as React.CSSProperties),
              ...(labelStyle as React.CSSProperties),
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Register custom edge types
const edgeTypes = {
  smart: SmartEdge,
};

// =============================================================================
// CUSTOM NODE COMPONENT
// =============================================================================

// CustomNodeData and CustomNode types are now imported from ./types

const CustomNodeComponent = ({ data, selected }: NodeProps<CustomNode>) => {
  const nodeData = data as unknown as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;
  
  // Highlighting states
  const isHighlighted = nodeData.isHighlighted === true;
  const isDimmed = nodeData.isDimmed === true;
  const isSelectedNode = nodeData.isSelected === true;
  
  const handleCopyLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(nodeData.label).then(() => {
      toast.success(`Copied: ${nodeData.label}`);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };
  
  // Compute opacity and styles based on highlight state
  const dimmedOpacity = isDimmed ? 0.3 : 1;
  const highlightGlow = isHighlighted && !isSelectedNode 
    ? `0 0 12px 2px ${color}60, 0 0 20px 4px ${color}30` 
    : undefined;
  const selectedGlow = isSelectedNode 
    ? `0 0 16px 4px ${color}80, 0 0 30px 8px ${color}40` 
    : undefined;
  
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-lg min-w-[140px] max-w-[200px]
        transition-all duration-300
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''}
        ${isSelectedNode ? 'scale-110 z-50' : ''}
        ${isDimmed ? 'grayscale' : ''}
      `}
      style={{
        backgroundColor: isDimmed ? '#1a1a1a40' : `${color}20`,
        borderColor: isDimmed ? '#4a4a4a' : color,
        opacity: dimmedOpacity,
        boxShadow: selectedGlow || highlightGlow,
        transform: isSelectedNode ? 'scale(1.05)' : undefined,
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
          className="text-[10px] uppercase font-medium tracking-wider transition-colors duration-300"
          style={{ color: isDimmed ? '#6b7280' : color }}
        >
          {nodeData.nodeType}
        </div>
        <div 
          className={`text-sm font-semibold truncate flex items-center gap-1.5 group cursor-pointer transition-colors duration-300 ${
            isDimmed ? 'text-neutral-500' : 'text-white hover:text-blue-300'
          }`}
          title={`Double-click to copy: ${nodeData.label}`}
          onDoubleClick={handleCopyLabel}
        >
          <span className="truncate">{nodeData.label}</span>
          <Copy className={`w-3 h-3 transition-opacity flex-shrink-0 ${isDimmed ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`} />
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNodeComponent,
};

// Panel components (ExploitabilityPanel, RemediationPanel, AttackPathPanel, NodeDetailsPanel)
// are now imported from ./panels

// Modal components (AddNodeModal, AddRelationshipModal, EditPropertiesModal, 
// EditRelationshipModal, RelationshipSelector) are now imported from ./modals

// Helper function to get score color for inline use
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

// All panel components are imported from ./panels
// All modal components are imported from ./modals
// All UI components are imported from ./components

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

// Demo data is imported from demoData.ts
import { DEMO_GRAPH_DATA } from './demoData';

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

/** Ref handle for zoom controls in header (setViewport/getViewport/persistZoom from useReactFlow). */
export type FlowControlRef = {
  setViewport: (v: { x: number; y: number; zoom: number }) => void;
  getViewport: () => { x: number; y: number; zoom: number };
  /** Persist current zoom to layout storage (e.g. when changed from header). */
  persistZoom: (zoom: number) => void;
};

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
  /** Ref to expose setViewport/getViewport for header zoom control. */
  flowRef?: React.RefObject<FlowControlRef | null>;
  /** Called when zoom level changes (for header display). */
  onZoomChange?: (zoom: number) => void;
}

// Minimum zoom level to ensure nodes are readable
// Zoom constraints - adaptive based on node count
const MIN_READABLE_ZOOM = 0.15;  // Allow more zoom out for large graphs
const MAX_INITIAL_ZOOM = 1.2;

// Calculate optimal initial zoom based on node count
const getOptimalZoom = (nodeCount: number): { minZoom: number; maxZoom: number; targetZoom: number } => {
  if (nodeCount <= 20) {
    return { minZoom: 0.5, maxZoom: 1.2, targetZoom: 0.9 };
  } else if (nodeCount <= 50) {
    return { minZoom: 0.4, maxZoom: 1.0, targetZoom: 0.7 };
  } else if (nodeCount <= 100) {
    return { minZoom: 0.3, maxZoom: 0.8, targetZoom: 0.5 };
  } else if (nodeCount <= 200) {
    return { minZoom: 0.2, maxZoom: 0.6, targetZoom: 0.35 };
  } else if (nodeCount <= 400) {
    return { minZoom: 0.15, maxZoom: 0.4, targetZoom: 0.25 };
  } else {
    return { minZoom: 0.1, maxZoom: 0.3, targetZoom: 0.15 };
  }
};
function InternalFlow({ graphData, stats, loading, error, onRefresh, endpoint, isShowingDemoData, onLoadDemoData, loadingProgress, isBackgroundFetching, flowRef, onZoomChange }: InternalFlowProps) {
  const { fitView, setCenter, getNode, setViewport, getViewport } = useReactFlow();
  
  // Track current zoom level for display; restore from stored layout when available
  const [currentZoom, setCurrentZoom] = useState(() => getStoredLayout()?.preferences?.lastZoom ?? 1);
  // Persist zoom to layout storage (merge with existing preferences)
  const persistZoom = useCallback((zoom: number) => {
    const existing = getStoredLayout();
    saveLayout({
      preferences: {
        showMinimap: existing?.preferences?.showMinimap ?? true,
        showLegend: existing?.preferences?.showLegend ?? false,
        lastZoom: zoom,
      },
    });
  }, []);
  // Expose setViewport/getViewport/persistZoom to parent for header zoom control
  useImperativeHandle(flowRef, () => ({ setViewport, getViewport, persistZoom }), [setViewport, getViewport, persistZoom]);

  // Sync initial zoom to parent when mounted
  useEffect(() => {
    if (onZoomChange == null) return;
    const t = setTimeout(() => onZoomChange(getViewport().zoom), 150);
    return () => clearTimeout(t);
  }, [onZoomChange, getViewport]);
  
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
  
  // Fetch latest node data from API when selected (ensures we have latest properties)
  const fetchNodeData = useCallback(async (nodeId: string) => {
    if (!endpoint) return null;
    
    try {
      const baseUrl = endpoint || 'http://localhost:7777';
      // Use singular "node" endpoint (not "nodes")
      const response = await fetch(`${baseUrl}/v1/asset-graph/node/${nodeId}`);
      if (response.ok) {
        const responseData = await response.json();
        // API returns { node: {...}, neighbors: [...] }
        return responseData.node || null;
      }
    } catch (error) {
      console.warn('Failed to fetch node data:', error);
    }
    return null;
  }, [endpoint]);
  
  // Update selected node when nodes array changes (e.g., after CVE analysis refresh)
  useEffect(() => {
    if (selectedNode) {
      // Find the updated node in the current nodes array
      const updatedNode = nodes.find(n => n.id === selectedNode.id);
      if (updatedNode) {
        // Check if properties have changed
        const currentProps = JSON.stringify((selectedNode.data as CustomNodeData).properties || {});
        const newProps = JSON.stringify((updatedNode.data as CustomNodeData).properties || {});
        if (currentProps !== newProps) {
          // Update selected node with latest data
          setSelectedNode(updatedNode);
        }
      }
    }
  }, [nodes, selectedNode?.id]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());
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
  // Saved layout settings (persisted state) - for Save/Cancel workflow
  const [savedLayoutSettings, setSavedLayoutSettings] = useState<LayoutSettings>({
    ...DEFAULT_LAYOUT_SETTINGS,
  });
  
  // Node analysis hook - handles CVE analysis and future node-specific analysis operations
  const { cveAnalysisInProgress, runCVEAnalysis } = useNodeAnalysis({ endpoint, onRefresh });
  
  // Check if there are unsaved layout changes (current vs saved)
  const hasUnsavedLayoutChanges = useMemo(() => {
    return JSON.stringify(layoutSettings) !== JSON.stringify(savedLayoutSettings);
  }, [layoutSettings, savedLayoutSettings]);
  
  // Update a single layout setting with instant feedback
  const updateLayoutSetting = useCallback(<K extends keyof LayoutSettings>(
    key: K,
    value: LayoutSettings[K]
  ) => {
    setLayoutSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Save layout settings (persist as saved state)
  const saveLayoutSettings = useCallback(() => {
    setSavedLayoutSettings({ ...layoutSettings });
    // Persist to localStorage
    const stored = getStoredLayout();
    saveLayout({ ...stored, layoutSettings });
    setShowLayoutSettings(false);
  }, [layoutSettings]);
  
  // Cancel layout settings changes (revert to saved state)
  const cancelLayoutSettings = useCallback(() => {
    setLayoutSettings({ ...savedLayoutSettings });
    setShowLayoutSettings(false);
  }, [savedLayoutSettings]);
  
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
  
  // View mode state: 'graph' or 'table'
  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
  
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
  
  // Search input ref for focusing via keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/Redo hook for edit mode
  const { 
    pushHistory, 
    undo: undoHistory, 
    redo: redoHistory, 
    canUndo, 
    canRedo 
  } = useUndoRedo({ maxHistorySize: 50 });
  
  // Navigation history hook for breadcrumb navigation
  const {
    history: navigationHistory,
    currentIndex: navCurrentIndex,
    push: pushNavigation,
    goBack: navGoBack,
    goForward: navGoForward,
    canGoBack,
    canGoForward,
  } = useNavigationHistory(50);
  
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

    // Count edges between each node pair for handle spreading
    const edgePairCounts = new Map<string, number>();
    const edgePairIndices = new Map<string, number>();
    
    graphData.edges
      .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      .forEach(edge => {
        const pairKey = [edge.source, edge.target].sort().join('|');
        edgePairCounts.set(pairKey, (edgePairCounts.get(pairKey) || 0) + 1);
      });

    // Convert to ReactFlow edges with relationship-based colors and smart handle selection
    const flowEdges: Edge[] = graphData.edges
      .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      .map((edge) => {
        const edgeColor = EDGE_COLORS[edge.label] || EDGE_COLORS.default;
        
        // Check for stored handle positions first
        const storedHandles = stored?.edgeHandles?.[edge.id];
        let sourceHandle = storedHandles?.sourceHandle || 'source-bottom';
        let targetHandle = storedHandles?.targetHandle || 'target-top';
        
        // If no stored handles, determine based on node positions and hierarchy
        if (!storedHandles) {
          const sourceNode = nodePositionMap.get(edge.source);
          const targetNode = nodePositionMap.get(edge.target);
          
          if (sourceNode && targetNode) {
            // Get edge index for this pair (for spreading multiple edges)
            const pairKey = [edge.source, edge.target].sort().join('|');
            const edgeIndex = edgePairIndices.get(pairKey) || 0;
            edgePairIndices.set(pairKey, edgeIndex + 1);
            const totalEdges = edgePairCounts.get(pairKey) || 1;
            
            // Use position-based handle optimization
            const handles = getOptimalHandles(
              sourceNode, 
              targetNode, 
              edge.label, 
              edgeIndex, 
              totalEdges
            );
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
            fillOpacity: 0.95,
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

    // =====================================================================
    // POST-LAYOUT EDGE HANDLE OPTIMIZATION
    // Re-optimize edge handles based on actual node positions after layout
    // =====================================================================
    const optimizeEdgeHandles = (positionedNodes: Node[], edgesToOptimize: Edge[]): Edge[] => {
      // Build position map from actual layouted positions
      const actualPositions = new Map<string, { x: number; y: number; level: number }>();
      positionedNodes.forEach(node => {
        const nodeData = node.data as CustomNodeData;
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
          maxClustersPerRow: layoutSettings.clustersPerRow > 0 ? layoutSettings.clustersPerRow : undefined,
          clusterSpacing: layoutSettings.clusterSpacing,
          minNodeSpacing: layoutSettings.minNodeSpacing,
          levelSpacing: layoutSettings.levelSpacing,
          forceIterations: layoutSettings.forceIterations,
          useWebWorker: layoutSettings.useWebWorker,
          gridFallbackThreshold: layoutSettings.gridFallbackThreshold,
        }
      );
      
      // Spread overlapping nodes to prevent initial overlap
      const spreadNodes = spreadAllOverlappingNodes(layoutedNodes, layoutSettings.minNodeSpacing || 200);
      
      // Optimize edge handles based on actual layouted positions
      const optimizedEdges = optimizeEdgeHandles(spreadNodes, layoutedEdges);
      
      setNodes(spreadNodes as CustomNode[]);
      setEdges(optimizedEdges);
      console.log(`[AssetGraph] Applied fresh hierarchical layout${hasActiveFilters ? ' (filters active)' : ''} with overlap prevention and optimized edge handles (container: ${containerSize.width}x${containerSize.height}, clustersPerRow: ${layoutSettings.clustersPerRow || 'auto'}, worker: ${layoutSettings.useWebWorker})`);
    }

    // Fit view after layout with adaptive zoom based on node count; restore stored zoom when available
    const nodeCount = flowNodes.length;
    const { minZoom, maxZoom, targetZoom } = getOptimalZoom(nodeCount);
    const savedZoom = getStoredLayout()?.preferences?.lastZoom;
    
    console.log(`[AssetGraph] Adaptive zoom for ${nodeCount} nodes: min=${minZoom}, max=${maxZoom}, target=${targetZoom}${savedZoom != null ? `, restoring saved zoom ${savedZoom}` : ''}`);
    
    setTimeout(() => {
      fitView({ 
        padding: 0.1,
        minZoom,
        maxZoom,
        duration: 300,
      });
      
      // Apply zoom: prefer saved zoom from storage, else use adaptive target
      const clampZoom = (z: number) => Math.max(minZoom, Math.min(maxZoom, z));
      if (nodeCount > 100) {
        setTimeout(() => {
          const viewport = getViewport();
          const initialZoom = savedZoom != null ? clampZoom(savedZoom) : targetZoom;
          setViewport({ ...viewport, zoom: initialZoom }, { duration: 200 });
          setCurrentZoom(initialZoom);
          onZoomChange?.(initialZoom);
        }, 350);
      } else {
        setTimeout(() => {
          const viewport = getViewport();
          const zoom = savedZoom != null ? clampZoom(savedZoom) : viewport.zoom;
          setViewport({ ...viewport, zoom }, { duration: 200 });
          setCurrentZoom(zoom);
          onZoomChange?.(zoom);
        }, 350);
      }
    }, 100);
  }, [graphData, activeFilters, primaryAnchorType, searchFilteredNodeIds, nodeMatchesDateFilter, dateFilter, containerSize, layoutSettings, filterMaxHops, getNodesWithinHops, setNodes, setEdges, fitView, getViewport, onZoomChange]);

  // Keep a ref of the last zoom so we can restore it when switching from table back to graph
  const lastZoomRef = useRef(currentZoom);
  useEffect(() => {
    lastZoomRef.current = currentZoom;
  }, [currentZoom]);

  const prevViewModeRef = useRef(viewMode);
  // When switching from table view to graph view, restore zoom (ReactFlow remounts and fitView resets it)
  useEffect(() => {
    const prev = prevViewModeRef.current;
    prevViewModeRef.current = viewMode;
    if (prev !== 'table' || viewMode !== 'graph') return;
    const id = setTimeout(() => {
      const zoom = lastZoomRef.current;
      const v = getViewport();
      setViewport({ ...v, zoom }, { duration: 0 });
      setCurrentZoom(zoom);
      onZoomChange?.(zoom);
    }, 150);
    return () => clearTimeout(id);
  }, [viewMode, getViewport, setViewport, onZoomChange]);

  // ==========================================================================
  // HIGHLIGHT RELATED NODES WHEN A NODE IS SELECTED
  // Uses the same filterMaxHops (depth) setting from the navigation controls
  // ==========================================================================
  
  // Use refs to access current nodes/edges without causing effect re-runs
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  
  useEffect(() => {
    if (!selectedNode) {
      // No node selected - clear all highlighting
      setHighlightedNodeIds(new Set());
      setHighlightedEdgeIds(new Set());
      
      // Remove highlight/dim state from all nodes
      setNodes(currentNodes => currentNodes.map(node => {
        // Only update if node has highlight state
        if (node.data.isHighlighted || node.data.isDimmed || node.data.isSelected) {
          return {
            ...node,
            data: {
              ...node.data,
              isHighlighted: false,
              isDimmed: false,
              isSelected: false,
            },
          };
        }
        return node;
      }));
      return;
    }
    
    // Use VISIBLE nodes and edges (from refs) for highlight calculation
    // This ensures highlighting respects the current filtered view
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const visibleNodeIds = new Set(currentNodes.map(n => n.id));
    
    // Build adjacency list from VISIBLE edges only
    const adjacency = new Map<string, Set<string>>();
    currentEdges.forEach(edge => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    });
    
    // BFS to find nodes within filterMaxHops from selected node
    // filterMaxHops: undefined = 'all' (no limit), 0 = selected only, N = N hops
    const maxHops = filterMaxHops ?? 100; // undefined means 'all', use large number
    const relatedNodeIds = new Set<string>([selectedNode.id]);
    let frontier = new Set<string>([selectedNode.id]);
    
    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier = new Set<string>();
      frontier.forEach(nodeId => {
        const neighbors = adjacency.get(nodeId);
        if (neighbors) {
          neighbors.forEach(neighborId => {
            if (!relatedNodeIds.has(neighborId) && visibleNodeIds.has(neighborId)) {
              relatedNodeIds.add(neighborId);
              nextFrontier.add(neighborId);
            }
          });
        }
      });
      frontier = nextFrontier;
      if (frontier.size === 0) break;
    }
    
    // Find edges that connect related nodes (both endpoints must be related)
    const relatedEdgeIds = new Set<string>();
    currentEdges.forEach(edge => {
      if (relatedNodeIds.has(edge.source) && relatedNodeIds.has(edge.target)) {
        relatedEdgeIds.add(edge.id);
      }
    });
    
    setHighlightedNodeIds(relatedNodeIds);
    setHighlightedEdgeIds(relatedEdgeIds);
    
    // Update node data with highlight state
    setNodes(currentNodes => currentNodes.map(node => {
      const isRelated = relatedNodeIds.has(node.id);
      const isTheSelectedNode = node.id === selectedNode.id;
      const newIsHighlighted = isRelated && !isTheSelectedNode;
      const newIsDimmed = !isRelated;
      
      // Only create new object if state actually changed
      if (node.data.isHighlighted === newIsHighlighted && 
          node.data.isDimmed === newIsDimmed && 
          node.data.isSelected === isTheSelectedNode) {
        return node;
      }
      
      return {
        ...node,
        data: {
          ...node.data,
          isHighlighted: newIsHighlighted,
          isDimmed: newIsDimmed,
          isSelected: isTheSelectedNode,
        },
      };
    }));
    
    console.log(`[AssetGraph] Highlighting ${relatedNodeIds.size} nodes, ${relatedEdgeIds.size} edges within ${filterMaxHops ?? 'all'} hops of "${(selectedNode.data as CustomNodeData).label}"`);
    
  }, [selectedNode, filterMaxHops, setNodes]);

  // ==========================================================================
  // INCREMENTAL FORCE SIMULATION (DISABLED - kept for future use)
  // Force simulation is disabled for performance. Grid-based layout is used instead.
  // To re-enable: remove the early return below.
  // ==========================================================================
  
  // State for incremental simulation
  const simulationStateRef = useRef<{
    simNodes: SimNode[];
    simEdges: Array<{ source: SimNode; target: SimNode }>;
    currentIter: number;
    totalIterations: number;
    isRunning: boolean;
    graphKey: string;
  } | null>(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  
  // Start incremental simulation for large graphs
  // DISABLED: Force simulation is too slow for large graphs. Grid-based layout is used instead.
  // To re-enable: uncomment the useEffect below and comment out the empty one.
  useEffect(() => {
    // Force simulation disabled - using fast grid layout
    void simulationStateRef; // Suppress unused warning
    void setIsSimulating;
    void setSimulationProgress;
    void simNodesToLayout;
  }, []);
  
  /*
  // ORIGINAL FORCE SIMULATION CODE (kept for future use):
  useEffect(() => {
    if (!graphData || nodes.length <= 50) return;
    
    const graphKey = `${nodes.length}-${edges.length}`;
    
    if (simulationStateRef.current?.graphKey === graphKey && simulationStateRef.current.isRunning) {
      return;
    }
    
    const simNodes: SimNode[] = nodes.map(node => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      vx: 0,
      vy: 0,
      node: node as Node,
    }));
    
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));
    
    const simEdges = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
      }));
    
    const totalIterations = Math.min(150, Math.max(50, 200 - nodes.length / 2));
    
    simulationStateRef.current = {
      simNodes,
      simEdges,
      currentIter: 0,
      totalIterations,
      isRunning: true,
      graphKey,
    };
    
    setIsSimulating(true);
    setSimulationProgress(0);
    console.log(`[AssetGraph] Starting incremental force simulation for ${nodes.length} nodes (${totalIterations} iterations)`);
    
    const batchSize = Math.max(5, Math.floor(20 - nodes.length / 50));
    
    const runBatch = () => {
      const state = simulationStateRef.current;
      if (!state || !state.isRunning) return;
      
      const { simNodes, simEdges, currentIter, totalIterations } = state;
      
      const { done, nextIter } = continueSimulation(simNodes, simEdges, currentIter, totalIterations, batchSize);
      
      state.currentIter = nextIter;
      setSimulationProgress(Math.round((nextIter / totalIterations) * 100));
      
      const result = simNodesToLayout(simNodes);
      const updatedNodes = result.nodes.map(n => ({
        ...n,
        data: simNodes.find(sn => sn.id === n.id)?.node.data || n.data,
      }));
      
      setNodes(updatedNodes as CustomNode[]);
      
      if (done) {
        state.isRunning = false;
        setIsSimulating(false);
        console.log(`[AssetGraph] Force simulation complete`);
        
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 300 });
        }, 50);
      } else {
        requestAnimationFrame(runBatch);
      }
    };
    
    const timer = setTimeout(() => {
      requestAnimationFrame(runBatch);
    }, 200);
    
    return () => {
      clearTimeout(timer);
      if (simulationStateRef.current) {
        simulationStateRef.current.isRunning = false;
      }
    };
  }, [nodes.length, edges.length, graphData, setNodes, fitView]);
  */

  // ==========================================================================
  // SAVE LAYOUT TO BROWSER STORAGE
  // ==========================================================================
  
  // Save node positions when they change (debounced)
  const saveNodePositionsRef = useRef<NodeJS.Timeout | null>(null);
  const updateEdgeHandlesRef = useRef<NodeJS.Timeout | null>(null);
  
  // ==========================================================================
  // A* PATHFINDING FOR EDGE ROUTING (inspired by react-flow-smart-edge)
  // ==========================================================================
  
  // Grid and node configuration - tuned for better collision avoidance
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 60;
  const GRID_SIZE = 10; // Smaller grid = more precise pathfinding (was 20)
  const NODE_PADDING = 25; // Larger padding = more clearance around nodes (was 15)
  
  // A* Priority Queue implementation (min-heap)
  class PriorityQueue<T> {
    private items: Array<{ item: T; priority: number }> = [];
    
    push(item: T, priority: number) {
      this.items.push({ item, priority });
      this.items.sort((a, b) => a.priority - b.priority);
    }
    
    pop(): T | undefined {
      return this.items.shift()?.item;
    }
    
    isEmpty(): boolean {
      return this.items.length === 0;
    }
  }
  
  // A* pathfinding algorithm
  const findPathAStar = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    obstacles: Array<{ x: number; y: number; width: number; height: number }>,
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): Array<{ x: number; y: number }> | null => {
    // Convert to grid coordinates
    const toGrid = (p: { x: number; y: number }) => ({
      gx: Math.round(p.x / GRID_SIZE),
      gy: Math.round(p.y / GRID_SIZE)
    });
    
    const fromGrid = (gx: number, gy: number) => ({
      x: gx * GRID_SIZE,
      y: gy * GRID_SIZE
    });
    
    const startGrid = toGrid(start);
    const endGrid = toGrid(end);
    
    // Create obstacle set for O(1) lookup
    const obstacleSet = new Set<string>();
    obstacles.forEach(obs => {
      const minGx = Math.floor((obs.x - NODE_PADDING) / GRID_SIZE);
      const maxGx = Math.ceil((obs.x + obs.width + NODE_PADDING) / GRID_SIZE);
      const minGy = Math.floor((obs.y - NODE_PADDING) / GRID_SIZE);
      const maxGy = Math.ceil((obs.y + obs.height + NODE_PADDING) / GRID_SIZE);
      
      for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gy = minGy; gy <= maxGy; gy++) {
          obstacleSet.add(`${gx},${gy}`);
        }
      }
    });
    
    // Heuristic: Manhattan distance
    const heuristic = (gx: number, gy: number) => 
      Math.abs(gx - endGrid.gx) + Math.abs(gy - endGrid.gy);
    
    // A* setup
    const openSet = new PriorityQueue<{ gx: number; gy: number }>();
    const cameFrom = new Map<string, { gx: number; gy: number }>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    
    const key = (gx: number, gy: number) => `${gx},${gy}`;
    
    gScore.set(key(startGrid.gx, startGrid.gy), 0);
    fScore.set(key(startGrid.gx, startGrid.gy), heuristic(startGrid.gx, startGrid.gy));
    openSet.push(startGrid, heuristic(startGrid.gx, startGrid.gy));
    
    // Directions: 4-way (orthogonal) for cleaner paths
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 1, dy: 0 },  // right
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
    ];
    
    // Expand search bounds significantly for better routing around obstacles
    const minGx = Math.floor(bounds.minX / GRID_SIZE) - 20;
    const maxGx = Math.ceil(bounds.maxX / GRID_SIZE) + 20;
    const minGy = Math.floor(bounds.minY / GRID_SIZE) - 20;
    const maxGy = Math.ceil(bounds.maxY / GRID_SIZE) + 20;
    
    let iterations = 0;
    const maxIterations = 5000; // Increased for complex graphs
    
    while (!openSet.isEmpty() && iterations < maxIterations) {
      iterations++;
      const current = openSet.pop()!;
      
      // Goal reached
      if (current.gx === endGrid.gx && current.gy === endGrid.gy) {
        // Reconstruct path
        const path: Array<{ x: number; y: number }> = [];
        let curr: { gx: number; gy: number } | undefined = current;
        
        while (curr) {
          path.unshift(fromGrid(curr.gx, curr.gy));
          curr = cameFrom.get(key(curr.gx, curr.gy));
        }
        
        // Simplify path (remove intermediate points on straight lines)
        const simplified: Array<{ x: number; y: number }> = [path[0]];
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
          openSet.push({ gx: nx, gy: ny }, f);
        }
      }
    }
    
    // No path found
    return null;
  }, []);
  
  // Get handle position offset
  const getHandleOffset = useCallback((handle: string): { x: number; y: number } => {
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
  }, []);
  
  // Calculate optimal handle based on relative positions using A* pathfinding
  // Named differently to avoid conflict with getOptimalHandles from edgeUtils
  const getOptimalHandlesAStar = useCallback((
    sourceId: string,
    targetId: string,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    allNodePositions: Map<string, { x: number; y: number }>
  ): { sourceHandle: string; targetHandle: string; path?: Array<{ x: number; y: number }> } => {
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
      
      // Determine source handle from first move direction
      let sourceHandle: string;
      if (Math.abs(firstMove.dx) > Math.abs(firstMove.dy)) {
        sourceHandle = firstMove.dx > 0 ? 'source-right' : 'source-left';
      } else {
        sourceHandle = firstMove.dy > 0 ? 'source-bottom' : 'source-top';
      }
      
      // Determine target handle from last move direction
      let targetHandle: string;
      if (Math.abs(lastMove.dx) > Math.abs(lastMove.dy)) {
        targetHandle = lastMove.dx > 0 ? 'target-left' : 'target-right';
      } else {
        targetHandle = lastMove.dy > 0 ? 'target-top' : 'target-bottom';
      }
      
      return { sourceHandle, targetHandle, path };
    }
    
    // Fallback to default handles if no path found
    return { sourceHandle: defaultHandles.source, targetHandle: defaultHandles.target };
  }, [findPathAStar, getHandleOffset]);
  
  // Update edge handles based on current node positions, avoiding collisions
  const updateEdgeHandlesForPositions = useCallback(() => {
    if (nodes.length === 0 || edges.length === 0) return;
    
    // Build a map of node positions
    const nodePositions = new Map<string, { x: number; y: number }>();
    nodes.forEach(node => {
      nodePositions.set(node.id, { x: node.position.x, y: node.position.y });
    });
    
    // Update edges with optimal handles (collision-aware)
    const updatedEdges = edges.map(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      
      if (!sourcePos || !targetPos) return edge;
      
      const { sourceHandle, targetHandle } = getOptimalHandlesAStar(
        edge.source, 
        edge.target, 
        sourcePos, 
        targetPos, 
        nodePositions
      );
      
      // Only update if handles changed
      if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) {
        return edge;
      }
      
      return {
        ...edge,
        sourceHandle,
        targetHandle,
      };
    });
    
    // Check if any edges actually changed
    const hasChanges = updatedEdges.some((edge, i) => 
      edge.sourceHandle !== edges[i].sourceHandle || 
      edge.targetHandle !== edges[i].targetHandle
    );
    
    if (hasChanges) {
      setEdges(updatedEdges);
      
      // Save edge handles to storage
      const edgeHandles: Record<string, { sourceHandle: string; targetHandle: string }> = {};
      updatedEdges.forEach(edge => {
        if (edge.sourceHandle && edge.targetHandle) {
          edgeHandles[edge.id] = { 
            sourceHandle: edge.sourceHandle, 
            targetHandle: edge.targetHandle 
          };
        }
      });
      saveLayout({ edgeHandles });
    }
  }, [nodes, edges, getOptimalHandlesAStar, setEdges]);
  
  // Apply A* pathfinding on initial render and when graph structure changes
  // DISABLED: Too slow for large graphs. Edge handles are set during initial layout.
  // To re-enable: uncomment the effect below
  const initialPathfindingAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    // DISABLED - initial pathfinding is too slow for large graphs
    void initialPathfindingAppliedRef; // Suppress unused warning
  }, []);
  
  /*
  // ORIGINAL INITIAL PATHFINDING CODE (kept for future use):
  useEffect(() => {
    const graphKey = `${nodes.length}-${edges.length}-${nodes.map(n => n.id).slice(0, 5).join(',')}`;
    
    if (initialPathfindingAppliedRef.current === graphKey || nodes.length === 0 || edges.length === 0) {
      return;
    }
    
    const timer = setTimeout(() => {
      console.log('[AssetGraph] Applying A* pathfinding for initial edge routing...');
      updateEdgeHandlesForPositions();
      initialPathfindingAppliedRef.current = graphKey;
    }, 500);
    
    return () => clearTimeout(timer);
  }, [nodes.length, edges.length, updateEdgeHandlesForPositions]);
  */
  
  // Custom onNodesChange handler that also saves positions and updates edge handles
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    
    // Check if any position changed
    const hasPositionChange = changes.some(
      (change) => change.type === 'position' && change.position
    );
    
    if (hasPositionChange) {
      // Debounce edge handle updates (faster response for better UX)
      if (updateEdgeHandlesRef.current) {
        clearTimeout(updateEdgeHandlesRef.current);
      }
      updateEdgeHandlesRef.current = setTimeout(() => {
        updateEdgeHandlesForPositions();
      }, 150); // Update handles 150ms after movement stops
      
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
  }, [nodes, onNodesChange, updateEdgeHandlesForPositions]);

  // Save UI preferences when they change (merge with existing so lastZoom is preserved)
  useEffect(() => {
    const stored = getStoredLayout();
    saveLayout({
      preferences: {
        ...(stored?.preferences || {}),
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
      
      // Fetch latest node data from API to ensure we have updated properties
      fetchNodeData(node.id).then(nodeData => {
        if (nodeData) {
          const properties = typeof nodeData.properties === 'string' 
            ? JSON.parse(nodeData.properties) 
            : (nodeData.properties || {});
          
          // Update the node in the nodes array with latest data
          setNodes((currentNodes) => {
            return currentNodes.map(n => {
              if (n.id === node.id) {
                // Update node with latest data from API
                return {
                  ...n,
                  data: {
                    ...n.data,
                    properties: properties,
                  },
                };
              }
              return n;
            });
          });
          
          // Update selected node with latest data
          setSelectedNode((currentSelected) => {
            if (currentSelected && currentSelected.id === node.id) {
              return {
                ...currentSelected,
                data: {
                  ...currentSelected.data,
                  properties: properties,
                },
              };
            }
            return currentSelected;
          });
        }
      });
      
      // Spread nodes in the same row to prevent overlap when focusing
      const spreadNodes = spreadNodesInRow(node.id, nodes, 200);
      if (spreadNodes !== nodes) {
        setNodes(spreadNodes as CustomNode[]);
      }
      
      // Center on the clicked node (use updated position after spreading)
      setTimeout(() => {
        const nodeData = getNode(node.id);
        if (nodeData) {
          setCenter(nodeData.position.x + 90, nodeData.position.y + 30, { zoom: 1.2, duration: 500 });
        }
      }, 50);
    }
  }, [getNode, setCenter, nodes, setNodes, fetchNodeData, setSelectedNode]);

  // Left-click handler (bound to onNodeClick)
  const onNodeClick = useCallback((event: React.MouseEvent, node: CustomNode) => {
    // If Command/Meta key is held, let ReactFlow handle multi-selection
    // Don't run custom logic that would interfere with selection
    if (event.metaKey) {
      return;
    }
    handleNodeInteraction(event, node, false);
  }, [handleNodeInteraction]);

  // Right-click handler (bound to onNodeContextMenu)
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: CustomNode) => {
    handleNodeInteraction(event, node, true);
  }, [handleNodeInteraction]);

  // Handle background click to deselect
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // If Command/Meta key is held, user might be doing multi-selection, don't clear
    if (event.metaKey) {
      return;
    }
    setSelectedNode(null);
    // Close context menu if open
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Navigate to a node with history tracking
  const navigateToNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setCenter(node.position.x + 90, node.position.y + 30, { zoom: 1.2, duration: 500 });
      // Track in navigation history
      pushNavigation(nodeId);
    }
  }, [nodes, setCenter, pushNavigation]);
  
  // Handle undo action
  const handleUndo = useCallback(() => {
    const previousState = undoHistory();
    if (previousState) {
      setNodes(previousState.nodes as CustomNode[]);
      setEdges(previousState.edges);
      toast.info('Undo successful', { duration: 1500 });
    }
  }, [undoHistory, setNodes, setEdges]);
  
  // Handle redo action  
  const handleRedo = useCallback(() => {
    const nextState = redoHistory();
    if (nextState) {
      setNodes(nextState.nodes as CustomNode[]);
      setEdges(nextState.edges);
      toast.info('Redo successful', { duration: 1500 });
    }
  }, [redoHistory, setNodes, setEdges]);
  
  // Handle navigation back
  const handleNavBack = useCallback(() => {
    const prevNodeId = navGoBack();
    if (prevNodeId) {
      const node = nodes.find(n => n.id === prevNodeId);
      if (node) {
        setSelectedNode(node);
        setCenter(node.position.x + 90, node.position.y + 30, { zoom: 1.2, duration: 500 });
      }
    }
  }, [navGoBack, nodes, setCenter]);
  
  // Handle navigation forward
  const handleNavForward = useCallback(() => {
    const nextNodeId = navGoForward();
    if (nextNodeId) {
      const node = nodes.find(n => n.id === nextNodeId);
      if (node) {
        setSelectedNode(node);
        setCenter(node.position.x + 90, node.position.y + 30, { zoom: 1.2, duration: 500 });
      }
    }
  }, [navGoForward, nodes, setCenter]);

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
  // Always include primary seed types (Threat, Vulnerability, Asset) for filtering,
  // plus any types from the API stats (all types in database) and current graph data
  const nodeTypesList = useMemo(() => {
    const typeSet = new Set<string>();
    
    // Always include primary seed types so they're available for filtering
    PRIMARY_SEED_TYPES.forEach(type => typeSet.add(type));
    
    // Add types from stats (represents all types in the database from API)
    if (stats?.nodes_by_label) {
      Object.keys(stats.nodes_by_label).forEach(type => typeSet.add(type));
    }
    
    // Add types from current graph data
    if (graphData?.nodes) {
      graphData.nodes.forEach(n => typeSet.add(n.label));
    }
    
    return [...typeSet];
  }, [graphData, stats]);

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
    
    // Get edge info for notification
    const edge = edges.find(e => e.id === edgeId);
    const edgeLabel = edge ? String(edge.label || 'relationship') : 'relationship';
    
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    
    // Check if it's a new edge (not yet saved) or existing edge
    const isNewEdge = pendingChanges.addedEdges.some((e) => e.id === edgeId);
    
    if (isNewEdge) {
      // Remove from added edges
      setPendingChanges((prev) => ({
        ...prev,
        addedEdges: prev.addedEdges.filter((e) => e.id !== edgeId),
      }));
      toast.info(`Removed pending ${edgeLabel}`, { duration: 2000 });
    } else {
      // Add to deleted edges - will be deleted on save
      setPendingChanges((prev) => ({
        ...prev,
        deletedEdgeIds: [...prev.deletedEdgeIds, edgeId],
      }));
      toast.info(`Marked ${edgeLabel} for deletion (click Save to confirm)`, { duration: 2000 });
    }
  }, [editMode, edges, setEdges, pendingChanges.addedEdges]);

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
      }).then(response => {
        if (response.ok) {
          toast.success(`Relationship updated to "${newRelType.replace(/_/g, ' ')}"`, { duration: 2000 });
        } else {
          toast.error('Failed to update relationship on server', { duration: 3000 });
        }
      }).catch(() => {
        toast.error('Failed to update edge connection', { duration: 3000 });
      });
    } else {
      toast.success(`Relationship updated locally to "${newRelType.replace(/_/g, ' ')}"`, { duration: 2000 });
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
    
    // Push to undo history before making changes
    pushHistory(nodes, edges);
    
    // Get node info for notification
    const node = nodes.find(n => n.id === nodeId);
    const nodeName = node ? (node.data as CustomNodeData).label : nodeId;
    
    // Check if it's a new node (not yet saved) or existing node
    const isNewNode = pendingChanges.addedNodes?.some((n) => n.id === nodeId);
    
    // Remove node and all connected edges
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    
    if (isNewNode) {
      // Remove from added nodes
      setPendingChanges((prev) => ({
        ...prev,
        addedNodes: (prev.addedNodes || []).filter((n) => n.id !== nodeId),
      }));
      toast.info(`Removed pending node "${nodeName}"`, { duration: 2000 });
    } else {
      // Add to deleted nodes - will be deleted on save
      setPendingChanges((prev) => ({
        ...prev,
        deletedNodeIds: [...prev.deletedNodeIds, nodeId],
      }));
      toast.info(`Marked "${nodeName}" for deletion (click Save to confirm)`, { duration: 2000 });
    }
    
    setSelectedNode(null);
  }, [editMode, setNodes, setEdges, nodes, edges, pushHistory, pendingChanges.addedNodes]);

  // Keyboard shortcuts integration - must be after handler definitions
  useKeyboardShortcuts({
    enabled: viewMode === 'graph',
    editMode,
    selectedNode,
    nodes,
    onSelectNode: (node) => {
      setSelectedNode(node);
      if (node) {
        pushNavigation(node.id);
      }
    },
    onDeleteSelectedNode: () => {
      if (selectedNode) {
        handleDeleteNode(selectedNode.id);
      }
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
    onCenterOnNode: () => {
      if (selectedNode) {
        setCenter(selectedNode.position.x + 90, selectedNode.position.y + 30, { zoom: 1.2, duration: 500 });
      }
    },
    onUndo: handleUndo,
    onRedo: handleRedo,
    onToggleFilters: () => setShowFilters(prev => !prev),
    onEscape: () => {
      setSelectedNode(null);
      setContextMenu({ isOpen: false, x: 0, y: 0, nodeId: null });
      setShowFilters(false);
      setShowDateFilter(false);
      setShowLayoutSettings(false);
    },
    canUndo,
    canRedo,
  });

  // Save changes to backend
  const handleSaveChanges = useCallback(async () => {
    if (!hasUnsavedChanges) return;
    
    setIsSaving(true);
    
    const baseUrl = endpoint || 'http://localhost:7777';
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    try {
      // Save new nodes first (so edges can reference them)
      for (const node of pendingChanges.addedNodes || []) {
        try {
          const response = await fetch(`${baseUrl}/v1/asset-graph/nodes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: node.name,
              label: node.nodeType,
              properties: {},
            }),
          });
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Failed to create node: ${node.name}`);
          }
        } catch (e) {
          errorCount++;
          errors.push(`Failed to create node: ${node.name}`);
        }
      }
      
      // Save new edges
      for (const edge of pendingChanges.addedEdges) {
        try {
          const labelStr = typeof edge.label === 'string' ? edge.label : '';
          const relationType = (edge.data as { relationType?: string })?.relationType || labelStr.replace(/ /g, '_');
          const response = await fetch(`${baseUrl}/v1/asset-graph/edges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from_id: edge.source,
              to_id: edge.target,
              label: relationType,
              properties: {},
            }),
          });
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Failed to create relationship: ${relationType}`);
          }
        } catch (e) {
          errorCount++;
          errors.push(`Failed to create relationship`);
        }
      }
      
      // Delete edges
      for (const edgeId of pendingChanges.deletedEdgeIds) {
        try {
          const response = await fetch(`${baseUrl}/v1/asset-graph/edges/${edgeId}`, {
            method: 'DELETE',
          });
          if (response.ok || response.status === 404) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Failed to delete relationship: ${edgeId}`);
          }
        } catch (e) {
          errorCount++;
          errors.push(`Failed to delete relationship: ${edgeId}`);
        }
      }
      
      // Delete nodes
      for (const nodeId of pendingChanges.deletedNodeIds) {
        try {
          const response = await fetch(`${baseUrl}/v1/asset-graph/nodes/${nodeId}`, {
            method: 'DELETE',
          });
          if (response.ok || response.status === 404) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Failed to delete node: ${nodeId}`);
          }
        } catch (e) {
          errorCount++;
          errors.push(`Failed to delete node: ${nodeId}`);
        }
      }
      
      // Clear pending changes
      setPendingChanges({
        addedEdges: [],
        deletedEdgeIds: [],
        deletedNodeIds: [],
        addedNodes: [],
      });
      
      // Show result notification
      if (errorCount === 0 && successCount > 0) {
        toast.success(`Successfully saved ${successCount} change${successCount > 1 ? 's' : ''} to database`, { duration: 3000 });
      } else if (errorCount > 0 && successCount > 0) {
        toast.warning(`Saved ${successCount} change(s), but ${errorCount} failed`, { duration: 4000 });
      } else if (errorCount > 0) {
        toast.error(`Failed to save ${errorCount} change(s). Check console for details.`, { duration: 4000 });
        console.error('Save errors:', errors);
      }
      
      // Exit edit mode and refresh
      setEditMode(false);
      onRefresh();
      
    } catch (e) {
      toast.error('Failed to save changes. Please try again.', { duration: 3000 });
      console.error('Save error:', e);
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
    
    toast.success(`Added "${name}" (${nodeType}) - click Save to persist`, { duration: 2500 });
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
    
    toast.success(`Added "${relType.replace(/_/g, ' ')}" relationship - click Save to persist`, { duration: 2500 });
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

  // Handle CVE Analysis for Vulnerability nodes - delegates to useNodeAnalysis hook
  const handleContextRunCVEAnalysis = useCallback(() => {
    if (contextMenuNode) {
      runCVEAnalysis(contextMenuNode);
    }
  }, [contextMenuNode, runCVEAnalysis]);

  // Handle saving node properties
  const handleSaveNodeProperties = useCallback(async (nodeId: string, properties: Record<string, unknown>) => {
    // Get node name for notification
    const node = nodes.find(n => n.id === nodeId);
    const nodeName = node ? (node.data as CustomNodeData).label : nodeId;
    
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
        const response = await fetch(`${baseUrl}/v1/asset-graph/nodes/${nodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties }),
        });
        if (response.ok) {
          toast.success(`Properties saved for "${nodeName}"`, { duration: 2000 });
        } else {
          toast.error('Failed to save node properties to server', { duration: 3000 });
        }
      } catch {
        toast.error('Failed to save node properties to server', { duration: 3000 });
        // Properties are still updated locally even if backend fails
      }
    } else {
      toast.success(`Properties updated locally for "${nodeName}"`, { duration: 2000 });
    }

    // Close the modal
    setShowEditPropertiesModal(false);
    setEditingNode(null);
  }, [nodes, setNodes, endpoint]);

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
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Demo Data Banner - Prominent notification */}
      {isShowingDemoData && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 flex items-center justify-center gap-3 border-b-2 border-amber-400/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full animate-pulse">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">
              DEMO DATA — Sample data for demonstration
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors font-medium"
          >
            Load Real Data
          </button>
        </div>
      )}

      {/* Unified Top Toolbar - Common to both views */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/95 border-b border-neutral-800">
        {/* Left Side - View-specific controls */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-neutral-800 rounded-lg p-0.5 border border-neutral-700">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === 'graph'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
              title="Graph View"
            >
              <Network className="w-3.5 h-3.5" />
              Graph
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
              title="Table View"
            >
              <Table className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-neutral-700" />

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              editMode
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-neutral-800 text-neutral-400 hover:text-white border-neutral-700 hover:border-amber-500/50'
            }`}
            title={editMode ? 'Exit Edit Mode' : 'Enable Edit Mode'}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode ? 'Editing' : 'Edit'}
          </button>

          {/* Edit Mode Actions */}
          {editMode && (
            <>
              {/* Undo/Redo Buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700"
                  title="Undo (⌘Z)"
                >
                  <Undo className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700"
                  title="Redo (⌘⇧Z)"
                >
                  <Redo className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => setShowAddNodeModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-xs font-medium"
                title="Add Node"
              >
                <Plus className="w-3.5 h-3.5" />
                Node
              </button>
              <button
                onClick={() => setShowAddRelationshipModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-xs font-medium"
                title="Add Relationship"
              >
                <Plus className="w-3.5 h-3.5" />
                Relationship
              </button>
              {hasUnsavedChanges && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                    title="Save Changes"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors text-xs font-medium"
                    title="Cancel"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </>
              )}
            </>
          )}

          {/* Separator */}
          <div className="w-px h-6 bg-neutral-700" />

          {/* Date Filter - Common to both views */}
          <div className="flex items-center gap-1 bg-neutral-800/80 border border-neutral-700 rounded-lg p-0.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
            {(['today', '3d', 'week', 'month', 'all'] as const).map((range) => {
              const labels: Record<typeof range, string> = {
                'today': 'Today',
                '3d': '3d',
                'week': '1w',
                'month': '1m',
                'all': 'All',
              };
              return (
                <button
                  key={range}
                  onClick={() => applyTimeRange(range)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activeTimeRange === range
                      ? 'bg-cyan-600 text-white font-medium'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  {labels[range]}
                </button>
              );
            })}
            {/* Custom Date Filter Toggle - uses sliders icon like graph mode */}
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`p-1 rounded transition-colors ${
                showDateFilter ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
              }`}
              title="Custom date range"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>

          {/* Date Filter Badge */}
          {dateFilter.applied && dateFilter.mode !== 'off' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 border border-cyan-500/30 rounded text-xs text-cyan-400">
              <span>
                {dateFilter.mode === 'single' 
                  ? dateFilter.singleDate 
                  : `${dateFilter.startDate} → ${dateFilter.endDate}`}
              </span>
            </div>
          )}
        </div>

        {/* Right Side - Stats and number-based zoom */}
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-600/20 border border-amber-500/30 rounded text-xs text-amber-400">
              <span>+{(pendingChanges.addedNodes?.length || 0) + pendingChanges.addedEdges.length}</span>
              <span>/</span>
              <span>-{pendingChanges.deletedEdgeIds.length + pendingChanges.deletedNodeIds.length}</span>
            </div>
          )}
          <div className="text-xs text-neutral-400">
            <span className="text-white font-medium">{nodes.length}</span> nodes •{' '}
            <span className="text-white font-medium">{edges.length}</span> edges
          </div>
          {/* Number-based zoom - right of node/edges details; disabled in table view */}
          {viewMode === 'graph' && (
            <div className="flex items-center gap-1 pl-2 ml-2 border-l border-neutral-700">
              <button
                type="button"
                onClick={() => {
                  const newZoom = Math.max(0.1, currentZoom - 0.2);
                  setViewport({ ...getViewport(), zoom: newZoom }, { duration: 200 });
                  setCurrentZoom(newZoom);
                  onZoomChange?.(newZoom);
                  persistZoom(newZoom);
                }}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors text-sm"
                title="Zoom Out"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  const ideal = 0.8;
                  setViewport({ ...getViewport(), zoom: ideal }, { duration: 200 });
                  setCurrentZoom(ideal);
                  onZoomChange?.(ideal);
                  persistZoom(ideal);
                }}
                className="text-xs font-mono text-neutral-300 min-w-[44px] text-center hover:text-white transition-colors"
                title="Click to reset zoom to 80%"
              >
                {Math.round(currentZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => {
                  const newZoom = Math.min(3, currentZoom + 0.2);
                  setViewport({ ...getViewport(), zoom: newZoom }, { duration: 200 });
                  setCurrentZoom(newZoom);
                  onZoomChange?.(newZoom);
                  persistZoom(newZoom);
                }}
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors text-sm"
                title="Zoom In"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Date Filter Panel - Common to both views */}
      {showDateFilter && (
        <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900/95">
          <DateFilterPanel
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onClose={() => setShowDateFilter(false)}
            filteredCount={nodes.length}
            totalCount={graphData?.nodes?.length || 0}
          />
        </div>
      )}
      
      {/* Content Area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* Table View */}
        {viewMode === 'table' && (
          <div className="absolute inset-0 overflow-hidden">
            <TableView
              nodes={nodes}
              edges={edges}
              onEditNode={(node) => {
                setEditingNode(node);
                setShowEditPropertiesModal(true);
              }}
              onDeleteNode={handleDeleteNode}
              onEditEdge={handleOpenEditRelationship}
              onDeleteEdge={handleDeleteEdge}
              onNavigateToNode={(nodeId) => {
                setViewMode('graph');
                setTimeout(() => navigateToNode(nodeId), 100);
              }}
              editMode={editMode}
              allNodeTypes={nodeTypesList}
              activeFilters={activeFilters}
              onFilterChange={(newFilters) => {
                // Sync filter changes from Table view back to Graph view
                setActiveFilters(newFilters);
                // Update primary anchor type based on the filter
                if (newFilters.size === 1) {
                  const selectedType = Array.from(newFilters)[0];
                  if (PRIMARY_SEED_TYPES.has(selectedType)) {
                    setPrimaryAnchorType(selectedType);
                  }
                } else if (newFilters.size === 0) {
                  setPrimaryAnchorType(null);
                }
              }}
            />
          </div>
        )}

        {/* Floating Demo Badge on Graph */}
        {isShowingDemoData && viewMode === 'graph' && (
          <div className="absolute bottom-4 left-4 z-20 bg-amber-600/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-amber-400/50 flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-white uppercase tracking-wide">
              Demo Mode
            </span>
          </div>
        )}
      
        {/* Graph View */}
        {viewMode === 'graph' && <ReactFlow
        nodes={nodes}
        edges={edges.map(e => {
          const isSelectedEdge = selectedEdges.has(e.id);
          const isHighlighted = highlightedEdgeIds.has(e.id);
          const hasSelection = selectedNode !== null;
          const isDimmed = hasSelection && !isHighlighted;
          
          // Determine stroke color and styling based on state
          let strokeColor = e.style?.stroke || '#6b7280';
          let strokeWidth = e.style?.strokeWidth || 2;
          let opacity = 1;
          let animated = false;
          
          if (isSelectedEdge) {
            // Selected edge: bright red, thicker
            strokeColor = '#ef4444';
            strokeWidth = 4;
          } else if (isDimmed) {
            // Dimmed edge: very faint, almost invisible
            strokeColor = '#2a2a2a';
            opacity = 0.15;
          } else if (isHighlighted && hasSelection) {
            // Highlighted edge: original color, slightly thicker, animated
            strokeWidth = 3;
            animated = true;
          }
          
          return {
            ...e,
            selected: isSelectedEdge,
            animated: animated,
            style: {
              ...e.style,
              strokeWidth,
              stroke: strokeColor,
              opacity,
              // No strokeDasharray - let animation handle the visual effect
              transition: 'all 0.3s ease',
            },
            // Dim the edge label when edge is dimmed
            labelStyle: {
              ...((e.labelStyle as React.CSSProperties) || {}),
              fill: isDimmed ? '#2a2a2a' : ((e.labelStyle as React.CSSProperties)?.fill || strokeColor),
              opacity: isDimmed ? 0.15 : 1,
              transition: 'all 0.3s ease',
            },
            labelBgStyle: {
              ...((e.labelBgStyle as React.CSSProperties) || {}),
              fill: isDimmed ? '#0a0a0a' : ((e.labelBgStyle as React.CSSProperties)?.fill || '#111827'),
              fillOpacity: isDimmed ? 0.3 : 0.9,
              transition: 'all 0.3s ease',
            },
          };
        })}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        onMoveEnd={(_, viewport) => {
          setCurrentZoom(viewport.zoom);
          onZoomChange?.(viewport.zoom);
          const existing = getStoredLayout();
          saveLayout({
            preferences: {
              showMinimap: existing?.preferences?.showMinimap ?? true,
              showLegend: existing?.preferences?.showLegend ?? false,
              lastZoom: viewport.zoom,
            },
          });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: '#22c55e', strokeWidth: 2, strokeDasharray: '5,5' }}
        fitView
        fitViewOptions={{ 
          padding: 0.1, 
          minZoom: 0.1, 
          maxZoom: 1.2 
        }}
        minZoom={0.05}
        maxZoom={3}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-950"
        nodesDraggable={true}
        nodesConnectable={editMode}
        elementsSelectable={true}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll={true}
        selectionKeyCode={null}
        multiSelectionKeyCode="Meta"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        
        {/* Button-based zoom controls: bottom-right, above minimap when minimap is shown */}
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="bottom-right"
          className={`!bg-neutral-800 !border-neutral-700 !rounded-lg !shadow-xl [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-300 [&>button:hover]:!bg-neutral-700 ${showMinimap ? '!bottom-52' : ''}`}
        />

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
              ref={searchInputRef}
              type="text"
              placeholder="Search nodes... (⌘F)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className={`w-44 pl-8 pr-7 py-1.5 bg-neutral-800 border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none ${
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
          
          {/* Force simulation progress indicator */}
          {isSimulating && (
            <div className="flex items-center gap-2 px-2 py-1 bg-purple-900/40 border border-purple-700/50 rounded-lg text-xs text-purple-300">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Optimizing layout... {simulationProgress}%</span>
              <div className="w-16 h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-200" 
                  style={{ width: `${simulationProgress}%` }}
                />
              </div>
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
              <div className="absolute top-full right-0 mt-2 w-80 bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Layout Settings</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setLayoutSettings({ ...DEFAULT_LAYOUT_SETTINGS });
                      }}
                      className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={cancelLayoutSettings}
                      className="p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Web Worker Toggle */}
                <div className="mb-4 pb-3 border-b border-neutral-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs text-neutral-400 block">Use Web Worker</label>
                      <span className="text-[10px] text-neutral-600">Run simulation off main thread</span>
                    </div>
                    <button
                      onClick={() => updateLayoutSetting('useWebWorker', !layoutSettings.useWebWorker)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        layoutSettings.useWebWorker ? 'bg-green-600' : 'bg-neutral-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        layoutSettings.useWebWorker ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
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

                {/* Force Simulation Section */}
                <div className="mb-4 pt-3 border-t border-neutral-700">
                  <label className="text-xs text-neutral-500 mb-3 block">Force Simulation</label>
                  
                  {/* Min Node Spacing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-neutral-400">Node Spacing</label>
                      <span className="text-xs font-mono text-orange-400">{layoutSettings.minNodeSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="400"
                      step="25"
                      value={layoutSettings.minNodeSpacing}
                      onChange={(e) => updateLayoutSetting('minNodeSpacing', Number(e.target.value))}
                      className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                      <span>Tight</span>
                      <span>Spread</span>
                    </div>
                  </div>

                  {/* Level Spacing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-neutral-400">Level Spacing</label>
                      <span className="text-xs font-mono text-orange-400">{layoutSettings.levelSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="500"
                      step="25"
                      value={layoutSettings.levelSpacing}
                      onChange={(e) => updateLayoutSetting('levelSpacing', Number(e.target.value))}
                      className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                      <span>Dense</span>
                      <span>Airy</span>
                    </div>
                  </div>

                  {/* Force Iterations */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-neutral-400">Iterations</label>
                      <span className="text-xs font-mono text-blue-400">{layoutSettings.forceIterations}</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="200"
                      step="10"
                      value={layoutSettings.forceIterations}
                      onChange={(e) => updateLayoutSetting('forceIterations', Number(e.target.value))}
                      className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                      <span>Fast</span>
                      <span>Precise</span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="pt-3 border-t border-neutral-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-500">Quick Presets</label>
                    <button
                      onClick={saveLayoutSettings}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                        hasUnsavedLayoutChanges
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                      }`}
                      disabled={!hasUnsavedLayoutChanges}
                    >
                      Save
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLayoutSettings({
                        clustersPerRow: 0,
                        clusterSpacing: 60,
                        minNodeSpacing: 150,
                        levelSpacing: 200,
                        forceIterations: 60,
                        useWebWorker: true,
                        gridFallbackThreshold: 250,
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
                        clustersPerRow: 4,
                        clusterSpacing: 180,
                        minNodeSpacing: 350,
                        levelSpacing: 450,
                        forceIterations: 150,
                        useWebWorker: true,
                        gridFallbackThreshold: 250,
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

          {/* Spread Nodes Button - Fix overlapping nodes */}
          <button
            onClick={() => {
              const spreadNodes = spreadAllOverlappingNodes(nodes, 200);
              if (spreadNodes !== nodes) {
                setNodes(spreadNodes as CustomNode[]);
                toast.success('Nodes spread to prevent overlap');
              } else {
                toast.info('No overlapping nodes found');
              }
            }}
            className="p-2 rounded-lg transition-colors bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-green-400 hover:border-green-600/50"
            title="Spread overlapping nodes"
          >
            <Zap className="w-4 h-4" />
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

          {/* Delete Selected Edges - show in graph panel when edges selected */}
          {editMode && selectedEdges.size > 0 && (
            <button
              onClick={handleDeleteSelectedEdges}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              title="Delete Selected Edges"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-medium">Delete ({selectedEdges.size})</span>
            </button>
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

        {/* Hierarchy Legend Panel */}
        {showLegend && (
          <Panel position="bottom-right" className="!bottom-4 !right-4">
            <HierarchyLegend />
          </Panel>
        )}

        {/* Unsaved Changes Indicator - Only when in edit mode with changes */}
        {editMode && hasUnsavedChanges && (
          <Panel position="top-right" className="!top-14 bg-amber-600/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-amber-500/50 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-white font-medium">
              <Edit3 className="w-3 h-3" />
              <span>Unsaved: +{(pendingChanges.addedNodes?.length || 0) + pendingChanges.addedEdges.length} / -{pendingChanges.deletedEdgeIds.length + pendingChanges.deletedNodeIds.length}</span>
            </div>
          </Panel>
        )}
      </ReactFlow>}

      {/* Node Details Panel - Only show in graph mode */}
      {viewMode === 'graph' && (
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
              cveAnalysisInProgress={selectedNode ? cveAnalysisInProgress.has(selectedNode.id) : false}
            />
          )}
        </AnimatePresence>
      )}

      {/* Analysis Panels - Only show in graph mode */}
      {viewMode === 'graph' && (
        <>
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
        </>
      )}

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
          onRunCVEAnalysis={handleContextRunCVEAnalysis}
          editMode={editMode}
          nodeName={(contextMenuNode.data as CustomNodeData).label}
          nodeType={(contextMenuNode.data as CustomNodeData).nodeType}
        />
      )}

      {/* Edit Node Properties Modal */}
      <EditPropertiesModal
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

const HEADER_IDEAL_ZOOM = 0.8;

export function GraphVisualization({ isOpen, onClose, endpoint }: GraphVisualizationProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShowingDemoData, setIsShowingDemoData] = useState(false);
  const [headerZoom, setHeaderZoom] = useState(1);
  const flowRef = useRef<FlowControlRef | null>(null);
  
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
          {/* Compact Header - title, status, zoom control, and actions */}
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

            <div className="flex items-center gap-2">
              {/* Number-based zoom control - right side of nodes & edges count */}
              <div className="flex items-center gap-1 pr-2 border-r border-neutral-700">
                <button
                  type="button"
                  onClick={() => {
                    const vp = flowRef.current?.getViewport();
                    if (vp) {
                      const newZoom = Math.max(0.1, vp.zoom - 0.2);
                      flowRef.current?.setViewport({ ...vp, zoom: newZoom });
                      setHeaderZoom(newZoom);
                      flowRef.current?.persistZoom(newZoom);
                    }
                  }}
                  className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors text-sm"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const vp = flowRef.current?.getViewport();
                    if (vp) {
                      flowRef.current?.setViewport({ ...vp, zoom: HEADER_IDEAL_ZOOM });
                      setHeaderZoom(HEADER_IDEAL_ZOOM);
                      flowRef.current?.persistZoom(HEADER_IDEAL_ZOOM);
                    }
                  }}
                  className="text-xs font-mono text-neutral-300 min-w-[44px] text-center hover:text-white transition-colors"
                  title="Click to reset zoom to 80%"
                >
                  {Math.round(headerZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const vp = flowRef.current?.getViewport();
                    if (vp) {
                      const newZoom = Math.min(3, vp.zoom + 0.2);
                      flowRef.current?.setViewport({ ...vp, zoom: newZoom });
                      setHeaderZoom(newZoom);
                      flowRef.current?.persistZoom(newZoom);
                    }
                  }}
                  className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors text-sm"
                  title="Zoom In"
                >
                  +
                </button>
              </div>
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
              flowRef={flowRef}
              onZoomChange={setHeaderZoom}
            />
          </ReactFlowProvider>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GraphVisualization;
