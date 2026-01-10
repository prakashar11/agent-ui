/**
 * Shared CSV parsing utilities for spreadsheet components.
 * 
 * =============================================================================
 * DESIGN: FORMAT-AGNOSTIC CSV PARSER
 * =============================================================================
 * 
 * This parser is designed to be **completely decoupled from data schemas**.
 * The core `parseCSV()` function handles raw CSV parsing regardless of what
 * fields/columns the CSV contains. Schema-specific logic (field mappings,
 * array fields, required fields) is defined by each consuming component.
 * 
 * =============================================================================
 * RFC 4180 COMPLIANCE
 * =============================================================================
 * 
 * The parser handles all standard CSV edge cases:
 * - Multi-line quoted fields (newlines inside quoted values)
 * - Escaped quotes ("" becomes single ")
 * - Smart/curly quote normalization (""'' → "")
 * - Line ending normalization (CRLF, CR, LF → LF)
 * - Commas inside quoted fields
 * - Field count validation per row
 * 
 * =============================================================================
 * USAGE: SUPPORTING DIFFERENT CSV FORMATS
 * =============================================================================
 * 
 * Each component defines its own field mappings that tell the parser how to
 * interpret headers. Example for two different data types:
 * 
 * **HygieneEssentials** (in HygieneEssentialsSpreadsheet/types.ts):
 * ```ts
 * export const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
 *   name: ['essentials', 'essential', 'name', 'hygiene_essential'],
 *   category: ['asset_category', 'category', 'asset_type'],
 *   maturity_level: ['maturity_level', 'maturity', 'level'],
 * };
 * ```
 * 
 * **Assets** (in AssetMemorySpreadsheet/types.ts):
 * ```ts
 * export const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
 *   hostname: ['hostname', 'host', 'server', 'server_name'],
 *   ip_addresses: ['ip_addresses', 'ip', 'ips', 'ip_address'],
 *   criticality: ['criticality', 'priority', 'severity'],
 * };
 * export const ARRAY_FIELDS = ['ip_addresses', 'tags', 'technologies'];
 * ```
 * 
 * **Usage in component**:
 * ```ts
 * import { parseCSV, mapCSVHeaders, csvRowsToObjects } from '../utils';
 * import { CSV_FIELD_MAPPINGS, ARRAY_FIELDS } from './types';
 * 
 * // 1. Parse raw CSV (format-agnostic)
 * const parseResult = parseCSV(csvText, { debug: true });
 * 
 * // 2. Map headers using component-specific field mappings
 * const headers = parseResult.rows[0].map(h => h.toLowerCase());
 * const headerMap = mapCSVHeaders(headers, CSV_FIELD_MAPPINGS);
 * 
 * // 3. Convert rows to typed objects
 * const objects = csvRowsToObjects<MyType>(parseResult.rows, headerMap, ARRAY_FIELDS);
 * ```
 * 
 * =============================================================================
 * ADDING SUPPORT FOR NEW CSV FORMATS
 * =============================================================================
 * 
 * To support a new data type (e.g., Vulnerability Spreadsheet):
 * 
 * 1. Create field mappings in your component's types.ts:
 *    ```ts
 *    export const CSV_FIELD_MAPPINGS: Record<string, string[]> = {
 *      cve_id: ['cve', 'cve_id', 'vulnerability_id', 'vuln_id'],
 *      severity: ['severity', 'rating', 'risk_level'],
 *      cvss_score: ['cvss', 'cvss_score', 'score'],
 *    };
 *    export const ARRAY_FIELDS = ['affected_products', 'references'];
 *    ```
 * 
 * 2. Import and use shared utilities:
 *    ```ts
 *    import { parseCSV, mapCSVHeaders } from '../utils';
 *    import { CSV_FIELD_MAPPINGS, ARRAY_FIELDS } from './types';
 *    // Same parsing code works with your custom field mappings
 *    ```
 * 
 * =============================================================================
 * FLEXIBILITY SUMMARY
 * =============================================================================
 * 
 * | Aspect              | Support                                    |
 * |---------------------|---------------------------------------------|
 * | CSV Structure       | ✅ Any number of columns, any order        |
 * | Header Names        | ✅ Multiple aliases per target field       |
 * | Field Types         | ✅ Text, arrays (configurable separators)  |
 * | New Data Types      | ✅ Just define new field mappings          |
 * | Unrecognized Cols   | ✅ Ignored (no error)                      |
 * | Missing Columns     | ✅ Validation helper available             |
 * 
 * =============================================================================
 */

export interface CSVParseOptions {
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Whether to skip empty rows (default: true) */
  skipEmptyRows?: boolean;
  /** Whether to trim field values (default: true) */
  trimFields?: boolean;
}

export interface CSVParseResult {
  /** Parsed rows (including header) */
  rows: string[][];
  /** Number of headers */
  headerCount: number;
  /** Rows with mismatched field counts */
  mismatchedRowCount: number;
  /** Whether parsing ended with unclosed quote */
  hasUnclosedQuote: boolean;
  /** Number of multi-line fields detected */
  multiLineFieldCount: number;
  /** Number of smart quotes converted */
  smartQuotesConverted: number;
}

/**
 * RFC 4180 compliant CSV parser.
 * 
 * Handles:
 * - Quoted fields with embedded commas, newlines
 * - Escaped quotes ("" becomes ")
 * - Smart/curly quote normalization
 * - CRLF, CR, LF line endings
 * 
 * @param csvText - Raw CSV text to parse
 * @param options - Parsing options
 * @returns Parsed result with rows and metadata
 */
export function parseCSV(csvText: string, options: CSVParseOptions = {}): CSVParseResult {
  const { debug = false, skipEmptyRows = true, trimFields = true } = options;
  
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  // Normalize line endings to \n
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Normalize smart/curly quotes to straight quotes
  const smartDoubleQuotes = /[\u201C\u201D\u201E\u201F\u2033\u2036]/g;
  const smartSingleQuotes = /[\u2018\u2019\u201A\u201B\u2032\u2035]/g;
  
  const smartQuoteMatches = csvText.match(smartDoubleQuotes);
  const smartQuotesConverted = smartQuoteMatches ? smartQuoteMatches.length : 0;
  
  const cleanedText = normalizedText
    .replace(smartDoubleQuotes, '"')  // Smart double quotes
    .replace(smartSingleQuotes, "'"); // Smart single quotes
  
  if (debug && smartQuotesConverted > 0) {
    console.log('⚠️ CSV Parser: Found smart/curly quotes - converted:', smartQuotesConverted, 'occurrences');
  }
  
  while (i < cleanedText.length) {
    const char = cleanedText[i];
    const nextChar = cleanedText[i + 1];
    
    if (inQuotes) {
      // Inside quotes - handle quote characters specially
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("") - add single quote and skip next
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      }
      // Any other character (including newlines) is part of the field
      currentField += char;
      i++;
      continue;
    }
    
    // Not inside quotes
    if (char === '"') {
      // Start of quoted field (only valid at start of field or after comma)
      inQuotes = true;
      i++;
      continue;
    }
    
    if (char === ',') {
      // End of field
      currentRow.push(trimFields ? currentField.trim() : currentField);
      currentField = '';
      i++;
      continue;
    }
    
    if (char === '\n') {
      // End of row
      currentRow.push(trimFields ? currentField.trim() : currentField);
      
      const hasContent = skipEmptyRows 
        ? currentRow.some(f => f.length > 0)
        : true;
      
      if (hasContent) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }
    
    // Regular character
    currentField += char;
    i++;
  }
  
  // Handle last field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(trimFields ? currentField.trim() : currentField);
    
    const hasContent = skipEmptyRows 
      ? currentRow.some(f => f.length > 0)
      : true;
    
    if (hasContent) {
      rows.push(currentRow);
    }
  }
  
  // Calculate metadata
  const headerCount = rows[0]?.length || 0;
  const mismatchedRows = rows.slice(1).filter(row => row.length !== headerCount);
  
  // Count multi-line fields
  const multiLineFields = rows.flatMap((row, rowIdx) => 
    row.map((field, fieldIdx) => ({ rowIdx, fieldIdx, field }))
      .filter(({ field }) => field.includes('\n'))
  );
  
  // Debug logging
  if (debug) {
    if (inQuotes) {
      console.warn('⚠️ CSV Parser: Ended with unclosed quote - possible malformed CSV');
    }
    
    if (mismatchedRows.length > 0) {
      console.warn(`⚠️ CSV Parser: ${mismatchedRows.length} rows have different field count than header (${headerCount})`);
    }
    
    console.log('CSV Parser - Total rows parsed:', rows.length);
    console.log('CSV Parser - All rows with field lengths:');
    rows.forEach((row, idx) => {
      console.log(`  Row ${idx}: [${row.map(f => `"${f.substring(0, 30).replace(/\n/g, '\\n')}${f.length > 30 ? '...' : ''}" (${f.length})`).join(', ')}]`);
    });
    
    if (multiLineFields.length > 0) {
      console.log('CSV Parser - Multi-line fields detected:', multiLineFields.length);
      multiLineFields.forEach(({ rowIdx, fieldIdx, field }) => {
        console.log(`  Row ${rowIdx}, Field ${fieldIdx}: "${field.substring(0, 50).replace(/\n/g, '\\n')}..."`);
      });
    }
  }
  
  return {
    rows,
    headerCount,
    mismatchedRowCount: mismatchedRows.length,
    hasUnclosedQuote: inQuotes,
    multiLineFieldCount: multiLineFields.length,
    smartQuotesConverted,
  };
}

/**
 * Maps CSV headers to expected field names using flexible matching.
 * 
 * @param headers - Array of header strings from CSV (typically already lowercased)
 * @param fieldMappings - Object mapping target field names to arrays of acceptable aliases
 * @returns Object mapping header index to target field name
 * 
 * @example
 * ```ts
 * const fieldMappings = {
 *   name: ['name', 'title', 'essentials'],
 *   category: ['category', 'asset_category', 'type'],
 * };
 * 
 * const headers = ['Asset Category', 'Essentials', 'Description'];
 * const headerMap = mapCSVHeaders(headers.map(h => h.toLowerCase()), fieldMappings);
 * // Result: { 0: 'category', 1: 'name' } (2 is unmatched)
 * ```
 */
export function mapCSVHeaders(
  headers: string[],
  fieldMappings: Record<string, string[]>
): Record<number, string> {
  const headerMap: Record<number, string> = {};
  
  headers.forEach((header, idx) => {
    // Normalize: remove underscores/spaces, lowercase
    const normalizedHeader = header.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const compactHeader = header.replace(/[_\s]/g, '');
    
    for (const [field, aliases] of Object.entries(fieldMappings)) {
      const matched = aliases.some(alias => {
        const normalizedAlias = alias.replace(/[_\s]/g, '');
        return (
          normalizedHeader === alias ||
          compactHeader === normalizedAlias ||
          normalizedHeader.includes(alias) ||
          alias.includes(normalizedHeader)
        );
      });
      
      if (matched) {
        headerMap[idx] = field;
        break;
      }
    }
  });
  
  return headerMap;
}

/**
 * Converts parsed CSV rows to objects using a header map.
 * 
 * @param rows - All parsed rows including header row
 * @param headerMap - Map of column index to field name
 * @param arrayFields - Optional list of fields that should be parsed as arrays
 * @param arraySeparators - RegExp for splitting array values (default: /[;|]/)
 * @returns Array of parsed objects
 */
export function csvRowsToObjects<T extends Record<string, unknown>>(
  rows: string[][],
  headerMap: Record<number, string>,
  arrayFields: string[] = [],
  arraySeparators: RegExp = /[;|]/
): Array<Partial<T>> {
  if (rows.length < 2) return [];
  
  const dataRows = rows.slice(1);
  const results: Array<Partial<T>> = [];
  
  for (const row of dataRows) {
    const obj: Record<string, unknown> = {};
    
    for (const [idxStr, fieldName] of Object.entries(headerMap)) {
      const idx = parseInt(idxStr, 10);
      const value = row[idx] ?? '';
      
      if (arrayFields.includes(fieldName)) {
        // Parse as array
        obj[fieldName] = value
          .split(arraySeparators)
          .map((v: string) => v.trim())
          .filter(Boolean);
      } else {
        obj[fieldName] = value;
      }
    }
    
    results.push(obj as Partial<T>);
  }
  
  return results;
}

/**
 * Generates CSV content from an array of objects.
 * 
 * @param data - Array of objects to convert
 * @param columns - Column definitions specifying order and field keys
 * @param options - Export options
 * @returns CSV string
 */
export interface CSVExportColumn {
  key: string;
  label?: string;
}

export interface CSVExportOptions {
  /** Include header row (default: true) */
  includeHeader?: boolean;
  /** Fields that are arrays and should be joined (default: []) */
  arrayFields?: string[];
  /** Separator for array values (default: ';') */
  arraySeparator?: string;
}

export function generateCSV(
  data: Array<Record<string, unknown>>,
  columns: CSVExportColumn[],
  options: CSVExportOptions = {}
): string {
  const { includeHeader = true, arrayFields = [], arraySeparator = ';' } = options;
  
  const lines: string[] = [];
  
  // Header row
  if (includeHeader) {
    const headerLine = columns.map(col => escapeCSVField(col.label || col.key)).join(',');
    lines.push(headerLine);
  }
  
  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      
      if (value === null || value === undefined) {
        return '';
      }
      
      if (Array.isArray(value)) {
        return escapeCSVField(value.join(arraySeparator));
      }
      
      if (typeof value === 'object') {
        return escapeCSVField(JSON.stringify(value));
      }
      
      return escapeCSVField(String(value));
    });
    
    lines.push(values.join(','));
  }
  
  return lines.join('\n');
}

/**
 * Escapes a value for CSV format.
 * Wraps in quotes if contains comma, quote, or newline.
 * Doubles internal quotes.
 */
export function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Validates CSV structure and returns any issues found.
 */
export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCSV(
  parseResult: CSVParseResult,
  options: {
    minRows?: number;
    requiredFields?: string[];
    headerMap?: Record<number, string>;
  } = {}
): CSVValidationResult {
  const { minRows = 2, requiredFields = [], headerMap = {} } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check minimum rows
  if (parseResult.rows.length < minRows) {
    errors.push(`CSV must have at least ${minRows} rows (including header). Found: ${parseResult.rows.length}`);
  }
  
  // Check for unclosed quotes
  if (parseResult.hasUnclosedQuote) {
    warnings.push('CSV parsing ended with unclosed quote - data may be truncated');
  }
  
  // Check for mismatched field counts
  if (parseResult.mismatchedRowCount > 0) {
    warnings.push(`${parseResult.mismatchedRowCount} rows have inconsistent field counts`);
  }
  
  // Check required fields are present in header map
  if (requiredFields.length > 0) {
    const mappedFields = Object.values(headerMap);
    const missingFields = requiredFields.filter(f => !mappedFields.includes(f));
    
    if (missingFields.length > 0) {
      errors.push(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
