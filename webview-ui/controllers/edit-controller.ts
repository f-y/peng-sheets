import { ReactiveController } from 'lit';
import { SpreadsheetTable } from '../components/spreadsheet-table';

export class EditController implements ReactiveController {
    host: SpreadsheetTable;

    isEditing: boolean = false;
    editingMetadata: boolean = false;
    pendingEditValue: string | null = null;
    // Flag to indicate if editing started via direct keyboard input (replacement mode)
    // vs double-click (append mode). In replacement mode, pendingEditValue should be
    // used as fallback when DOM is empty.
    isReplacementMode: boolean = false;
    // Flag to track if user explicitly inserted a newline via Option+Enter
    // Used to distinguish intentional newlines from browser-inserted cursor placeholders
    hasUserInsertedNewline: boolean = false;

    // Metadata State
    pendingTitle: string = '';
    pendingDescription: string = '';

    constructor(host: SpreadsheetTable) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {}

    startEditing(initialValue: string | null = null, isReplacement: boolean = false) {
        this.isEditing = true;
        this.pendingEditValue = initialValue === null || initialValue === undefined ? '' : initialValue;
        this.isReplacementMode = isReplacement;
        this.host.requestUpdate();
    }

    cancelEditing() {
        this.isEditing = false;
        this.editingMetadata = false; // Reset metadata edit mode too
        this.pendingEditValue = null;
        this.isReplacementMode = false;
        this.hasUserInsertedNewline = false;
        this.host.requestUpdate();
    }

    commitEditing() {
        // Validation or logic requires calling back to host method usually,
        // or ensure host reads controller state.
        // For simplicity, we just flag state change, host triggers logic via 'updated'
        // or we dispatch event directly here?
        // Ideally controller dispatches the logical intent.
    }

    // Simplified handlers that just update model state
    setPendingValue(val: string) {
        this.pendingEditValue = val;
    }

    deleteSelection() {
        const { sheetIndex, tableIndex, table, selectionCtrl } = this.host;
        const {
            selectedRow: selRow,
            selectedCol: selCol,
            selectionAnchorRow: anchorRow,
            selectionAnchorCol: anchorCol
        } = selectionCtrl;

        if (!table) return;

        // Determine effective range
        let minR = selRow;
        let maxR = selRow;
        let minC = selCol;
        let maxC = selCol;

        const rowCount = table.rows.length;
        // const colCount = table.headers ? table.headers.length : table.rows[0]?.length || 0;
        // Use logic from ClipboardController for determining count
        // Actually table.rows[0].length is reliable if headers missing
        const colCount = table.headers ? table.headers.length : table.rows.length > 0 ? table.rows[0].length : 0;

        if (selRow >= 0 && selCol >= 0) {
            // Cell/Range
            if (anchorRow === -2 || anchorCol === -2) {
                minR = selRow;
                maxR = selRow;
                minC = selCol;
                maxC = selCol;
            } else if (anchorRow !== -1 && anchorCol !== -1) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            }
        } else if (selCol === -2 && selRow >= 0) {
            // Row selection
            if (anchorRow === -2 || anchorRow === -1) {
                minR = selRow;
                maxR = selRow;
                minC = 0;
                maxC = colCount - 1;
            } else {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = 0;
                maxC = colCount - 1;
            }
        } else if (selRow === -2 && selCol >= 0) {
            // Column selection
            if (anchorCol === -2 || anchorCol === -1) {
                minR = 0;
                maxR = rowCount - 1;
                minC = selCol;
                maxC = selCol;
            } else {
                minR = 0;
                maxR = rowCount - 1;
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            }
        }

        const triggerUpdate = () => this.host.requestUpdate();

        if (selRow === -2 && selCol === -2) {
            // Clear All
            this.host.dispatchEvent(
                new CustomEvent('range-edit', {
                    detail: {
                        sheetIndex: sheetIndex,
                        tableIndex: tableIndex,
                        startRow: 0,
                        endRow: rowCount - 1,
                        startCol: 0,
                        endCol: colCount - 1,
                        newValue: ''
                    },
                    bubbles: true,
                    composed: true
                })
            );
        } else if (selCol === -2) {
            // Row Delete
            const effectiveMaxR = Math.min(maxR, rowCount - 1);
            if (effectiveMaxR < minR) return;

            // Optimistic Update: Remove rows from model (backwards to avoid index shift)
            const rowsToDelete: number[] = [];
            for (let r = effectiveMaxR; r >= minR; r--) {
                table.rows.splice(r, 1);
                rowsToDelete.push(r);
            }

            this.host.dispatchEvent(
                new CustomEvent('rows-delete', {
                    detail: { sheetIndex: sheetIndex, tableIndex: tableIndex, rowIndices: rowsToDelete },
                    bubbles: true,
                    composed: true
                })
            );

            triggerUpdate();
        } else if (selRow === -2) {
            // Column Clear
            const colIndices: number[] = [];
            for (let c = minC; c <= maxC; c++) {
                // Optimistic: Clear column data
                table.rows.forEach((row) => {
                    if (c < row.length) row[c] = '';
                });
                colIndices.push(c);
            }

            this.host.dispatchEvent(
                new CustomEvent('columns-clear', {
                    detail: { sheetIndex: sheetIndex, tableIndex: tableIndex, colIndices: colIndices },
                    bubbles: true,
                    composed: true
                })
            );
            triggerUpdate();
        } else if (minR >= 0 && minC >= 0) {
            // Range Clear - Optimistic
            for (let r = minR; r <= maxR; r++) {
                if (r < table.rows.length) {
                    for (let c = minC; c <= maxC; c++) {
                        if (c < table.rows[r].length) {
                            table.rows[r][c] = '';
                        }
                    }
                }
            }

            this.host.dispatchEvent(
                new CustomEvent('range-edit', {
                    detail: {
                        sheetIndex: sheetIndex,
                        tableIndex: tableIndex,
                        startRow: minR,
                        endRow: maxR,
                        startCol: minC,
                        endCol: maxC,
                        newValue: ''
                    },
                    bubbles: true,
                    composed: true
                })
            );
            triggerUpdate();
        }
    }
}
