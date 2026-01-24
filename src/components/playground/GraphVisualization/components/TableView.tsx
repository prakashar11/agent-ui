/**
 * Table View Component - Displays nodes and relationships in a table format
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Copy, Check, Filter } from 'lucide-react';
import type { Edge } from '@xyflow/react';
import { NODE_COLORS, EDGE_COLORS, type CustomNode, type CustomNodeData } from '../types';
import { PRIMARY_SEED_TYPES, NODE_TYPE_HIERARCHY } from '../hierarchyUtils';
import { FilterPanel } from '../panels/FilterPanel';

type TableViewTab = 'nodes' | 'relationships';

export interface TableViewProps {
  nodes: CustomNode[];
  edges: Edge[];
  onEditNode: (node: CustomNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onEditEdge: (edge: Edge) => void;
  onDeleteEdge: (edgeId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
  editMode: boolean;
  allNodeTypes: string[]; // All available node types for filtering
  activeFilters: Set<string>; // Active type filters from graph view
  onFilterChange?: (filters: Set<string>) => void; // Callback to sync filter changes back to graph
}

export function TableView({
  nodes,
  edges,
  onEditNode,
  onDeleteNode,
  onEditEdge,
  onDeleteEdge,
  onNavigateToNode,
  editMode,
  allNodeTypes,
  activeFilters,
  onFilterChange,
}: TableViewProps) {
  const [activeTab, setActiveTab] = useState<TableViewTab>('nodes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  
  // Derive nodeTypeFilter from activeFilters (graph view filter)
  // If exactly one filter is active, use that type; otherwise 'all'
  const nodeTypeFilter = useMemo(() => {
    if (activeFilters.size === 0) return 'all';
    if (activeFilters.size === 1) {
      return Array.from(activeFilters)[0];
    }
    // Multiple filters active - show 'all' but data is already filtered
    return 'all';
  }, [activeFilters]);
  
  // Handle node type filter change
  const handleNodeTypeFilterChange = (newFilter: string) => {
    if (onFilterChange) {
      if (newFilter === 'all') {
        // Clear all filters
        onFilterChange(new Set());
      } else {
        // Set single filter
        onFilterChange(new Set([newFilter]));
      }
    }
  };

  // Handle type filter toggle (simple toggle, no modifier keys needed)
  const handleTypeToggle = (type: string) => {
    if (!onFilterChange) return;

    const newFilters = new Set(activeFilters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    onFilterChange(newFilters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    if (onFilterChange) {
      onFilterChange(new Set());
    }
  };

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
        setShowFilterPanel(false);
      }
    };

    if (showFilterPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFilterPanel]);

  // Calculate stats for each node type
  const nodeTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    nodes.forEach(node => {
      const nodeData = node.data as CustomNodeData;
      const type = nodeData.nodeType;
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }, [nodes]);

  // Use all available node types from parent (aligns with graph mode filter)
  // Sort by hierarchy with primary seed types first
  const nodeTypes = useMemo(() => {
    return [...allNodeTypes].sort((a, b) => {
      // Primary seed types first
      const aIsSeed = PRIMARY_SEED_TYPES.has(a);
      const bIsSeed = PRIMARY_SEED_TYPES.has(b);
      if (aIsSeed && !bIsSeed) return -1;
      if (!aIsSeed && bIsSeed) return 1;
      // Then by hierarchy
      const rankA = NODE_TYPE_HIERARCHY[a] ?? 99;
      const rankB = NODE_TYPE_HIERARCHY[b] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      // Finally alphabetical
      return a.localeCompare(b);
    });
  }, [allNodeTypes]);

  // Get unique relationship types for filter dropdown
  const relationshipTypes = useMemo(() => {
    const types = new Set<string>();
    edges.forEach(edge => {
      if (edge.label) types.add(String(edge.label));
    });
    return Array.from(types).sort();
  }, [edges]);

  // Build node lookup map for edges
  const nodeMap = useMemo(() => {
    const map = new Map<string, CustomNodeData>();
    nodes.forEach(node => {
      map.set(node.id, node.data as CustomNodeData);
    });
    return map;
  }, [nodes]);

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    let result = [...nodes];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(node => {
        const nodeData = node.data as CustomNodeData;
        return (
          nodeData.label.toLowerCase().includes(query) ||
          nodeData.nodeType.toLowerCase().includes(query) ||
          JSON.stringify(nodeData.properties).toLowerCase().includes(query)
        );
      });
    }
    
    // Apply type filter - support multiple selected types
    if (activeFilters.size > 0) {
      result = result.filter(node => {
        const nodeData = node.data as CustomNodeData;
        return activeFilters.has(nodeData.nodeType);
      });
    }
    
    // Sort
    result.sort((a, b) => {
      const aData = a.data as CustomNodeData;
      const bData = b.data as CustomNodeData;
      
      let aValue: string;
      let bValue: string;
      
      switch (sortField) {
        case 'name':
          aValue = aData.label;
          bValue = bData.label;
          break;
        case 'type':
          aValue = aData.nodeType;
          bValue = bData.nodeType;
          break;
        default:
          aValue = aData.label;
          bValue = bData.label;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [nodes, searchQuery, activeFilters, sortField, sortDirection]);

  // Filter and sort edges
  const filteredEdges = useMemo(() => {
    let result = [...edges];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(edge => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        return (
          (sourceNode?.label || '').toLowerCase().includes(query) ||
          (targetNode?.label || '').toLowerCase().includes(query) ||
          String(edge.label || '').toLowerCase().includes(query)
        );
      });
    }
    
    // Apply type filter
    if (relationshipTypeFilter !== 'all') {
      result = result.filter(edge => {
        return String(edge.label || '').replace(/ /g, '_').toUpperCase() === relationshipTypeFilter.replace(/ /g, '_').toUpperCase();
      });
    }
    
    // Sort by relationship type
    result.sort((a, b) => {
      const aLabel = String(a.label || '');
      const bLabel = String(b.label || '');
      const comparison = aLabel.localeCompare(bLabel);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [edges, searchQuery, relationshipTypeFilter, nodeMap, sortDirection]);

  // Pagination
  const totalItems = activeTab === 'nodes' ? filteredNodes.length : filteredEdges.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const paginatedNodes = filteredNodes.slice(startIndex, endIndex);
  const paginatedEdges = filteredEdges.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilters, relationshipTypeFilter, activeTab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatProperties = (props: Record<string, unknown>): string => {
    if (!props || Object.keys(props).length === 0) return '—';
    const entries = Object.entries(props).slice(0, 3);
    const formatted = entries.map(([key, value]) => {
      const valStr = Array.isArray(value) ? `[${value.length}]` : String(value).substring(0, 20);
      return `${key}: ${valStr}`;
    }).join(', ');
    if (Object.keys(props).length > 3) {
      return formatted + ` +${Object.keys(props).length - 3} more`;
    }
    return formatted;
  };

  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopyUrl = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 p-3 border-b border-neutral-800 bg-neutral-900/50 relative">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Nodes ({nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('relationships')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === 'relationships'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Relationships ({edges.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder={activeTab === 'nodes' ? 'Search nodes...' : 'Search relationships...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-neutral-700 text-neutral-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter - Button and summary chip like graph view */}
        {activeTab === 'nodes' ? (
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-2 rounded-lg transition-colors ${
                showFilterPanel || activeFilters.size > 0
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
              }`}
              title="Filter by Type"
            >
              <Filter className="w-4 h-4" />
            </button>
            {activeFilters.size > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-neutral-800 rounded-lg text-xs text-neutral-300">
                <span>{activeFilters.size} {activeFilters.size === 1 ? 'type' : 'types'}</span>
                <button
                  onClick={handleClearFilters}
                  className="p-0.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                  title="Clear filters"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {showFilterPanel && (
              <div className="absolute top-full right-0 mt-2 z-50" ref={filterPanelRef}>
                <FilterPanel
                  nodeTypes={nodeTypes}
                  activeFilters={activeFilters}
                  onToggleFilter={handleTypeToggle}
                  stats={nodeTypeStats}
                  onClose={() => setShowFilterPanel(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <select
            value={relationshipTypeFilter}
            onChange={(e) => setRelationshipTypeFilter(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {relationshipTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        )}

        {/* Showing count */}
        <div className="text-xs text-neutral-500 ml-auto">
          {totalItems} {activeTab === 'nodes' ? 'nodes' : 'relationships'}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'nodes' ? (
          <table className="w-full">
            <thead className="bg-neutral-900/80 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortField === 'name' && (
                      <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-1">
                    Type
                    {sortField === 'type' && (
                      <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Properties
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Connections
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {paginatedNodes.map((node) => {
                const nodeData = node.data as CustomNodeData;
                const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;
                const connectionCount = edges.filter(e => e.source === node.id || e.target === node.id).length;
                
                // Get source for Threat nodes
                const isThreatNode = nodeData.nodeType === 'Threat' || nodeData.nodeType === 'ThreatActor' || nodeData.nodeType === 'AttackPattern';
                const sourceValue = nodeData.properties?.source || nodeData.properties?.origin || nodeData.properties?.feed_source || nodeData.properties?.intel_source;
                const sourceUrl = isThreatNode && sourceValue ? String(sourceValue) : null;
                const isHovered = hoveredRowId === node.id;
                const isCopied = copiedUrl === sourceUrl;

                return (
                  <tr
                    key={node.id}
                    className="hover:bg-neutral-800/50 transition-colors group relative"
                    onMouseEnter={() => setHoveredRowId(node.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            onClick={() => onNavigateToNode(node.id)}
                            className="flex items-center gap-2 text-left hover:text-blue-400 transition-colors"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm text-white font-medium">
                              {nodeData.label}
                            </span>
                          </button>
                          {/* Hover tooltip with copyable URL - positioned beside row text */}
                          {isHovered && sourceUrl && (
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 min-w-[300px] max-w-[500px]">
                              <div className="flex items-center gap-2">
                                <a
                                  href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 break-all flex-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {sourceUrl}
                                </a>
                                <button
                                  onClick={(e) => handleCopyUrl(sourceUrl, e)}
                                  className="flex-shrink-0 p-1 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                                  title="Copy URL"
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {nodeData.nodeType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-neutral-400 font-mono">
                        {formatProperties(nodeData.properties)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-neutral-300">{connectionCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onNavigateToNode(node.id)}
                          className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-blue-400 transition-colors"
                          title="View in Graph"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditNode(node)}
                          className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-green-400 transition-colors"
                          title="Edit Properties"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {editMode && (
                          <button
                            onClick={() => onDeleteNode(node.id)}
                            className="p-1.5 rounded hover:bg-red-600/20 text-neutral-400 hover:text-red-400 transition-colors"
                            title="Delete Node"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedNodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                    {searchQuery || activeFilters.size > 0
                      ? 'No nodes match your filters'
                      : 'No nodes available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-900/80 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('type')}>
                  <div className="flex items-center gap-1">
                    Relationship
                    {sortField === 'type' && (
                      <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {paginatedEdges.map((edge) => {
                const sourceNode = nodeMap.get(edge.source);
                const targetNode = nodeMap.get(edge.target);
                const edgeColor = EDGE_COLORS[String(edge.label || '').replace(/ /g, '_')] || EDGE_COLORS.default;
                const sourceColor = NODE_COLORS[sourceNode?.nodeType || ''] || NODE_COLORS.default;
                const targetColor = NODE_COLORS[targetNode?.nodeType || ''] || NODE_COLORS.default;

                return (
                  <tr
                    key={edge.id}
                    className="hover:bg-neutral-800/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onNavigateToNode(edge.source)}
                        className="flex items-center gap-2 text-left hover:text-blue-400 transition-colors"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sourceColor }}
                        />
                        <div>
                          <span className="text-sm text-white font-medium block">
                            {sourceNode?.label || edge.source}
                          </span>
                          <span className="text-[10px] text-neutral-500 uppercase">
                            {sourceNode?.nodeType}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-neutral-500">
                          <div className="w-8 h-0.5 rounded" style={{ backgroundColor: edgeColor }} />
                          <span className="text-lg">→</span>
                        </div>
                        <span
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: `${edgeColor}20`, color: edgeColor }}
                        >
                          {edge.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onNavigateToNode(edge.target)}
                        className="flex items-center gap-2 text-left hover:text-blue-400 transition-colors"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: targetColor }}
                        />
                        <div>
                          <span className="text-sm text-white font-medium block">
                            {targetNode?.label || edge.target}
                          </span>
                          <span className="text-[10px] text-neutral-500 uppercase">
                            {targetNode?.nodeType}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditEdge(edge)}
                          className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-green-400 transition-colors"
                          title="Edit Relationship"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {editMode && (
                          <button
                            onClick={() => onDeleteEdge(edge.id)}
                            className="p-1.5 rounded hover:bg-red-600/20 text-neutral-400 hover:text-red-400 transition-colors"
                            title="Delete Relationship"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedEdges.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-neutral-500">
                    {searchQuery || relationshipTypeFilter !== 'all'
                      ? 'No relationships match your filters'
                      : 'No relationships available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-neutral-800 bg-neutral-900/50">
          <div className="text-sm text-neutral-400">
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableView;
