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
    LookupFormula,
    TableMetadata
} from '../services/types';
import type { WorkbookJSON, TableJSON } from '../types';
import * as formulaEvaluator from '../utils/formula-evaluator';

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
        _table: TableJSON
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
    private registerLookupDependencies(tableId: number, colIndex: number, formula: LookupFormula): void {
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
    // Formula Execution
    // =========================================================================

    /**
     * Recalculate all formula columns affected by a cell change.
     * Returns an array of CellUpdate objects for batch application.
     * Handles cascading dependencies (e.g., Lookup → arithmetic that uses Lookup result).
     */
    recalculateAffectedColumns(tableId: number, changedColumn: string, workbook: WorkbookJSON): CellUpdate[] {
        const updates: CellUpdate[] = [];
        // Track visited (tableId, colIndex) to prevent infinite loops
        const visited = new Set<string>();

        this._recalculateAffectedColumnsRecursive(tableId, changedColumn, workbook, updates, visited);

        return updates;
    }

    /**
     * Internal recursive helper for cascading dependency resolution.
     */
    private _recalculateAffectedColumnsRecursive(
        tableId: number,
        changedColumn: string,
        workbook: WorkbookJSON,
        updates: CellUpdate[],
        visited: Set<string>
    ): void {
        // Get all dependent formula columns
        const dependents = this.getDependentColumns(tableId, changedColumn);
        if (dependents.length === 0) return;

        for (const dep of dependents) {
            const visitKey = `${dep.tableId}:${dep.colIndex}`;
            if (visited.has(visitKey)) continue;
            visited.add(visitKey);

            const location = this.findTableLocation(dep.tableId);
            if (!location) continue;

            const sheet = workbook.sheets[location.sheetIndex];
            const table = sheet.tables[location.tableIndex];
            const formula = this.getFormulaForTable(table, dep.colIndex);
            if (!formula) continue;

            // Evaluate formula for each row and update workbook in memory
            for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
                const newValue = this._evaluateFormulaForRow(formula, table, rowIndex, workbook);

                // Update workbook in memory so cascading formulas see new values
                if (table.rows[rowIndex]) {
                    table.rows[rowIndex][dep.colIndex] = newValue;
                }

                updates.push({
                    sheetIndex: location.sheetIndex,
                    tableIndex: location.tableIndex,
                    rowIndex,
                    colIndex: dep.colIndex,
                    value: newValue
                });
            }

            // Get the column name for the updated computed column
            const headers = table.headers || [];
            const updatedColName = headers[dep.colIndex];
            if (updatedColName) {
                // Recursively recalculate columns that depend on this computed column
                this._recalculateAffectedColumnsRecursive(dep.tableId, updatedColName, workbook, updates, visited);
            }
        }
    }

    /**
     * Recalculate a single formula column for all rows.
     * Returns an array of CellUpdate objects.
     */
    recalculateSingleColumn(
        sheetIndex: number,
        tableIndex: number,
        colIndex: number,
        workbook: WorkbookJSON
    ): CellUpdate[] {
        const updates: CellUpdate[] = [];

        const sheet = workbook.sheets[sheetIndex];
        if (!sheet) return updates;

        const table = sheet.tables[tableIndex];
        if (!table) return updates;

        const formula = this.getFormulaForTable(table, colIndex);
        if (!formula) return updates;

        for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
            const newValue = this._evaluateFormulaForRow(formula, table, rowIndex, workbook);

            updates.push({
                sheetIndex,
                tableIndex,
                rowIndex,
                colIndex,
                value: newValue
            });
        }

        return updates;
    }

    /**
     * Evaluate a formula for a specific row.
     */
    private _evaluateFormulaForRow(
        formula: FormulaDefinition,
        table: TableJSON,
        rowIndex: number,
        workbook: WorkbookJSON
    ): string {
        const headers = table.headers || [];
        const rowData = formulaEvaluator.buildRowData(headers, table.rows[rowIndex]);

        if (formula.type === 'arithmetic') {
            const result = formulaEvaluator.evaluateArithmeticFormula(formula, rowData);
            return result.value;
        } else if (formula.type === 'lookup') {
            // Get the local join key value for lookup
            const localKeyValue = rowData[formula.joinKeyLocal] || '';
            const result = formulaEvaluator.evaluateLookup(formula, localKeyValue, workbook);
            return result.value;
        }

        return formulaEvaluator.NA_VALUE;
    }

    /**
     * Get formula for a specific table and column.
     */
    getFormulaForTable(table: TableJSON, colIndex: number): FormulaDefinition | null {
        const formulas = this.getFormulasFromTable(table);
        if (!formulas) return null;
        return formulas[colIndex.toString()] ?? null;
    }

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
        const metadata = table.metadata as TableMetadata | undefined;
        // Check metadata.visual.id first (where parser stores custom metadata)
        const visual = metadata?.visual;
        if (visual && typeof visual.id === 'number') {
            return visual.id;
        }
        // Fallback to metadata.id
        if (metadata && typeof metadata.id === 'number') {
            return metadata.id;
        }
        return undefined;
    }

    /**
     * Get formulas from table visual metadata.
     */
    private getFormulasFromTable(table: TableJSON): FormulaMetadata | null {
        const metadata = table.metadata as TableMetadata | undefined;
        if (!metadata) return null;

        const visual = metadata.visual;
        if (!visual) return null;

        return visual.formulas ?? null;
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
