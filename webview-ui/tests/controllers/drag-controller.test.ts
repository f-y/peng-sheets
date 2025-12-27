/**
 * Unit tests for DragController
 *
 * Focuses on:
 * - Drag state management
 * - Drop target calculation
 * - Source range tracking
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DragController } from '../../controllers/drag-controller';
import { createMockHost } from './controller-test-helpers';

describe('DragController', () => {
    let host: ReturnType<typeof createMockHost>;
    let drag: DragController;

    beforeEach(() => {
        host = createMockHost();
        drag = new DragController(host);
    });

    describe('initial state', () => {
        it('should not be dragging initially', () => {
            expect(drag.isDragging).toBe(false);
            expect(drag.dragType).toBe(null);
            expect(drag.sourceRange).toBe(null);
            expect(drag.dropTargetIndex).toBe(-1);
        });
    });

    describe('startDrag', () => {
        it('should start row drag with correct state', () => {
            const sourceRange = { minR: 2, maxR: 4, minC: 0, maxC: 5 };

            drag.startDrag('row', sourceRange);

            expect(drag.isDragging).toBe(true);
            expect(drag.dragType).toBe('row');
            expect(drag.sourceRange).toEqual(sourceRange);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should start column drag with correct state', () => {
            const sourceRange = { minR: 0, maxR: 10, minC: 1, maxC: 3 };

            drag.startDrag('col', sourceRange);

            expect(drag.isDragging).toBe(true);
            expect(drag.dragType).toBe('col');
            expect(drag.sourceRange).toEqual(sourceRange);
        });

        it('should start cell drag with correct state', () => {
            const sourceRange = { minR: 2, maxR: 5, minC: 1, maxC: 4 };

            drag.startDrag('cell', sourceRange);

            expect(drag.isDragging).toBe(true);
            expect(drag.dragType).toBe('cell');
            expect(drag.sourceRange).toEqual(sourceRange);
        });
    });

    describe('updateDropTarget', () => {
        it('should update drop target index for row drag', () => {
            drag.startDrag('row', { minR: 2, maxR: 2, minC: 0, maxC: 5 });

            drag.updateDropTarget(5);

            expect(drag.dropTargetIndex).toBe(5);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should update drop target index for column drag', () => {
            drag.startDrag('col', { minR: 0, maxR: 10, minC: 3, maxC: 3 });

            drag.updateDropTarget(1);

            expect(drag.dropTargetIndex).toBe(1);
        });

        it('should not update if not dragging', () => {
            drag.updateDropTarget(5);

            expect(drag.dropTargetIndex).toBe(-1);
        });

        it('should update cell drop position', () => {
            drag.startDrag('cell', { minR: 0, maxR: 1, minC: 0, maxC: 1 });

            drag.updateCellDropTarget(3, 4);

            expect(drag.cellDropRow).toBe(3);
            expect(drag.cellDropCol).toBe(4);
        });
    });

    describe('cancelDrag', () => {
        it('should reset all drag state', () => {
            drag.startDrag('row', { minR: 1, maxR: 3, minC: 0, maxC: 5 });
            drag.updateDropTarget(5);

            drag.cancelDrag();

            expect(drag.isDragging).toBe(false);
            expect(drag.dragType).toBe(null);
            expect(drag.sourceRange).toBe(null);
            expect(drag.dropTargetIndex).toBe(-1);
        });
    });

    describe('completeDrag', () => {
        it('should return row move details', () => {
            drag.startDrag('row', { minR: 1, maxR: 2, minC: 0, maxC: 5 });
            drag.updateDropTarget(5);

            const result = drag.completeDrag();

            expect(result).toEqual({
                type: 'row',
                sourceIndices: [1, 2],
                targetIndex: 5
            });
            expect(drag.isDragging).toBe(false);
        });

        it('should return column move details', () => {
            drag.startDrag('col', { minR: 0, maxR: 10, minC: 2, maxC: 4 });
            drag.updateDropTarget(0);

            const result = drag.completeDrag();

            expect(result).toEqual({
                type: 'col',
                sourceIndices: [2, 3, 4],
                targetIndex: 0
            });
        });

        it('should return cell move details', () => {
            drag.startDrag('cell', { minR: 1, maxR: 2, minC: 1, maxC: 2 });
            drag.updateCellDropTarget(5, 5);

            const result = drag.completeDrag();

            expect(result).toEqual({
                type: 'cell',
                sourceRange: { minR: 1, maxR: 2, minC: 1, maxC: 2 },
                destRow: 5,
                destCol: 5
            });
        });

        it('should return null if not dragging', () => {
            const result = drag.completeDrag();

            expect(result).toBe(null);
        });

        it('should return null if drop target is invalid', () => {
            drag.startDrag('row', { minR: 1, maxR: 1, minC: 0, maxC: 5 });
            // dropTargetIndex is still -1

            const result = drag.completeDrag();

            expect(result).toBe(null);
        });
    });

    describe('isDropTargetValid', () => {
        it('should return false for row move to same position', () => {
            drag.startDrag('row', { minR: 2, maxR: 2, minC: 0, maxC: 5 });
            drag.updateDropTarget(2);

            expect(drag.isDropTargetValid()).toBe(false);
        });

        it('should return false for row move into selection range', () => {
            drag.startDrag('row', { minR: 2, maxR: 4, minC: 0, maxC: 5 });
            drag.updateDropTarget(3);

            expect(drag.isDropTargetValid()).toBe(false);
        });

        it('should return true for row move outside selection', () => {
            drag.startDrag('row', { minR: 2, maxR: 4, minC: 0, maxC: 5 });
            drag.updateDropTarget(6);

            expect(drag.isDropTargetValid()).toBe(true);
        });

        it('should return true for row move before selection', () => {
            drag.startDrag('row', { minR: 2, maxR: 4, minC: 0, maxC: 5 });
            drag.updateDropTarget(0);

            expect(drag.isDropTargetValid()).toBe(true);
        });
    });
});
