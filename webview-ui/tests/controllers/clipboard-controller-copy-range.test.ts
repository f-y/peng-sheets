/**
 * Tests for Copy Range Indicator feature
 *
 * Tests the visual copy indicator (dashed border) functionality:
 * - _saveCopiedRange stores correct range with sheetIndex/tableIndex
 * - clearCopiedRange clears the range
 * - copy-range-set event is dispatched on copy
 * - Cross-table copy clears other table's copy range
 * - Edit start clears copy range via EditController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClipboardController } from '../../controllers/clipboard-controller';

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
        host = createMockClipboardHost();
        clipboardCtrl = new ClipboardController(host);
    });

    describe('copiedRange state', () => {
        it('should initialize with null copiedRange', () => {
            expect(clipboardCtrl.copiedRange).toBeNull();
        });

        it('should clear copiedRange when clearCopiedRange is called', () => {
            // Set some range first
            clipboardCtrl.copiedRange = {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 1
            };

            clipboardCtrl.clearCopiedRange();

            expect(clipboardCtrl.copiedRange).toBeNull();
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should not call requestUpdate if copiedRange is already null', () => {
            clipboardCtrl.copiedRange = null;
            host.requestUpdate.mockClear();

            clipboardCtrl.clearCopiedRange();

            expect(host.requestUpdate).not.toHaveBeenCalled();
        });
    });

    describe('_saveCopiedRange', () => {
        it('should save single cell selection', () => {
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

        it('should save multi-cell range selection', () => {
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

        it('should save row selection', () => {
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

        it('should dispatch copy-range-set event', () => {
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 0;

            (clipboardCtrl as any)._saveCopiedRange();

            expect(host.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'copy-range-set',
                    bubbles: true,
                    composed: true
                })
            );
        });

        it('should include sheetIndex and tableIndex in event detail', () => {
            host.sheetIndex = 2;
            host.tableIndex = 1;
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 0;

            (clipboardCtrl as any)._saveCopiedRange();

            const dispatchedEvent = host.dispatchEvent.mock.calls[0][0] as CustomEvent;
            expect(dispatchedEvent.detail).toEqual({
                sheetIndex: 2,
                tableIndex: 1
            });
        });
    });
});
