/**
 * Type definitions for webview services.
 *
 * Since the Python-TypeScript boundary no longer exists (Pyodide removed),
 * these types are now re-exports from the unified editor module.
 */

// Re-export types from the canonical source
export type {
    UpdateResult as IUpdateSpec,
    VisualMetadata as IVisualMetadata,
    TableMetadata,
    ValidationMetadata,
    TabOrderItem,
    CellRange,
    ColumnMetadata,
    ColumnFormat,
    NumberFormat,
    ValidationRule,
    EditorConfig,
    // Formula types (Computed Columns)
    FormulaDefinition,
    FormulaMetadata,
    FormulaFunctionType,
    ArithmeticFormula,
    LookupFormula,
    TableIdentity
} from '../../src/editor/types';

// VSCode API interface (specific to webview context)
export interface IVSCodeApi {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}
