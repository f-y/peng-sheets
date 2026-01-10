/**
 * Regression Test: Split-View Table Deletion
 *
 * Bug: When deleting a table in split-view layout, the pane-table
 * associations become incorrect because table indices in layout metadata
 * are not updated after deletion.
 *
 * Expected behavior:
 * - Deleted table is removed from its pane
 * - Remaining table indices are shifted down
 * - Each pane keeps its original tables (minus the deleted one)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeWorkbook, getState, resetContext, deleteTable } from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('Split-View Table Deletion', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Layout metadata update after table deletion', () => {
        /**
         * Test case: 4 tables in split layout
         * - Pane 1: Table 0, Table 1
         * - Pane 2: Table 2, Table 3
         *
         * After deleting Table 1:
         * - Pane 1: Table 0 (indices shifted: [0])
         * - Pane 2: Table 1, Table 2 (indices shifted from [2, 3] to [1, 2])
         */
        const SPLIT_VIEW_MD = `# Tables

## Split Sheet

### Table 0

| A |
|---|
| 0 |

### Table 1

| B |
|---|
| 1 |

### Table 2

| C |
|---|
| 2 |

### Table 3

| D |
|---|
| 3 |

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "split", "id": "root-split", "direction": "horizontal", "sizes": [50, 50], "children": [{"type": "pane", "id": "pane-1", "tables": [0, 1], "activeTableIndex": 0}, {"type": "pane", "id": "pane-2", "tables": [2, 3], "activeTableIndex": 0}]}} -->
`;

        beforeEach(() => {
            initializeWorkbook(SPLIT_VIEW_MD, SAMPLE_CONFIG);
        });

        it('should update table indices in layout after deleting table from first pane', () => {
            // Delete Table 1 from sheet 0
            const result = deleteTable(0, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const sheet = state.workbook.sheets[0];

            // Should have 3 tables now
            expect(sheet.tables.length).toBe(3);

            // Layout should be updated
            const layout = sheet.metadata?.layout;
            expect(layout).toBeDefined();
            expect(layout.type).toBe('split');

            const pane1 = layout.children[0];
            const pane2 = layout.children[1];

            // Pane 1 should only have Table 0 (index 1 was removed)
            expect(pane1.tables).toEqual([0]);

            // Pane 2 should have indices shifted from [2, 3] to [1, 2]
            expect(pane2.tables).toEqual([1, 2]);
        });

        it('should update table indices in layout after deleting table from second pane', () => {
            // Delete Table 2 from sheet 0
            const result = deleteTable(0, 2);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const sheet = state.workbook.sheets[0];

            // Should have 3 tables now
            expect(sheet.tables.length).toBe(3);

            // Layout should be updated
            const layout = sheet.metadata?.layout;
            expect(layout).toBeDefined();

            const pane1 = layout.children[0];
            const pane2 = layout.children[1];

            // Pane 1 should remain unchanged: [0, 1]
            expect(pane1.tables).toEqual([0, 1]);

            // Pane 2 should have index 2 removed, index 3 shifted to 2: [2]
            expect(pane2.tables).toEqual([2]);
        });

        it('should handle deleting first table correctly', () => {
            // Delete Table 0 from sheet 0
            const result = deleteTable(0, 0);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const sheet = state.workbook.sheets[0];

            // Should have 3 tables now
            expect(sheet.tables.length).toBe(3);

            // Layout should be updated
            const layout = sheet.metadata?.layout;
            expect(layout).toBeDefined();

            const pane1 = layout.children[0];
            const pane2 = layout.children[1];

            // Pane 1 should have index 0 removed, index 1 shifted to 0: [0]
            expect(pane1.tables).toEqual([0]);

            // Pane 2 should have indices shifted from [2, 3] to [1, 2]
            expect(pane2.tables).toEqual([1, 2]);
        });

        it('should handle deleting last table correctly', () => {
            // Delete Table 3 from sheet 0
            const result = deleteTable(0, 3);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const sheet = state.workbook.sheets[0];

            // Should have 3 tables now
            expect(sheet.tables.length).toBe(3);

            // Layout should be updated
            const layout = sheet.metadata?.layout;
            expect(layout).toBeDefined();

            const pane1 = layout.children[0];
            const pane2 = layout.children[1];

            // Pane 1 should remain unchanged: [0, 1]
            expect(pane1.tables).toEqual([0, 1]);

            // Pane 2 should have index 3 removed: [2]
            expect(pane2.tables).toEqual([2]);
        });

        it('should handle nested split layout', () => {
            // Create a more complex nested layout for testing
            const NESTED_SPLIT_MD = `# Tables

## Nested Sheet

### Table 0

| A |
|---|
| 0 |

### Table 1

| B |
|---|
| 1 |

### Table 2

| C |
|---|
| 2 |

### Table 3

| D |
|---|
| 3 |

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "split", "id": "root", "direction": "vertical", "sizes": [50, 50], "children": [{"type": "pane", "id": "pane-1", "tables": [0], "activeTableIndex": 0}, {"type": "split", "id": "nested", "direction": "horizontal", "sizes": [50, 50], "children": [{"type": "pane", "id": "pane-2", "tables": [1, 2], "activeTableIndex": 0}, {"type": "pane", "id": "pane-3", "tables": [3], "activeTableIndex": 0}]}]}} -->
`;

            resetContext();
            initializeWorkbook(NESTED_SPLIT_MD, SAMPLE_CONFIG);

            // Delete Table 1
            const result = deleteTable(0, 1);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const layout = state.workbook.sheets[0].metadata?.layout;

            // Root pane 1: [0] (unchanged)
            expect(layout.children[0].tables).toEqual([0]);

            // Nested split - pane 2: was [1, 2], now index 1 removed, 2 shifted to 1: [1]
            const nestedSplit = layout.children[1];
            expect(nestedSplit.children[0].tables).toEqual([1]);

            // Nested split - pane 3: was [3], now shifted to [2]
            expect(nestedSplit.children[1].tables).toEqual([2]);
        });
    });
});
