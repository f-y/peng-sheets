import { ReactiveController, ReactiveControllerHost } from 'lit';
import { SelectionController } from './selection-controller';

interface TableData {
    headers: string[] | null;
    rows: string[][];
}

import { EditController } from './edit-controller';

interface ClipboardHost extends ReactiveControllerHost {
    table: TableData | null;
    sheetIndex: number;
    tableIndex: number;
    selectionCtrl: SelectionController;
    editCtrl: EditController;
    dispatchEvent(event: Event): boolean;
    requestUpdate(): void;
}

/**
 * ClipboardController - Manages clipboard operations (copy, paste, delete).
 *
 * Handles:
 * - Copy selected cells to clipboard as TSV
 * - Paste TSV data from clipboard
 * - Delete/clear selected cells
 * - TSV parsing with RFC 4180 support
 */
export class ClipboardController implements ReactiveController {
    host: ClipboardHost;

    // Track the copied range for visual indicator (includes source location)
    copiedRange: {
        sheetIndex: number;
        tableIndex: number;
        minR: number;
        maxR: number;
        minC: number;
        maxC: number;
    } | null = null;

    constructor(host: ClipboardHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {}

    /**
     * Clear the copied range indicator
     */
    clearCopiedRange() {
        if (this.copiedRange) {
            this.copiedRange = null;
            this.host.requestUpdate();
        }
    }

    /**
     * Save the current selection as the copied range for visual indicator
     */
    private _saveCopiedRange() {
        const { table, selectionCtrl } = this.host;
        if (!table) return;

        const numCols = table?.headers?.length || 0;
        const numRows = table.rows.length;

        const anchorRow = selectionCtrl.selectionAnchorRow;
        const anchorCol = selectionCtrl.selectionAnchorCol;
        const selRow = selectionCtrl.selectedRow;
        const selCol = selectionCtrl.selectedCol;

        let minR = -1,
            maxR = -1,
            minC = -1,
            maxC = -1;

        // Full table selection (corner click)
        if (selRow === -2 && selCol === -2) {
            minR = 0;
            maxR = numRows - 1;
            minC = 0;
            maxC = numCols - 1;
        } else if (selCol === -2 && selRow >= 0) {
            // Row selection
            if (anchorRow >= 0) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
            } else {
                minR = maxR = selRow;
            }
            minC = 0;
            maxC = numCols - 1;
        } else if (selRow === -2 && selCol >= 0) {
            // Column selection
            if (anchorCol >= 0) {
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            } else {
                minC = maxC = selCol;
            }
            minR = 0;
            maxR = numRows - 1;
        } else if (selRow >= 0 && selCol >= 0) {
            // Cell or cell range selection
            if (anchorRow >= 0 && anchorCol >= 0) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            } else {
                // Single cell (no anchor set)
                minR = maxR = selRow;
                minC = maxC = selCol;
            }
        }

        if (minR >= 0 && minC >= 0) {
            this.copiedRange = {
                sheetIndex: this.host.sheetIndex,
                tableIndex: this.host.tableIndex,
                minR,
                maxR,
                minC,
                maxC
            };
            // Dispatch global event so other tables can clear their copy range
            this.host.dispatchEvent(
                new CustomEvent('copy-range-set', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        sheetIndex: this.host.sheetIndex,
                        tableIndex: this.host.tableIndex
                    }
                })
            );
            this.host.requestUpdate();
        }
    }

    /**
     * Parse TSV text that may contain quoted values with embedded newlines, tabs, or escaped quotes.
     * Follows RFC 4180 conventions: values containing special chars are quoted, quotes inside quoted values are doubled.
     */
    parseTsv(text: string): string[][] {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentValue = '';
        let inQuotes = false;
        let i = 0;

        while (i < text.length) {
            const char = text[i];

            if (inQuotes) {
                if (char === '"') {
                    // Check if this is an escaped quote (doubled)
                    if (i + 1 < text.length && text[i + 1] === '"') {
                        currentValue += '"';
                        i += 2;
                    } else {
                        // End of quoted value
                        inQuotes = false;
                        i++;
                    }
                } else {
                    currentValue += char;
                    i++;
                }
            } else {
                if (char === '"') {
                    // Start of quoted value
                    inQuotes = true;
                    i++;
                } else if (char === '\t') {
                    // Field delimiter - end current value
                    currentRow.push(currentValue);
                    currentValue = '';
                    i++;
                } else if (char === '\r') {
                    // Handle \r\n or standalone \r as row delimiter
                    currentRow.push(currentValue);
                    currentValue = '';
                    rows.push(currentRow);
                    currentRow = [];
                    if (i + 1 < text.length && text[i + 1] === '\n') {
                        i += 2;
                    } else {
                        i++;
                    }
                } else if (char === '\n') {
                    // Row delimiter
                    currentRow.push(currentValue);
                    currentValue = '';
                    rows.push(currentRow);
                    currentRow = [];
                    i++;
                } else {
                    currentValue += char;
                    i++;
                }
            }
        }

        // Add final value and row if any content remains
        if (currentValue !== '' || currentRow.length > 0) {
            currentRow.push(currentValue);
            rows.push(currentRow);
        }

        return rows;
    }

    /**
     * Escape a value for TSV format (quote if contains newline, tab, or quotes)
     */
    private _escapeTsvValue(val: string): string {
        if (val.includes('\n') || val.includes('\t') || val.includes('"')) {
            // Escape quotes by doubling them
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        return val;
    }

    /**
     * Copy selected cells to clipboard as TSV
     */
    async copyToClipboard(): Promise<void> {
        const text = this._getTsvForSelection();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            this._saveCopiedRange();
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }

    handleCopy(e: ClipboardEvent) {
        const text = this._getTsvForSelection();
        if (text) {
            e.clipboardData?.setData('text/plain', text);
            e.preventDefault();
            this._saveCopiedRange();
        }
    }

    handleCut(e: ClipboardEvent) {
        const text = this._getTsvForSelection();
        if (text) {
            e.clipboardData?.setData('text/plain', text);
            e.preventDefault();
            this.host.editCtrl.deleteSelection();
            // Clear copied range on cut (data is moved, not copied)
            this.clearCopiedRange();
        }
    }

    handlePaste(e: ClipboardEvent) {
        const text = e.clipboardData?.getData('text/plain');
        if (text) {
            e.preventDefault();
            this._pasteTsvData(text);
        }
    }

    private _getTsvForSelection(): string | null {
        const { table, selectionCtrl } = this.host;
        if (!table) return null;

        let minR = -100,
            maxR = -100,
            minC = -100,
            maxC = -100;
        // ... (existing logic)
        const numCols = table?.headers?.length || 0;
        const numRows = table.rows.length;

        const anchorRow = selectionCtrl.selectionAnchorRow;
        const anchorCol = selectionCtrl.selectionAnchorCol;
        const selRow = selectionCtrl.selectedRow;
        const selCol = selectionCtrl.selectedCol;

        // Full table selection (corner click)
        if (selRow === -2 && selCol === -2) {
            minR = 0;
            maxR = numRows - 1;
            minC = 0;
            maxC = numCols - 1;
        } else if (anchorRow !== -1 && anchorCol !== -1) {
            if (selCol === -2 || anchorCol === -2) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = 0;
                maxC = numCols - 1;
            } else if (selRow === -2 || anchorRow === -2) {
                minR = 0;
                maxR = numRows - 1;
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            } else {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            }
        } else if (selRow !== -2 && selCol !== -2) {
            minR = maxR = selRow;
            minC = maxC = selCol;
        }

        if (minR < -1 || minC < -1) return null;

        const effectiveMinR = Math.max(0, minR);
        const effectiveMaxR = Math.min(numRows - 1, maxR);
        const effectiveMinC = Math.max(0, minC);
        const effectiveMaxC = Math.min(numCols - 1, maxC);

        const rows: string[] = [];

        // Column selection or full table selection - include header row first
        const isColumnSelection = selRow === -2 || anchorRow === -2;
        const isFullTableSelection = selRow === -2 && selCol === -2;
        if ((isColumnSelection || isFullTableSelection) && table.headers) {
            const headerData: string[] = [];
            for (let c = effectiveMinC; c <= effectiveMaxC; c++) {
                headerData.push(this._escapeTsvValue(table.headers[c] || ''));
            }
            rows.push(headerData.join('\t'));
        }

        for (let r = effectiveMinR; r <= effectiveMaxR; r++) {
            const rowData: string[] = [];
            for (let c = effectiveMinC; c <= effectiveMaxC; c++) {
                const cellVal = table.rows[r][c] || '';
                rowData.push(this._escapeTsvValue(cellVal));
            }
            rows.push(rowData.join('\t'));
        }

        return rows.join('\n');
    }

    /**
     * Paste TSV data from clipboard into the spreadsheet
     */
    async paste(): Promise<void> {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this._pasteTsvData(text);
            }
        } catch (err) {
            console.error('Paste failed', err);
        }
    }

    private _pasteTsvData(text: string): void {
        const { table, selectionCtrl, sheetIndex, tableIndex } = this.host;
        if (!table) return;

        const rows = this.parseTsv(text);

        let startRow = selectionCtrl.selectedRow;
        let startCol = selectionCtrl.selectedCol;

        if (selectionCtrl.selectedRow === -1 || selectionCtrl.selectedCol === -1) {
            return;
        }

        // Full table selection (corner click)
        const isFullTableSelection = selectionCtrl.selectedRow === -2 && selectionCtrl.selectedCol === -2;

        // Column selection (row header area)
        const isColumnSelection = selectionCtrl.selectedRow === -2 && selectionCtrl.selectedCol !== -2;

        if (isFullTableSelection) {
            startRow = 0;
            startCol = 0;
        } else if (isColumnSelection) {
            startRow = 0;
            // startCol stays at selected column
        } else if (selectionCtrl.selectedCol === -2) {
            // Row selection
            startRow = selectionCtrl.selectedRow;
            startCol = 0;
        } else if (
            selectionCtrl.selectionAnchorRow !== -1 &&
            selectionCtrl.selectedRow !== -2 &&
            selectionCtrl.selectedCol !== -2
        ) {
            startRow = Math.min(selectionCtrl.selectionAnchorRow, selectionCtrl.selectedRow);
            startCol = Math.min(selectionCtrl.selectionAnchorCol, selectionCtrl.selectedCol);
        }

        if (selectionCtrl.selectedRow >= (table?.rows.length || 0)) {
            startRow = table?.rows.length || 0;
            startCol = 0;
        }

        // Include headers when pasting at row 0 with column/full selection
        const includeHeaders = isFullTableSelection || isColumnSelection;

        this.host.dispatchEvent(
            new CustomEvent('paste-cells', {
                detail: {
                    sheetIndex: sheetIndex,
                    tableIndex: tableIndex,
                    startRow: startRow,
                    startCol: startCol,
                    data: rows,
                    includeHeaders: includeHeaders
                },
                bubbles: true,
                composed: true
            })
        );
    }

    /**
     * Delete/clear the current selection
     */
}
