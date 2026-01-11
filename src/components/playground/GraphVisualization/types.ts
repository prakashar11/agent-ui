/**
 * Types for Asset Graph Visualization
 * 
 * Supports visualization of assets, vulnerabilities, threats, attacks, and identities
 * with interactive navigation through graph relationships.
 * 
 * Consolidated Node Types (9):
 * - Asset, AssetCategory, Vulnerability, Control, Service
 * - Identity (embeds credentials), Threat (embeds actor/campaign/tools)
 * - Attack (MITRE ATT&CK technique+tactic), Indicator, LogEvent
 */

export interface GraphNode {
  id: string;
  name: string;
  label: string; // Node type: Asset, Vulnerability, Threat, Attack, Identity, etc.
  properties: Record<string, unknown>;
  created_at?: string; // ISO timestamp when node was created (nodes only have created_at, not updated_at)
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

// Node type to color mapping (9 consolidated node types)
export const NODE_COLORS: Record<string, string> = {
  // Core entities
  Asset: '#3b82f6',           // Blue - infrastructure, applications, endpoints
  AssetCategory: '#8b5cf6',   // Purple - logical groupings
  Vulnerability: '#f97316',   // Orange - CVEs and security weaknesses
  Control: '#22c55e',         // Green - security controls / hygiene essentials
  Service: '#06b6d4',         // Cyan - network services and APIs
  
  // Identity (embeds: credential types, privileges, MFA status)
  Identity: '#14b8a6',        // Teal - user/service identities
  
  // Threat (embeds: actor, campaign, tools, malware)
  Threat: '#ef4444',          // Red - consolidated threat entity
  
  // Attack (MITRE ATT&CK technique + tactic combined)
  Attack: '#eab308',          // Yellow - consolidated MITRE ATT&CK
  
  // Detection/Correlation
  Indicator: '#f59e0b',       // Amber - IOCs (IP, domain, hash, URL)
  LogEvent: '#64748b',        // Slate - security logs for detection
  
  default: '#6b7280',         // Gray
};

// Node type to size mapping
export const NODE_SIZES: Record<string, number> = {
  AssetCategory: 15,    // Largest - top-level grouping
  Asset: 12,            // Large - primary entities
  Threat: 12,           // Large - consolidated threat
  Attack: 10,           // Medium - MITRE ATT&CK
  Identity: 10,         // Medium
  Vulnerability: 8,     // Small
  Control: 8,           // Small
  Indicator: 8,         // Small
  LogEvent: 8,          // Small
  Service: 8,           // Small
  default: 8,
};

// Edge type to color mapping (consolidated relationships)
export const EDGE_COLORS: Record<string, string> = {
  // Category relationships
  BELONGS_TO_CATEGORY: '#8b5cf6', // Purple - assets belong to categories
  APPLIES_TO_CATEGORY: '#a78bfa', // Light Purple - threat/vuln/control apply to categories
  
  // Asset relationships
  CONNECTED_TO: '#06b6d4',        // Cyan - network connections
  DEPENDS_ON: '#14b8a6',          // Teal - dependencies
  HOSTS: '#0891b2',               // Dark Cyan - asset hosts service/app
  HAS_SERVICE: '#22d3ee',         // Light Cyan - asset has service
  
  // Identity relationships
  HAS_IDENTITY: '#14b8a6',        // Teal - asset has identity
  
  // Control relationships
  HAS_CONTROL: '#22c55e',         // Green - asset has control
  IMPLEMENTS_CONTROL: '#16a34a',  // Dark Green - asset implements control
  MITIGATED_BY: '#4ade80',        // Light Green - vuln mitigated by control
  
  // Vulnerability relationships
  VULNERABLE_TO: '#f97316',       // Orange - asset vulnerable to CVE
  HAS_VULNERABILITY: '#fb923c',   // Light Orange
  
  // Threat relationships
  HAS_THREAT: '#ef4444',          // Red - asset has threat
  EXPLOITS: '#dc2626',            // Dark Red - threat exploits vulnerability
  TARGETS: '#f87171',             // Light Red - threat targets asset/category
  
  // Attack relationships (MITRE ATT&CK)
  USES_ATTACK: '#eab308',         // Yellow - threat uses attack technique
  ATTACK_TARGETS: '#fbbf24',      // Light Yellow - attack targets category
  RELATED_ATTACK: '#facc15',      // Pale Yellow - attack relates to attack (kill chain)
  
  // Detection/Correlation relationships
  HAS_INDICATOR: '#f59e0b',       // Amber - attack/threat has IOC
  DETECTED_BY_LOG: '#64748b',     // Slate - attack detected by log event
  DETECTED_BY: '#94a3b8',         // Light Slate - detection relationship
  
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

// =============================================================================
// METAPATH WALKER TYPES (Exploitability & Remediation)
// =============================================================================

export interface ExploitabilityScore {
  asset_id: string;
  asset_name: string;
  overall_score: number; // 0-100
  component_scores: {
    threat_exposure: number;
    vulnerability_severity: number;
    attack_surface: number;
    lateral_movement_risk: number;
    control_coverage: number;
  };
  top_threats: string[];
  critical_vulnerabilities: string[];
  exposed_services: string[];
  missing_controls: string[];
  kill_chain_coverage: Record<string, boolean>;
}

export interface RemediationRecommendation {
  priority_rank: number;
  priority_score: number; // 0-100
  remediation_type: 'patch' | 'control' | 'configuration' | 'architecture';
  target: {
    id: string;
    name: string;
    type: 'asset' | 'vulnerability' | 'control';
  };
  action: string;
  rationale: string;
  impact: {
    affected_assets: string[];
    mitigated_threats: string[];
    mitigated_vulnerabilities: string[];
  };
  effort_level: 'low' | 'medium' | 'high';
}

export interface AttackPathStep {
  step: number;
  type: 'threat' | 'attack' | 'category' | 'asset';
  node_id: string;
  name?: string;
  action: string;
}

export interface AttackPath {
  path: AttackPathStep[];
}

export interface MetaPathInfo {
  name: string;
  description: string;
  length: number;
  node_types: string[];
  edge_types: string[];
  weight: number;
}

export interface MetaPathStats {
  metapaths: Record<string, MetaPathInfo>;
  graph_stats: GraphStats;
  capabilities: {
    exploitability_analysis: boolean;
    remediation_prioritization: boolean;
    attack_path_discovery: boolean;
    kill_chain_analysis: boolean;
    defense_gap_analysis: boolean;
    embeddings_available: boolean;
  };
}
