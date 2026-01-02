/**
 * Singleton store for clipboard data shared across all SpreadsheetTable instances.
 * Emits 'change' events when clipboard state updates, allowing components to react.
 */

export interface CopiedRange {
    sheetIndex: number;
    tableIndex: number;
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

class ClipboardStoreClass extends EventTarget {
    /** The actual copied cell data */
    copiedData: string[][] | null = null;

    /** Type of copy operation: 'cells', 'rows', or 'columns' */
    copyType: 'cells' | 'rows' | 'columns' | null = null;

    /** Range info for visual indicator (dashed border) */
    copiedRange: CopiedRange | null = null;

    /**
     * Store copied data and emit change event
     */
    setCopiedData(data: string[][] | null, type: 'cells' | 'rows' | 'columns' | null, range: CopiedRange | null): void {
        this.copiedData = data;
        this.copyType = type;
        this.copiedRange = range;
        this.dispatchEvent(new CustomEvent('change'));
    }

    /**
     * Clear all clipboard data and emit change event
     */
    clear(): void {
        this.copiedData = null;
        this.copyType = null;
        this.copiedRange = null;
        this.dispatchEvent(new CustomEvent('change'));
    }

    /**
     * Check if clipboard contains copied rows
     */
    get hasCopiedRows(): boolean {
        return this.copyType === 'rows' && this.copiedData !== null;
    }

    /**
     * Check if clipboard contains copied columns
     */
    get hasCopiedColumns(): boolean {
        return this.copyType === 'columns' && this.copiedData !== null;
    }

    /**
     * Check if the copied range belongs to a specific table
     */
    isFromTable(sheetIndex: number, tableIndex: number): boolean {
        return this.copiedRange?.sheetIndex === sheetIndex && this.copiedRange?.tableIndex === tableIndex;
    }

    /**
     * Adjust copied range when rows are inserted.
     * If rows are inserted before or within the copied range, shift the range accordingly.
     */
    adjustForRowInsert(sheetIndex: number, tableIndex: number, insertedAt: number, count: number): void {
        if (!this.copiedRange || !this.isFromTable(sheetIndex, tableIndex)) return;

        // If insertion is at or before the copied range start, shift the entire range
        if (insertedAt <= this.copiedRange.minR) {
            this.copiedRange.minR += count;
            this.copiedRange.maxR += count;
            this.dispatchEvent(new CustomEvent('change'));
        }
        // If insertion is within the range, we could expand it, but simpler to clear
        else if (insertedAt <= this.copiedRange.maxR) {
            this.clear();
        }
        // If insertion is after the range, no adjustment needed
    }

    /**
     * Adjust copied range when rows are deleted.
     * If deleted rows overlap with the copied range, clear it.
     * If deleted rows are before the range, shift accordingly.
     */
    adjustForRowDelete(sheetIndex: number, tableIndex: number, deletedAt: number, count: number): void {
        if (!this.copiedRange || !this.isFromTable(sheetIndex, tableIndex)) return;

        const deleteEnd = deletedAt + count - 1;

        // Check if deleted range overlaps with copied range
        if (deletedAt <= this.copiedRange.maxR && deleteEnd >= this.copiedRange.minR) {
            // Overlap detected - clear the copied range
            this.clear();
            return;
        }

        // If deletion is entirely before the copied range, shift it
        if (deleteEnd < this.copiedRange.minR) {
            this.copiedRange.minR -= count;
            this.copiedRange.maxR -= count;
            this.dispatchEvent(new CustomEvent('change'));
        }
        // If deletion is entirely after the range, no adjustment needed
    }

    /**
     * Adjust copied range when columns are inserted.
     * If columns are inserted before or within the copied range, shift the range accordingly.
     */
    adjustForColumnInsert(sheetIndex: number, tableIndex: number, insertedAt: number, count: number): void {
        if (!this.copiedRange || !this.isFromTable(sheetIndex, tableIndex)) return;

        // If insertion is at or before the copied range start, shift the entire range
        if (insertedAt <= this.copiedRange.minC) {
            this.copiedRange.minC += count;
            this.copiedRange.maxC += count;
            this.dispatchEvent(new CustomEvent('change'));
        }
        // If insertion is within the range, clear to avoid complexity
        else if (insertedAt <= this.copiedRange.maxC) {
            this.clear();
        }
        // If insertion is after the range, no adjustment needed
    }

    /**
     * Adjust copied range when columns are deleted.
     * If deleted columns overlap with the copied range, clear it.
     * If deleted columns are before the range, shift accordingly.
     */
    adjustForColumnDelete(sheetIndex: number, tableIndex: number, deletedAt: number, count: number): void {
        if (!this.copiedRange || !this.isFromTable(sheetIndex, tableIndex)) return;

        const deleteEnd = deletedAt + count - 1;

        // Check if deleted range overlaps with copied range
        if (deletedAt <= this.copiedRange.maxC && deleteEnd >= this.copiedRange.minC) {
            // Overlap detected - clear the copied range
            this.clear();
            return;
        }

        // If deletion is entirely before the copied range, shift it
        if (deleteEnd < this.copiedRange.minC) {
            this.copiedRange.minC -= count;
            this.copiedRange.maxC -= count;
            this.dispatchEvent(new CustomEvent('change'));
        }
        // If deletion is entirely after the range, no adjustment needed
    }
}

/** Singleton instance of ClipboardStore */
export const ClipboardStore = new ClipboardStoreClass();
