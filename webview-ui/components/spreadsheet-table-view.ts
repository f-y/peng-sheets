import { html, LitElement, nothing, unsafeCSS, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import spreadsheetTableStyles from './styles/spreadsheet-table.css?inline';
import validationControlsStyles from '../styles/validation-controls.css?inline';
import './cells/ss-data-cell';
import './cells/ss-corner-cell';
import './cells/ss-row-header';
import './cells/ss-column-header';
import './cells/ss-ghost-cell';
import './menus/ss-context-menu';
import './menus/ss-metadata-editor';
import './filter-menu';
import codiconsStyles from '@vscode/codicons/dist/codicon.css?inline';
import { getEditingHtml, formatCellValue, renderMarkdown, NumberFormat } from '../utils/spreadsheet-helpers';
import { calculateCellRangeState } from '../utils/edit-mode-helpers';
import { VisualMetadata } from '../controllers/row-visibility-controller';
import { t } from '../utils/i18n';

import { TableJSON, AlignmentType } from '../types';

export type { TableJSON, AlignmentType };

export interface SelectionRange {
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

export interface ContextMenuState {
    x: number;
    y: number;
    type: 'row' | 'col' | 'cell';
    index: number;
    hasCopiedRows?: boolean;
    hasCopiedColumns?: boolean;
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
    static styles = [unsafeCSS(codiconsStyles), unsafeCSS(spreadsheetTableStyles), unsafeCSS(validationControlsStyles)];

    // Data
    @property({ type: Object }) table: TableJSON | null = null;
    @property({ type: Array }) visibleRowIndices: number[] = [];
    @property({ type: Object }) columnWidths: { [key: number]: number } = {};

    // Selection state
    @property({ type: Number }) selectedRow: number = 0;
    @property({ type: Number }) selectedCol: number = 0;
    @property({ type: Object }) selectionRange: SelectionRange = { minR: -1, maxR: -1, minC: -1, maxC: -1 };

    // Edit state
    @property({ type: Object }) editState: EditState = { isEditing: false, pendingEditValue: null };

    // Menu state
    @property({ type: Object }) contextMenu: ContextMenuState | null = null;
    @property({ type: Object }) filterMenu: FilterMenuState | null = null;

    // Resize state
    @property({ type: Number }) resizingCol: number = -1;

    // Row count for dynamic header width
    @property({ type: Number }) rowCount: number = 0;

    // Drag state
    @property({ type: Boolean }) isDragging: boolean = false;
    @property({ type: String }) dragType: 'row' | 'col' | 'cell' | null = null;
    @property({ type: Number }) dropTargetIndex: number = -1;
    @property({ type: Number }) cellDropRow: number = -1;
    @property({ type: Number }) cellDropCol: number = -1;
    @property({ type: Object }) dragSourceRange: SelectionRange | null = null;

    @property({ type: String })
    dateFormat: string = 'YYYY-MM-DD';

    // Current table location for copy indicator matching
    @property({ type: Number }) sheetIndex: number = 0;
    @property({ type: Number }) tableIndex: number = 0;

    // Copied range for visual indicator (includes source location)
    @property({ type: Object })
    copiedRange: {
        sheetIndex: number;
        tableIndex: number;
        minR: number;
        maxR: number;
        minC: number;
        maxC: number;
    } | null = null;

    // Copy type for determining if headers should show copy indicator
    @property({ type: String })
    copyType: 'cells' | 'rows' | 'columns' | null = null;

    /**
     * Calculate the width needed for row headers based on max row number.
     * Uses 35px for 3 digits or fewer, then 8px per digit + 6px padding for 4+.
     */
    private _getRowHeaderWidth(): number {
        const digits = String(this.rowCount).length;
        if (digits <= 2) {
            return 30;
        }
        if (digits <= 3) {
            return 35; // 3 digits or fewer need slightly more space
        }
        // 4+ digits: 8px per digit + 6px padding
        return 6 + digits * 8;
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

    private _handleFocusIn(_e: FocusEvent) {}

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
                          .hasCopiedRows="${contextMenu.hasCopiedRows || false}"
                          .hasCopiedColumns="${contextMenu.hasCopiedColumns || false}"
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
                          @ss-insert-copied-rows="${(e: CustomEvent<{ index: number; position: string }>) => {
                              this._bubbleEvent('view-insert-copied-rows', e.detail);
                          }}"
                          @ss-insert-copied-cols="${(e: CustomEvent<{ index: number; position: string }>) => {
                              this._bubbleEvent('view-insert-copied-cols', e.detail);
                          }}"
                          @ss-data-validation="${(e: CustomEvent<{ index: number }>) => {
                              this._bubbleEvent('view-data-validation', e.detail);
                          }}"
                          @ss-copy="${() => {
                              this._bubbleEvent('view-copy', {});
                          }}"
                          @ss-cut="${() => {
                              this._bubbleEvent('view-cut', {});
                          }}"
                          @ss-paste="${() => {
                              this._bubbleEvent('view-paste', {});
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
                          @clear-filter="${(_e: CustomEvent<{ column: string }>) => {
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
        const isColMode = selRow === -2;
        const isSingleCell = minR === maxR && minC === maxC && minR !== -1;
        const enableColHighlight = isColMode || isSingleCell;

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
                @ss-corner-contextmenu="${(e: CustomEvent<{ originalEvent: MouseEvent }>) => {
                    this._bubbleEvent('view-corner-contextmenu', { originalEvent: e.detail.originalEvent });
                }}"
            ></ss-corner-cell>

            <!-- Column Headers -->
            ${Array.from({ length: colCount }).map((_, c) => {
                const headerValue = table.headers?.[c] || '';
                const isColSelected =
                    (selCol === -2 && (selRow === -2 || ((minR === -1 || selRow === -2) && c >= minC && c <= maxC))) ||
                    (selRow === -2 && selCol === c) ||
                    (selRow === -1 && selCol === c && minR === maxR && minC === maxC);
                const isColInRange = enableColHighlight && minC >= 0 && maxC >= 0 && c >= minC && c <= maxC;
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

                // Compute hasValidation from table metadata
                const validation = visual.validation;
                const validationRule = validation?.[c.toString()];
                const hasValidation = !!validationRule;
                // Convert type to i18n tooltip
                const prefix = t('validationTooltipPrefix');
                let validationTooltip = '';
                if (validationRule?.type) {
                    if (validationRule.type === 'list' && validationRule.values?.length) {
                        // For list type, show values directly with truncation
                        const maxItems = 5;
                        const values = validationRule.values;
                        const displayValues =
                            values.length > maxItems ? values.slice(0, maxItems).join(', ') + '...' : values.join(', ');
                        validationTooltip = `${prefix}: ${displayValues}`;
                    } else {
                        // For other types, show the type name
                        const typeKey = `validation${validationRule.type.charAt(0).toUpperCase()}${validationRule.type.slice(1)}`;
                        const typeName = t(typeKey as Parameters<typeof t>[0]);
                        validationTooltip = `${prefix}: ${typeName}`;
                    }
                }

                // Calculate header copy state for dashed border indicator
                // Headers show copy indicator for:
                // 1. 'columns' copy type (column selection)
                // 2. Full table copy (all columns selected as 'cells' type)
                const isCopySourceTable =
                    this.copiedRange &&
                    this.copiedRange.sheetIndex === this.sheetIndex &&
                    this.copiedRange.tableIndex === this.tableIndex;
                const isFullTableCopy =
                    isCopySourceTable && this.copiedRange!.minC === 0 && this.copiedRange!.maxC === colCount - 1;
                const includeHeaders = this.copyType === 'columns' || (isFullTableCopy && this.copyType !== 'rows');
                const headerInCopyRange =
                    isCopySourceTable && includeHeaders && c >= this.copiedRange!.minC && c <= this.copiedRange!.maxC;
                const headerCopyLeft = headerInCopyRange && c === this.copiedRange!.minC;
                const headerCopyRight = headerInCopyRange && c === this.copiedRange!.maxC;

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
                        .hasValidation="${hasValidation}"
                        .validationType="${validationTooltip}"
                        .width="${this.columnWidths[c] ?? 100}"
                        .isDraggable="${isColMode && isColInRange}"
                        .isDragging="${this.isDragging && this.dragType === 'col' && isColInRange}"
                        .isDropTarget="${this.isDragging && this.dragType === 'col' && c === this.dropTargetIndex}"
                        .isDropTargetEnd="${this.isDragging &&
                        this.dragType === 'col' &&
                        c === colCount - 1 &&
                        this.dropTargetIndex === colCount}"
                        .copyTop="${headerInCopyRange}"
                        .copyLeft="${headerCopyLeft}"
                        .copyRight="${headerCopyRight}"
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
            (selCol >= 0 && selRow === r && minR >= 0 && minR === maxR && minC === maxC);

        const isRowMode = selCol === -2;
        const isSingleCell = minR === maxR && minC === maxC && minR !== -1;
        const enableRowHighlight = isRowMode || isSingleCell;
        const isRowInRange = enableRowHighlight && minR >= 0 && maxR >= 0 && r >= minR && r <= maxR;

        return html`
            <!-- Row Header -->
            <ss-row-header
                .row="${r}"
                .isSelected="${isRowSelected}"
                .isInRange="${isRowInRange}"
                .isDraggable="${isRowMode && isRowInRange}"
                .isDragging="${this.isDragging && this.dragType === 'row' && isRowInRange}"
                .isDropTarget="${this.isDragging && this.dragType === 'row' && r === this.dropTargetIndex}"
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

                // Calculate copy range state for dashed border indicator
                // Only show copy indicator on the same table where copy originated
                const isCopySourceTable =
                    this.copiedRange &&
                    this.copiedRange.sheetIndex === this.sheetIndex &&
                    this.copiedRange.tableIndex === this.tableIndex;
                const copyState = isCopySourceTable
                    ? calculateCellRangeState(
                          r,
                          c,
                          this.copiedRange!.minR,
                          this.copiedRange!.maxR,
                          this.copiedRange!.minC,
                          this.copiedRange!.maxC
                      )
                    : { inRange: false, topEdge: false, bottomEdge: false, leftEdge: false, rightEdge: false };

                // Get alignment from GFM alignments
                const align = this.table!.alignments?.[c] ?? 'left';

                // Get format settings from metadata
                const visual = (this.table!.metadata?.['visual'] as VisualMetadata) || {};
                const columns = visual.columns || {};
                const colSettings = columns[c.toString()] || {};
                const format = colSettings.format;
                const wordWrapEnabled = format?.wordWrap !== false;

                // Get validation rule for this column
                // Get validation rule for this column
                const validation = visual.validation;
                const validationRule = validation?.[c.toString()] || null;

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
                        .validationRule="${validationRule}"
                        .rangeTop="${rangeState.topEdge}"
                        .rangeBottom="${rangeState.bottomEdge}"
                        .rangeLeft="${rangeState.leftEdge}"
                        .rangeRight="${rangeState.rightEdge}"
                        .copyTop="${copyState.inRange && copyState.topEdge}"
                        .copyBottom="${copyState.inRange && copyState.bottomEdge}"
                        .copyLeft="${copyState.inRange && copyState.leftEdge}"
                        .copyRight="${copyState.inRange && copyState.rightEdge}"
                        .dateFormat="${this.dateFormat}"
                        .isDraggable="${rangeState.inRange && isRangeSelection}"
                        .isCellDropTarget="${this._isCellInDropRange(r, c)}"
                        @ss-cell-click="${(e: CustomEvent) => this._bubbleEvent('view-cell-click', e.detail)}"
                        @ss-cell-mousedown="${(e: CustomEvent) => this._bubbleEvent('view-cell-mousedown', e.detail)}"
                        @ss-cell-dblclick="${(e: CustomEvent) => this._bubbleEvent('view-cell-dblclick', e.detail)}"
                        @ss-cell-input="${(e: CustomEvent) => this._bubbleEvent('view-cell-input', e.detail)}"
                        @ss-cell-blur="${(e: CustomEvent) => this._bubbleEvent('view-cell-blur', e.detail)}"
                        @ss-cell-keydown="${(e: CustomEvent) => this._bubbleEvent('view-cell-keydown', e.detail)}"
                        @ss-cell-contextmenu="${(e: CustomEvent) =>
                            this._bubbleEvent('view-cell-contextmenu', e.detail)}"
                        @ss-validation-input="${(e: CustomEvent) =>
                            this._bubbleEvent('view-validation-input', e.detail)}"
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
                .isDropTarget="${this.isDragging && this.dragType === 'row' && ghostRowIndex === this.dropTargetIndex}"
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

    /**
     * Check if a cell is within the drop target range for cell drag operations.
     * The drop range size matches the source selection size.
     */
    private _isCellInDropRange(row: number, col: number): boolean {
        if (!this.isDragging || this.dragType !== 'cell') return false;
        if (this.cellDropRow < 0 || this.cellDropCol < 0) return false;
        if (!this.dragSourceRange) return false;

        // Calculate drop range based on source range size
        const srcHeight = this.dragSourceRange.maxR - this.dragSourceRange.minR;
        const srcWidth = this.dragSourceRange.maxC - this.dragSourceRange.minC;

        const dropMinR = this.cellDropRow;
        const dropMaxR = this.cellDropRow + srcHeight;
        const dropMinC = this.cellDropCol;
        const dropMaxC = this.cellDropCol + srcWidth;

        return row >= dropMinR && row <= dropMaxR && col >= dropMinC && col <= dropMaxC;
    }
}
