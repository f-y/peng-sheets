import { html, LitElement, nothing, unsafeCSS, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { spreadsheetTableStyles } from './styles/spreadsheet-table-styles';
import './cells/ss-data-cell';
import './cells/ss-corner-cell';
import './cells/ss-row-header';
import './cells/ss-column-header';
import './cells/ss-ghost-cell';
import './menus/ss-context-menu';
import './menus/ss-metadata-editor';
import './filter-menu';
// @ts-expect-error type import
import codiconsStyles from '@vscode/codicons/dist/codicon.css?inline';
import { getEditingHtml, formatCellValue, renderMarkdown, NumberFormat } from '../utils/spreadsheet-helpers';
import { calculateCellRangeState } from '../utils/edit-mode-helpers';
import { VisualMetadata } from '../controllers/row-visibility-controller';

// Re-export for convenience
export interface TableJSON {
    name: string | null;
    description: string | null;
    headers: string[] | null;
    rows: string[][];
    metadata: Record<string, unknown>;
    start_line: number | null;
    end_line: number | null;
}

export interface SelectionRange {
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

export interface ContextMenuState {
    x: number;
    y: number;
    type: 'row' | 'col';
    index: number;
}

export interface FilterMenuState {
    x: number;
    y: number;
    col: number;
    values: string[];
    hiddenValues: string[];
}

export interface EditState {
    isEditing: boolean;
    pendingEditValue: string | null;
}

/**
 * SpreadsheetTableView - Pure rendering component
 *
 * Receives all data via properties and emits events for user interactions.
 * No business logic - just rendering.
 */
@customElement('spreadsheet-table-view')
export class SpreadsheetTableView extends LitElement {
    static styles = [unsafeCSS(codiconsStyles), ...spreadsheetTableStyles];

    // Data
    @property({ type: Object }) table: TableJSON | null = null;
    @property({ type: Array }) visibleRowIndices: number[] = [];
    @property({ type: Object }) columnWidths: { [key: number]: number } = {};

    // Selection state
    @property({ type: Number }) selectedRow: number = 0;
    @property({ type: Number }) selectedCol: number = 0;
    @property({ type: Object }) selectionRange: SelectionRange = { minR: 0, maxR: 0, minC: 0, maxC: 0 };

    // Edit state
    @property({ type: Object }) editState: EditState = { isEditing: false, pendingEditValue: null };

    // Menu state
    @property({ type: Object }) contextMenu: ContextMenuState | null = null;
    @property({ type: Object }) filterMenu: FilterMenuState | null = null;

    // Resize state
    @property({ type: Number }) resizingCol: number = -1;

    // Row count for dynamic header width
    @property({ type: Number }) rowCount: number = 0;

    /**
     * Calculate the width needed for row headers based on max row number.
     * Uses ~8px per digit + 6px total padding.
     */
    private _getRowHeaderWidth(): number {
        const digits = String(this.rowCount).length;
        // 8px per digit + 6px padding, minimum 24px
        return Math.max(24, 6 + digits * 8);
    }

    private _getColumnTemplate(colCount: number): string {
        const rowHeaderWidth = this._getRowHeaderWidth();
        const widths: string[] = [`${rowHeaderWidth}px`]; // Row header
        for (let c = 0; c < colCount; c++) {
            if (this.columnWidths[c] !== undefined) {
                widths.push(`${this.columnWidths[c]}px`);
            } else {
                widths.push('100px');
            }
        }
        return widths.join(' ');
    }

    private _getEditingHtml(text: string): string {
        return getEditingHtml(text);
    }

    private _formatCellValue(value: string, format?: NumberFormat): string {
        return formatCellValue(value, format);
    }

    private _renderMarkdown(content: string): string {
        return renderMarkdown(content);
    }

    /**
     * Render context menu and filter menu overlays.
     */
    private _renderMenus(): TemplateResult | typeof nothing {
        const { contextMenu, filterMenu } = this;

        if (!contextMenu && !filterMenu) return nothing;

        return html`
            ${contextMenu
                ? html`
                      <ss-context-menu
                          .x="${contextMenu.x}"
                          .y="${contextMenu.y}"
                          .menuType="${contextMenu.type}"
                          .index="${contextMenu.index}"
                          @ss-insert-row="${(e: CustomEvent<{ index: number; position: string }>) => {
                              this._bubbleEvent('view-insert-row', e.detail);
                          }}"
                          @ss-delete-row="${(e: CustomEvent<{ index: number }>) => {
                              this._bubbleEvent('view-delete-row', e.detail);
                          }}"
                          @ss-insert-col="${(e: CustomEvent<{ index: number; position: string }>) => {
                              this._bubbleEvent('view-insert-col', e.detail);
                          }}"
                          @ss-delete-col="${(e: CustomEvent<{ index: number }>) => {
                              this._bubbleEvent('view-delete-col', e.detail);
                          }}"
                          @ss-menu-close="${() => {
                              this.dispatchEvent(new CustomEvent('view-menu-close', { bubbles: true, composed: true }));
                          }}"
                      ></ss-context-menu>
                  `
                : nothing}
            ${filterMenu
                ? html`
                      <filter-menu
                          .x="${filterMenu.x}"
                          .y="${filterMenu.y}"
                          .values="${filterMenu.values}"
                          .hiddenValues="${filterMenu.hiddenValues || []}"
                          .columnName="${this.table?.headers?.[filterMenu.col] || ''}"
                          @sort="${(e: CustomEvent<{ direction: string; column: string }>) => {
                              this.dispatchEvent(
                                  new CustomEvent('view-sort', {
                                      detail: { col: filterMenu.col, direction: e.detail.direction },
                                      bubbles: true,
                                      composed: true
                                  })
                              );
                          }}"
                          @filter-change="${(e: CustomEvent<{ column: string; hiddenValues: string[] }>) => {
                              this.dispatchEvent(
                                  new CustomEvent('view-filter-change', {
                                      detail: { col: filterMenu.col, hiddenValues: e.detail.hiddenValues },
                                      bubbles: true,
                                      composed: true
                                  })
                              );
                          }}"
                          @clear-filter="${(e: CustomEvent<{ column: string }>) => {
                              this.dispatchEvent(
                                  new CustomEvent('view-clear-filter', {
                                      detail: { col: filterMenu.col },
                                      bubbles: true,
                                      composed: true
                                  })
                              );
                          }}"
                      ></filter-menu>
                  `
                : nothing}
        `;
    }

    /**
     * Render corner cell and all column headers.
     */
    private _renderColumnHeaders(
        table: TableJSON,
        colCount: number,
        selRow: number,
        selCol: number,
        minR: number,
        maxR: number,
        minC: number,
        maxC: number
    ): TemplateResult {
        const isAllSelected = selRow === -2 && selCol === -2;

        return html`
            <!-- Corner Cell -->
            <ss-corner-cell
                .isSelected="${isAllSelected}"
                @ss-corner-click="${() => {
                    this.dispatchEvent(new CustomEvent('view-corner-click', { bubbles: true, composed: true }));
                }}"
                @ss-corner-keydown="${(e: CustomEvent<{ originalEvent: KeyboardEvent }>) => {
                    this._bubbleEvent('view-corner-keydown', { originalEvent: e.detail.originalEvent });
                }}"
            ></ss-corner-cell>

            <!-- Column Headers -->
            ${Array.from({ length: colCount }).map((_, c) => {
                const headerValue = table.headers?.[c] || '';
                const isColSelected =
                    (selCol === -2 && (selRow === -2 || ((minR === -1 || selRow === -2) && c >= minC && c <= maxC))) ||
                    (selRow === -2 && selCol === c) ||
                    (selRow === -1 && selCol === c && minR === maxR && minC === maxC);
                const isColInRange = (minR === -1 || selRow === -2) && c >= minC && c <= maxC;
                const isColEditing = this.editState.isEditing && selRow === -1 && selCol === c;
                const editValue =
                    isColEditing && this.editState.pendingEditValue !== null
                        ? this.editState.pendingEditValue
                        : headerValue;

                // Compute hasActiveFilter from table metadata
                const visual = (table.metadata?.['visual'] as VisualMetadata) || {};
                const filters = visual.filters || {};
                const hiddenValues = filters[c.toString()] || [];
                const hasActiveFilter = hiddenValues.length > 0;

                return html`
                    <ss-column-header
                        .col="${c}"
                        .value="${headerValue}"
                        .editingHtml="${this._getEditingHtml(editValue)}"
                        .isSelected="${isColSelected}"
                        .isInRange="${isColInRange}"
                        .isEditing="${isColEditing}"
                        .isResizing="${this.resizingCol === c}"
                        .hasActiveFilter="${hasActiveFilter}"
                        @ss-col-click="${(e: CustomEvent) => this._bubbleEvent('view-col-click', e.detail)}"
                        @ss-col-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-col-mousedown', e.detail)}"
                        @ss-col-dblclick="${(e: CustomEvent) => this._bubbleEvent('view-col-dblclick', e.detail)}"
                        @ss-contextmenu="${(e: CustomEvent) => this._bubbleEvent('view-col-contextmenu', e.detail)}"
                        @ss-col-input="${(e: CustomEvent) => this._bubbleEvent('view-col-input', e.detail)}"
                        @ss-col-blur="${(e: CustomEvent) => this._bubbleEvent('view-col-blur', e.detail)}"
                        @ss-col-keydown="${(e: CustomEvent) => this._bubbleEvent('view-col-keydown', e.detail)}"
                        @ss-filter-click="${(e: CustomEvent) => this._bubbleEvent('view-filter-click', e.detail)}"
                        @ss-resize-start="${(e: CustomEvent) => this._bubbleEvent('view-resize-start', e.detail)}"
                    ></ss-column-header>
                `;
            })}
        `;
    }

    /**
     * Render a single data row with row header and cells.
     */
    private _renderDataRow(
        r: number,
        row: string[],
        colCount: number,
        selRow: number,
        selCol: number,
        minR: number,
        maxR: number,
        minC: number,
        maxC: number
    ): TemplateResult {
        const isRowSelected =
            (selCol === -2 && (selRow === r || ((minC === -1 || selCol === -2) && r >= minR && r <= maxR))) ||
            (selCol === -1 && selRow === r) ||
            (selCol >= 0 && selRow === r && minR === maxR && minC === maxC);
        const isRowInRange = (minC === -1 || selCol === -2) && r >= minR && r <= maxR;

        return html`
            <!-- Row Header -->
            <ss-row-header
                .row="${r}"
                .isSelected="${isRowSelected}"
                .isInRange="${isRowInRange}"
                @ss-row-click="${(e: CustomEvent) => this._bubbleEvent('view-row-click', e.detail)}"
                @ss-row-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-row-mousedown', e.detail)}"
                @ss-contextmenu="${(e: CustomEvent) => this._bubbleEvent('view-row-contextmenu', e.detail)}"
                @ss-row-keydown="${(e: CustomEvent) => this._bubbleEvent('view-row-keydown', e.detail)}"
            ></ss-row-header>

            <!-- Cells -->
            ${Array.from({ length: colCount }).map((_, c) => {
                const cell = row[c] !== undefined ? row[c] : '';
                const isActive = r === selRow && c === selCol;
                const rangeState = calculateCellRangeState(r, c, minR, maxR, minC, maxC);
                const isEditingCell = this.editState.isEditing && isActive;
                const isRangeSelection = minR !== maxR || minC !== maxC;

                // Get alignment and format from metadata
                const visual = (this.table!.metadata?.['visual'] as VisualMetadata) || {};
                const columns = visual.columns || {};
                const colSettings = columns[c.toString()] || {};
                const align = colSettings.align || 'left';
                const format = colSettings.format;
                const wordWrapEnabled = format?.wordWrap !== false;

                const displayValue = isEditingCell ? cell : this._formatCellValue(cell, format?.numberFormat);

                return html`
                    <ss-data-cell
                        .row="${r}"
                        .col="${c}"
                        .value="${isEditingCell && this.editState.pendingEditValue !== null
                            ? this.editState.pendingEditValue
                            : cell}"
                        .renderedHtml="${this._renderMarkdown(displayValue)}"
                        .editingHtml="${this._getEditingHtml(
                            isEditingCell && this.editState.pendingEditValue !== null
                                ? this.editState.pendingEditValue
                                : cell
                        )}"
                        .isEditing="${isEditingCell}"
                        .isSelected="${r === selRow && c === selCol}"
                        .isInRange="${rangeState.inRange}"
                        .isActive="${isActive && !isRangeSelection}"
                        .wordWrap="${wordWrapEnabled}"
                        .align="${align}"
                        .rangeTop="${rangeState.topEdge}"
                        .rangeBottom="${rangeState.bottomEdge}"
                        .rangeLeft="${rangeState.leftEdge}"
                        .rangeRight="${rangeState.rightEdge}"
                        @ss-cell-click="${(e: CustomEvent) => this._bubbleEvent('view-cell-click', e.detail)}"
                        @ss-cell-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-cell-mousedown', e.detail)}"
                        @ss-cell-dblclick="${(e: CustomEvent) => this._bubbleEvent('view-cell-dblclick', e.detail)}"
                        @ss-cell-input="${(e: CustomEvent) => this._bubbleEvent('view-cell-input', e.detail)}"
                        @ss-cell-blur="${(e: CustomEvent) => this._bubbleEvent('view-cell-blur', e.detail)}"
                        @ss-cell-keydown="${(e: CustomEvent) => this._bubbleEvent('view-cell-keydown', e.detail)}"
                    ></ss-data-cell>
                `;
            })}
        `;
    }

    /**
     * Render the ghost row for adding new data.
     */
    private _renderGhostRow(
        table: TableJSON,
        colCount: number,
        selRow: number,
        selCol: number,
        minR: number,
        maxR: number,
        minC: number,
        maxC: number
    ): TemplateResult {
        const ghostRowIndex = table.rows.length;
        const isGhostRowSelected = selRow === ghostRowIndex;

        return html`
            <!-- Ghost Row Header -->
            <ss-row-header
                .row="${ghostRowIndex}"
                .isSelected="${isGhostRowSelected && selCol === -1}"
                .isInRange="${false}"
                .isGhost="${true}"
                @ss-row-click="${(e: CustomEvent) => this._bubbleEvent('view-row-click', e.detail)}"
                @ss-row-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-row-mousedown', e.detail)}"
                @ss-row-keydown="${(e: CustomEvent) => this._bubbleEvent('view-row-keydown', e.detail)}"
            ></ss-row-header>

            <!-- Ghost Cells -->
            ${Array.from({ length: colCount }).map((_, c) => {
                const isActive = selRow === ghostRowIndex && selCol === c;
                const isEditingCell = this.editState.isEditing && isActive;
                const rangeState = calculateCellRangeState(ghostRowIndex, c, minR, maxR, minC, maxC);

                // Get the current value - use pendingEditValue ONLY if this specific cell is being edited
                const cellValue =
                    isEditingCell && this.editState.pendingEditValue !== null ? this.editState.pendingEditValue : '';

                return html`
                    <ss-ghost-cell
                        .row="${ghostRowIndex}"
                        .col="${c}"
                        .value="${cellValue}"
                        .editingHtml="${this._getEditingHtml(cellValue)}"
                        .isEditing="${isEditingCell}"
                        .isSelected="${isActive}"
                        .isInRange="${rangeState.inRange}"
                        .rangeTop="${rangeState.topEdge}"
                        .rangeBottom="${rangeState.bottomEdge}"
                        .rangeLeft="${rangeState.leftEdge}"
                        .rangeRight="${rangeState.rightEdge}"
                        @ss-cell-click="${(e: CustomEvent) => this._bubbleEvent('view-cell-click', e.detail)}"
                        @ss-cell-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-cell-mousedown', e.detail)}"
                        @ss-cell-dblclick="${(e: CustomEvent) => this._bubbleEvent('view-cell-dblclick', e.detail)}"
                        @ss-cell-input="${(e: CustomEvent) => this._bubbleEvent('view-cell-input', e.detail)}"
                        @ss-cell-blur="${(e: CustomEvent) => this._bubbleEvent('view-cell-blur', e.detail)}"
                        @ss-cell-keydown="${(e: CustomEvent) => this._bubbleEvent('view-cell-keydown', e.detail)}"
                    ></ss-ghost-cell>
                `;
            })}
        `;
    }

    /**
     * Helper to bubble events from sub-components with prefixed names.
     */
    private _bubbleEvent(eventName: string, detail: unknown) {
        this.dispatchEvent(
            new CustomEvent(eventName, {
                detail,
                bubbles: true,
                composed: true
            })
        );
    }

    render() {
        if (!this.table) return html``;
        const table = this.table;

        const { minR, maxR, minC, maxC } = this.selectionRange;
        const selRow = this.selectedRow;
        const selCol = this.selectedCol;

        const colCount = Math.max(table.headers?.length || 0, table.rows[0]?.length || 0);

        return html`
            <ss-metadata-editor
                .description="${table.description || ''}"
                @ss-metadata-change="${(e: CustomEvent<{ description: string }>) => {
                    this._bubbleEvent('view-metadata-change', { description: e.detail.description });
                }}"
            ></ss-metadata-editor>

            <div class="table-container">
                <div class="grid" style="grid-template-columns: ${this._getColumnTemplate(colCount)};">
                    ${this._renderColumnHeaders(table, colCount, selRow, selCol, minR, maxR, minC, maxC)}

                    <!-- Rows -->
                    ${this.visibleRowIndices.map((r) => {
                        const row = table.rows[r];
                        return this._renderDataRow(r, row, colCount, selRow, selCol, minR, maxR, minC, maxC);
                    })}

                    <!-- Ghost Row -->
                    ${this._renderGhostRow(table, colCount, selRow, selCol, minR, maxR, minC, maxC)}
                </div>
            </div>

            ${this._renderMenus()}
        `;
    }
}
