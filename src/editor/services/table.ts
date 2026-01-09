/**
 * Table service - Table and cell-level operations.
 * Converted from python-modules/src/md_spreadsheet_editor/services/table.py
 */

import { Table, Sheet } from 'md-spreadsheet-parser';
import type { EditorContext } from '../context';
import type { UpdateResult, CellRange, ColumnMetadata } from '../types';
import { applySheetUpdate } from './workbook';

// =============================================================================
// Table CRUD Operations
// =============================================================================

/**
 * Add a new table to a sheet.
 */
export function addTable(
    context: EditorContext,
    sheetIdx: number,
    columnNames: string[] | null = null,
    tableName: string | null = null
): UpdateResult {
    const cols = columnNames ?? ['Column 1', 'Column 2', 'Column 3'];

    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        const finalName = tableName ?? `New Table ${newTables.length + 1}`;
        const newTable = new Table({
            name: finalName,
            description: '',
            headers: cols,
            rows: [cols.map(() => '')],
            metadata: {}
        });
        newTables.push(newTable);
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Delete a table from a sheet.
 */
export function deleteTable(context: EditorContext, sheetIdx: number, tableIdx: number): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        newTables.splice(tableIdx, 1);
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Rename a table.
 */
export function renameTable(context: EditorContext, sheetIdx: number, tableIdx: number, newName: string): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        newTables[tableIdx] = new Table({ ...targetTable, name: newName });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Update table name and description.
 */
export function updateTableMetadata(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    newName: string,
    newDescription: string
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        newTables[tableIdx] = new Table({
            ...targetTable,
            name: newName,
            description: newDescription
        });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Update visual metadata for a table.
 */
export function updateVisualMetadata(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    visualMetadata: Record<string, unknown>
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const metadata = { ...(targetTable.metadata || {}), visual: visualMetadata };
        newTables[tableIdx] = new Table({ ...targetTable, metadata });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

// =============================================================================
// Cell Operations
// =============================================================================

/**
 * Escape pipe characters for GFM table cells.
 */
function escapePipe(value: string): string {
    if (!value || !value.includes('|')) {
        return value;
    }

    const result: string[] = [];
    let inCode = false;
    let i = 0;

    while (i < value.length) {
        const char = value[i];

        if (char === '`') {
            inCode = !inCode;
            result.push(char);
            i++;
        } else if (char === '\\' && i + 1 < value.length) {
            // Already escaped, keep as is
            result.push(char);
            result.push(value[i + 1]);
            i += 2;
        } else if (char === '|' && !inCode) {
            // Escape the pipe
            result.push('\\|');
            i++;
        } else {
            result.push(char);
            i++;
        }
    }

    return result.join('');
}

/**
 * Update a cell value.
 */
export function updateCell(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    rowIdx: number,
    colIdx: number,
    value: string
): UpdateResult {
    const escapedValue = escapePipe(value);

    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];

        // Ensure rows array has enough rows
        const newRows = [...targetTable.rows];
        while (newRows.length <= rowIdx) {
            newRows.push(targetTable.headers.map(() => ''));
        }

        // Ensure row has enough columns
        const row = [...newRows[rowIdx]];
        while (row.length <= colIdx) {
            row.push('');
        }

        // Update the cell value
        row[colIdx] = escapedValue;
        newRows[rowIdx] = row;

        const newTable = new Table({ ...targetTable, rows: newRows });
        newTables[tableIdx] = newTable;
        return new Sheet({ ...sheet, tables: newTables });
    });
}

// =============================================================================
// Row Operations
// =============================================================================

/**
 * Insert a new row at the specified index.
 */
export function insertRow(context: EditorContext, sheetIdx: number, tableIdx: number, rowIdx: number): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const emptyRow = targetTable.headers.map(() => '');
        const newRows = [...targetTable.rows];
        const insertPos = Math.max(0, Math.min(rowIdx, newRows.length));
        newRows.splice(insertPos, 0, emptyRow);
        newTables[tableIdx] = new Table({ ...targetTable, rows: newRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Delete rows at the specified indices.
 */
export function deleteRows(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    rowIndices: number[]
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const newRows = [...targetTable.rows];

        // Sort indices in descending order to avoid shifting issues
        const sortedIndices = [...rowIndices].sort((a, b) => b - a);
        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < newRows.length) {
                newRows.splice(idx, 1);
            }
        }

        newTables[tableIdx] = new Table({ ...targetTable, rows: newRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Move rows to a new position.
 */
export function moveRows(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    rowIndices: number[],
    targetIndex: number
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const currentRows = [...targetTable.rows];

        // Identify rows to move
        const uniqueIndices = [...new Set(rowIndices)].sort((a, b) => a - b);
        const rowsToMove: Array<[number, string[]]> = [];
        for (const idx of uniqueIndices) {
            if (idx >= 0 && idx < currentRows.length) {
                rowsToMove.push([idx, currentRows[idx]]);
            }
        }

        if (!rowsToMove.length) {
            return sheet;
        }

        const movingRowsMap = new Map(rowsToMove);
        const stayingRows: string[][] = [];
        for (let i = 0; i < currentRows.length; i++) {
            if (!movingRowsMap.has(i)) {
                stayingRows.push(currentRows[i]);
            }
        }

        // Determine insertion point
        let insertIdxInStaying = 0;
        for (let i = 0; i < targetIndex; i++) {
            if (!movingRowsMap.has(i)) {
                insertIdxInStaying++;
            }
        }

        const toInsert = rowsToMove.map(([, row]) => row);
        const finalRows = [...stayingRows];
        finalRows.splice(insertIdxInStaying, 0, ...toInsert);

        newTables[tableIdx] = new Table({ ...targetTable, rows: finalRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Infer column type from data.
 */
function inferColumnType(rows: string[][], colIdx: number, metadata: Record<string, unknown>): string {
    // Check Metadata for explicit type
    const visual = metadata.visual as Record<string, unknown> | undefined;
    if (visual && visual.columns) {
        const columns = visual.columns as Record<string, ColumnMetadata>;
        const colMeta = columns[String(colIdx)];
        if (colMeta && colMeta.type) {
            return colMeta.type;
        }
    }

    // Heuristic: Check if all non-empty values are numeric
    let isNumber = true;
    let hasValue = false;

    for (const row of rows) {
        if (colIdx >= row.length) continue;
        const val = row[colIdx].trim();
        if (!val) continue;

        hasValue = true;
        const valClean = val.replace(/,/g, '');
        if (isNaN(parseFloat(valClean))) {
            isNumber = false;
            break;
        }
    }

    if (hasValue && isNumber) {
        return 'number';
    }

    return 'string';
}

/**
 * Get sort key for a row value.
 */
function getSortKey(row: string[], colIdx: number, colType: string): number | string {
    const val = colIdx < row.length ? row[colIdx] : '';

    if (colType === 'number') {
        const s = val.trim();
        if (!s) {
            return -Infinity;
        }
        const num = parseFloat(s.replace(/,/g, ''));
        return isNaN(num) ? -Infinity : num;
    }

    return val.toLowerCase();
}

/**
 * Sort rows by a column.
 */
export function sortRows(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    ascending: boolean
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const rows = [...targetTable.rows];
        const metadata = targetTable.metadata || {};

        const colType = inferColumnType(rows, colIdx, metadata);

        rows.sort((a, b) => {
            const keyA = getSortKey(a, colIdx, colType);
            const keyB = getSortKey(b, colIdx, colType);

            if (typeof keyA === 'number' && typeof keyB === 'number') {
                return ascending ? keyA - keyB : keyB - keyA;
            }
            const strA = String(keyA);
            const strB = String(keyB);
            return ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });

        newTables[tableIdx] = new Table({ ...targetTable, rows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

// =============================================================================
// Column Operations
// =============================================================================

/**
 * Shift column-based metadata keys.
 */
function shiftColumnMetadata(
    metadata: Record<string, unknown>,
    shiftMap: Map<number, number | null>
): Record<string, unknown> {
    if (!metadata) return {};

    const newMetadata = { ...metadata };

    const shiftDict = (sourceDict: Record<string, unknown>): Record<string, unknown> => {
        if (!sourceDict) return {};
        const newDict: Record<string, unknown> = {};

        for (const [k, v] of Object.entries(sourceDict)) {
            const idx = parseInt(k, 10);
            if (!isNaN(idx)) {
                if (shiftMap.has(idx)) {
                    const newIdx = shiftMap.get(idx);
                    if (newIdx !== null) {
                        newDict[String(newIdx)] = v;
                    }
                } else {
                    newDict[k] = v;
                }
            } else {
                newDict[k] = v;
            }
        }
        return newDict;
    };

    // Shift validation
    if (newMetadata.validation) {
        newMetadata.validation = shiftDict(newMetadata.validation as Record<string, unknown>);
    }

    // Shift visual
    if (newMetadata.visual) {
        const visual = { ...(newMetadata.visual as Record<string, unknown>) };

        if (visual.validation) {
            visual.validation = shiftDict(visual.validation as Record<string, unknown>);
        }
        if (visual.columns) {
            visual.columns = shiftDict(visual.columns as Record<string, unknown>);
        }
        if (visual.filters) {
            visual.filters = shiftDict(visual.filters as Record<string, unknown>);
        }

        newMetadata.visual = visual;
    }

    return newMetadata;
}

/**
 * Insert a column.
 */
export function insertColumn(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    columnName = 'New Column'
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];

        const newHeaders = [...targetTable.headers];
        const insertPos = Math.max(0, Math.min(colIdx, newHeaders.length));
        newHeaders.splice(insertPos, 0, columnName);

        const newRows = targetTable.rows.map((row: string[]) => {
            const newRow = [...row];
            while (newRow.length < targetTable.headers.length) {
                newRow.push('');
            }
            newRow.splice(insertPos, 0, '');
            return newRow;
        });

        // Shift Metadata
        const colCount = targetTable.headers.length;
        const shiftMap = new Map<number, number | null>();
        for (let i = 0; i < colCount; i++) {
            shiftMap.set(i, i >= insertPos ? i + 1 : i);
        }

        let newTable = new Table({ ...targetTable, headers: newHeaders, rows: newRows });
        if (targetTable.metadata) {
            const newMeta = shiftColumnMetadata(targetTable.metadata, shiftMap);
            newTable = new Table({ ...newTable, metadata: newMeta });
        }

        newTables[tableIdx] = newTable;
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Delete columns.
 */
export function deleteColumns(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIndices: number[]
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];

        const sortedIndices = [...colIndices].sort((a, b) => b - a);
        const newHeaders = [...targetTable.headers];

        for (const idx of sortedIndices) {
            if (idx >= 0 && idx < newHeaders.length) {
                newHeaders.splice(idx, 1);
            }
        }

        const newRows = targetTable.rows.map((row: string[]) => {
            const newRow = [...row];
            while (newRow.length < targetTable.headers.length) {
                newRow.push('');
            }
            for (const idx of sortedIndices) {
                if (idx >= 0 && idx < newRow.length) {
                    newRow.splice(idx, 1);
                }
            }
            return newRow;
        });

        // Shift Metadata
        const deletedSet = new Set(sortedIndices);
        const colCount = targetTable.headers.length;
        const shiftMap = new Map<number, number | null>();
        let targetPos = 0;
        for (let i = 0; i < colCount; i++) {
            if (deletedSet.has(i)) {
                shiftMap.set(i, null);
            } else {
                shiftMap.set(i, targetPos);
                targetPos++;
            }
        }

        let newTable = new Table({ ...targetTable, headers: newHeaders, rows: newRows });
        if (targetTable.metadata) {
            const newMeta = shiftColumnMetadata(targetTable.metadata, shiftMap);
            newTable = new Table({ ...newTable, metadata: newMeta });
        }

        newTables[tableIdx] = newTable;
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Move columns to a new position.
 */
export function moveColumns(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIndices: number[],
    targetIndex: number
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const headers = [...targetTable.headers];
        const rows = targetTable.rows.map((r: string[]) => [...r]);

        const reorderList = <T>(items: T[]): T[] => {
            const uniqueIndices = [...new Set(colIndices)].sort((a, b) => a - b);
            const movingMap = new Map<number, T>();
            for (const idx of uniqueIndices) {
                if (idx >= 0 && idx < items.length) {
                    movingMap.set(idx, items[idx]);
                }
            }

            if (!movingMap.size) return items;

            const staying: T[] = [];
            for (let i = 0; i < items.length; i++) {
                if (!movingMap.has(i)) {
                    staying.push(items[i]);
                }
            }

            let insertIdx = 0;
            for (let i = 0; i < targetIndex; i++) {
                if (!movingMap.has(i)) {
                    insertIdx++;
                }
            }

            const toMove = uniqueIndices.filter((i) => movingMap.has(i)).map((i) => movingMap.get(i)!);
            const final = [...staying];
            final.splice(insertIdx, 0, ...toMove);
            return final;
        };

        const newHeaders = reorderList(headers);
        const newRows = rows.map((row: string[]) => {
            while (row.length < headers.length) {
                row.push('');
            }
            return reorderList(row);
        });

        // Build shift map
        const colsIndicesArr = Array.from({ length: headers.length }, (_, i) => i);
        const newIndices = reorderList(colsIndicesArr);
        const shiftMap = new Map<number, number | null>();
        newIndices.forEach((oldIdx, newPos) => {
            shiftMap.set(oldIdx, newPos);
        });

        let newTable = new Table({ ...targetTable, headers: newHeaders, rows: newRows });
        if (targetTable.metadata) {
            const newMeta = shiftColumnMetadata(targetTable.metadata, shiftMap);
            newTable = new Table({ ...newTable, metadata: newMeta });
        }

        newTables[tableIdx] = newTable;
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Clear columns (set values to empty string).
 */
export function clearColumns(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIndices: number[]
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const indicesSet = new Set(colIndices);

        const newRows = targetTable.rows.map((row: string[]) => {
            const newRow = [...row];
            for (let i = 0; i < newRow.length; i++) {
                if (indicesSet.has(i)) {
                    newRow[i] = '';
                }
            }
            return newRow;
        });

        newTables[tableIdx] = new Table({ ...targetTable, rows: newRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Helper to update column metadata.
 */
function updateColumnMetadataHelper(table: Table, colIdx: number, key: string, value: unknown): Table {
    const metadata = { ...(table.metadata || {}) };
    const visual = { ...((metadata.visual as Record<string, unknown>) || {}) };
    const columns = { ...((visual.columns as Record<string, unknown>) || {}) };

    const colStr = String(colIdx);
    const colMeta = { ...((columns[colStr] as Record<string, unknown>) || {}) };
    colMeta[key] = value;
    columns[colStr] = colMeta;
    visual.columns = columns;
    metadata.visual = visual;

    return new Table({ ...table, metadata });
}

/**
 * Update column width.
 */
export function updateColumnWidth(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    width: number
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        newTables[tableIdx] = updateColumnMetadataHelper(newTables[tableIdx], colIdx, 'width', width);
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Update column format.
 */
export function updateColumnFormat(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    fmt: unknown
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        newTables[tableIdx] = updateColumnMetadataHelper(newTables[tableIdx], colIdx, 'format', fmt);
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Update column filter.
 */
export function updateColumnFilter(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    hiddenValues: string[]
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const metadata = { ...(targetTable.metadata || {}) };
        const visual = { ...((metadata.visual as Record<string, unknown>) || {}) };
        const filters = { ...((visual.filters as Record<string, string[]>) || {}) };
        filters[String(colIdx)] = hiddenValues;
        visual.filters = filters;
        metadata.visual = visual;
        newTables[tableIdx] = new Table({ ...targetTable, metadata });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Update column alignment.
 */
export function updateColumnAlign(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    colIdx: number,
    align: 'left' | 'center' | 'right'
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];
        const alignments = [...(targetTable.alignments || [])];

        const numCols = targetTable.headers.length;
        while (alignments.length < numCols) {
            alignments.push('left');
        }

        if (colIdx >= 0 && colIdx < alignments.length) {
            alignments[colIdx] = align;
        }

        newTables[tableIdx] = new Table({ ...targetTable, alignments });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

// =============================================================================
// Bulk Operations
// =============================================================================

/**
 * Paste cells starting at a specific position.
 */
export function pasteCells(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    startRow: number,
    startCol: number,
    newData: string[][],
    includeHeaders = false
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];

        let pasteData = [...newData];
        const newHeaders = [...(targetTable.headers || [])];

        // Handle headers from first row of paste data
        if (includeHeaders && pasteData.length > 0) {
            const headerRow = pasteData[0];
            pasteData = pasteData.slice(1);

            for (let cOffset = 0; cOffset < headerRow.length; cOffset++) {
                const targetC = startCol + cOffset;
                while (newHeaders.length <= targetC) {
                    newHeaders.push(`Col ${newHeaders.length + 1}`);
                }
                newHeaders[targetC] = headerRow[cOffset];
            }
        }

        const currentRows = targetTable.rows.map((r: string[]) => [...r]);
        const rowsToPaste = pasteData.length;

        if (rowsToPaste === 0 && !includeHeaders) {
            return sheet;
        }

        // Max columns in pasted data
        let colsToPaste = 0;
        for (const row of pasteData) {
            colsToPaste = Math.max(colsToPaste, row.length);
        }

        // Expand rows
        const neededRows = startRow + rowsToPaste;
        const baseWidth = Math.max(newHeaders.length, currentRows[0]?.length || 0);
        while (currentRows.length < neededRows) {
            currentRows.push(Array(baseWidth).fill(''));
        }

        // Update data & expand columns
        const maxColsNeeded = startCol + colsToPaste;
        for (let rOffset = 0; rOffset < pasteData.length; rOffset++) {
            const targetR = startRow + rOffset;
            while (currentRows[targetR].length < maxColsNeeded) {
                currentRows[targetR].push('');
            }
            for (let cOffset = 0; cOffset < pasteData[rOffset].length; cOffset++) {
                const targetC = startCol + cOffset;
                currentRows[targetR][targetC] = escapePipe(pasteData[rOffset][cOffset]);
            }
        }

        // Homogenize row lengths and headers
        let globalMaxWidth = 0;
        for (const r of currentRows) {
            globalMaxWidth = Math.max(globalMaxWidth, r.length);
        }
        globalMaxWidth = Math.max(globalMaxWidth, newHeaders.length);

        for (const r of currentRows) {
            while (r.length < globalMaxWidth) {
                r.push('');
            }
        }
        while (newHeaders.length < globalMaxWidth) {
            newHeaders.push(`Col ${newHeaders.length + 1}`);
        }

        newTables[tableIdx] = new Table({ ...targetTable, headers: newHeaders, rows: currentRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}

/**
 * Move cells from source range to destination.
 */
export function moveCells(
    context: EditorContext,
    sheetIdx: number,
    tableIdx: number,
    srcRange: CellRange,
    destRow: number,
    destCol: number
): UpdateResult {
    return applySheetUpdate(context, sheetIdx, (sheet) => {
        const newTables = [...(sheet.tables ?? [])];
        if (tableIdx < 0 || tableIdx >= newTables.length) {
            throw new Error('Invalid table index');
        }
        const targetTable = newTables[tableIdx];

        const { minR, maxR, minC, maxC } = srcRange;

        // Check for no-op
        if (minR === destRow && minC === destCol) {
            return sheet;
        }

        const currentRows = targetTable.rows.map((r: string[]) => [...r]);

        // Extract source data
        const srcData: string[][] = [];
        for (let r = minR; r <= maxR; r++) {
            const rowData: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                if (r < currentRows.length && c < currentRows[r].length) {
                    rowData.push(currentRows[r][c]);
                } else {
                    rowData.push('');
                }
            }
            srcData.push(rowData);
        }

        const height = maxR - minR + 1;
        const width = maxC - minC + 1;

        // Expand grid if needed for destination
        const neededRows = destRow + height;
        const numCols = targetTable.headers.length || currentRows[0]?.length || 0;
        const neededCols = destCol + width;

        while (currentRows.length < neededRows) {
            currentRows.push(Array(numCols).fill(''));
        }

        for (const row of currentRows) {
            while (row.length < neededCols) {
                row.push('');
            }
        }

        // Clear source cells
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (r < currentRows.length && c < currentRows[r].length) {
                    currentRows[r][c] = '';
                }
            }
        }

        // Place at destination
        for (let rOff = 0; rOff < srcData.length; rOff++) {
            for (let cOff = 0; cOff < srcData[rOff].length; cOff++) {
                currentRows[destRow + rOff][destCol + cOff] = srcData[rOff][cOff];
            }
        }

        newTables[tableIdx] = new Table({ ...targetTable, rows: currentRows });
        return new Sheet({ ...sheet, tables: newTables });
    });
}
