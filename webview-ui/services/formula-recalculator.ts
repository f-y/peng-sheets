/**
 * Formula Recalculator Service
 *
 * Handles calculation and recalculation of formula columns.
 * Extracted from main.ts for better modularity.
 */

import { WorkbookJSON } from '../types';
import { FormulaDefinition, ArithmeticFormula, LookupFormula, TableMetadata } from './types';
import { SpreadsheetService } from './spreadsheet-service';
import * as evaluator from '../utils/formula-evaluator';

/**
 * Update entry for a cell value change.
 */
interface CellUpdate {
    sheetIndex: number;
    tableIndex: number;
    rowIndex: number;
    colIndex: number;
    value: string;
}

/**
 * Formula task definition.
 */
interface FormulaTask {
    sheetIndex: number;
    tableIndex: number;
    colIndex: number;
    formula: FormulaDefinition;
}

/**
 * Collect all formula tasks from the workbook, separated by type.
 */
function collectFormulaTasks(workbook: WorkbookJSON): {
    lookupTasks: FormulaTask[];
    arithmeticTasks: FormulaTask[];
} {
    const lookupTasks: FormulaTask[] = [];
    const arithmeticTasks: FormulaTask[] = [];

    for (let sheetIndex = 0; sheetIndex < workbook.sheets.length; sheetIndex++) {
        const sheet = workbook.sheets[sheetIndex];
        for (let tableIndex = 0; tableIndex < sheet.tables.length; tableIndex++) {
            const table = sheet.tables[tableIndex];
            const meta = table.metadata as TableMetadata | undefined;
            const visual = meta?.visual;
            const formulas = visual?.formulas;

            if (!formulas || Object.keys(formulas).length === 0) continue;

            for (const [colKey, formula] of Object.entries(formulas)) {
                const colIndex = parseInt(colKey, 10);
                if (isNaN(colIndex)) continue;

                const task = { sheetIndex, tableIndex, colIndex, formula };
                if (formula.type === 'lookup') {
                    lookupTasks.push(task);
                } else if (formula.type === 'arithmetic') {
                    arithmeticTasks.push(task);
                }
            }
        }
    }

    return { lookupTasks, arithmeticTasks };
}

/**
 * Evaluate a single formula task for all rows.
 * @param checkForChanges If true, only add updates where value changed
 */
function evaluateTask(task: FormulaTask, workbook: WorkbookJSON, checkForChanges: boolean): CellUpdate[] {
    const updates: CellUpdate[] = [];
    const table = workbook.sheets[task.sheetIndex].tables[task.tableIndex];
    const headers = table.headers || [];

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const rowData = evaluator.buildRowData(headers, table.rows[rowIndex]);
        const currentValue = table.rows[rowIndex]?.[task.colIndex] ?? '';
        let newValue = evaluator.NA_VALUE;

        try {
            if (task.formula.type === 'arithmetic') {
                const arithmeticFormula = task.formula as ArithmeticFormula;
                const result = evaluator.evaluateArithmeticFormula(arithmeticFormula, rowData);
                newValue = result.value;
            } else if (task.formula.type === 'lookup') {
                const lookupFormula = task.formula as LookupFormula;
                const localKeyValue = rowData[lookupFormula.joinKeyLocal] || '';
                const result = evaluator.evaluateLookup(lookupFormula, localKeyValue, workbook);
                newValue = result.value;
            }
        } catch {
            newValue = evaluator.NA_VALUE;
        }

        // Add update if not checking for changes, or if value changed
        if (!checkForChanges || newValue !== currentValue) {
            // Update in-memory immediately for cascade
            if (table.rows[rowIndex]) {
                table.rows[rowIndex][task.colIndex] = newValue;
            }
            updates.push({
                sheetIndex: task.sheetIndex,
                tableIndex: task.tableIndex,
                rowIndex,
                colIndex: task.colIndex,
                value: newValue
            });
        }
    }

    return updates;
}

/**
 * Process tasks in 2-pass order (Lookup first, then Arithmetic).
 * @param checkForChanges If true, only collect updates where value changed
 */
function processTasks(
    lookupTasks: FormulaTask[],
    arithmeticTasks: FormulaTask[],
    workbook: WorkbookJSON,
    checkForChanges: boolean
): CellUpdate[] {
    const updates: CellUpdate[] = [];

    // Pass 1: Lookup formulas
    for (const task of lookupTasks) {
        updates.push(...evaluateTask(task, workbook, checkForChanges));
    }

    // Pass 2: Arithmetic formulas (may depend on Lookup results)
    for (const task of arithmeticTasks) {
        updates.push(...evaluateTask(task, workbook, checkForChanges));
    }

    return updates;
}

/**
 * Recalculate all formula columns in the entire workbook.
 * Only updates cells whose values have changed.
 * Called automatically after any data-modifying operation via SpreadsheetService callback.
 *
 * @param workbook The workbook JSON to recalculate
 * @param spreadsheetService The service to sync updates
 * @param requestUpdate Callback to trigger UI update
 * @param withinBatch If true, caller manages batch - skip startBatch/endBatch calls
 */
export function recalculateAllFormulas(
    workbook: WorkbookJSON | null,
    spreadsheetService: SpreadsheetService,
    requestUpdate: () => void,
    withinBatch: boolean = false
): void {
    if (!workbook) return;

    const { lookupTasks, arithmeticTasks } = collectFormulaTasks(workbook);

    // Skip if no formulas to recalculate
    if (lookupTasks.length === 0 && arithmeticTasks.length === 0) return;

    // Process with change detection
    const updates = processTasks(lookupTasks, arithmeticTasks, workbook, true);

    // If any values changed, sync to VSCode
    if (updates.length > 0) {
        // Only manage batch if not already within one
        if (!withinBatch) {
            spreadsheetService.startBatch();
        }
        try {
            for (const update of updates) {
                spreadsheetService.updateRangeBatch(
                    update.sheetIndex,
                    update.tableIndex,
                    update.rowIndex,
                    update.colIndex,
                    update.value
                );
            }
        } finally {
            if (!withinBatch) {
                spreadsheetService.endBatch();
            }
        }

        // Trigger UI update
        requestUpdate();
    }
}

/**
 * Calculate all formula column values on initial workbook load.
 * Does not check for changes - always calculates and syncs all values.
 * Uses 2-pass approach: Lookup formulas first, then Arithmetic.
 *
 * @param workbook The workbook JSON to calculate
 * @param spreadsheetService The service to sync updates
 * @param requestUpdate Callback to trigger UI update
 */
export function calculateAllFormulas(
    workbook: WorkbookJSON | null,
    spreadsheetService: SpreadsheetService,
    requestUpdate: () => void
): void {
    if (!workbook) return;

    const { lookupTasks, arithmeticTasks } = collectFormulaTasks(workbook);

    // Skip if no formulas
    if (lookupTasks.length === 0 && arithmeticTasks.length === 0) return;

    // Process without change detection (always calculate all)
    const updates = processTasks(lookupTasks, arithmeticTasks, workbook, false);

    // Trigger UI update immediately
    requestUpdate();

    // Sync to VSCode document with a delay to ensure editor is ready
    if (updates.length > 0) {
        setTimeout(() => {
            spreadsheetService.startBatch();
            try {
                for (const update of updates) {
                    spreadsheetService.updateRangeBatch(
                        update.sheetIndex,
                        update.tableIndex,
                        update.rowIndex,
                        update.colIndex,
                        update.value
                    );
                }
            } finally {
                spreadsheetService.endBatch();
            }
        }, 100); // Small delay to allow editor initialization
    }
}
