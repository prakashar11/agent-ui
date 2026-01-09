/**
 * Types for the Hygiene Essentials Spreadsheet component
 */

export interface HygieneEssential {
  id: string;
  name: string;
  category: string;
  categories: string[];
  maturity_level: string;
  control_type: string;
  description: string;
  source: string;
  status: string;
  created_at?: string;
}

export interface HygieneEssentialListResponse {
  essentials: HygieneEssential[];
  total: number;
  filters: {
    category: string | null;
    maturity_level: string | null;
  };
}

export interface HygieneCategoryResponse {
  categories: Array<{
    name: string;
    count: number;
  }>;
  total: number;
}

export interface MaturityLevelResponse {
  maturity_levels: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

export interface HygieneEssentialsSpreadsheetProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: keyof HygieneEssential | null;
  direction: SortDirection;
}

// Column definition for the spreadsheet
export interface ColumnDef {
  key: keyof HygieneEssential;
  label: string;
  width: string;
  editable: boolean;
  type: 'text' | 'select' | 'array';
  options?: string[];
}

// Default columns for the hygiene essentials spreadsheet
export const SPREADSHEET_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Hygiene Essential', width: '220px', editable: true, type: 'text' },
  { key: 'category', label: 'Asset Category', width: '160px', editable: true, type: 'text' },
  { key: 'maturity_level', label: 'Maturity', width: '130px', editable: true, type: 'select', options: ['basic', 'intermediate', 'advanced'] },
  { key: 'control_type', label: 'Control Type', width: '140px', editable: true, type: 'select', options: ['preventive', 'detective', 'corrective', 'unknown'] },
  { key: 'source', label: 'Source', width: '120px', editable: true, type: 'text' },
  { key: 'description', label: 'Description', width: '250px', editable: true, type: 'text' },
];

// Maturity level colors for badges
export const MATURITY_COLORS: Record<string, string> = {
  basic: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// Control type colors
export const CONTROL_TYPE_COLORS: Record<string, string> = {
  preventive: 'bg-blue-500/10 text-blue-400',
  detective: 'bg-orange-500/10 text-orange-400',
  corrective: 'bg-emerald-500/10 text-emerald-400',
  unknown: 'bg-gray-500/10 text-gray-400',
};

// CSV template headers (order: asset category, essentials, maturity level, source)
export const CSV_TEMPLATE_HEADERS = [
  'asset_category',
  'essentials',
  'maturity_level',
  'source',
];

// CSV import field mappings (support multiple field names)
// All aliases should be lowercase for matching
// Expected CSV order: asset_category, essentials, maturity_level, source
export const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
  name: [
    'essentials', 'essential', 'name', 'essentialsname', 
    'hygiene_essential', 'hygieneessential', 'hygiene essential',
    'control_name', 'controlname', 'control', 'hygiene'
  ],
  category: [
    'asset_category', 'assetcategory', 'asset category',
    'category', 'asset_type', 'assettype', 'asset type',
    'asset category type', 'assetcategorytype', 'category type', 'categorytype'
  ],
  maturity_level: [
    'maturity_level', 'maturitylevel', 'maturity level', 'maturity', 'level'
  ],
  control_type: [
    'control_type', 'controltype', 'control type', 'type'
  ],
  description: ['description', 'desc', 'details', 'notes'],
  source: ['source', 'origin', 'framework', 'reference'],
};
