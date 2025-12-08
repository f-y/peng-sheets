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
    }

    .header-row {
        background-color: var(--header-bg);
        text-align: center; 
        font-weight: normal;
        color: var(--vscode-descriptionForeground);
        position: sticky;
        left: 0;
        z-index: 10;
        /* width: max-content; Removed */
        user-select: none;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        padding: 0 0.6rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Corner Cell */
    .header-corner {
        background-color: var(--header-bg);
        position: sticky;
        top: 0;
        left: 0;
        /* width: max-content; Removed */
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

    updated(changedProperties: PropertyValues) {
        if (this._shouldFocusCell) {
            this._focusSelectedCell();
            this._shouldFocusCell = false;
        }
    }

    private _focusSelectedCell() {
        if (this.selectedRow >= -1 && this.selectedCol !== -1) {
            // Find the cell element
            const cell = this.shadowRoot?.querySelector(`.cell[data-row="${this.selectedRow}"][data-col="${this.selectedCol}"]`) as HTMLElement;
            if (cell) {
                cell.focus();
                if (this.isEditing) {
                    // Place cursor at the end
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
            // Edit Mode Handling
            if (e.key === 'Enter') {
                e.preventDefault();
                this._commitEdit(e);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._cancelEdit();
            }
            return;
        }

        // Navigation Mode Handling
        // Only handle if we have a selection
        if (this.selectedRow === -1 && this.selectedCol === -1 && !isHeader) return;

        let dRow = 0;
        let dCol = 0;

        switch (e.key) {
            case 'ArrowUp': dRow = -1; break;
            case 'ArrowDown': dRow = 1; break;
            case 'ArrowLeft': dCol = -1; break;
            case 'ArrowRight': dCol = 1; break;
            case 'F2':
                e.preventDefault();
                this.isEditing = true;
                this._shouldFocusCell = true;
                return;
            case 'Enter':
                // Excel behavior: Move down? Or Edit? User said F2/DblClick for Edit.
                // Let's make Enter move down for now to be "Excel-like".
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

    private _moveSelection(dRow: number, dCol: number) {
        if (!this.table) return;

        const rowCount = this.table.rows.length;
        const colCount = this.table.headers ? this.table.headers.length : (this.table.rows[0]?.length || 0);

        // Current
        let r = this.selectedRow;
        let c = this.selectedCol;

        // If header is selected (row -1), handle it?
        // For now let's blocking navigation OUT of header to body via arrow keys maybe?
        // Or treat header as Row -1.

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
            const newValue = target.innerText; // Use innerText to get generic text

            // Explicitly clear content of target to prevent ghosting if strict mode fails
            // This is safe because if it re-renders with data, it will be filled. 
            // If it re-renders as empty ghost cell, it will remain empty.
            if (target) target.textContent = "";

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

    render() {
        if (!this.table) return html``;

        const table = this.table;
        const colCount = table.headers ? table.headers.length : (table.rows.length > 0 ? table.rows[0].length : 0);

        // Grid Template: RowHeader (max-content) + Columns (1fr each)
        const gridStyle = `grid-template-columns: max-content repeat(${colCount}, minmax(100px, 1fr));`;

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
                    <div class="cell header-corner">${table.rows.length}</div>

                    <!-- Column Headers (Integrated) -->
                    ${Array.from({ length: colCount }).map((_, i) => html`
                        <div 
                            class="cell header-col ${this.selectedRow === -1 && this.selectedCol === i ? 'selected' : ''} ${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'editing' : ''}"
                            style="font-weight: bold;"
                            data-row="-1"
                            data-col="${i}"
                            tabindex="${this.selectedRow === -1 && this.selectedCol === i ? '0' : '-1'}"
                            contenteditable="${this.isEditing && this.selectedRow === -1 && this.selectedCol === i ? 'true' : 'false'}"
                            @click="${(e: MouseEvent) => this._handleCellClick(e, -1, i)}"
                            @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, -1, i)}"
                            @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                            @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e, true)}"
                            .textContent=${table.headers && table.headers[i] ? table.headers[i] : ''}
                        ></div>
                    `)}

                    <!-- Data Rows -->
                    ${table.rows.map((row, rowIndex) => html`
                        <div class="cell header-row">${rowIndex + 1}</div>
                        ${row.map((cell, colIndex) => html`
                            <div 
                                class="cell ${this.selectedRow === rowIndex && this.selectedCol === colIndex ? 'selected' : ''} ${this.isEditing && this.selectedRow === rowIndex && this.selectedCol === colIndex ? 'editing' : ''}"
                                data-row="${rowIndex}"
                                data-col="${colIndex}"
                                tabindex="${this.selectedRow === rowIndex && this.selectedCol === colIndex ? '0' : '-1'}"
                                contenteditable="${this.isEditing && this.selectedRow === rowIndex && this.selectedCol === colIndex ? 'true' : 'false'}"
                                @click="${(e: MouseEvent) => this._handleCellClick(e, rowIndex, colIndex)}"
                                @dblclick="${(e: MouseEvent) => this._handleCellDblClick(e, rowIndex, colIndex)}"
                                @blur="${(e: FocusEvent) => this._handleBlur(e)}"
                                @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                                .textContent=${cell}
                            ></div>
                        `)}
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
