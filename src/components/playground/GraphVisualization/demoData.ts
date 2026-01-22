/**
 * Demo/Sample data for the graph visualization
 * Shown when backend has no data or for testing
 */

import type { GraphData } from './types';

// Demo graph data with realistic security-related nodes
export const DEMO_GRAPH_DATA: GraphData = {
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
    { id: 'threat-1', name: 'APT-29', label: 'Threat', properties: { threat_type: 'apt', ttps: ['T1566', 'T1078'], target_sectors: ['government', 'technology'] }, created_at: new Date().toISOString() },
    // Indicator - created today
    { id: 'ioc-1', name: '185.141.63.0/24', label: 'Indicator', properties: { indicator_type: 'ip_range', confidence: 'high', first_seen: '2024-01-15' }, created_at: new Date().toISOString() },
    // Attack - created today
    { id: 'attack-1', name: 'Spearphishing Attachment', label: 'Attack', properties: { attack_type: 'initial_access', mitre_id: 'T1566.001', tactic: 'Initial Access' }, created_at: new Date().toISOString() },
  ],
  edges: [
    // Category relationships
    { id: 'e1', source: 'asset-web1', target: 'cat-web', label: 'BELONGS_TO_CATEGORY' },
    { id: 'e2', source: 'asset-db1', target: 'cat-db', label: 'BELONGS_TO_CATEGORY' },
    // Asset connections
    { id: 'e3', source: 'asset-web1', target: 'asset-db1', label: 'CONNECTED_TO' },
    // Identity relationships
    { id: 'e4', source: 'id-admin', target: 'asset-web1', label: 'HAS_IDENTITY' },
    { id: 'e5', source: 'id-svc', target: 'asset-db1', label: 'HAS_IDENTITY' },
    // Vulnerability
    { id: 'e6', source: 'asset-web1', target: 'vuln-1', label: 'VULNERABLE_TO' },
    // Controls
    { id: 'e7', source: 'asset-web1', target: 'ctrl-1', label: 'HAS_CONTROL' },
    { id: 'e8', source: 'asset-db1', target: 'ctrl-2', label: 'HAS_CONTROL' },
    { id: 'e9', source: 'vuln-1', target: 'ctrl-1', label: 'MITIGATED_BY' },
    // Threat relationships
    { id: 'e10', source: 'threat-1', target: 'vuln-1', label: 'EXPLOITS' },
    { id: 'e11', source: 'threat-1', target: 'ioc-1', label: 'HAS_INDICATOR' },
    // Attack relationships
    { id: 'e12', source: 'threat-1', target: 'attack-1', label: 'USES_ATTACK' },
    { id: 'e13', source: 'attack-1', target: 'asset-web1', label: 'ATTACK_TARGETS' },
  ],
};

export default DEMO_GRAPH_DATA;
