/**
 * Types for the Asset Memory Spreadsheet component
 */

export interface Asset {
  asset_id: string;
  hostname: string;
  name: string;
  description: string;
  ip_addresses: string[];
  asset_type: string;
  criticality: string;
  environment: string;
  business_unit: string;
  tags: string[];
  technologies: string[];
  owner: string;
  risk_score: number;
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
  type: 'text' | 'select' | 'array' | 'number';
  options?: string[];
}

// Default columns for the spreadsheet
export const SPREADSHEET_COLUMNS: ColumnDef[] = [
  { key: 'hostname', label: 'Hostname', width: '180px', editable: true, type: 'text' },
  { key: 'name', label: 'Name', width: '150px', editable: true, type: 'text' },
  { key: 'asset_type', label: 'Type', width: '140px', editable: true, type: 'select' },
  { key: 'criticality', label: 'Criticality', width: '120px', editable: true, type: 'select' },
  { key: 'environment', label: 'Environment', width: '120px', editable: true, type: 'select' },
  { key: 'ip_addresses', label: 'IP Addresses', width: '150px', editable: true, type: 'array' },
  { key: 'owner', label: 'Owner', width: '120px', editable: true, type: 'text' },
  { key: 'business_unit', label: 'Business Unit', width: '130px', editable: true, type: 'text' },
  { key: 'tags', label: 'Tags', width: '150px', editable: true, type: 'array' },
  { key: 'technologies', label: 'Technologies', width: '150px', editable: true, type: 'array' },
  { key: 'risk_score', label: 'Risk Score', width: '100px', editable: false, type: 'number' },
  { key: 'description', label: 'Description', width: '200px', editable: true, type: 'text' },
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

