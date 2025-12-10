import { html, css, LitElement, PropertyValues } from "lit";
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
        position: sticky;
        top: 0;
        left: 0;
        color: var(--header-bg);
        z-index: 20;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0 0.6rem;
        display: flex;
        align-items: center;
        justify-content: center;
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
    isEditing: boolean = false;

    // To track if we should focus the element after update
    private _shouldFocusCell: boolean = false;
    private _pendingEditValue: string | null = null; // New state for immediate edit

    updated(changedProperties: PropertyValues) {
        if (this._shouldFocusCell) {
            this._focusSelectedCell();
            this._shouldFocusCell = false;
        }
    }

    private _focusSelectedCell() {
        if (this.selectedRow >= -1 && this.selectedCol !== -1) {
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
        if (this.isEditing) return; // Don't change selection if editing (unless clicked outside? handled by blur)
        this.selectedRow = rowIndex;
        this.selectedCol = colIndex;
        this._shouldFocusCell = true; // Focus handled naturally by click usually, but good to enforce
    }

    private _handleCellDblClick(e: MouseEvent, rowIndex: number, colIndex: number) {
        this.selectedRow = rowIndex;
        this.selectedCol = colIndex;
        this.isEditing = true;
        this._shouldFocusCell = true;
    }

    private _handleKeyDown(e: KeyboardEvent, isHeader: boolean = false) {
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
            // Move down? Standards say Enter commits and usually moves down
            if (this.selectedRow < (this.table?.rows.length || 0)) {
                this._moveSelection(1, 0);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this._commitEdit(e);

            // Tab Logic: Move Right. If last col, move to next row first col.
            const colCount = this.table?.headers ? this.table.headers.length : (this.table?.rows[0]?.length || 0);

            if (this.selectedCol === colCount - 1) {
                // Wrap to next row
                // User said "move to the cell below" (Next line). 
                // Implicitly this usually means first cell of next line in text editors, 
                // but in Excel selection wrap it is A(n+1).
                this._moveSelection(1, -this.selectedCol); // +1 Row, Reset Col to 0 (delta = -current)
            } else {
                this._moveSelection(0, 1);
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
                dRow = 1;
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
            const target = e.target as HTMLElement;
            // Safety check
            let cell = target;
            if (!cell.classList.contains('cell')) {
                const found = this.shadowRoot?.querySelector('.cell.editing');
                if (found) cell = found as HTMLElement;
                else return;
            }

            let newValue = cell.innerText;
            if (newValue === '\n') {
                newValue = "";
            }

            // Remove manual clear to prevent Lit dirty-check failure (Fixes Disappearing Text)
            // if (cell) cell.textContent = "";

            // Optimistic Update
            if (this.table && this.selectedCol >= 0) { // Row can be -1 (Header) or length (Ghost)

                // Header Update
                if (this.selectedRow === -1) {
                    if (this.table.headers && this.selectedCol < this.table.headers.length) {
                        this.table.headers[this.selectedCol] = newValue;
                    }
                }
                // Body Update
                else if (this.selectedRow >= 0 && this.selectedRow < this.table.rows.length) {
                    if (this.selectedCol < this.table.rows[this.selectedRow].length) {
                        this.table.rows[this.selectedRow][this.selectedCol] = newValue;
                    }
                }
                // Ghost Row Update (Add Row)
                else if (this.selectedRow === this.table.rows.length) {
                    // Create new row
                    const width = this.table.headers ? this.table.headers.length : (this.table.rows[0]?.length || 0);
                    const newRow = new Array(width).fill("");
                    if (this.selectedCol < width) newRow[this.selectedCol] = newValue;
                    this.table.rows.push(newRow);
                }

                this.requestUpdate();
            }

            // Dispatch update
            this.dispatchEvent(new CustomEvent('cell-edit', {
                detail: {
                    sheetIndex: this.sheetIndex,
                    tableIndex: this.tableIndex,
                    rowIndex: this.selectedRow,
                    colIndex: this.selectedCol,
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
            // Optimistic
            if (this.selectedRow < rowCount) {
                // If last row -> Delete?
                // Logic in main.ts matches this: if selectedRow == rowCount - 1 (Last Row) -> Delete.
                if (this.selectedRow === rowCount - 1) {
                    this.table.rows.splice(this.selectedRow, 1);
                } else {
                    // Just clear content
                    const row = this.table.rows[this.selectedRow];
                    for (let c = 0; c < row.length; c++) row[c] = "";
                }
                triggerUpdate();
            }

            this._updateRange(
                this.selectedRow, this.selectedRow,
                0, Number.MAX_SAFE_INTEGER, // Ensure backend sees this as "All Columns"
                ""
            );
        }
        // Column Selection
        else if (this.selectedRow === -2 && this.selectedCol >= 0) {
            // Optimistic
            for (let r = 0; r < rowCount; r++) {
                if (this.selectedCol < this.table.rows[r].length) {
                    this.table.rows[r][this.selectedCol] = "";
                }
            }
            if (this.table.headers && this.selectedCol < this.table.headers.length) {
                this.table.headers[this.selectedCol] = "";
            }
            triggerUpdate();

            this._updateRange(
                0, rowCount - 1,
                this.selectedCol, this.selectedCol,
                ""
            );
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

    render() {
        if (!this.table) return html``;

        const table = this.table;
        const colCount = table.headers ? table.headers.length : (table.rows.length > 0 ? table.rows[0].length : 0);

        // Grid Template: RowHeader (max-content) + Columns (1fr each)
        const gridStyle = `grid-template-columns: max-content repeat(${colCount}, minmax(100px, 1fr));`;

        const isHeaderEditable = (colIndex: number) => {
            return this.isEditing && this.selectedRow === -1 && this.selectedCol === colIndex;
        };

        return html`
        <div>
            ${table.name
                ? html`<h3 style="margin: 1rem 0 0.5rem 0; color: var(--vscode-foreground);">${table.name}</h3>`
                : html`<h3 style="margin: 1rem 0 0.5rem 0; color: var(--vscode-disabledForeground); font-style: italic;">(Untitled Table)</h3>`
            }
            ${table.description ? html`<p style="margin: 0 0 1rem 0; color: var(--vscode-descriptionForeground);">${table.description}</p>` : ''}
            
            <div class="table-container">
                <div class="grid" style="${gridStyle}">
                    <!-- Corner Cell -->
                    <div 
                        class="cell header-corner" 
                        @click="${() => { this.selectedRow = -2; this.selectedCol = -2; this._shouldFocusCell = true; }}"
                        style="cursor: pointer;"
                        title="Select All"
                        tabindex="${this.selectedRow === -2 && this.selectedCol === -2 ? '0' : '-1'}"
                        @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e, true)}"
                    >${table.rows.length}</div>

                    <!-- Column Headers (Integrated) -->
                    ${Array.from({ length: colCount }).map((_, i) => html`
                        <div 
                            class="cell header-col ${this.selectedCol === i && this.selectedRow === -2 ? 'selected' : ''} ${isHeaderEditable(i) ? 'editing' : ''}"
                            style="font-weight: bold; cursor: pointer;"
                            data-row="-1"
                            data-col="${i}"
                            tabindex="${this.selectedCol === i && this.selectedRow === -2 ? '0' : '-1'}"
                            contenteditable="${isHeaderEditable(i) ? 'true' : 'false'}"
                            @click="${(e: MouseEvent) => this._handleColumnHeaderClick(e, i)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, -1, i)}"
                            @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                            @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e, true)}"
                            .textContent=${table.headers && table.headers[i] ? table.headers[i] : ''}
                        ></div>
                    `)}

                    <!-- Data Rows -->
                    ${table.rows.map((row, rowIndex) => html`
                        <!-- Row Header -->
                        <div 
                            class="cell header-row ${this.selectedRow === rowIndex && this.selectedCol === -2 ? 'selected' : ''}"
                            style="cursor: pointer;"
                            data-row="${rowIndex}"
                            data-col="-2"
                            tabindex="${this.selectedRow === rowIndex && this.selectedCol === -2 ? '0' : '-1'}"
                            @click="${(e: MouseEvent) => this._handleRowHeaderClick(e, rowIndex)}"
                            @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e, true)}"
                        >${rowIndex + 1}</div>
                        
                        ${row.map((cell, colIndex) => {
                // Determine selection class
                let selectionClass = '';
                if (this.selectedRow === rowIndex && this.selectedCol === colIndex) {
                    selectionClass = 'selected';
                } else if (this.selectedRow === rowIndex && this.selectedCol === -2) {
                    selectionClass = 'selected-row-cell';
                    if (colIndex === 0) selectionClass += ' first';
                    if (colIndex === colCount - 1) selectionClass += ' last';
                } else if (this.selectedRow === -2 && this.selectedCol === colIndex) {
                    selectionClass = 'selected-col-cell';
                    if (rowIndex === 0) selectionClass += ' first';
                    if (rowIndex === table.rows.length - 1) selectionClass += ' last';
                } else if (this.selectedRow === -2 && this.selectedCol === -2) {
                    selectionClass = 'selected-all-cell';
                    if (rowIndex === 0) selectionClass += ' first-row';
                    if (rowIndex === table.rows.length - 1) selectionClass += ' last-row';
                    if (colIndex === 0) selectionClass += ' first-col';
                    if (colIndex === colCount - 1) selectionClass += ' last-col';
                }

                const isEditableFunc = () => {
                    // Only exact cell match allows editing
                    return this.isEditing && this.selectedRow === rowIndex && this.selectedCol === colIndex;
                };

                return html`
                            <div 
                                class="cell ${selectionClass} ${isEditableFunc() ? 'editing' : ''}"
                                data-row="${rowIndex}"
                                data-col="${colIndex}"
                                tabindex="${this.selectedRow === rowIndex && this.selectedCol === colIndex ? '0' : '-1'}"
                                contenteditable="${isEditableFunc() ? 'true' : 'false'}"
                                @click="${(e: MouseEvent) => this._handleCellClick(e, rowIndex, colIndex)}"
                                @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, rowIndex, colIndex)}"
                                @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                                @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                                .textContent=${cell}
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
                            @click="${(e: MouseEvent) => this._handleCellClick(e, table.rows.length, colIndex)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, table.rows.length, colIndex)}"
                            @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                            @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                            .textContent=${live("")}
                        ></div>
                    `)}
                </div>
            </div>
        </div>
    `;
    }
}
