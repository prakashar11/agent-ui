/**
 * Hierarchy utilities for graph visualization
 * Defines node type hierarchy, rankings, and seed types
 */

// =============================================================================
// HIERARCHY CONFIGURATION
// =============================================================================

// Define the logical hierarchy for node types (lower number = higher in graph)
// Consolidated to 9 node types to avoid schema bloat
export const NODE_TYPE_HIERARCHY: Record<string, number> = {
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

// Get the hierarchy rank for a node type (lower = higher in graph)
export const getNodeRank = (nodeType: string): number => {
  return NODE_TYPE_HIERARCHY[nodeType] ?? 6; // Default to bottom for unknown types
};

// Seed node types that anchor the layout
// These are the primary node types around which other nodes are positioned
export const SEED_NODE_TYPES = new Set(['Threat', 'Vulnerability', 'Asset']);

// Primary seed node types for filtering UI
// These enable use cases like threat hunting, vulnerability management, or asset hygiene verification
export const PRIMARY_SEED_TYPES = new Set(['Threat', 'Vulnerability', 'Asset']);

// Hierarchy level descriptions for UI display
export const HIERARCHY_LEVELS = [
  { rank: 0, label: 'Categories', types: ['AssetCategory'], description: 'Asset categories & groups' },
  { rank: 1, label: 'Assets', types: ['Asset', 'Service', 'Identity'], description: 'Assets, services, identities (Identity embeds credentials)' },
  { rank: 2, label: 'Vulnerabilities', types: ['Vulnerability', 'Control'], description: 'Weaknesses & security controls' },
  { rank: 3, label: 'Threats', types: ['Threat', 'Indicator'], description: 'Threats (embeds actor/campaign/tools) & IOCs' },
  { rank: 4, label: 'Attacks', types: ['Attack', 'LogEvent'], description: 'MITRE ATT&CK (embeds technique+tactic) & logs' },
];

// Check if a node type is a seed type
export const isSeedType = (nodeType: string): boolean => {
  return SEED_NODE_TYPES.has(nodeType);
};

// Check if a node type is a primary seed type (for filtering)
export const isPrimarySeedType = (nodeType: string): boolean => {
  return PRIMARY_SEED_TYPES.has(nodeType);
};
