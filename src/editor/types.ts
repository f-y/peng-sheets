/**
 * Type definitions for the PengSheets editor module.
 * Converted from python-modules/src/md_spreadsheet_editor/types.py
 */

// =============================================================================
// Number Format
// =============================================================================

export interface NumberFormat {
    type?: 'number' | 'currency' | 'percent';
    decimals?: number;
    useThousandsSeparator?: boolean;
    currencySymbol?: string;
}

// =============================================================================
// Column Format
// =============================================================================

export interface ColumnFormat {
    wordWrap?: boolean;
    numberFormat?: NumberFormat;
}

// =============================================================================
// Column Metadata
// =============================================================================

export interface ColumnMetadata {
    width?: number;
    format?: ColumnFormat;
    align?: 'left' | 'center' | 'right';
    hidden?: boolean;
    type?: string; // For type inference (number, string, date, etc.)
}

export type ColumnsMetadata = Record<string, ColumnMetadata>;

// =============================================================================
// Validation Rules
// =============================================================================

export interface ListValidationRule {
    [key: string]: unknown;
    type: 'list';
    values: string[];
}

export interface DateValidationRule {
    [key: string]: unknown;
    type: 'date';
}

export interface IntegerValidationRule {
    [key: string]: unknown;
    type: 'integer';
    min?: number;
    max?: number;
}

export interface EmailValidationRule {
    [key: string]: unknown;
    type: 'email';
}

export interface UrlValidationRule {
    [key: string]: unknown;
    type: 'url';
}

export type ValidationRule =
    | ListValidationRule
    | DateValidationRule
    | IntegerValidationRule
    | EmailValidationRule
    | UrlValidationRule;

export type ValidationMetadata = Record<string, ValidationRule>;

// =============================================================================
// Filter Metadata
// =============================================================================

export type FiltersMetadata = Record<string, string[]>;

// =============================================================================
// Visual Metadata
// =============================================================================

export interface VisualMetadata {
    [key: string]: unknown;
    columns?: ColumnsMetadata;
    validation?: ValidationMetadata;
    filters?: FiltersMetadata;
    // Legacy support
    column_widths?: Record<string, number> | number[];
}

// =============================================================================
// Tab Order
// =============================================================================

export interface TabOrderItem {
    type: 'sheet' | 'document';
    index: number;
}

// =============================================================================
// Update Result (returned by most operations)
// =============================================================================

export interface UpdateResult {
    [key: string]: unknown; // Index signature for compatibility
    type?: 'updateRange';
    startLine?: number;
    endLine?: number;
    endCol?: number;
    content?: string;
    error?: string;
    file_changed?: boolean;
}

// =============================================================================
// Cell Range (for move_cells, paste_cells)
// =============================================================================

export interface CellRange {
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

// =============================================================================
// Structure Section (from extract_structure)
// =============================================================================

export interface DocumentSection {
    type: 'document';
    title: string;
    content: string;
}

export interface WorkbookSection {
    type: 'workbook';
}

export type StructureSection = DocumentSection | WorkbookSection;

// =============================================================================
// Editor Config
// =============================================================================

export interface EditorConfig {
    rootMarker?: string;
    sheetHeaderLevel?: number;
    tableHeaderLevel?: number;
    captureDescription?: boolean;
    columnSeparator?: string;
    headerSeparatorChar?: string;
    requireOuterPipes?: boolean;
    stripWhitespace?: boolean;
}
