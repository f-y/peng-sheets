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
}

/** Singleton instance of ClipboardStore */
export const ClipboardStore = new ClipboardStoreClass();
