/**
 * Node Details Panel - Shows details of a selected node
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Copy, Pencil, Plus, Loader2, ScanSearch } from 'lucide-react';
import { toast } from 'sonner';
import type { Edge } from '@xyflow/react';
import { NODE_COLORS, type CustomNode, type CustomNodeData } from '../types';

// Helper to render property values with URL detection
const isUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const renderPropertyValue = (key: string, value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return '—';
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v, i) => (
      <span key={i}>
        {renderPropertyValue(key, v)}
        {i < value.length - 1 && ', '}
      </span>
    ));
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  const strValue = String(value);
  
  // Render URLs as clickable links
  if (isUrl(strValue)) {
    return (
      <a
        href={strValue}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {strValue.length > 60 ? `${strValue.substring(0, 60)}...` : strValue}
      </a>
    );
  }
  
  return strValue;
};

export interface NodeDetailsPanelProps {
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
  // CVE Analysis status for Vulnerability nodes
  cveAnalysisInProgress?: boolean;
}

export function NodeDetailsPanel({ 
  node, 
  edges, 
  nodes, 
  onNavigate, 
  onClose, 
  editMode, 
  onDeleteNode, 
  onAddRelationship, 
  onEditProperties, 
  onDeleteEdge, 
  onEditEdge,
  cveAnalysisInProgress,
}: NodeDetailsPanelProps) {
  if (!node) return null;

  const nodeData = node.data as unknown as CustomNodeData;
  const color = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.default;
  const hasProperties = nodeData.properties && Object.keys(nodeData.properties).length > 0;
  const isVulnerability = nodeData.nodeType === 'Vulnerability';

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

        {/* CVE Analysis Status - only for Vulnerability nodes */}
        {isVulnerability && cveAnalysisInProgress && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <div className="flex-1">
              <span className="text-sm text-amber-400 font-medium">CVE Analysis in Progress</span>
              <p className="text-xs text-amber-400/70">Enriching vulnerability data...</p>
            </div>
            <ScanSearch className="w-4 h-4 text-amber-400/50" />
          </div>
        )}

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

export default NodeDetailsPanel;
