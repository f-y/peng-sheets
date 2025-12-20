/**
 * Unit tests for SelectionController
 *
 * Focuses on:
 * - Range calculation logic (getSelectionRange)
 * - Selection state management
 * - Drag selection updates
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectionController } from '../../controllers/selection-controller';
import { createMockHost } from './controller-test-helpers';

describe('SelectionController', () => {
    let host: ReturnType<typeof createMockHost>;
    let selection: SelectionController;

    beforeEach(() => {
        host = createMockHost();
        selection = new SelectionController(host);
    });

    describe('selectCell', () => {
        it('should set anchor and current cell for new selection', () => {
            selection.selectCell(2, 3);

            expect(selection.selectedRow).toBe(2);
            expect(selection.selectedCol).toBe(3);
            expect(selection.selectionAnchorRow).toBe(2);
            expect(selection.selectionAnchorCol).toBe(3);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should extend selection when extend=true', () => {
            // Initial selection
            selection.selectCell(2, 3);

            // Extend to new cell
            selection.selectCell(4, 5, true);

            expect(selection.selectedRow).toBe(4);
            expect(selection.selectedCol).toBe(5);
            expect(selection.selectionAnchorRow).toBe(2); // Anchor stays
            expect(selection.selectionAnchorCol).toBe(3); // Anchor stays
        });

        it('should not extend selection when anchor is -1', () => {
            selection.selectionAnchorRow = -1;
            selection.selectionAnchorCol = -1;

            selection.selectCell(2, 3, true);

            expect(selection.selectionAnchorRow).toBe(2);
            expect(selection.selectionAnchorCol).toBe(3);
        });
    });

    describe('getSelectionRange', () => {
        it('should return single cell range', () => {
            selection.selectionAnchorRow = 2;
            selection.selectionAnchorCol = 3;
            selection.selectedRow = 2;
            selection.selectedCol = 3;

            const range = selection.getSelectionRange(10, 10);

            expect(range).toEqual({ minR: 2, maxR: 2, minC: 3, maxC: 3 });
        });

        it('should return full table range for corner selection', () => {
            selection.selectedRow = -2;
            selection.selectedCol = -2;

            const range = selection.getSelectionRange(10, 5);

            expect(range).toEqual({ minR: 0, maxR: 9, minC: 0, maxC: 4 });
        });

        it('should handle empty table (0 rows)', () => {
            selection.selectedRow = -2;
            selection.selectedCol = -2;

            const range = selection.getSelectionRange(0, 5);

            expect(range).toEqual({ minR: 0, maxR: 0, minC: 0, maxC: 4 });
        });

        it('should return invalid range when anchor is -1', () => {
            selection.selectionAnchorRow = -1;
            selection.selectionAnchorCol = -1;
            selection.selectedRow = 2;
            selection.selectedCol = 3;

            const range = selection.getSelectionRange(10, 10);

            expect(range).toEqual({ minR: -1, maxR: -1, minC: -1, maxC: -1 });
        });

        it('should return row range for row selection', () => {
            selection.selectionAnchorRow = 2;
            selection.selectionAnchorCol = -2;
            selection.selectedRow = 5;
            selection.selectedCol = -2;

            const range = selection.getSelectionRange(10, 8);

            expect(range).toEqual({ minR: 2, maxR: 5, minC: 0, maxC: 7 });
        });

        it('should return column range for column selection', () => {
            selection.selectionAnchorRow = -2;
            selection.selectionAnchorCol = 3;
            selection.selectedRow = -2;
            selection.selectedCol = 6;

            const range = selection.getSelectionRange(10, 10);

            expect(range).toEqual({ minR: 0, maxR: 9, minC: 3, maxC: 6 });
        });

        it('should handle rectangular range selection', () => {
            selection.selectionAnchorRow = 2;
            selection.selectionAnchorCol = 3;
            selection.selectedRow = 5;
            selection.selectedCol = 7;

            const range = selection.getSelectionRange(10, 10);

            expect(range).toEqual({ minR: 2, maxR: 5, minC: 3, maxC: 7 });
        });

        it('should handle reversed selection (anchor > current)', () => {
            selection.selectionAnchorRow = 5;
            selection.selectionAnchorCol = 7;
            selection.selectedRow = 2;
            selection.selectedCol = 3;

            const range = selection.getSelectionRange(10, 10);

            expect(range).toEqual({ minR: 2, maxR: 5, minC: 3, maxC: 7 });
        });

        it('should handle single row selection', () => {
            selection.selectionAnchorRow = 3;
            selection.selectionAnchorCol = -2;
            selection.selectedRow = 3;
            selection.selectedCol = -2;

            const range = selection.getSelectionRange(10, 5);

            expect(range).toEqual({ minR: 3, maxR: 3, minC: 0, maxC: 4 });
        });

        it('should handle single column selection', () => {
            selection.selectionAnchorRow = -2;
            selection.selectionAnchorCol = 4;
            selection.selectedRow = -2;
            selection.selectedCol = 4;

            const range = selection.getSelectionRange(10, 8);

            expect(range).toEqual({ minR: 0, maxR: 9, minC: 4, maxC: 4 });
        });
    });

    describe('reset', () => {
        it('should reset all selection state', () => {
            selection.selectedRow = 5;
            selection.selectedCol = 7;
            selection.selectionAnchorRow = 2;
            selection.selectionAnchorCol = 3;
            selection.isSelecting = true;

            selection.reset();

            expect(selection.selectedRow).toBe(0);
            expect(selection.selectedCol).toBe(0);
            expect(selection.selectionAnchorRow).toBe(-1);
            expect(selection.selectionAnchorCol).toBe(-1);
            expect(selection.isSelecting).toBe(false);
            expect(host.requestUpdate).toHaveBeenCalled();
        });
    });

    describe('startSelection', () => {
        it('should set isSelecting flag and add event listeners', () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            selection.startSelection(2, 3);

            expect(selection.isSelecting).toBe(true);
            expect(selection.selectedRow).toBe(2);
            expect(selection.selectedCol).toBe(3);
            expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

            addEventListenerSpy.mockRestore();
        });
    });

    describe('edge cases', () => {
        it('should handle very large table dimensions', () => {
            selection.selectedRow = -2;
            selection.selectedCol = -2;

            const range = selection.getSelectionRange(1000000, 100);

            expect(range.maxR).toBe(999999);
            expect(range.maxC).toBe(99);
        });
    });
});
