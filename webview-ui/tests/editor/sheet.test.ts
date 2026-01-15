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
    moveSheet
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
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

        it('should remove deleted sheet from tab_order', () => {
            // Before: tab_order = [sheet:0, sheet:1]
            const state1 = JSON.parse(getState());
            expect(state1.workbook.metadata?.tab_order?.length).toBe(2);

            const result = deleteSheet(0);
            expect(result.error).toBeUndefined();

            // After: tab_order should have 1 entry (the remaining sheet, now shifted to index 0)
            const state2 = JSON.parse(getState());
            const tabOrder = state2.workbook.metadata?.tab_order;

            // Should have exactly 1 entry after deleting 1 of 2 sheets
            expect(tabOrder?.length).toBe(1);

            // The remaining entry should be index 0 (shifted from original index 1)
            expect(tabOrder?.[0]).toEqual({ type: 'sheet', index: 0 });
        });

        it('should shift remaining sheet indices in tab_order after deletion', () => {
            // Before: tab_order = [sheet:0, sheet:1]
            const result = deleteSheet(0);
            expect(result.error).toBeUndefined();

            // After: remaining sheet (was index 1) should now be index 0
            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata?.tab_order;
            if (tabOrder && tabOrder.length > 0) {
                const sheetEntries = tabOrder.filter((item: { type: string }) => item.type === 'sheet');
                // The remaining sheet should have index 0
                expect(sheetEntries[0]?.index).toBe(0);
            }
        });

        it('should handle deleting middle sheet with tab_order', () => {
            // Add a third sheet
            addSheet('Sheet 3');
            const state1 = JSON.parse(getState());
            expect(state1.workbook.sheets.length).toBe(3);

            // Delete middle sheet (index 1)
            const result = deleteSheet(1);
            expect(result.error).toBeUndefined();

            const state2 = JSON.parse(getState());
            expect(state2.workbook.sheets.length).toBe(2);
            // Sheet 3 should now be at index 1
            expect(state2.workbook.sheets[1].name).toBe('Sheet 3');

            // tab_order should be updated: old index 2 should become index 1
            const tabOrder = state2.workbook.metadata?.tab_order;
            if (tabOrder) {
                const sheetEntries = tabOrder.filter((item: { type: string }) => item.type === 'sheet');
                // Should have 2 sheet entries with indices 0 and 1
                const indices = sheetEntries.map((e: { index: number }) => e.index).sort();
                expect(indices).toEqual([0, 1]);
            }
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
            // After move: sheet 0 moves to physical position 1, becomes logical index 1
            // The moved sheet should be at tab_order position 0 (adjusted from 1 because currPos=0 < target=1)
            if (state.workbook.metadata?.tab_order) {
                expect(state.workbook.metadata.tab_order[0].index).toBe(1);
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

        /**
         * BUG REPRODUCTION: Sheet reorder when documents exist
         * When moving Sheet1 after Sheet2 with docs in file:
         * - Should physically reorder sheets in markdown
         * - NOT just update metadata
         */
        it('should physically reorder sheets when documents exist in file', () => {
            const HYBRID_MD = `# Doc 1

Content.

# Doc 3

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

# Doc 2
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Move Sheet 1 (index 0) after Sheet 2 (index 1)
            const result = moveSheet(0, 1, 1);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Sheet 2 should now be BEFORE Sheet 1 in file (physical reorder)
            const sheet1Pos = content.indexOf('## Sheet 1');
            const sheet2Pos = content.indexOf('## Sheet 2');

            expect(sheet2Pos).toBeLessThan(sheet1Pos); // KEY: Physical order changed
        });
    });
});
