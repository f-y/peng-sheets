/**
 * Tests for Copy Range Indicator feature
 *
 * Tests the visual copy indicator (dashed border) functionality:
 * - _saveCopiedRange stores correct range in ClipboardStore
 * - clearCopiedRange clears the range when called by owning table
 * - Cross-table copy coordination via ClipboardStore
 * - Edit start clears copy range via EditController
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClipboardController } from '../../controllers/clipboard-controller';
import { ClipboardStore } from '../../stores/clipboard-store';

// Mock minimal host for ClipboardController
const createMockClipboardHost = () => {
    const selectionCtrl = {
        selectedRow: 0,
        selectedCol: 0,
        selectionAnchorRow: -1,
        selectionAnchorCol: -1
    };

    return {
        addController: vi.fn(),
        removeController: vi.fn(),
        requestUpdate: vi.fn(),
        updateComplete: Promise.resolve(true),
        dispatchEvent: vi.fn(),
        table: {
            headers: ['A', 'B', 'C'],
            rows: [
                ['1', '2', '3'],
                ['4', '5', '6']
            ]
        },
        sheetIndex: 0,
        tableIndex: 0,
        selectionCtrl
    } as any;
};

describe('ClipboardController Copy Range Indicator', () => {
    let host: ReturnType<typeof createMockClipboardHost>;
    let clipboardCtrl: ClipboardController;

    beforeEach(() => {
        ClipboardStore.clear();
        host = createMockClipboardHost();
        clipboardCtrl = new ClipboardController(host);
    });

    afterEach(() => {
        ClipboardStore.clear();
    });

    describe('copiedRange state', () => {
        it('should initialize with null copiedRange', () => {
            expect(clipboardCtrl.copiedRange).toBeNull();
        });

        it('should clear copiedRange when clearCopiedRange is called by owning table', () => {
            // Set some range first in store
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 1
            });

            clipboardCtrl.clearCopiedRange();

            expect(clipboardCtrl.copiedRange).toBeNull();
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should NOT clear if copiedRange is from different table', () => {
            // Set range from different table
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 1,
                tableIndex: 1,
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 1
            });
            host.requestUpdate.mockClear();

            clipboardCtrl.clearCopiedRange();

            // Should not have been cleared
            expect(clipboardCtrl.copiedRange).not.toBeNull();
            expect(host.requestUpdate).not.toHaveBeenCalled();
        });

        it('should not call requestUpdate if copiedRange is already null', () => {
            // Store is already clear (no copiedRange)
            host.requestUpdate.mockClear();

            clipboardCtrl.clearCopiedRange();

            expect(host.requestUpdate).not.toHaveBeenCalled();
        });
    });

    describe('_saveCopiedRange', () => {
        it('should save single cell selection to ClipboardStore', () => {
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 1;
            host.selectionCtrl.selectionAnchorRow = -1;
            host.selectionCtrl.selectionAnchorCol = -1;

            // Call private method via type assertion
            (clipboardCtrl as any)._saveCopiedRange();

            expect(clipboardCtrl.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 0,
                minC: 1,
                maxC: 1
            });
        });

        it('should save multi-cell range selection to ClipboardStore', () => {
            host.selectionCtrl.selectedRow = 1;
            host.selectionCtrl.selectedCol = 2;
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;

            (clipboardCtrl as any)._saveCopiedRange();

            expect(clipboardCtrl.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 2
            });
        });

        it('should save row selection to ClipboardStore', () => {
            host.selectionCtrl.selectedRow = 1;
            host.selectionCtrl.selectedCol = -2; // Full row
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = -1;

            (clipboardCtrl as any)._saveCopiedRange();

            expect(clipboardCtrl.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 2 // numCols - 1
            });
        });

        it('should store sheetIndex and tableIndex in ClipboardStore range', () => {
            host.sheetIndex = 2;
            host.tableIndex = 1;
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 0;

            (clipboardCtrl as any)._saveCopiedRange();

            expect(clipboardCtrl.copiedRange?.sheetIndex).toBe(2);
            expect(clipboardCtrl.copiedRange?.tableIndex).toBe(1);
        });
    });
});
