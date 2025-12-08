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
        /* width: 40px; Removed explicit width, let grid handle it */
        user-select: none;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
    }

    /* Corner Cell */
    .header-corner {
        background-color: var(--header-bg);
        position: sticky;
        top: 0;
        left: 0;
        z-index: 20;
        border-right: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
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

        // Grid Template: RowHeader (40px) + Columns (1fr each)
        const gridStyle = `grid-template-columns: 40px repeat(${colCount}, minmax(100px, 1fr));`;

        return html`
        <div>
            ${table.name ? html`<h3>${table.name}</h3>` : ''}
            ${table.description ? html`<p>${table.description}</p>` : ''}
            
            <div class="table-container">
                <div class="grid" style="${gridStyle}">
                    <!-- Corner Cell -->
                    <div class="cell header-corner"></div>

                    <!-- Column Headers (A, B, C...) -->
                    ${Array.from({ length: colCount }).map((_, i) => html`
                        <div class="cell header-col">
                            ${this._getColumnLabel(i)}
                        </div>
                    `)}

                    <!-- Data Headers (if present) -->
                    ${table.headers ? html`
                        <div class="cell header-row">1</div>
                        ${table.headers.map((header, i) => html`
                            <div class="cell header-col" style="top: 25px; z-index: 5; background-color: var(--vscode-editor-background); border-bottom: 2px solid var(--border-color);">
                                <b>${header}</b>
                            </div>
                        `)}
                        <!-- Note: If we treat Markdown headers as Row 1, they should be in the data area but styled? 
                             Or should they be the sticky header? 
                             Excel doesn't have "table headers" usually, just A/B/C. 
                             Markdown tables DO have headers. 
                             Let's render Markdown headers as the first row of DATA, but maybe bold.
                             And the Row Header for them is "1".
                        -->
                    ` : ''}

                    <!-- Data Rows -->
                    ${table.rows.map((row, rowIndex) => html`
                        <div class="cell header-row">${rowIndex + (table.headers ? 2 : 1)}</div>
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
