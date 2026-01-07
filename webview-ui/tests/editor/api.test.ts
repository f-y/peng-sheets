/**
 * API Layer Tests - Verifying TypeScript implementation matches Python behavior.
 *
 * These tests mirror the Python tests in test_api.py to ensure parity.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    addSheet,
    renameSheet,
    deleteSheet,
    moveSheet,
    updateCell,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    addTable,
    deleteTable,
    renameTable,
    sortRows,
    pasteCells,
    addDocument,
    renameDocument,
    deleteDocument,
    generateAndGetRange,
} from '../../../src/editor';

// Sample markdown for testing
const SAMPLE_MD = `# Tables

## Sheet 1

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

describe('Editor API', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('initializeWorkbook', () => {
        it('should parse markdown and create workbook', () => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
            const stateJson = getState();
            const state = JSON.parse(stateJson);

            expect(state.workbook).not.toBeNull();
            expect(state.workbook.sheets).toHaveLength(1);
            expect(state.workbook.sheets[0].name).toBe('Sheet 1');
        });

        it('should handle empty markdown', () => {
            initializeWorkbook('', SAMPLE_CONFIG);
            const stateJson = getState();
            const state = JSON.parse(stateJson);

            expect(state.workbook).not.toBeNull();
        });
    });

    describe('Sheet Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should add a new sheet', () => {
            const result = addSheet('New Sheet');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets).toHaveLength(2);
            expect(state.workbook.sheets[1].name).toBe('New Sheet');
        });

        it('should rename a sheet', () => {
            const result = renameSheet(0, 'Renamed Sheet');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Renamed Sheet');
        });

        it('should delete a sheet', () => {
            addSheet('Sheet 2');
            const result = deleteSheet(0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets).toHaveLength(1);
            expect(state.workbook.sheets[0].name).toBe('Sheet 2');
        });

        it('should move a sheet', () => {
            addSheet('Sheet 2');
            addSheet('Sheet 3');

            const result = moveSheet(0, 2);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Sheet 2');
            expect(state.workbook.sheets[2].name).toBe('Sheet 1');
        });
    });

    describe('Cell Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should update a cell', () => {
            const result = updateCell(0, 0, 0, 0, 'Updated Value');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('Updated Value');
        });

        it('should insert a row', () => {
            const result = insertRow(0, 0, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows).toHaveLength(3);
            expect(state.workbook.sheets[0].tables[0].rows[1]).toEqual(['', '', '']);
        });

        it('should delete a row', () => {
            const result = deleteRow(0, 0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows).toHaveLength(1);
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('4');
        });
    });

    describe('Column Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should insert a column', () => {
            const result = insertColumn(0, 0, 1, 'New Col');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].headers).toHaveLength(4);
            expect(state.workbook.sheets[0].tables[0].headers[1]).toBe('New Col');
        });

        it('should delete a column', () => {
            const result = deleteColumn(0, 0, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].headers).toHaveLength(2);
            expect(state.workbook.sheets[0].tables[0].headers).toEqual(['A', 'C']);
        });
    });

    describe('Table Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should add a table', () => {
            const result = addTable(0, ['X', 'Y'], 'New Table');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables).toHaveLength(2);
        });

        it('should delete a table', () => {
            addTable(0, ['X', 'Y'], 'Table 2');
            const result = deleteTable(0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables).toHaveLength(1);
        });

        it('should rename a table', () => {
            const result = renameTable(0, 0, 'Renamed Table');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].name).toBe('Renamed Table');
        });
    });

    describe('Sort Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should sort rows ascending', () => {
            // First row has "1", second has "4"
            const result = sortRows(0, 0, 0, true);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Sorted ascending: 1, 4
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('1');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('4');
        });

        it('should sort rows descending', () => {
            const result = sortRows(0, 0, 0, false);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Sorted descending: 4, 1
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('4');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('1');
        });
    });

    describe('Bulk Operations', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should paste cells', () => {
            const pasteData = [
                ['X', 'Y'],
                ['Z', 'W'],
            ];
            const result = pasteCells(0, 0, 0, 0, pasteData);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('X');
            expect(state.workbook.sheets[0].tables[0].rows[0][1]).toBe('Y');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('Z');
            expect(state.workbook.sheets[0].tables[0].rows[1][1]).toBe('W');
        });
    });

    describe('Generate Markdown', () => {
        beforeEach(() => {
            initializeWorkbook(SAMPLE_MD, SAMPLE_CONFIG);
        });

        it('should generate markdown for workbook', () => {
            const result = generateAndGetRange();

            expect(result.error).toBeUndefined();
            expect(result.content).toBeDefined();
            expect(result.content).toContain('## Sheet 1');
            expect(result.content).toContain('| A | B | C |');
        });
    });
});

describe('Document Operations', () => {
    const HYBRID_MD = `# My Document

Some content here.

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

# Another Document

More content.
`;

    beforeEach(() => {
        resetContext();
        initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
    });

    it('should add a document section', () => {
        const result = addDocument('New Doc');
        expect(result.error).toBeUndefined();
        expect(result.file_changed).toBe(true);
    });

    it('should rename a document section', () => {
        const result = renameDocument(0, 'Renamed Document');
        expect(result.error).toBeUndefined();
        expect(result.content).toContain('# Renamed Document');
    });

    it('should delete a document section', () => {
        const result = deleteDocument(0);
        expect(result.error).toBeUndefined();
        expect(result.content).not.toContain('# My Document');
    });
});
