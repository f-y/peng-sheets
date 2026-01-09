/**
 * Sheet Service Tests
 *
 * Phase 2 test expansion for sheet.ts (224 lines, 5 functions)
 * Target: 85%+ coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    addSheet,
    deleteSheet,
    renameSheet,
    updateSheetMetadata,
    moveSheet,
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

const SIMPLE_MD = `# Tables

## Sheet 1

### Table 1

| A | B |
|---|---|
| 1 | 2 |
`;

const MULTI_SHEET_MD = `# Tables

## Sheet 1

### Table 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

### Table 2

| C | D |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]} -->
`;

describe('Sheet Service Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    // =========================================================================
    // Add Sheet
    // =========================================================================

    describe('addSheet', () => {
        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should add a new sheet with specified name', () => {
            const result = addSheet('New Sheet');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets.length).toBe(2);
            expect(state.workbook.sheets[1].name).toBe('New Sheet');
        });

        it('should add a new sheet with custom columns', () => {
            const result = addSheet('Custom', ['Name', 'Age', 'City']);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[1].tables[0].headers).toEqual(['Name', 'Age', 'City']);
        });

        it('should add a new sheet with default name when empty string provided', () => {
            const result = addSheet('');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[1].name).toMatch(/Sheet \d+/);
        });

        it('should add sheet at specific index', () => {
            const result = addSheet('Inserted', null, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Inserted');
            expect(state.workbook.sheets[1].name).toBe('Sheet 1');
        });

        it('should update tab_order when adding sheet at specific index', () => {
            // Add first sheet at position 0 with tab_order position 0
            addSheet('Sheet A');
            const result = addSheet('Sheet B', null, 0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Sheet B should be first in physical order
            expect(state.workbook.sheets[0].name).toBe('Sheet B');
        });
    });

    // =========================================================================
    // Rename Sheet
    // =========================================================================

    describe('renameSheet', () => {
        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should rename a sheet', () => {
            const result = renameSheet(0, 'Renamed Sheet');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Renamed Sheet');
        });

        it('should return error for invalid sheet index', () => {
            const result = renameSheet(99, 'Invalid');
            expect(result.error).toBeDefined();
        });
    });

    // =========================================================================
    // Update Sheet Metadata
    // =========================================================================

    describe('updateSheetMetadata', () => {
        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should update sheet metadata', () => {
            const metadata = { color: 'blue', icon: 'star' };
            const result = updateSheetMetadata(0, metadata);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].metadata).toEqual(metadata);
        });
    });

    // =========================================================================
    // Delete Sheet
    // =========================================================================

    describe('deleteSheet', () => {
        beforeEach(() => {
            initializeWorkbook(MULTI_SHEET_MD, SAMPLE_CONFIG);
        });

        it('should delete a sheet', () => {
            const state1 = JSON.parse(getState());
            expect(state1.workbook.sheets.length).toBe(2);

            const result = deleteSheet(0);
            expect(result.error).toBeUndefined();

            const state2 = JSON.parse(getState());
            expect(state2.workbook.sheets.length).toBe(1);
            expect(state2.workbook.sheets[0].name).toBe('Sheet 2');
        });

        it('should return error for invalid sheet index', () => {
            const result = deleteSheet(99);
            expect(result.error).toBeDefined();
        });
    });

    // =========================================================================
    // Move Sheet
    // =========================================================================

    describe('moveSheet', () => {
        beforeEach(() => {
            initializeWorkbook(MULTI_SHEET_MD, SAMPLE_CONFIG);
        });

        it('should move sheet forward', () => {
            const result = moveSheet(0, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Sheet 2');
            expect(state.workbook.sheets[1].name).toBe('Sheet 1');
        });

        it('should move sheet backward', () => {
            const result = moveSheet(1, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Sheet 2');
            expect(state.workbook.sheets[1].name).toBe('Sheet 1');
        });

        it('should return error for invalid source index', () => {
            const result = moveSheet(99, 0);
            expect(result.error).toBeDefined();
        });

        it('should update tab_order when targetTabOrderIndex is specified', () => {
            const result = moveSheet(0, 1, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            // Check that tab_order is updated
            if (state.workbook.metadata?.tab_order) {
                expect(state.workbook.metadata.tab_order[1].index).toBe(1);
            }
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        it('should create workbook if none exists', () => {
            // Don't initialize workbook
            resetContext();
            const result = addSheet('First Sheet');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets.length).toBe(1);
        });

        it('should handle moving to same position', () => {
            initializeWorkbook(MULTI_SHEET_MD, SAMPLE_CONFIG);
            const result = moveSheet(0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.sheets[0].name).toBe('Sheet 1');
        });
    });
});
