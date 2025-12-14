import { html, css, LitElement, PropertyValues, noChange } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { provideVSCodeDesignSystem, vsCodeButton } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(vsCodeButton());

export interface TableJSON {
    name: string | null;
    description: string | null;
    headers: string[] | null;
    rows: string[][];
    metadata: any;
    start_line: number | null;
    end_line: number | null;
}

@customElement("spreadsheet-table")
export class SpreadsheetTable extends LitElement {
    static styles = css`
    :host {
      display: block;
      margin-bottom: 0; /* Reduced bottom margin */
      --header-bg: var(--vscode-editor-inactiveSelectionBackground);
      --border-color: var(--vscode-widget-border);
      --cell-padding: 0.25rem;
      --selection-color: #217346; /* Excel-like Dark Green */
      box-sizing: border-box;
    }

    *, *:before, *:after {
        box-sizing: inherit;
    }
    
    .table-container {
        overflow: auto;
        max-height: 80vh;
        border: 1px solid var(--border-color);
        position: relative;
        width: fit-content;
    }

    .grid {
        display: grid;
        /* Grid columns will be set dynamically in style */
    }

    .cell {
        padding: var(--cell-padding);
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        white-space: nowrap;
        overflow: hidden;
        min-height: 24px;
        line-height: 24px;
        outline: none;
        background-color: var(--vscode-editor-background);
        cursor: default;
        user-select: none; /* Prevent text selection in nav mode */
    }
    
    .cell.selected {
        outline: 2px solid var(--selection-color);
        outline-offset: -2px; /* Draw inside to prevent clipping at edges */
        z-index: 100;
    }

    .cell.selected-row-cell {
        border-top: 2px solid var(--selection-color);
        border-bottom: 2px solid var(--selection-color);
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-row-cell.first { border-left: 2px solid var(--selection-color); }
    .cell.selected-row-cell.last { border-right: 2px solid var(--selection-color); }

    .cell.selected-col-cell {
        border-left: 2px solid var(--selection-color);
        border-right: 2px solid var(--selection-color);
        background-color: rgba(33, 115, 70, 0.05);
        z-index: 90;
    }
    .cell.selected-col-cell.first { border-top: 2px solid var(--selection-color); }
    .cell.selected-col-cell.last { border-bottom: 2px solid var(--selection-color); }
    .cell.selected-all-cell {
        background-color: rgba(33, 115, 70, 0.05); /* Just background */
        z-index: 90;
    }
    .cell.selected-all-cell.first-row { border-top: 2px solid var(--selection-color); }
    .cell.selected-all-cell.last-row { border-bottom: 2px solid var(--selection-color); }
    .cell.selected-all-cell.first-col { border-left: 2px solid var(--selection-color); }
    .cell.selected-all-cell.last-col { border-right: 2px solid var(--selection-color); }
    
    .cell.selected:focus {
         outline: 2px solid var(--selection-color);
         outline-offset: -2px;
    }
    
    .cell.editing {
        z-index: 101;
        background-color: var(--vscode-input-background, #fff);
        color: var(--vscode-input-foreground);
        outline: 2px solid var(--selection-color);
        outline-offset: -2px;
        user-select: text;
        cursor: text;
    }

    .cell:focus {
        /* Remove default browser focus ring, use .selected instead manually */
        outline: none;
    }

    /* Headers */
    .cell.header-col {
        background-color: var(--header-bg);
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        position: sticky;
        top: 0;
        z-index: 10;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0.1rem; /* Reduced padding */
        outline-offset: -2px; /* Ensure outline doesn't overflow */
    }
    
    .cell.header-col.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    .header-row {
        background-color: var(--header-bg);
        text-align: center; 
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        position: sticky;
        left: 0;
        z-index: 10;
        user-select: none;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0 0.6rem;
        display: flex;
        align-items: center;
        justify-content: center;
        outline-offset: -2px;
    }

    .header-row.selected {
        background-color: var(--vscode-editor-selectionBackground);
        color: var(--vscode-editor-selectionForeground);
        outline: none;
    }

    /* Corner Cell */
    .header-corner {
        background-color: var(--header-bg);
        z-index: 20; /* Higher than headers */
        position: sticky;
        top: 0;
        left: 0;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        text-align: center;
        color: var(--header-bg);
        user-select: none;
        outline-offset: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .metadata-input-title {
        font-size: 1.17em; /* h3 size */
        font-weight: bold;
        width: 100%;
        margin: 1rem 0 0.5rem 0;
        box-sizing: border-box;
        border: 1px solid var(--border-color); /* Transparent? */
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        padding: 4px;
    }
    
    .metadata-input-desc {
        width: 100%;
        margin: 0 0 1rem 0;
        box-sizing: border-box;
        border: 1px solid var(--border-color);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        font-family: inherit;
        padding: 4px;
    }
    
    .metadata-container {
        margin-bottom: 0.5rem;
    }

    .metadata-desc {
        min-height: 1.5em; /* Ensure clickable even if empty */
        margin: 0 0 1rem 0;
    }

    .context-menu {
        position: fixed;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        min-width: 150px;
        padding: 4px 0;
    }

    .context-menu-item {
        padding: 6px 12px;
        cursor: pointer;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        color: var(--vscode-foreground);
    }

    .context-menu-item:hover {
        background: var(--vscode-list-hoverBackground);
        color: var(--vscode-list-hoverForeground);
    }
    .col-resize-handle {
        position: absolute;
        top: 0;
        right: 0;
        width: 5px;
        height: 100%;
        cursor: col-resize;
        z-index: 20;
    }
    .col-resize-handle:hover {
        background-color: var(--selection-color);
    }
  `;

    @property({ type: Object })
    table: TableJSON | null = null;

    @property({ type: Number })
    sheetIndex: number = 0;

    @property({ type: Number })
    tableIndex: number = 0;

    @state()
    selectedRow: number = -1;

    @state()
    selectedCol: number = -1;

    @state()
    @state()
    isEditing: boolean = false;

    @state()
    colWidths: { [key: number]: number } = {};

    @state()
    resizingCol: number = -1;

    resizeStartX: number = 0;
    resizeStartWidth: number = 0;
    editingMetadata: boolean = false;

    @state()
    pendingTitle: string = "";

    @state()
    pendingDescription: string = "";

    @state()
    contextMenu: { x: number, y: number, type: 'row' | 'col', index: number } | null = null;


    // To track if we should focus the element after update
    private _shouldFocusCell: boolean = false;

    private _pendingEditValue: string | null = null; // New state for immediate edit

    willUpdate(changedProperties: PropertyValues) {
        if (changedProperties.has("table") && this.table) {
            const visual = this.table.metadata && this.table.metadata.visual;
            if (visual && visual.columnWidths) {
                if (Array.isArray(visual.columnWidths)) {
                    this.colWidths = {};
                    visual.columnWidths.forEach((w: number, i: number) => this.colWidths[i] = w);
                } else {
                    this.colWidths = { ...visual.columnWidths };
                }
            } else {
                this.colWidths = {};
            }
        }
    }

    private _getColumnTemplate(colCount: number) {
        let template = "40px"; // Row Header
        for (let i = 0; i < colCount; i++) {
            const width = this.colWidths[i];
            template += width ? ` ${width}px` : " 100px";
        }
        return template;
    }

    private _startColResize(e: MouseEvent, index: number) {
        e.preventDefault();
        e.stopPropagation();
        this.resizingCol = index;
        this.resizeStartX = e.clientX;

        // Use current DOM width if not explicitly set in state
        let currentWidth = this.colWidths[index];
        if (!currentWidth) {
            const headerCell = this.shadowRoot?.querySelector(`.header-col[data-col="${index}"]`);
            if (headerCell) {
                currentWidth = headerCell.getBoundingClientRect().width;
            } else {
                currentWidth = 100;
            }
        }
        this.resizeStartWidth = currentWidth;

        // Listen globally
        document.addEventListener('mousemove', this._handleColResizeMove);
        document.addEventListener('mouseup', this._endColResize);
    }

    private _handleColResizeMove = (e: MouseEvent) => {
        if (this.resizingCol === -1) return;
        const diff = e.clientX - this.resizeStartX;
        const newWidth = Math.max(30, this.resizeStartWidth + diff); // Min width 30

        // Optimistic update
        this.colWidths = { ...this.colWidths, [this.resizingCol]: newWidth };
    }

    private _endColResize = (e: MouseEvent) => {
        if (this.resizingCol === -1) return;

        // Dispatch change
        const finalWidth = this.colWidths[this.resizingCol];

        this.dispatchEvent(new CustomEvent('metadata-change', {
            detail: {
                sheetIndex: this.sheetIndex,
                tableIndex: this.tableIndex,
                metadata: {
                    columnWidths: { ...this.colWidths }
                }
            },
            bubbles: true,
            composed: true
        }));

        this.resizingCol = -1;
        document.removeEventListener('mousemove', this._handleColResizeMove);
        document.removeEventListener('mouseup', this._endColResize);
    }

    updated(changedProperties: PropertyValues) {
        if (this._shouldFocusCell) {
            this._focusSelectedCell();
            this._shouldFocusCell = false;
        }
    }

    private _focusSelectedCell() {
        if (this.selectedRow >= -2 && this.selectedCol >= -2) {
            // Find the cell element or header
            let selector = `.cell[data-row="${this.selectedRow}"][data-col="${this.selectedCol}"]`;

            // Handle Row/Col Selection cases where we focus the header
            if (this.selectedCol === -2) {
                // Row Selection: Focus Row Header
                selector = `.cell.header-row[data-row="${this.selectedRow}"]`;
            } else if (this.selectedRow === -2) {
                // Column Selection: Focus Column Header
                selector = `.cell.header-col[data-col="${this.selectedCol}"]`;
            } else if (this.selectedRow === -2 && this.selectedCol === -2) {
                // Select All: Focus Corner
                selector = `.cell.header-corner`;
            }

            const cell = this.shadowRoot?.querySelector(selector) as HTMLElement;
            if (cell) {
                cell.focus();

                // If we have a pending edit value, applying it now ensures it overrides the default content
                if (this._pendingEditValue !== null && this.isEditing) {
                    cell.innerText = this._pendingEditValue;
                    this._pendingEditValue = null;

                    // Place cursor at end
                    const range = document.createRange();
                    range.selectNodeContents(cell);
                    range.collapse(false);
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                } else if (this.isEditing) {
                    // Normal edit mode entry (F2/DblClick) - Place cursor at end
                    const range = document.createRange();
                    range.selectNodeContents(cell);
                    range.collapse(false); // false = end
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }
        }
    }

    private _handleCellClick(e: MouseEvent, rowIndex: number, colIndex: number) {
        // Explicitly commit if we were editing to ensure we capture value BEFORE selection changes/re-render.
        if (this.isEditing) {
            this._commitEdit(new Event('manual-commit'));
        }

        this.selectedRow = rowIndex;
        this.selectedCol = colIndex;

        // If we are clicking, we probably want to focus the cell.
        // If we were editing, blur happens, commit happens.
        // Then focus moves to new selection.
        this._shouldFocusCell = true;
    }

    private _handleInput(e: Event) {
        const target = e.target as HTMLElement;
        this._pendingEditValue = target.innerText;
    }

    private _handleCellDblClick(e: MouseEvent, rowIndex: number, colIndex: number) {
        this.selectedRow = rowIndex;
        this.selectedCol = colIndex;
        this.isEditing = true;
        this._shouldFocusCell = true;
    }

    private _handleKeyDown(e: KeyboardEvent, isHeader: boolean = false) {
        if (e.isComposing) return;

        if (this.isEditing) {
            this._handleEditModeKey(e);
            return;
        }

        const isControl = e.ctrlKey || e.metaKey || e.altKey;

        // Range Selection overrides
        // If Column Selection (selectedRow == -2) AND typing -> Edit Header (Row -1)
        if (this.selectedRow === -2 && this.selectedCol >= 0 && !isControl && e.key.length === 1) {
            e.preventDefault();
            this.selectedRow = -1; // Switch to header
            this._startEditing(e.key);
            return;
        }

        const isRangeSelection = this.selectedCol === -2 || this.selectedRow === -2;

        if (!isControl && e.key.length === 1 && !isRangeSelection) {
            e.preventDefault();
            this._startEditing(e.key);
            return;
        }

        this._handleNavigationKey(e);
    }

    private _handleEditModeKey(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this._commitEdit(e);
            // Move down (or up if Shift)
            const dRow = e.shiftKey ? -1 : 1;
            // Ensure we don't move out of bounds excessively (logic in _moveSelection handles clamping but we can check basic bounds)
            this._moveSelection(dRow, 0);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this._commitEdit(e);

            const colCount = this.table?.headers ? this.table.headers.length : (this.table?.rows[0]?.length || 0);

            if (e.shiftKey) {
                // Shift+Tab: Move Left
                if (this.selectedCol === 0) {
                    // Wrap to previous row (Last Col)
                    this._moveSelection(-1, colCount - 1 - this.selectedCol); // -1 Row, Target Col (colCount-1) - Current(0) = colCount-1
                } else {
                    this._moveSelection(0, -1);
                }
            } else {
                // Tab: Move Right
                if (this.selectedCol === colCount - 1) {
                    // Wrap to next row (First Col)
                    this._moveSelection(1, -this.selectedCol); // +1 Row, Reset Col to 0
                } else {
                    this._moveSelection(0, 1);
                }
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this._cancelEdit();
        }
    }

    private _handleNavigationKey(e: KeyboardEvent) {
        let dRow = 0;
        let dCol = 0;

        switch (e.key) {
            case 'ArrowUp': dRow = -1; break;
            case 'ArrowDown': dRow = 1; break;
            case 'ArrowLeft': dCol = -1; break;
            case 'ArrowRight': dCol = 1; break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this._deleteSelection();
                return;
            case 'F2':
                e.preventDefault();
                this._startEditing(null);
                return;
            case 'Enter':
                e.preventDefault();
                if (this.isEditing) {
                    // Logic handled in EditModeKey usually, but just in case
                }
                dRow = e.shiftKey ? -1 : 1;
                break;
            case 'Tab':
                e.preventDefault();
                // Logic same as Edit Mode but no commit needed (already saved or not editing)
                // Actually if we were editing, handleEditModeKey would catch it.
                // So this is purely Navigation Mode.

                const colCount = this.table?.headers ? this.table.headers.length : (this.table?.rows[0]?.length || 0);
                if (e.shiftKey) {
                    // Shift+Tab: Move Left
                    if (this.selectedCol === 0) {
                        // Wrap to previous row
                        // We can't use dRow/dCol simple accumulation for wrapping easily unless we custom handle
                        // So we call _moveSelection directly and return
                        this._moveSelection(-1, colCount - 1 - this.selectedCol);
                        return;
                    } else {
                        dCol = -1;
                    }
                } else {
                    // Tab: Move Right
                    if (this.selectedCol === colCount - 1) {
                        // Wrap to next row
                        this._moveSelection(1, -this.selectedCol);
                        return;
                    } else {
                        dCol = 1;
                    }
                }
                break;
            default:
                return;
        }

        if (dRow !== 0 || dCol !== 0) {
            e.preventDefault();
            this._moveSelection(dRow, dCol);
        }
    }

    private _startEditing(initialValue: string | null) {
        this.isEditing = true;
        this._pendingEditValue = initialValue;
        this._shouldFocusCell = true;

        if (initialValue !== null) {
            const cell = this.shadowRoot?.querySelector(`.cell[data-row="${this.selectedRow}"][data-col="${this.selectedCol}"]`) as HTMLElement;
            if (cell) {
                cell.innerText = initialValue;
            }
        }
    }

    private _moveSelection(dRow: number, dCol: number) {
        if (!this.table) return;

        const rowCount = this.table.rows.length;
        const colCount = this.table.headers ? this.table.headers.length : (this.table.rows[0]?.length || 0);

        // Current
        let r = this.selectedRow;
        let c = this.selectedCol;

        // If in Row/Col selection (sentinel -2), collapse to specific cell?
        // Excel: Moving arrows from Row selection -> Moves active cell.
        // Simplified: Reset to 0,0 or clamping?
        // If I press Down on Row 5 (Selected), go to Row 6 (Selected).
        // If I press Right on Row 5 (Selected), go to Row 5, Col 0?

        if (c === -2 && dRow !== 0) {
            // Move Row Selection
            let newR = r + dRow;
            if (newR >= 0 && newR <= rowCount) { // Allow ghost row
                this.selectedRow = newR;
                this._shouldFocusCell = true;
            }
            return;
        }
        if (r === -2 && dCol !== 0) {
            // Move Col Selection
            let newC = c + dCol;
            if (newC >= 0 && newC < colCount) {
                this.selectedCol = newC;
                this._shouldFocusCell = true;
            }
            return;
        }

        // If escaping selection mode to cell mode
        if (c === -2 && dCol !== 0) {
            c = 0; // Default to col 0?
        }
        if (r === -2 && dRow !== 0) {
            r = 0; // Default to row 0?
        }


        let newR = r + dRow;
        let newC = c + dCol;

        // Clamp
        // Allow -1 for Header Row if we want navigation to headers? Yes.
        // But headers handles are separate in render (rowIndex -1).

        // Limits:
        // Rows: -1 to rowCount - 1
        // Cols: 0 to colCount - 1

        if (newR < -1) newR = -1;
        if (newR > rowCount) newR = rowCount; // Allow selecting the ghost row (index = rowCount)
        if (newC < 0) newC = 0;
        if (newC >= colCount) newC = colCount - 1;

        // Update
        this.selectedRow = newR;
        this.selectedCol = newC;
        this._shouldFocusCell = true;
    }

    private _isCommitting: boolean = false;

    private async _commitEdit(e: Event) {
        if (this._isCommitting) return;
        this._isCommitting = true;

        try {

            try {
                const target = e.target as HTMLElement;
                // Safety check
                let cell = target;
                if (!cell || !cell.classList || !cell.classList.contains('cell')) {
                    const found = this.shadowRoot?.querySelector('.cell.editing');
                    if (found) cell = found as HTMLElement;
                    else return; // If no editing cell found, nothing to commit
                }

                let newValue = this._pendingEditValue !== null ? this._pendingEditValue : cell.innerText;
                if (newValue === '\n') {
                    newValue = "";
                }

                // Remove manual clear to prevent Lit dirty-check failure (Fixes Disappearing Text)
                // if (cell) cell.textContent = "";

                // Parse coordinates from the cell element
                let editRow = parseInt(cell.dataset.row || "-10"); // -10 as invalid sentinel
                let editCol = parseInt(cell.dataset.col || "-10");

                // Fallback to selected if parsing fails (should not happen)
                if (isNaN(editRow)) editRow = this.selectedRow;
                if (isNaN(editCol)) editCol = this.selectedCol;

                // Optimistic Update
                if (this.table && editCol >= 0) {

                    // Header Update
                    if (editRow === -1) {
                        if (this.table.headers && editCol < this.table.headers.length) {
                            this.table.headers[editCol] = newValue;
                        }
                    }
                    // Body Update
                    else if (editRow >= 0 && editRow < this.table.rows.length) {
                        if (editCol < this.table.rows[editRow].length) {
                            this.table.rows[editRow][editCol] = newValue;
                        }
                    }
                    // Ghost Row Update (Add Row)
                    else if (editRow === this.table.rows.length) {
                        // Create new row
                        const width = this.table.headers ? this.table.headers.length : (this.table.rows[0]?.length || 0);
                        const newRow = new Array(width).fill("");
                        if (editCol < width) newRow[editCol] = newValue;
                        this.table.rows.push(newRow);
                    }

                    this.requestUpdate();
                }

                // Dispatch update
                this.dispatchEvent(new CustomEvent('cell-edit', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: this.tableIndex,
                        rowIndex: editRow,
                        colIndex: editCol,
                        newValue: newValue
                    },
                    bubbles: true,
                    composed: true
                }));

                this.isEditing = false;
                this._shouldFocusCell = true; // Focus back to item
            } finally {
                // Short delay to prevent blur from triggering immediately after?
                // Or just reset.
                this._isCommitting = false;
                this._pendingEditValue = null;
            }
        } catch (err) {
            // Ignore error or log unobtrusively if needed
        }
    }

    private _cancelEdit() {
        if (this._isCommitting) return;
        this.isEditing = false;
        // Revert content usage? Lit will re-render and revert text if we didn't update state.
        this.requestUpdate();
        this._shouldFocusCell = true;
    }

    private _handleBlur(e: FocusEvent) {
        // If editing, commit on blur?
        // Check if we are still editing and not already committing
        if (this.isEditing && !this._isCommitting) {
            this._commitEdit(e);
        }
    }

    private _deleteSelection() {
        if (!this.table) return;

        const rowCount = this.table.rows.length;
        const colCount = this.table.headers ? this.table.headers.length : (this.table.rows[0]?.length || 0);

        // Optimistic Update Helper
        const triggerUpdate = () => this.requestUpdate();

        // Single Cell
        if (this.selectedRow >= 0 && this.selectedCol >= 0) {
            // Optimistic
            if (this.selectedRow < rowCount && this.selectedCol < (this.table.rows[this.selectedRow].length)) {
                this.table.rows[this.selectedRow][this.selectedCol] = "";
                triggerUpdate();
            }
            this._updateCell(this.selectedRow, this.selectedCol, "");
        }
        // Row Selection
        else if (this.selectedRow >= 0 && this.selectedCol === -2) {
            // Structural Deletion Logic
            // Optimistic update locally
            if (this.selectedRow < rowCount) {
                this.table.rows.splice(this.selectedRow, 1);
                triggerUpdate();
            }

            // Emit explicit row-delete event
            this.dispatchEvent(new CustomEvent('row-delete', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    tableIndex: this.tableIndex,
                    rowIndex: this.selectedRow
                },
                bubbles: true,
                composed: true
            }));

            // Adjust selection after delete?
            // If we deleted last row, move up.
            if (this.selectedRow >= this.table.rows.length) {
                this.selectedRow = Math.max(-1, this.table.rows.length - 1);
            }
        }
        // Column Selection
        else if (this.selectedRow === -2 && this.selectedCol >= 0) {
            // Content Clear Logic (Reverted to original behavior)
            // Optimistic update locally
            const rowCount = this.table.rows.length;
            for (let r = 0; r < rowCount; r++) {
                if (this.selectedCol < this.table.rows[r].length) {
                    this.table.rows[r][this.selectedCol] = "";
                }
            }

            triggerUpdate();

            // Emit explicit column-clear event
            this.dispatchEvent(new CustomEvent('column-clear', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    tableIndex: this.tableIndex,
                    colIndex: this.selectedCol
                },
                bubbles: true,
                composed: true
            }));

            // Selection stays
        }
        // Select All (Optional, but safe now)
        else if (this.selectedRow === -2 && this.selectedCol === -2) {
            // Optimistic: Clear All? Or Delete All? 
            // Usually Clear All content.
            for (let r = 0; r < rowCount; r++) {
                for (let c = 0; c < this.table.rows[r].length; c++) {
                    this.table.rows[r][c] = "";
                }
            }
            if (this.table.headers) {
                for (let c = 0; c < this.table.headers.length; c++) this.table.headers[c] = "";
            }
            triggerUpdate();

            this._updateRange(
                0, rowCount - 1,
                0, colCount - 1,
                ""
            );
        }
    }

    private _updateRange(startRow: number, endRow: number, startCol: number, endCol: number, val: string) {
        this.dispatchEvent(new CustomEvent('range-edit', {
            detail: {
                sheetIndex: this.sheetIndex,
                tableIndex: this.tableIndex,
                startRow: startRow,
                endRow: endRow,
                startCol: startCol,
                endCol: endCol,
                newValue: val
            },
            bubbles: true,
            composed: true
        }));
    }

    private _updateCell(r: number, c: number, val: string) {
        this.dispatchEvent(new CustomEvent('cell-edit', {
            detail: {
                sheetIndex: this.sheetIndex,
                tableIndex: this.tableIndex,
                rowIndex: r,
                colIndex: c,
                newValue: val
            },
            bubbles: true,
            composed: true
        }));
    }

    private _handleMetadataDblClick() {
        if (!this.table) return;
        this.pendingTitle = this.table.name || "";
        this.pendingDescription = this.table.description || "";
        this.editingMetadata = true;
        setTimeout(() => {
            const input = this.shadowRoot?.querySelector('.metadata-input-title') as HTMLInputElement;
            if (input) input.focus();
        }, 0);
    }

    private _handleMetadataKeydown(e: KeyboardEvent) {
        if (e.isComposing) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.editingMetadata = false;
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._commitMetadata();
        }
    }

    private _commitMetadata(e?: FocusEvent) {
        if (!this.editingMetadata) return;

        // If blurring to another metadata field, do not close
        if (e && e.relatedTarget) {
            const target = e.relatedTarget as HTMLElement;
            if (target.classList.contains('metadata-input-title') || target.classList.contains('metadata-input-desc')) {
                return;
            }
        }

        this.editingMetadata = false;

        if (this.pendingTitle !== (this.table?.name || "") || this.pendingDescription !== (this.table?.description || "")) {
            this.dispatchEvent(new CustomEvent('metadata-edit', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    tableIndex: this.tableIndex,
                    name: this.pendingTitle,
                    description: this.pendingDescription
                },
                bubbles: true,
                composed: true
            }));
        }
    }

    private _handleRowHeaderClick(e: MouseEvent, rowIndex: number) {
        this.selectedRow = rowIndex;
        this.selectedCol = -2;
        this._shouldFocusCell = true; // Focus the header
    }

    private _handleColumnHeaderClick(e: MouseEvent, colIndex: number) {
        this.selectedRow = -2;
        this.selectedCol = colIndex;
        this._shouldFocusCell = true; // Focus the header
    }

    private _handleContextMenu(e: MouseEvent, type: 'row' | 'col', index: number) {
        e.preventDefault();
        e.stopPropagation();
        this.contextMenu = {
            x: e.clientX,
            y: e.clientY,
            type: type,
            index: index
        };
        // Also select the item
        if (type === 'row') {
            this.selectedRow = index;
            this.selectedCol = -2;
        } else {
            this.selectedRow = -2;
            this.selectedCol = index;
        }
    }

    private _closeContextMenu() {
        this.contextMenu = null;
    }

    private _dispatchAction(action: string, detail: any) {
        this.dispatchEvent(new CustomEvent(action, {
            detail: {
                sheetIndex: this.sheetIndex,
                tableIndex: this.tableIndex,
                ...detail
            },
            bubbles: true,
            composed: true
        }));
        this._closeContextMenu();
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('click', this._handleGlobalClick);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('click', this._handleGlobalClick);
    }

    private _handleGlobalClick = (e: MouseEvent) => {
        // If click is outside menu, close it
        if (this.contextMenu) {
            this._closeContextMenu();
        }
    }

    render() {
        if (!this.table) return html``;

        const table = this.table;
        const colCount = table.headers ? table.headers.length : (table.rows.length > 0 ? table.rows[0].length : 0);

        return html`
            <div class="metadata-container">
               ${this.editingMetadata ? html`
                    <input 
                        class="metadata-input-title" 
                        .value="${table.name || ""}" 
                        placeholder="Table Name"
                        @input="${(e: Event) => this.pendingTitle = (e.target as HTMLInputElement).value}"
                        @keydown="${this._handleMetadataKeydown}"
                        @blur="${this._commitMetadata}"
                    />
                    <textarea 
                        class="metadata-input-desc" 
                        .value="${table.description || ""}" 
                        placeholder="Description"
                        @input="${(e: Event) => this.pendingDescription = (e.target as HTMLInputElement).value}"
                        @keydown="${this._handleMetadataKeydown}"
                        @blur="${this._commitMetadata}"
                        rows="2"
                    ></textarea>
               ` : html`
                     <h3 @dblclick="${this._handleMetadataDblClick}">${table.name || "Table " + (this.tableIndex + 1)}</h3>
                     ${table.description ? html`
                        <p class="metadata-desc" @dblclick="${this._handleMetadataDblClick}" style="color: var(--vscode-descriptionForeground);">
                            ${table.description}
                        </p>
                     ` : ''}
                `}
            </div>

            <div class="table-container">
                <div class="grid" style="grid-template-columns: ${this._getColumnTemplate(colCount)};">
                    <!-- Corner -->
                    <div class="cell header-corner" @click="${() => { this.selectedRow = -2; this.selectedCol = -2; }}"></div>

                    <!-- Column Headers -->
                    ${table.headers ? table.headers.map((header, i) => html`
                        <div 
                            class="cell header-col ${this.selectedCol === i || (this.selectedCol === -2 && this.selectedRow === -2) ? 'selected' : ''} ${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'editing' : ''}"
                            data-col="${i}"
                            data-row="-1"
                            tabindex="0"
                            contenteditable="${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'true' : 'false'}"
                            @click="${(e: MouseEvent) => this._handleColumnHeaderClick(e, i)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, -1, i)}"
                            @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'col', i)}"
                            @input="${this._handleInput}"
                            @blur="${this._handleBlur}"
                            @keydown="${this._handleKeyDown}"
                        >
                            ${header}
                            <div class="col-resize-handle" @mousedown="${(e: MouseEvent) => this._startColResize(e, i)}"></div>
                        </div>
                    `) : Array.from({ length: colCount }).map((_, i) => html`
                         <div 
                            class="cell header-col ${this.selectedCol === i || (this.selectedCol === -2 && this.selectedRow === -2) ? 'selected' : ''} ${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'editing' : ''}"
                            data-col="${i}"
                            data-row="-1"
                            tabindex="0"
                            contenteditable="${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'true' : 'false'}"
                            @click="${(e: MouseEvent) => this._handleColumnHeaderClick(e, i)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, -1, i)}"
                            @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'col', i)}"
                            @input="${this._handleInput}"
                            @blur="${this._handleBlur}"
                            @keydown="${this._handleKeyDown}"
                         >
                            ${i + 1}
                            <div class="col-resize-handle" @mousedown="${(e: MouseEvent) => this._startColResize(e, i)}"></div>
                         </div>
                    `)}

                    <!-- Rows -->
                    ${table.rows.map((row, r) => html`
                        <!-- Row Header -->
                        <div 
                            class="cell header-row ${this.selectedRow === r || (this.selectedRow === -2 && this.selectedCol === -2) ? 'selected' : ''}"
                            data-row="${r}"
                            tabindex="0"
                            @click="${(e: MouseEvent) => this._handleRowHeaderClick(e, r)}"
                            @keydown="${this._handleKeyDown}"
                            @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'row', r)}"
                        >${r + 1}</div>

                        <!-- Cells -->
                        ${row.map((cell, c) => {
            const isSelected = this.selectedRow === r && this.selectedCol === c;
            const isRowSelected = this.selectedRow === r && this.selectedCol === -2;
            const isColSelected = this.selectedRow === -2 && this.selectedCol === c;
            const isAllSelected = this.selectedRow === -2 && this.selectedCol === -2;

            const classes = [
                'cell',
                isSelected ? 'selected' : '',
                isRowSelected ? 'selected-row-cell' : '',
                isColSelected ? 'selected-col-cell' : '',
                isAllSelected ? 'selected-all-cell' : '',
                this.isEditing && isSelected ? 'editing' : ''
            ].filter(Boolean).join(' ');

            return html`
                                <div 
                                    class="${classes}"
                                    tabindex="${isSelected ? 0 : -1}"
                                    data-row="${r}" 
                                    data-col="${c}"
                                    contenteditable="${this.isEditing && isSelected ? 'true' : 'false'}"
                                    .textContent="${this.isEditing && isSelected ? noChange : live(cell)}"
                                    @click="${(e: MouseEvent) => this._handleCellClick(e, r, c)}"
                                    @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, r, c)}"
                                    @keydown="${this._handleKeyDown}"
                                    @input="${this._handleInput}"
                                    @blur="${this._handleBlur}"
                                ></div>
                             `;
        })}
                    `)}

                    <!-- Ghost Row (Add Row) -->
                    <div class="cell header-row" style="color: var(--vscode-disabledForeground);">${table.rows.length + 1}</div>
                    ${Array.from({ length: colCount }).map((_, colIndex) => html`
                         <div 
                            class="cell ${this.selectedRow === table.rows.length && this.selectedCol === colIndex ? 'selected' : ''} ${this.isEditing && this.selectedRow === table.rows.length && this.selectedCol === colIndex ? 'editing' : ''}"
                            data-row="${table.rows.length}"
                            data-col="${colIndex}"
                            tabindex="${this.selectedRow === table.rows.length && this.selectedCol === colIndex ? '0' : '-1'}"
                            contenteditable="${this.isEditing && this.selectedRow === table.rows.length && this.selectedCol === colIndex ? 'true' : 'false'}"
                            .textContent="${this.isEditing && this.selectedRow === table.rows.length && this.selectedCol === colIndex ? noChange : live('')}"
                            @click="${(e: MouseEvent) => this._handleCellClick(e, table.rows.length, colIndex)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, table.rows.length, colIndex)}"
                            @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                            @input="${(e: Event) => this._handleInput(e)}"
                            @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                        ></div>
                    `)}
                </div>
                
                ${this.contextMenu ? html`
                    <div class="context-menu" style="top: ${this.contextMenu.y}px; left: ${this.contextMenu.x}px;">
                        ${this.contextMenu.type === 'row' ? html`
                            <div class="context-menu-item" @click="${() => this._dispatchAction('row-insert', { rowIndex: this.contextMenu?.index })}">Insert Row Above</div>
                            <div class="context-menu-item" @click="${() => this._dispatchAction('row-delete', { rowIndex: this.contextMenu?.index })}">Delete Row</div>
                        ` : html`
                            <div class="context-menu-item" @click="${() => this._dispatchAction('column-insert', { colIndex: this.contextMenu!.index + 1 })}">Add Column Right</div>
                            <div class="context-menu-item" @click="${() => this._dispatchAction('column-delete', { colIndex: this.contextMenu?.index })}">Delete Column</div>
                            <div class="context-menu-item" @click="${() => this._dispatchAction('column-clear', { colIndex: this.contextMenu?.index })}">Clear Column Content</div>
                        `}
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }
}
