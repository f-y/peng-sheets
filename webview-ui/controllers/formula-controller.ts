/**
 * FormulaController - Manages computed column formulas and dependencies.
 *
 * Responsibilities:
 * - Build and maintain dependency graph between source and formula columns
 * - Trigger recalculation when source cells change
 * - Validate formula references
 * - Coordinate batch updates for atomic undo/redo
 */

import { ReactiveController, ReactiveControllerHost } from 'lit';
import type {
    FormulaDefinition,
    FormulaMetadata,
    ArithmeticFormula,
    LookupFormula
} from '../services/types';
import type { WorkbookJSON, TableJSON } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a cell update to be batched.
 */
export interface CellUpdate {
    sheetIndex: number;
    tableIndex: number;
    rowIndex: number;
    colIndex: number;
    value: string;
}

/**
 * Dependency graph entry: which columns depend on a source column.
 */
export interface DependencyEntry {
    sourceTableId: number;
    sourceColumn: string;
    dependentColumns: Array<{
        tableId: number;
        colIndex: number;
    }>;
}

/**
 * Validation result for a formula.
 */
export interface FormulaValidationResult {
    valid: boolean;
    error?: string;
    missingColumns?: string[];
    missingTableId?: number;
}

/**
 * Host interface for FormulaController.
 */
export interface FormulaControllerHost extends ReactiveControllerHost {
    workbook: WorkbookJSON | null;
    getSheetIndex(): number;
    getTableIndex(): number;
    getFormulaMetadata(): FormulaMetadata | null;
}

// =============================================================================
// FormulaController
// =============================================================================

export class FormulaController implements ReactiveController {
    private host: FormulaControllerHost;
    private dependencyGraph: Map<string, DependencyEntry> = new Map();

    constructor(host: FormulaControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected(): void {
        this.rebuildDependencyGraph();
    }

    hostDisconnected(): void {
        this.dependencyGraph.clear();
    }

    // =========================================================================
    // Dependency Graph
    // =========================================================================

    /**
     * Rebuild the dependency graph from current workbook formulas.
     */
    rebuildDependencyGraph(): void {
        this.dependencyGraph.clear();
        const workbook = this.host.workbook;
        if (!workbook) return;

        for (const sheet of workbook.sheets) {
            for (const table of sheet.tables) {
                const tableId = this.getTableId(table);
                if (tableId === undefined) continue;

                const formulas = this.getFormulasFromTable(table);
                if (!formulas) continue;

                for (const [colIndexStr, formula] of Object.entries(formulas)) {
                    const colIndex = parseInt(colIndexStr, 10);
                    this.registerFormulaDependencies(tableId, colIndex, formula, table);
                }
            }
        }
    }

    /**
     * Register dependencies for a single formula.
     */
    private registerFormulaDependencies(
        tableId: number,
        colIndex: number,
        formula: FormulaDefinition,
        table: TableJSON
    ): void {
        if (formula.type === 'arithmetic') {
            this.registerArithmeticDependencies(tableId, colIndex, formula, table);
        } else if (formula.type === 'lookup') {
            this.registerLookupDependencies(tableId, colIndex, formula);
        }
    }

    /**
     * Register dependencies for arithmetic formula.
     */
    private registerArithmeticDependencies(
        tableId: number,
        colIndex: number,
        formula: ArithmeticFormula,
        table: TableJSON
    ): void {
        const sourceTableId = formula.sourceTableId ?? tableId;

        if (formula.functionType === 'expression' && formula.expression) {
            // Parse column references from expression
            const columnRefs = this.parseColumnReferences(formula.expression);
            for (const colName of columnRefs) {
                this.addDependency(sourceTableId, colName, tableId, colIndex);
            }
        } else if (formula.columns) {
            // Aggregate function with explicit column list
            for (const colName of formula.columns) {
                this.addDependency(sourceTableId, colName, tableId, colIndex);
            }
        }
    }

    /**
     * Register dependencies for lookup formula.
     */
    private registerLookupDependencies(
        tableId: number,
        colIndex: number,
        formula: LookupFormula
    ): void {
        // Lookup depends on local join key and remote target field
        this.addDependency(tableId, formula.joinKeyLocal, tableId, colIndex);
        this.addDependency(formula.sourceTableId, formula.targetField, tableId, colIndex);
        this.addDependency(formula.sourceTableId, formula.joinKeyRemote, tableId, colIndex);
    }

    /**
     * Add a dependency to the graph.
     */
    private addDependency(
        sourceTableId: number,
        sourceColumn: string,
        dependentTableId: number,
        dependentColIndex: number
    ): void {
        const key = `${sourceTableId}:${sourceColumn}`;
        let entry = this.dependencyGraph.get(key);
        if (!entry) {
            entry = {
                sourceTableId,
                sourceColumn,
                dependentColumns: []
            };
            this.dependencyGraph.set(key, entry);
        }
        entry.dependentColumns.push({
            tableId: dependentTableId,
            colIndex: dependentColIndex
        });
    }

    /**
     * Parse column references from an expression string.
     * Matches patterns like [ColumnName].
     */
    parseColumnReferences(expression: string): string[] {
        const regex = /\[([^\]]+)\]/g;
        const refs: string[] = [];
        let match;
        while ((match = regex.exec(expression)) !== null) {
            refs.push(match[1]);
        }
        return refs;
    }

    // =========================================================================
    // Formula Execution (Placeholder - will be expanded in Phase 2)
    // =========================================================================

    /**
     * Get columns that depend on a source column change.
     */
    getDependentColumns(tableId: number, columnName: string): Array<{ tableId: number; colIndex: number }> {
        const key = `${tableId}:${columnName}`;
        const entry = this.dependencyGraph.get(key);
        return entry?.dependentColumns ?? [];
    }

    /**
     * Check if a column is a formula column.
     */
    isFormulaColumn(colIndex: number): boolean {
        const formulas = this.host.getFormulaMetadata();
        if (!formulas) return false;
        return colIndex.toString() in formulas;
    }

    /**
     * Get the formula for a column.
     */
    getFormula(colIndex: number): FormulaDefinition | null {
        const formulas = this.host.getFormulaMetadata();
        if (!formulas) return null;
        return formulas[colIndex.toString()] ?? null;
    }

    // =========================================================================
    // Validation
    // =========================================================================

    /**
     * Validate a formula definition.
     */
    validateFormula(formula: FormulaDefinition): FormulaValidationResult {
        if (formula.type === 'arithmetic') {
            return this.validateArithmeticFormula(formula);
        } else if (formula.type === 'lookup') {
            return this.validateLookupFormula(formula);
        }
        return { valid: false, error: 'Unknown formula type' };
    }

    /**
     * Validate an arithmetic formula.
     */
    private validateArithmeticFormula(formula: ArithmeticFormula): FormulaValidationResult {
        if (formula.functionType === 'expression') {
            if (!formula.expression || formula.expression.trim() === '') {
                return { valid: false, error: 'Expression is empty' };
            }
            const refs = this.parseColumnReferences(formula.expression);
            if (refs.length === 0) {
                return { valid: false, error: 'No column references found in expression' };
            }
        } else {
            if (!formula.columns || formula.columns.length === 0) {
                return { valid: false, error: 'No columns selected for aggregate function' };
            }
        }
        return { valid: true };
    }

    /**
     * Validate a lookup formula.
     */
    private validateLookupFormula(formula: LookupFormula): FormulaValidationResult {
        if (formula.sourceTableId === undefined || formula.sourceTableId < 0) {
            return { valid: false, error: 'Invalid source table' };
        }
        if (!formula.joinKeyLocal || !formula.joinKeyRemote || !formula.targetField) {
            return { valid: false, error: 'Missing required lookup fields' };
        }

        // Check if source table exists
        const sourceTable = this.findTableById(formula.sourceTableId);
        if (!sourceTable) {
            return { valid: false, error: 'Source table not found', missingTableId: formula.sourceTableId };
        }

        return { valid: true };
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    /**
     * Get table ID from table metadata.
     */
    private getTableId(table: TableJSON): number | undefined {
        const metadata = table.metadata as Record<string, unknown> | undefined;
        if (metadata && typeof metadata.id === 'number') {
            return metadata.id;
        }
        return undefined;
    }

    /**
     * Get formulas from table visual metadata.
     */
    private getFormulasFromTable(table: TableJSON): FormulaMetadata | null {
        const metadata = table.metadata as Record<string, unknown> | undefined;
        if (!metadata) return null;

        const visual = metadata.visual as Record<string, unknown> | undefined;
        if (!visual) return null;

        const formulas = visual.formulas as FormulaMetadata | undefined;
        return formulas ?? null;
    }

    /**
     * Find a table by its ID across all sheets.
     */
    findTableById(tableId: number): TableJSON | null {
        const workbook = this.host.workbook;
        if (!workbook) return null;

        for (const sheet of workbook.sheets) {
            for (const table of sheet.tables) {
                if (this.getTableId(table) === tableId) {
                    return table;
                }
            }
        }
        return null;
    }

    /**
     * Get sheet and table indices for a table ID.
     */
    findTableLocation(tableId: number): { sheetIndex: number; tableIndex: number } | null {
        const workbook = this.host.workbook;
        if (!workbook) return null;

        for (let sheetIndex = 0; sheetIndex < workbook.sheets.length; sheetIndex++) {
            const sheet = workbook.sheets[sheetIndex];
            for (let tableIndex = 0; tableIndex < sheet.tables.length; tableIndex++) {
                if (this.getTableId(sheet.tables[tableIndex]) === tableId) {
                    return { sheetIndex, tableIndex };
                }
            }
        }
        return null;
    }
}
