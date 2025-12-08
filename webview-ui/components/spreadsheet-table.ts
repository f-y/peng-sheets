import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
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
    }

    .cell:focus {
        outline: 2px solid var(--vscode-focusBorder);
        z-index: 100;
    }

    /* Headers */
    .header-col {
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
        width: max-content;
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
        width: max-content;
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

    private _getColumnLabel(index: number): string {
        let label = "";
        index++; // 1-based
        while (index > 0) {
            index--;
            label = String.fromCharCode(65 + (index % 26)) + label;
            index = Math.floor(index / 26);
        }
        return label;
    }

    private _handleCellEdit(e: FocusEvent, rowIndex: number, colIndex: number) {
        const target = e.target as HTMLElement;
        const newValue = target.innerText;

        this.dispatchEvent(new CustomEvent('cell-edit', {
            detail: {
                sheetIndex: this.sheetIndex,
                tableIndex: this.tableIndex,
                rowIndex: rowIndex,
                colIndex: colIndex,
                newValue: newValue
            },
            bubbles: true,
            composed: true
        }));
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
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
            ${table.name ? html`<h3>${table.name}</h3>` : ''}
            ${table.description ? html`<p>${table.description}</p>` : ''}
            
            <div class="table-container">
                <div class="grid" style="${gridStyle}">
                    <!-- Corner Cell -->
                    <div class="cell header-corner">${table.rows.length}</div>

                    <!-- Column Headers (Integrated) -->
                    ${Array.from({ length: colCount }).map((_, i) => html`
                        <div class="cell header-col">
                            ${table.headers && table.headers[i] ? html`
                                <div 
                                    style="font-weight: bold; width: 100%; height: 100%;"
                                    contenteditable="true"
                                    @blur="${(e: FocusEvent) => this._handleCellEdit(e, -1, i)}"
                                    @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                                >${table.headers[i]}</div>
                            ` : ''}
                        </div>
                    `)}

                    <!-- Data Rows -->
                    ${table.rows.map((row, rowIndex) => html`
                        <div class="cell header-row">${rowIndex + 1}</div>
                        ${row.map((cell, colIndex) => html`
                            <div 
                                class="cell"
                                contenteditable="true"
                                @blur="${(e: FocusEvent) => this._handleCellEdit(e, rowIndex, colIndex)}"
                                @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e)}"
                            >${cell}</div>
                        `)}
                    `)}
                </div>
            </div>
        </div>
    `;
    }
}
