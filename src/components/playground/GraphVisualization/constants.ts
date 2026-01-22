/**
 * Shared constants for GraphVisualization components
 */

import { NODE_COLORS, EDGE_COLORS } from './types';

// =============================================================================
// HIERARCHY LEVELS
// =============================================================================

// Hierarchy levels for the consolidated 9-node schema
export const HIERARCHY_LEVELS = [
  { rank: 0, label: 'Categories', types: ['AssetCategory'], description: 'Asset categories & groups' },
  { rank: 1, label: 'Assets', types: ['Asset', 'Service', 'Identity'], description: 'Assets, services, identities (Identity embeds credentials)' },
  { rank: 2, label: 'Vulnerabilities', types: ['Vulnerability', 'Control'], description: 'Weaknesses & security controls' },
  { rank: 3, label: 'Threats', types: ['Threat', 'Indicator'], description: 'Threats (embeds actor/campaign/tools) & IOCs' },
  { rank: 4, label: 'Attacks', types: ['Attack', 'LogEvent'], description: 'MITRE ATT&CK (embeds technique+tactic) & logs' },
];

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

// Relationship types for consolidated schema
export const RELATIONSHIP_TYPES = [
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

// =============================================================================
// NODE TYPES
// =============================================================================

// Consolidated 9 node types + LogEvent
export const NODE_TYPES = [
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
// HANDLE POSITIONS
// =============================================================================

export const HANDLE_POSITIONS = [
  { value: 'top', label: 'Top', icon: '↑' },
  { value: 'bottom', label: 'Bottom', icon: '↓' },
  { value: 'left', label: 'Left', icon: '←' },
  { value: 'right', label: 'Right', icon: '→' },
];
