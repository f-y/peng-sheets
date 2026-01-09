/**
 * Python-TypeScript Parity Tests
 *
 * These tests verify that the TypeScript implementation produces
 * identical output to the Python implementation for critical operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    updateCell,
    insertRow,
    deleteRows,
    moveRows,
    insertColumn,
    deleteColumns,
    moveColumns,
    sortRows,
    pasteCells,
    moveCells,
    addSheet,
    generateAndGetRange
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('Python-TypeScript Parity Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Pipe Escape Handling', () => {
        const MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
`;

        it('should escape pipe characters in cell values', () => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
            const result = updateCell(0, 0, 0, 0, 'value|with|pipes');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Pipes should be escaped
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('value\\|with\\|pipes');
        });

        it('should not escape pipes inside backticks', () => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
            const result = updateCell(0, 0, 0, 0, '`code|here`');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Pipes inside backticks should remain unescaped
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('`code|here`');
        });
    });

    describe('Row Operations', () => {
        const MD = `# Tables

## Sheet 1

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
| 7 | 8 | 9 |
`;

        beforeEach(() => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
        });

        it('should insert row at correct position', () => {
            insertRow(0, 0, 1);
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].rows).toHaveLength(4);
            expect(state.workbook.sheets[0].tables[0].rows[1]).toEqual(['', '', '']);
        });

        it('should delete multiple rows', () => {
            deleteRows(0, 0, [0, 2]);
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].rows).toHaveLength(1);
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('4');
        });

        it('should move rows correctly (insert before semantics)', () => {
            // Move row 0 to position 2 (after row 1)
            moveRows(0, 0, [0], 2);
            const state = JSON.parse(getState());

            // Row "1,2,3" should now be at position 1
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('4');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('1');
            expect(state.workbook.sheets[0].tables[0].rows[2][0]).toBe('7');
        });

        it('should sort numeric columns correctly', () => {
            // Add a row with mixed values to test numeric sorting
            updateCell(0, 0, 0, 0, '10');
            updateCell(0, 0, 1, 0, '2');
            updateCell(0, 0, 2, 0, '100');

            sortRows(0, 0, 0, true);
            const state = JSON.parse(getState());

            // Numeric sort: 2, 10, 100 (not string sort: 10, 100, 2)
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('2');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('10');
            expect(state.workbook.sheets[0].tables[0].rows[2][0]).toBe('100');
        });

        it('should handle empty values in sort (-infinity for invalids)', () => {
            updateCell(0, 0, 0, 0, '');
            updateCell(0, 0, 1, 0, '5');
            updateCell(0, 0, 2, 0, '3');

            sortRows(0, 0, 0, true);
            const state = JSON.parse(getState());

            // Empty values should sort to beginning (as -infinity)
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('');
            expect(state.workbook.sheets[0].tables[0].rows[1][0]).toBe('3');
            expect(state.workbook.sheets[0].tables[0].rows[2][0]).toBe('5');
        });
    });

    describe('Column Operations', () => {
        const MD = `# Tables

## Sheet 1

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;

        beforeEach(() => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
        });

        it('should insert column at correct position', () => {
            insertColumn(0, 0, 1, 'New');
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].headers).toEqual(['A', 'New', 'B', 'C']);
            expect(state.workbook.sheets[0].tables[0].rows[0]).toEqual(['1', '', '2', '3']);
        });

        it('should delete multiple columns', () => {
            deleteColumns(0, 0, [0, 2]);
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].headers).toEqual(['B']);
            expect(state.workbook.sheets[0].tables[0].rows[0]).toEqual(['2']);
        });

        it('should move columns correctly', () => {
            moveColumns(0, 0, [0], 2);
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].headers).toEqual(['B', 'A', 'C']);
            expect(state.workbook.sheets[0].tables[0].rows[0]).toEqual(['2', '1', '3']);
        });
    });

    describe('Bulk Operations', () => {
        const MD = `# Tables

## Sheet 1

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;

        beforeEach(() => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
        });

        it('should paste cells and expand grid if needed', () => {
            const pasteData = [['X', 'Y', 'Z', 'W']];
            pasteCells(0, 0, 0, 0, pasteData);
            const state = JSON.parse(getState());

            // Grid should expand to 4 columns
            expect(state.workbook.sheets[0].tables[0].headers.length).toBeGreaterThanOrEqual(4);
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('X');
            expect(state.workbook.sheets[0].tables[0].rows[0][3]).toBe('W');
        });

        it('should paste cells and expand rows if needed', () => {
            const pasteData = [['A1'], ['A2'], ['A3'], ['A4']];
            pasteCells(0, 0, 0, 0, pasteData);
            const state = JSON.parse(getState());

            expect(state.workbook.sheets[0].tables[0].rows.length).toBeGreaterThanOrEqual(4);
        });

        it('should move cells correctly', () => {
            const srcRange = { minR: 0, maxR: 0, minC: 0, maxC: 0 };
            moveCells(0, 0, srcRange, 1, 1);
            const state = JSON.parse(getState());

            // Original cell should be empty
            expect(state.workbook.sheets[0].tables[0].rows[0][0]).toBe('');
            // Destination should have the value
            expect(state.workbook.sheets[0].tables[0].rows[1][1]).toBe('1');
        });
    });

    describe('Markdown Generation', () => {
        const MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
`;

        it('should generate valid markdown', () => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
            const result = generateAndGetRange();

            expect(result.error).toBeUndefined();
            expect(result.content).toContain('## Sheet 1');
            expect(result.content).toContain('| A | B |');
            expect(result.content).toContain('| 1 | 2 |');
        });

        it('should preserve data after round-trip', () => {
            initializeWorkbook(MD, SAMPLE_CONFIG);
            addSheet('Sheet 2', ['X', 'Y']);
            updateCell(1, 0, 0, 0, 'test value');

            const result = generateAndGetRange();
            expect(result.content).toContain('## Sheet 2');
            expect(result.content).toContain('test value');
        });
    });

    describe('Structure Parsing', () => {
        const HYBRID_MD = `# Introduction

Some document content.

\`\`\`
# This is not a header (code block)
\`\`\`

# Tables

## Sheet 1

| A |
|---|
| 1 |

# Conclusion

More content.
`;

        it('should ignore headers inside code blocks', () => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
            const state = JSON.parse(getState());

            // Should have exactly 1 sheet
            expect(state.workbook.sheets).toHaveLength(1);
            expect(state.workbook.sheets[0].name).toBe('Sheet 1');
        });

        it('should extract structure with documents', () => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
            const state = JSON.parse(getState());

            // Should have structure with documents
            expect(state.structure).toBeDefined();
            expect(state.structure.length).toBeGreaterThan(0);
        });
    });
});
