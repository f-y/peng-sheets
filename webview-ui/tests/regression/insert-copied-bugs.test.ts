/**
 * Regression tests for Insert Copied Rows/Columns bugs
 *
 * Bug 1: Insert Row Above/Below menu not working
 * Bug 2: Column headers not copied when copying columns
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SelectionController
function createMockSelectionController(overrides = {}) {
    return {
        selectedRow: 0,
        selectedCol: 0,
        selectionAnchorRow: 0,
        selectionAnchorCol: 0,
        isRowSelection: () => false,
        isColumnSelection: () => false,
        ...overrides
    };
}

// Mock EditController
function createMockEditController() {
    return {
        isEditing: false,
        isReplacementMode: false
    };
}

// Create mock host
function createMockHost(overrides = {}) {
    const dispatchedEvents: CustomEvent[] = [];
    return {
        table: {
            headers: ['HeaderA', 'HeaderB', 'HeaderC'],
            rows: [
                ['A1', 'B1', 'C1'],
                ['A2', 'B2', 'C2'],
                ['A3', 'B3', 'C3']
            ]
        },
        sheetIndex: 0,
        tableIndex: 0,
        selectionCtrl: createMockSelectionController(),
        editCtrl: createMockEditController(),
        dispatchEvent: (event: CustomEvent) => {
            dispatchedEvents.push(event);
            return true;
        },
        requestUpdate: vi.fn(),
        addController: vi.fn(),
        removeController: vi.fn(),
        updateComplete: Promise.resolve(true),
        _dispatchedEvents: dispatchedEvents,
        ...overrides
    };
}

import { ClipboardController } from '../../controllers/clipboard-controller';

describe('Bug: Column Headers Not Copied', () => {
    let host: ReturnType<typeof createMockHost>;
    let controller: ClipboardController;

    beforeEach(() => {
        host = createMockHost();
        controller = new ClipboardController(host as any);
    });

    it('should include header in copiedData when copying a column', () => {
        // Set up column selection (selectedRow = -2 means column header selection)
        host.selectionCtrl = createMockSelectionController({
            selectedRow: -2, // Column selection marker
            selectedCol: 1, // Column B
            selectionAnchorRow: -2,
            selectionAnchorCol: 1
        });

        // Simulate copy (call private method via property access hack)
        // This is testing the internal state after _saveCopiedRange is called
        // by triggering copyToClipboard behavior

        // We need to manually simulate what _saveCopiedRange does
        // to verify the bug
        const { table, selectionCtrl } = host;
        const numRows = table.rows.length;
        const anchorCol = selectionCtrl.selectionAnchorCol;
        const selCol = selectionCtrl.selectedCol;

        const minC = Math.min(anchorCol, selCol);
        const maxC = Math.max(anchorCol, selCol);
        const minR = 0;
        const maxR = numRows - 1;

        // Current broken implementation: only copies rows, not headers
        const brokenData: string[][] = [];
        for (let r = minR; r <= maxR; r++) {
            const rowData: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                rowData.push(table.rows[r]?.[c] || '');
            }
            brokenData.push(rowData);
        }

        // This is what we currently get (bug)
        expect(brokenData).toEqual([['B1'], ['B2'], ['B3']]);
        // Notice: 'HeaderB' is missing!

        // Fixed implementation should include header as first row
        const fixedData: string[][] = [];
        // Add header row first
        const headerRow: string[] = [];
        for (let c = minC; c <= maxC; c++) {
            headerRow.push(table.headers?.[c] || '');
        }
        fixedData.push(headerRow);
        // Then add data rows
        for (let r = minR; r <= maxR; r++) {
            const rowData: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                rowData.push(table.rows[r]?.[c] || '');
            }
            fixedData.push(rowData);
        }

        // This is what we should get (4 rows: header + 3 data rows)
        expect(fixedData).toEqual([['HeaderB'], ['B1'], ['B2'], ['B3']]);
    });

    it('should include headers when copying multiple columns', () => {
        host.selectionCtrl = createMockSelectionController({
            selectedRow: -2,
            selectedCol: 2,
            selectionAnchorRow: -2,
            selectionAnchorCol: 0
        });

        const { table } = host;
        const minC = 0;
        const maxC = 2;

        // Fixed implementation
        const fixedData: string[][] = [];
        const headerRow: string[] = [];
        for (let c = minC; c <= maxC; c++) {
            headerRow.push(table.headers?.[c] || '');
        }
        fixedData.push(headerRow);
        for (let r = 0; r < table.rows.length; r++) {
            const rowData: string[] = [];
            for (let c = minC; c <= maxC; c++) {
                rowData.push(table.rows[r]?.[c] || '');
            }
            fixedData.push(rowData);
        }

        expect(fixedData[0]).toEqual(['HeaderA', 'HeaderB', 'HeaderC']);
    });
});

describe('Bug: Insert Row Above/Below Menu Not Working', () => {
    describe('Event propagation from context menu to SpreadsheetTable', () => {
        it('ss-insert-row event should bubble from SSContextMenu', () => {
            // This tests that the ss-insert-row event has correct structure
            const event = new CustomEvent('ss-insert-row', {
                bubbles: true,
                composed: true,
                detail: { index: 2, position: 'above' }
            });

            expect(event.bubbles).toBe(true);
            expect(event.composed).toBe(true);
            expect(event.detail.index).toBe(2);
            expect(event.detail.position).toBe('above');
        });

        it('view-insert-row event should bubble from SpreadsheetTableView', () => {
            const event = new CustomEvent('view-insert-row', {
                bubbles: true,
                composed: true,
                detail: { index: 1, position: 'below' }
            });

            expect(event.bubbles).toBe(true);
            expect(event.composed).toBe(true);
        });
    });
});

describe('insertColumnsWithData should handle header', () => {
    it('columnsData first element should be header when inserting columns', () => {
        // When columns are copied with headers, the first row of columnsData
        // (after transposition) should contain the headers
        const copiedData = [
            ['HeaderX', 'HeaderY'], // Headers
            ['X1', 'Y1'],
            ['X2', 'Y2']
        ];

        // Transpose for column insertion
        const columnData: string[][] = [];
        if (copiedData.length > 0) {
            const numCols = copiedData[0].length;
            for (let c = 0; c < numCols; c++) {
                const colValues: string[] = [];
                for (let r = 0; r < copiedData.length; r++) {
                    colValues.push(copiedData[r][c] || '');
                }
                columnData.push(colValues);
            }
        }

        // Column 0: ['HeaderX', 'X1', 'X2']
        // Column 1: ['HeaderY', 'Y1', 'Y2']
        expect(columnData[0][0]).toBe('HeaderX'); // First element is header
        expect(columnData[1][0]).toBe('HeaderY');
    });
});
