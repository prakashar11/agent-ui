/**
 * Types for the Asset Memory Spreadsheet component
 */

/**
 * CIA Triad Impact levels (aligned with FIPS 199 / NIST SP 800-60)
 */
export type CIAImpact = 'low' | 'medium' | 'high' | 'unknown';

/**
 * A single dimension of the CIA Triad (Confidentiality, Integrity, or Availability)
 */
export interface CIADimension {
  impact: CIAImpact;
  justification?: string;
}

/**
 * CIA Triad Profile for an asset.
 * 
 * The CIA Triad describes three core security objectives:
 * - Confidentiality: Preventing unauthorized disclosure of information
 * - Integrity: Preventing unauthorized modification of information
 * - Availability: Ensuring authorized access to information when needed
 */
export interface CIAProfile {
  confidentiality: CIADimension;
  integrity: CIADimension;
  availability: CIADimension;
}

/**
 * Default CIA profile with unknown impacts
 */
export const DEFAULT_CIA_PROFILE: CIAProfile = {
  confidentiality: { impact: 'unknown' },
  integrity: { impact: 'unknown' },
  availability: { impact: 'unknown' },
};

/**
 * CIA Impact level options for dropdowns
 */
export const CIA_IMPACT_OPTIONS: { value: CIAImpact; label: string; color: string }[] = [
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  { value: 'low', label: 'Low', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'high', label: 'High', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

export interface Asset {
  asset_id: string;
  asset_name: string;
  asset_category: string;
  criticality: string;
  description: string;
  business_unit: string;
  owner: string;
  publicly_accessible: boolean;
  data_handled: string;
  compliance_scope: string;
  technologies: string[];
  risk_score: number;
  tags: string[];
  cia_profile?: CIAProfile;
  created_at?: number;
  updated_at?: number;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  session_id: string;
}

export interface AssetStatsResponse {
  memory_stats: {
    total_entries: number;
    valid_entries: number;
    expired_entries: number;
    total_items_cached: number;
    average_ttl_hours: number;
    average_time_remaining_hours: number;
    database_file: string;
  };
  asset_stats: {
    total_assets: number;
    type_distribution: Record<string, number>;
    criticality_distribution: Record<string, number>;
    environment_distribution: Record<string, number>;
    cached_at?: number;
    expires_at?: number;
  };
  session_id: string;
}

export interface CriticalityOption {
  value: string;
  label: string;
  color: string;
}

export interface AssetMemorySpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: keyof Asset | null;
  direction: SortDirection;
}

// Column definition for the spreadsheet
export interface ColumnDef {
  key: keyof Asset;
  label: string;
  width: string;
  editable: boolean;
  type: 'text' | 'select' | 'array' | 'number' | 'cia_profile';
  options?: string[];
}

// Default columns for the spreadsheet
// Order: asset_name, asset_category, criticality, cia_profile, description, business_unit, owner, publicly_accessible, data_handled, compliance_scope, technologies, risk_score, tags
export const SPREADSHEET_COLUMNS: ColumnDef[] = [
  { key: 'asset_name', label: 'Asset Name', width: '180px', editable: true, type: 'text' },
  { key: 'asset_category', label: 'Category', width: '140px', editable: true, type: 'select' },
  { key: 'criticality', label: 'Criticality', width: '120px', editable: true, type: 'select' },
  { key: 'cia_profile', label: 'CIA Profile', width: '140px', editable: false, type: 'cia_profile' },
  { key: 'description', label: 'Description', width: '200px', editable: true, type: 'text' },
  { key: 'business_unit', label: 'Business Unit', width: '130px', editable: true, type: 'text' },
  { key: 'owner', label: 'Owner', width: '120px', editable: true, type: 'text' },
  { key: 'publicly_accessible', label: 'Public', width: '80px', editable: true, type: 'select' },
  { key: 'data_handled', label: 'Data Handled', width: '140px', editable: true, type: 'text' },
  { key: 'compliance_scope', label: 'Compliance Scope', width: '150px', editable: true, type: 'text' },
  { key: 'technologies', label: 'Technologies', width: '150px', editable: true, type: 'array' },
  { key: 'risk_score', label: 'Risk Score', width: '100px', editable: false, type: 'number' },
  { key: 'tags', label: 'Tags', width: '150px', editable: true, type: 'array' },
];

// Criticality colors for badges
export const CRITICALITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  informational: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Environment colors
export const ENVIRONMENT_COLORS: Record<string, string> = {
  production: 'bg-red-500/10 text-red-400',
  staging: 'bg-orange-500/10 text-orange-400',
  development: 'bg-blue-500/10 text-blue-400',
  testing: 'bg-purple-500/10 text-purple-400',
  qa: 'bg-indigo-500/10 text-indigo-400',
  uat: 'bg-cyan-500/10 text-cyan-400',
  dr: 'bg-rose-500/10 text-rose-400',
  sandbox: 'bg-teal-500/10 text-teal-400',
  unknown: 'bg-gray-500/10 text-gray-400',
};

// CSV import field mappings (support multiple field names)
// Order: asset_name, asset_category, criticality, description, business_unit, owner, publicly_accessible, data_handled, compliance_scope, technologies, risk_score, tags
// All aliases should be lowercase for matching
export const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
  asset_name: ['asset_name', 'assetname', 'asset name', 'name', 'title', 'label'],
  asset_category: ['asset_category', 'assetcategory', 'asset category', 'category', 'asset_type', 'assettype', 'asset type', 'type'],
  criticality: ['criticality', 'critical', 'priority', 'importance', 'severity'],
  description: ['description', 'desc', 'details', 'notes', 'comment', 'comments'],
  business_unit: ['business_unit', 'businessunit', 'business unit', 'bu', 'department', 'dept', 'team'],
  owner: ['owner', 'owners', 'contact', 'responsible', 'admin', 'administrator'],
  publicly_accessible: ['publicly_accessible', 'publiclyaccessible', 'publicly accessible', 'public', 'internet_facing', 'external'],
  data_handled: ['data_handled', 'datahandled', 'data handled', 'data_type', 'data type', 'data_classification', 'data'],
  compliance_scope: ['compliance_scope', 'compliancescope', 'compliance scope', 'compliace_scope', 'compliance', 'regulatory', 'regulations'],
  technologies: ['technologies', 'technology', 'tech', 'stack', 'software', 'apps', 'applications'],
  risk_score: ['risk_score', 'riskscore', 'risk score', 'risk', 'score'],
  tags: ['tags', 'tag', 'labels', 'keywords'],
};

// Fields that should be parsed as arrays (comma, semicolon, or pipe separated)
export const ARRAY_FIELDS = ['tags', 'technologies'];
