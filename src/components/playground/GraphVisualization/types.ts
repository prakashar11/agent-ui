/**
 * Types for Asset Graph Visualization
 * 
 * Supports visualization of assets, vulnerabilities, threats, and MITRE techniques
 * with interactive navigation through graph relationships.
 */

export interface GraphNode {
  id: string;
  name: string;
  label: string; // Node type: Asset, Vulnerability, Threat, Technique, etc.
  properties: Record<string, unknown>;
  // Visual properties
  color?: string;
  size?: number;
  // Force graph properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string; // Relationship type: VULNERABLE_TO, HAS_THREAT, etc.
  properties: Record<string, unknown>;
  // Visual properties
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphStats {
  node_count: number;
  edge_count: number;
  nodes_by_label: Record<string, number>;
  edges_by_label: Record<string, number>;
  db_path?: string;
}

// Node type to color mapping
export const NODE_COLORS: Record<string, string> = {
  Asset: '#3b82f6',           // Blue
  AssetCategory: '#8b5cf6',   // Purple
  Threat: '#ef4444',          // Red
  ThreatActor: '#dc2626',     // Dark Red
  Vulnerability: '#f97316',   // Orange
  Technique: '#eab308',       // Yellow
  Tactic: '#84cc16',          // Lime
  Service: '#06b6d4',         // Cyan
  Identity: '#14b8a6',        // Teal
  Credential: '#64748b',      // Slate
  Control: '#22c55e',         // Green
  Indicator: '#a855f7',       // Violet
  Malware: '#be123c',         // Rose
  Tool: '#0ea5e9',            // Sky
  default: '#6b7280',         // Gray
};

// Node type to size mapping
export const NODE_SIZES: Record<string, number> = {
  Asset: 12,
  AssetCategory: 15,
  Threat: 10,
  ThreatActor: 12,
  Vulnerability: 8,
  Technique: 8,
  Tactic: 10,
  default: 8,
};

// Edge type to color mapping
export const EDGE_COLORS: Record<string, string> = {
  // Asset relationships
  BELONGS_TO_CATEGORY: '#8b5cf6', // Purple - assets belong to categories
  APPLIES_TO_CATEGORY: '#a78bfa', // Light Purple - things apply to categories
  CONNECTED_TO: '#06b6d4',        // Cyan - network connections
  DEPENDS_ON: '#14b8a6',          // Teal - dependencies
  PROTECTS: '#22c55e',            // Green - security controls
  
  // Vulnerability relationships
  VULNERABLE_TO: '#f97316',       // Orange - vulnerabilities
  HAS_VULNERABILITY: '#fb923c',   // Light Orange
  
  // Threat relationships
  HAS_THREAT: '#ef4444',          // Red - threats
  EXPLOITS: '#dc2626',            // Dark Red - exploitation
  TARGETS: '#f87171',             // Light Red - targeting
  
  // MITRE relationships
  USES_TECHNIQUE: '#eab308',      // Yellow - technique usage
  TACTIC_INCLUDES: '#facc15',     // Light Yellow - tactic includes technique
  USES_TOOL: '#0ea5e9',           // Sky - tool usage
  USES_MALWARE: '#be123c',        // Rose - malware usage
  
  default: '#6b7280',             // Gray
};

export interface SelectedNode {
  node: GraphNode;
  neighbors: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphVisualizationProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint?: string;
}

