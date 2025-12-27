/**
 * DragController - Manages drag-and-drop move operations for rows, columns, and cells.
 *
 * Handles:
 * - Drag state tracking (isDragging, dragType, sourceRange)
 * - Drop target calculation
 * - Move operation completion
 */
import { ReactiveController, ReactiveControllerHost } from 'lit';

export type DragType = 'row' | 'col' | 'cell' | null;

export interface SelectionRange {
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

export interface RowMoveResult {
    type: 'row';
    sourceIndices: number[];
    targetIndex: number;
}

export interface ColMoveResult {
    type: 'col';
    sourceIndices: number[];
    targetIndex: number;
}

export interface CellMoveResult {
    type: 'cell';
    sourceRange: SelectionRange;
    destRow: number;
    destCol: number;
}

export type DragResult = RowMoveResult | ColMoveResult | CellMoveResult | null;

export class DragController implements ReactiveController {
    host: ReactiveControllerHost;

    // Drag state
    isDragging: boolean = false;
    dragType: DragType = null;
    sourceRange: SelectionRange | null = null;

    // Drop target for row/column moves (index where items will be inserted)
    dropTargetIndex: number = -1;

    // Drop target for cell moves (top-left corner of destination)
    cellDropRow: number = -1;
    cellDropCol: number = -1;

    constructor(host: ReactiveControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}

    hostDisconnected() {
        this.cancelDrag();
    }

    /**
     * Start a drag operation.
     * @param type - Type of drag: 'row', 'col', or 'cell'
     * @param sourceRange - The selection range being dragged
     */
    startDrag(type: DragType, sourceRange: SelectionRange): void {
        this.isDragging = true;
        this.dragType = type;
        this.sourceRange = sourceRange;
        this.dropTargetIndex = -1;
        this.cellDropRow = -1;
        this.cellDropCol = -1;
        this.host.requestUpdate();
    }

    /**
     * Update the drop target index for row/column drags.
     * @param index - The index where items would be inserted
     */
    updateDropTarget(index: number): void {
        if (!this.isDragging) return;

        if (this.dropTargetIndex !== index) {
            this.dropTargetIndex = index;
            this.host.requestUpdate();
        }
    }

    /**
     * Update the drop target position for cell drags.
     * @param row - Destination row (top-left)
     * @param col - Destination column (top-left)
     */
    updateCellDropTarget(row: number, col: number): void {
        if (!this.isDragging || this.dragType !== 'cell') return;

        if (this.cellDropRow !== row || this.cellDropCol !== col) {
            this.cellDropRow = row;
            this.cellDropCol = col;
            this.host.requestUpdate();
        }
    }

    /**
     * Check if the current drop target is valid (not same position as source).
     */
    isDropTargetValid(): boolean {
        if (!this.isDragging || !this.sourceRange) return false;

        if (this.dragType === 'row') {
            const minR = this.sourceRange.minR;
            const maxR = this.sourceRange.maxR;
            // Invalid if target is within the selection range
            return this.dropTargetIndex < minR || this.dropTargetIndex > maxR + 1;
        }

        if (this.dragType === 'col') {
            const minC = this.sourceRange.minC;
            const maxC = this.sourceRange.maxC;
            return this.dropTargetIndex < minC || this.dropTargetIndex > maxC + 1;
        }

        if (this.dragType === 'cell') {
            // Invalid if destination equals source top-left
            return !(this.cellDropRow === this.sourceRange.minR && this.cellDropCol === this.sourceRange.minC);
        }

        return false;
    }

    /**
     * Complete the drag operation and return move details.
     * Returns null if drag is invalid or not active.
     */
    completeDrag(): DragResult {
        if (!this.isDragging || !this.sourceRange) {
            this.cancelDrag();
            return null;
        }

        const result = this._buildResult();
        this.cancelDrag();
        return result;
    }

    private _buildResult(): DragResult {
        if (!this.sourceRange) return null;

        if (this.dragType === 'row') {
            if (this.dropTargetIndex < 0) return null;

            const indices: number[] = [];
            for (let i = this.sourceRange.minR; i <= this.sourceRange.maxR; i++) {
                indices.push(i);
            }
            return {
                type: 'row',
                sourceIndices: indices,
                targetIndex: this.dropTargetIndex
            };
        }

        if (this.dragType === 'col') {
            if (this.dropTargetIndex < 0) return null;

            const indices: number[] = [];
            for (let i = this.sourceRange.minC; i <= this.sourceRange.maxC; i++) {
                indices.push(i);
            }
            return {
                type: 'col',
                sourceIndices: indices,
                targetIndex: this.dropTargetIndex
            };
        }

        if (this.dragType === 'cell') {
            if (this.cellDropRow < 0 || this.cellDropCol < 0) return null;

            return {
                type: 'cell',
                sourceRange: { ...this.sourceRange },
                destRow: this.cellDropRow,
                destCol: this.cellDropCol
            };
        }

        return null;
    }

    /**
     * Cancel the current drag operation and reset state.
     */
    cancelDrag(): void {
        this.isDragging = false;
        this.dragType = null;
        this.sourceRange = null;
        this.dropTargetIndex = -1;
        this.cellDropRow = -1;
        this.cellDropCol = -1;
        this.host.requestUpdate();
    }
}
