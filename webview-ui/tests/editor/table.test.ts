/**
 * Table Service Tests
 *
 * Phase 1 test expansion for table.ts (997 lines, 32 functions)
 * Target: 80%+ coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    addTable,
    deleteTable,
    renameTable,
    updateTableMetadata,
    updateVisualMetadata,
    updateCell,
    insertRow,
    deleteRows,
    moveRows,
    sortRows,
    insertColumn,
    deleteColumns,
    moveColumns,
    clearColumns,
    updateColumnWidth,
    updateColumnFormat,
    updateColumnFilter,
    updateColumnAlign
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

const SIMPLE_MD = `# Tables

## Sheet 1

### Table 1

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;

describe('Table Service Tests', () => {
    beforeEach(() => {
        resetContext();
        initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
    });

    // =========================================================================
    // Table CRUD Operations
    // =========================================================================

    describe('Table CRUD', () => {
        it('should add a new table with default columns', () => {
            const result = addTable(0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables.length).toBe(2);
            expect(state.workbook.sheets[0].tables[1].name).toContain('New Table');
        });

        it('should add a new table with custom columns', () => {
            const result = addTable(0, ['Name', 'Age', 'City'], 'Employees');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const newTable = state.workbook.sheets[0].tables[1];
            expect(newTable.name).toBe('Employees');
            expect(newTable.headers).toEqual(['Name', 'Age', 'City']);
        });

        it('should delete a table', () => {
            // First add a table
            addTable(0);

            const state1 = JSON.parse(getState());
            expect(state1.workbook.sheets[0].tables.length).toBe(2);

            // Delete the second table
            const result = deleteTable(0, 1);
            expect(result.error).toBeUndefined();

            const state2 = JSON.parse(getState());
            expect(state2.workbook.sheets[0].tables.length).toBe(1);
        });

        it('should return error for invalid table index on delete', () => {
            const result = deleteTable(0, 99);
            expect(result.error).toBeDefined();
        });

        it('should rename a table', () => {
            const result = renameTable(0, 0, 'Renamed Table');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].name).toBe('Renamed Table');
        });

        it('should update table metadata', () => {
            const result = updateTableMetadata(0, 0, 'Updated Name', 'New Description');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.name).toBe('Updated Name');
            expect(table.description).toBe('New Description');
        });

        it('should update visual metadata', () => {
            const visual = { theme: 'dark', fontSize: 14 };
            const result = updateVisualMetadata(0, 0, visual);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.metadata.visual).toEqual(visual);
        });
    });

    // =========================================================================
    // Cell Operations
    // =========================================================================

    describe('Cell Operations', () => {
        it('should update a cell value', () => {
            const result = updateCell(0, 0, 0, 0, 'Updated');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('Updated');
        });

        it('should escape pipe characters in cell values', () => {
            const result = updateCell(0, 0, 0, 0, 'Value|With|Pipes');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('Value\\|With\\|Pipes');
        });

        it('should not escape pipes inside code backticks', () => {
            const result = updateCell(0, 0, 0, 0, '`code|here`');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Pipes inside backticks should remain unescaped
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('`code|here`');
        });

        it('should handle already escaped pipes', () => {
            const result = updateCell(0, 0, 0, 0, 'Already\\|escaped');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Should preserve already escaped pipes
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('Already\\|escaped');
        });

        it('should expand table if row index exceeds current rows', () => {
            const result = updateCell(0, 0, 5, 0, 'New Value');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows.length).toBeGreaterThanOrEqual(6);
        });

        it('should update header cell when rowIdx is -1', () => {
            // This is the column rename functionality
            const result = updateCell(0, 0, -1, 0, 'Renamed Column');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].headers[0]).toBe('Renamed Column');
        });

        it('should escape pipe characters in header cell values', () => {
            const result = updateCell(0, 0, -1, 1, 'Header|With|Pipes');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].headers[1]).toBe('Header\\|With\\|Pipes');
        });

        it('should return error for invalid column index on header edit', () => {
            const result = updateCell(0, 0, -1, 99, 'Invalid');
            expect(result.error).toBeDefined();
        });
    });

    // =========================================================================
    // Row Operations
    // =========================================================================

    describe('Row Operations', () => {
        it('should insert a row at the beginning', () => {
            const result = insertRow(0, 0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            expect(rows.length).toBe(3);
            expect(rows[0]).toEqual(['', '', '']);
        });

        it('should insert a row at the end', () => {
            const result = insertRow(0, 0, 2);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            expect(rows.length).toBe(3);
            expect(rows[2]).toEqual(['', '', '']);
        });

        it('should delete rows', () => {
            const result = deleteRows(0, 0, [0]);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            expect(rows.length).toBe(1);
            expect(rows[0]).toEqual(['4', '5', '6']);
        });

        it('should delete multiple rows in correct order', () => {
            // Add more rows first
            insertRow(0, 0, 2);
            insertRow(0, 0, 3);

            const result = deleteRows(0, 0, [0, 2]);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            // Original: [row0, row1, empty, empty] -> delete 0,2 -> [row1, empty]
            expect(rows.length).toBe(2);
        });

        it('should move rows down', () => {
            const result = moveRows(0, 0, [0], 2);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            // Row 0 [1,2,3] moved after row 1
            expect(rows[0]).toEqual(['4', '5', '6']);
            expect(rows[1]).toEqual(['1', '2', '3']);
        });

        it('should move rows up', () => {
            const result = moveRows(0, 0, [1], 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            // Row 1 [4,5,6] moved before row 0
            expect(rows[0]).toEqual(['4', '5', '6']);
            expect(rows[1]).toEqual(['1', '2', '3']);
        });

        it('should sort rows ascending', () => {
            const result = sortRows(0, 0, 0, true);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            // Sorted by column 0: 1, 4
            expect(rows[0][0]).toBe('1');
            expect(rows[1][0]).toBe('4');
        });

        it('should sort rows descending', () => {
            const result = sortRows(0, 0, 0, false);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const rows = state.workbook.sheets[0].tables[0].rows;
            // Sorted by column 0 descending: 4, 1
            expect(rows[0][0]).toBe('4');
            expect(rows[1][0]).toBe('1');
        });
    });

    // =========================================================================
    // Column Operations
    // =========================================================================

    describe('Column Operations', () => {
        it('should insert a column at the beginning', () => {
            const result = insertColumn(0, 0, 0, 'New Col');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.headers[0]).toBe('New Col');
            expect(table.headers.length).toBe(4);
            expect(table.rows[0][0]).toBe('');
        });

        it('should insert a column at the end', () => {
            const result = insertColumn(0, 0, 3, 'End Col');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.headers[3]).toBe('End Col');
            expect(table.headers.length).toBe(4);
        });

        it('should delete columns', () => {
            const result = deleteColumns(0, 0, [0]);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.headers).toEqual(['B', 'C']);
            expect(table.rows[0]).toEqual(['2', '3']);
        });

        it('should delete multiple columns', () => {
            const result = deleteColumns(0, 0, [0, 2]);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.headers).toEqual(['B']);
            expect(table.rows[0]).toEqual(['2']);
        });

        it('should move columns', () => {
            const result = moveColumns(0, 0, [0], 2);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            // Column A moved after B
            expect(table.headers).toEqual(['B', 'A', 'C']);
            expect(table.rows[0]).toEqual(['2', '1', '3']);
        });

        it('should clear columns', () => {
            const result = clearColumns(0, 0, [0, 1]);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.rows[0]).toEqual(['', '', '3']);
            expect(table.rows[1]).toEqual(['', '', '6']);
        });
    });

    // =========================================================================
    // Column Metadata Operations
    // =========================================================================

    describe('Column Metadata', () => {
        it('should update column width', () => {
            const result = updateColumnWidth(0, 0, 0, 150);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.metadata.visual.columns['0'].width).toBe(150);
        });

        it('should update column format', () => {
            const result = updateColumnFormat(0, 0, 0, { type: 'currency', prefix: '$' });
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.metadata.visual.columns['0'].format).toEqual({ type: 'currency', prefix: '$' });
        });

        it('should update column filter', () => {
            const result = updateColumnFilter(0, 0, 0, ['1', '4']);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.metadata.visual.filters['0']).toEqual(['1', '4']);
        });

        it('should update column alignment', () => {
            const result = updateColumnAlign(0, 0, 0, 'center');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const table = state.workbook.sheets[0].tables[0];
            expect(table.alignments[0]).toBe('center');
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle empty table name on add', () => {
            const result = addTable(0, null, null);
            expect(result.error).toBeUndefined();
        });

        it('should handle invalid sheet index', () => {
            const result = addTable(99);
            expect(result.error).toBeDefined();
        });

        it('should handle no rows to move', () => {
            const result = moveRows(0, 0, [], 0);
            expect(result.error).toBeUndefined();
        });

        it('should handle out of range row indices on delete', () => {
            const result = deleteRows(0, 0, [99, 100]);
            expect(result.error).toBeUndefined(); // Should silently ignore invalid indices
        });

        it('should handle out of range column indices on delete', () => {
            const result = deleteColumns(0, 0, [99]);
            expect(result.error).toBeUndefined(); // Should silently ignore invalid indices
        });
    });
});
