import { LitElement, html, PropertyValues, css, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit';
import { SelectionController, SelectionRange } from '../controllers/selection-controller';
import { EditController } from '../controllers/edit-controller';
import { ResizeController } from '../controllers/resize-controller';
import { NavigationController } from '../controllers/navigation-controller';
import { ClipboardController } from '../controllers/clipboard-controller';
import { FilterController } from '../controllers/filter-controller';
import { ToolbarController } from '../controllers/toolbar-controller';
import { FocusController } from '../controllers/focus-controller';
import { KeyboardController } from '../controllers/keyboard-controller';
import { EventController } from '../controllers/event-controller';
import { RowVisibilityController, VisualMetadata } from '../controllers/row-visibility-controller';
import { getDOMText } from '../utils/spreadsheet-helpers';
import { normalizeEditContent, findEditingCell } from '../utils/edit-mode-helpers';
import { spreadsheetTableStyles } from './styles/spreadsheet-table-styles';
import './filter-menu';
import './cells/ss-data-cell';
import './cells/ss-corner-cell';
import './cells/ss-row-header';
import './cells/ss-column-header';
import './cells/ss-ghost-cell';
import './menus/ss-context-menu';
import './menus/ss-metadata-editor';
import './spreadsheet-table-view';
// @ts-expect-error type import
import codiconsStyles from '@vscode/codicons/dist/codicon.css?inline';

provideVSCodeDesignSystem().register(vsCodeButton());

export interface TableJSON {
    name: string | null;
    description: string | null;
    headers: string[] | null;
    rows: string[][];
    metadata: Record<string, unknown>;
    start_line: number | null;
    end_line: number | null;
}

@customElement('spreadsheet-table')
export class SpreadsheetTable extends LitElement {
    static styles = [unsafeCSS(codiconsStyles), ...spreadsheetTableStyles];

    @property({ type: Object })
    table: TableJSON | null = null;

    @property({ type: Number })
    sheetIndex: number = 0;

    @property({ type: Number })
    tableIndex: number = 0;

    selectionCtrl = new SelectionController(this);
    editCtrl = new EditController(this);
    resizeCtrl = new ResizeController(this);
    navCtrl = new NavigationController(this, this.selectionCtrl);
    clipboardCtrl = new ClipboardController(this);
    filterCtrl = new FilterController(this);
    toolbarCtrl = new ToolbarController(this);
    keyboardCtrl = new KeyboardController(this);
    eventCtrl = new EventController(this);
    focusCtrl = new FocusController({
        getShadowRoot: () => this.shadowRoot?.querySelector('spreadsheet-table-view')?.shadowRoot || this.shadowRoot,
        getSelectedRow: () => this.selectionCtrl.selectedRow,
        getSelectedCol: () => this.selectionCtrl.selectedCol,
        isEditing: () => this.editCtrl.isEditing,
        getPendingEditValue: () => this.editCtrl.pendingEditValue,
        clearPendingEditValue: () => {
            this.editCtrl.pendingEditValue = null;
        }
    });
    rowVisibilityCtrl = new RowVisibilityController({
        getRows: () => this.table?.rows || null,
        getVisualMetadata: () => {
            if (!this.table?.metadata) return null;
            return ((this.table.metadata as Record<string, unknown>)?.visual as VisualMetadata) || null;
        }
    });

    @state()
    contextMenu: { x: number; y: number; type: 'row' | 'col'; index: number } | null = null;

    private _shouldFocusCell: boolean = false;
    private _isCommitting: boolean = false; // Kept in host for now as it coordinates editCtrl and Events
    private _restoreCaretPos: number | null = null;
    private _wasFocusedBeforeUpdate: boolean = false;

    // Exposed for Controllers
    public focusCell() {
        this._shouldFocusCell = true;
        this.requestUpdate();
    }

    willUpdate(changedProperties: PropertyValues) {
        // Track focus before update to prevent focus stealing/loss across re-renders
        // If we currently have focus (or a child has focus), we want to try to restore it after update
        // unless _shouldFocusCell explicitly requested a focus change.
        const active = this.shadowRoot?.activeElement;
        this._wasFocusedBeforeUpdate =
            !!active &&
            (active.classList.contains('cell') ||
                active.classList.contains('cell-content') ||
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA');

        if (changedProperties.has('sheetIndex') || changedProperties.has('tableIndex')) {
            this.editCtrl.cancelEditing(); // Reset edit
            this.selectionCtrl.reset();
            this._shouldFocusCell = false;
            this.contextMenu = null;
        }

        if (changedProperties.has('table')) {
            const oldTable = changedProperties.get('table');
            // Only restore focus if we had it before, or if we are the only thing?
            // Actually, if we are editing, _wasFocusedBeforeUpdate is handled above.
            // This block forces focus on data reload. We should ONLY do it if we were focused.
            if (oldTable && this._wasFocusedBeforeUpdate) {
                this._shouldFocusCell = true;
            }
        }

        if (changedProperties.has('table') && this.table) {
            const visual = (this.table.metadata as Record<string, unknown>)?.visual as VisualMetadata;
            if (visual && visual.column_widths) {
                if (Array.isArray(visual.column_widths)) {
                    const widths: Record<number, number> = {};
                    visual.column_widths.forEach((w: number, i: number) => (widths[i] = w));
                    this.resizeCtrl.setColumnWidths(widths);
                } else {
                    this.resizeCtrl.setColumnWidths(visual.column_widths as Record<number, number>);
                }
            } else {
                this.resizeCtrl.setColumnWidths({});
            }

            const colCount = this.table.headers ? this.table.headers.length : this.table.rows[0]?.length || 0;
            const rowCount = this.table.rows.length;

            if (this.selectionCtrl.selectedCol !== -2 && this.selectionCtrl.selectedCol >= colCount) {
                this.selectionCtrl.selectedCol = Math.max(0, colCount - 1);
            }
            if (
                this.selectionCtrl.selectedRow !== -2 &&
                this.selectionCtrl.selectedRow !== -1 &&
                this.selectionCtrl.selectedRow > rowCount
            ) {
                this.selectionCtrl.selectedRow = rowCount;
            }
        }
    }

    private _getColumnTemplate(colCount: number) {
        let template = '30px';
        for (let i = 0; i < colCount; i++) {
            const width = this.resizeCtrl.colWidths[i];
            template += width ? ` ${width}px` : ' 100px';
        }
        return template;
    }

    updated(_changedProperties: PropertyValues) {
        if (this._restoreCaretPos !== null) {
            const cell = this.shadowRoot?.querySelector('.cell.editing');
            if (cell) {
                // Removed firstChild check, _setCaretPosition handles it
                try {
                    (cell as HTMLElement).focus(); // Ensure focus
                    this.focusCtrl.setCaretPosition(cell, this._restoreCaretPos);
                } catch (e) {
                    console.warn('Failed to restore caret:', e);
                }
            }
            this._restoreCaretPos = null;
            this._shouldFocusCell = false; // Prevent focus override
        }

        // Focus Retention Logic
        // Focus Retention Logic
        if (this._shouldFocusCell) {
            const view = this.shadowRoot?.querySelector('spreadsheet-table-view');
            if (view) {
                (view as any).updateComplete.then(() => {
                    setTimeout(() => {
                        this.focusCtrl.focusSelectedCell();
                    }, 0);
                });
            }
            this._shouldFocusCell = false;
            this._wasFocusedBeforeUpdate = false;
        } else if (this._wasFocusedBeforeUpdate) {
            const view = this.shadowRoot?.querySelector('spreadsheet-table-view');
            if (view) {
                (view as any).updateComplete.then(() => {
                    setTimeout(() => {
                        this.focusCtrl.focusSelectedCell();
                    }, 0);
                });
            }
            this._wasFocusedBeforeUpdate = false;
        }
    }

    // Existing Focus Listeners
    private _handleFocusIn = () => {
        (window as unknown as { activeSpreadsheetTable: SpreadsheetTable }).activeSpreadsheetTable = this;
    };

    // Delegate to RowVisibilityController
    get visibleRowIndices(): number[] {
        return this.rowVisibilityCtrl.visibleRowIndices;
    }

    // Wrapper for backward compatibility (used by NavigationController)
    getNextVisibleRowIndex(currentDataRowIndex: number, delta: number): number {
        const ghostRowIndex = this.table ? this.table.rows.length : -1;
        return this.rowVisibilityCtrl.getNextVisibleRowIndex(currentDataRowIndex, delta, ghostRowIndex);
    }

    connectedCallback() {
        super.connectedCallback();
        // MouseMove/Up handled by SelectionController
        // Register focus tracker
        this.addEventListener('focusin', this._handleFocusIn);
    }

    /**
     * Helper to get the View component's shadow root.
     * This is where the cells actually live.
     */
    get viewShadowRoot(): ShadowRoot | null {
        return this.shadowRoot?.querySelector('spreadsheet-table-view')?.shadowRoot || null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('focusin', this._handleFocusIn);
    }

    /**
     * Commits the current edit if one is active.
     * Call this before changing cell selection to ensure edits are saved.
     */
    public async commitEdit(e: Event) {
        if (this._isCommitting) return;
        // Guard: Do not commit if we are not in edit mode (prevent ghost commits from stale events)
        if (!this.editCtrl.isEditing && !this.editCtrl.isReplacementMode) return;

        this._isCommitting = true;

        try {
            const target = e.target as HTMLElement;
            // Use View's shadowRoot since cells are in the View component
            const view = this.shadowRoot?.querySelector('spreadsheet-table-view');
            const viewShadowRoot = view?.shadowRoot ?? null;
            const result = findEditingCell(
                target,
                viewShadowRoot,
                this.selectionCtrl.selectedRow,
                this.selectionCtrl.selectedCol
            );
            if (!result) return;

            const { cell, row: editRow, col: editCol } = result;
            const contentSpan = cell.querySelector('.cell-content') as HTMLElement;
            let newValue = '';

            // Read from DOM for WYSIWYG correctness
            const targetEl = contentSpan || cell;
            newValue = getDOMText(targetEl);

            // Normalize content (strip trailing newlines, handle empty content)
            newValue = normalizeEditContent(newValue, this.editCtrl.hasUserInsertedNewline);

            // In replacement mode, pendingEditValue is the authoritative value.
            // DOM may be empty or stale due to timing between mousedown and commit.
            // In non-replacement mode (dblclick), DOM is authoritative - user edits are preserved.
            if (this.editCtrl.isReplacementMode && this.editCtrl.pendingEditValue !== null) {
                newValue = normalizeEditContent(this.editCtrl.pendingEditValue, this.editCtrl.hasUserInsertedNewline);
            }

            if (this.table && editCol >= 0) {
                // Optimistic Update
                if (editRow === -1) {
                    if (this.table.headers && editCol < this.table.headers.length) {
                        this.table.headers[editCol] = newValue;
                    }
                } else if (editRow >= 0 && editRow < this.table.rows.length) {
                    if (editCol < this.table.rows[editRow].length) {
                        this.table.rows[editRow][editCol] = newValue;
                    }
                } else if (editRow === this.table.rows.length) {
                    // Ghost row: Only add a new row if the value is non-empty
                    if (newValue.trim() !== '') {
                        const width = this.table.headers ? this.table.headers.length : this.table.rows[0]?.length || 0;
                        const newRow = new Array(width).fill('');
                        if (editCol < width) newRow[editCol] = newValue;
                        // Use immutable update to trigger Lit re-render
                        this.table = { ...this.table, rows: [...this.table.rows, newRow] };
                    } else {
                        // Empty value on ghost row: just cancel editing, don't add row
                        this.editCtrl.cancelEditing();
                        this._isCommitting = false;
                        return;
                    }
                }
                this.requestUpdate();

                // Dispatch update
                this.dispatchEvent(
                    new CustomEvent('cell-edit', {
                        detail: {
                            sheetIndex: this.sheetIndex,
                            tableIndex: this.tableIndex,
                            rowIndex: editRow,
                            colIndex: editCol,
                            newValue: newValue
                        },
                        bubbles: true,
                        composed: true
                    })
                );
                this.editCtrl.cancelEditing(); // Reset state
                this.focusCell();
            }
        } finally {
            this._isCommitting = false;
        }
    }

    /**
     * Calculate the selection range boundaries based on current selection state.
     * Delegates to SelectionController for the actual logic.
     */
    private _getSelectionRange(): SelectionRange {
        const table = this.table;
        if (!table) return { minR: -1, maxR: -1, minC: -1, maxC: -1 };

        const numRows = table.rows.length || 1;
        const numCols = table.headers ? table.headers.length : table.rows[0]?.length || 0;
        return this.selectionCtrl.getSelectionRange(numRows, numCols);
    }

    render() {
        if (!this.table) return html``;
        const table = this.table;

        const { minR, maxR, minC, maxC } = this._getSelectionRange();
        const editState = {
            isEditing: this.editCtrl.isEditing,
            pendingEditValue: this.editCtrl.pendingEditValue
        };

        // Build filter menu state from FilterController
        const filterMenu = this.filterCtrl.activeFilterMenu
            ? {
                x: this.filterCtrl.activeFilterMenu.x,
                y: this.filterCtrl.activeFilterMenu.y,
                col: this.filterCtrl.activeFilterMenu.colIndex,
                values: this.filterCtrl.getUniqueValues(this.filterCtrl.activeFilterMenu.colIndex),
                hiddenValues: this.filterCtrl.getHiddenValues(this.filterCtrl.activeFilterMenu.colIndex)
            }
            : null;

        return html`
            <spreadsheet-table-view
                .table="${table}"
                .visibleRowIndices="${this.rowVisibilityCtrl.visibleRowIndices}"
                .columnWidths="${this.resizeCtrl.colWidths}"
                .selectedRow="${this.selectionCtrl.selectedRow}"
                .selectedCol="${this.selectionCtrl.selectedCol}"
                .selectionRange="${{ minR, maxR, minC, maxC }}"
                .editState="${editState}"
                .contextMenu="${this.contextMenu}"
                .filterMenu="${filterMenu}"
                .resizingCol="${this.resizeCtrl.resizingCol}"
            }}"
                @view-insert-row="${this.eventCtrl.handleInsertRow}"
                @view-delete-row="${this.eventCtrl.handleDeleteRow}"
                @view-insert-col="${this.eventCtrl.handleInsertCol}"
                @view-delete-col="${this.eventCtrl.handleDeleteCol}"
                @view-filter-apply="${this.eventCtrl.handleFilterApply}"
                @view-filter-close="${this.eventCtrl.handleFilterClose}"
                @view-col-click="${this.eventCtrl.handleColClick}"
                @view-col-mousedown="${this.eventCtrl.handleColMousedown}"
                @view-col-dblclick="${this.eventCtrl.handleColDblclick}"
                @view-col-contextmenu="${this.eventCtrl.handleColContextMenu}"
                @view-col-input="${this.eventCtrl.handleColInput}"
                @view-col-blur="${this.eventCtrl.handleColBlur}"
                @view-col-keydown="${this.eventCtrl.handleColKeydown}"
                @view-row-click="${this.eventCtrl.handleRowClick}"
                @view-row-mousedown="${this.eventCtrl.handleRowMousedown}"
                @view-row-contextmenu="${this.eventCtrl.handleRowContextMenu}"
                @view-row-keydown="${this.eventCtrl.handleRowKeydown}"
                @view-cell-click="${this.eventCtrl.handleCellClick}"
                @view-cell-mousedown="${this.eventCtrl.handleCellMousedown}"
                @view-cell-dblclick="${this.eventCtrl.handleCellDblclick}"
                @view-cell-input="${this.eventCtrl.handleCellInput}"
                @view-cell-blur="${this.eventCtrl.handleCellBlur}"
                @view-cell-keydown="${this.eventCtrl.handleCellKeydown}"
                @view-cell-mousemove="${this.eventCtrl.handleCellMousemove}"
                @view-corner-click="${this.eventCtrl.handleCornerClick}"
                @view-corner-keydown="${this.eventCtrl.handleCornerKeydown}"
                @view-filter-click="${this.eventCtrl.handleFilterClick}"
                @view-resize-start="${this.eventCtrl.handleResizeStart}"
                @ss-metadata-change="${this.eventCtrl.handleMetadataChange}"
                @view-sort="${this.filterCtrl.handleSort}"
                @view-filter-change="${this.filterCtrl.handleFilterChange}"
                @view-clear-filter="${this.filterCtrl.handleClearFilter}"
            ></spreadsheet-table-view>
        `;
    }

    public handleToolbarAction(action: string) {
        this.toolbarCtrl.handleAction(action);
    }
}
