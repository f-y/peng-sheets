import { html, LitElement, PropertyValues, nothing, unsafeCSS, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit';
import { SelectionController, SelectionRange } from '../controllers/selection-controller';
import { EditController } from '../controllers/edit-controller';
import { ResizeController } from '../controllers/resize-controller';
import { NavigationController } from '../controllers/navigation-controller';
import { ClipboardController } from '../controllers/clipboard-controller';
import { FilterController } from '../controllers/filter-controller';
import { ToolbarController } from '../controllers/toolbar-controller';
import { FocusController } from '../controllers/focus-controller';
import { RowVisibilityController, VisualMetadata } from '../controllers/row-visibility-controller';
import {
    getEditingHtml,
    getDOMText,
    formatCellValue,
    renderMarkdown,
    NumberFormat
} from '../utils/spreadsheet-helpers';
import {
    getSelection as getEditSelection,
    insertLineBreakAtSelection,
    handleBackspaceAtZWS,
    normalizeEditContent,
    findEditingCell,
    calculateCellRangeState
} from '../utils/edit-mode-helpers';
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
    focusCtrl = new FocusController({
        getShadowRoot: () => this.shadowRoot,
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
            this._closeContextMenu();
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
        if (this._shouldFocusCell) {
            this.focusCtrl.focusSelectedCell();
            this._shouldFocusCell = false;
            this._wasFocusedBeforeUpdate = false;
        } else if (this._wasFocusedBeforeUpdate) {
            this.focusCtrl.focusSelectedCell();
            this._wasFocusedBeforeUpdate = false;
        }
    }

    private _handleInput(e: Event) {
        const inputEvent = e as InputEvent;
        const target = e.target as HTMLElement;

        // Track if user explicitly inserted a newline via Option+Enter
        if (inputEvent.inputType === 'insertLineBreak') {
            this.editCtrl.hasUserInsertedNewline = true;
        }

        // Normalize empty cells: when only <br> remains (browser placeholder), clear it
        // BUT only if user hasn't explicitly inserted newlines during this edit session
        if (target && target.innerHTML) {
            // Check if content is only <br> tags (browser cursor placeholder)
            const stripped = target.innerHTML
                .replace(/<br\s*\/?>/gi, '')
                .replace(/\u200B/g, '')
                .trim();
            if (stripped === '' && !this.editCtrl.hasUserInsertedNewline) {
                // Content is only BR and user didn't insert newlines, clear the browser placeholder
                target.innerHTML = '';
            }
        }

        // In replacement mode, keep pendingEditValue in sync with DOM content
        // This ensures that if user continues typing after initial direct input,
        // the final value reflects all their input, not just the initial character.
        if (this.editCtrl.isReplacementMode && target) {
            this.editCtrl.pendingEditValue = this._getDOMText(target);
        }
    }

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (this.editCtrl.isEditing) {
            this._handleEditModeKey(e);
            return;
        }

        if (e.isComposing) return;

        const isControl = e.ctrlKey || e.metaKey || e.altKey;

        // Header Edit
        if (
            this.selectionCtrl.selectedRow === -2 &&
            this.selectionCtrl.selectedCol >= 0 &&
            !isControl &&
            e.key.length === 1
        ) {
            e.preventDefault();
            this.selectionCtrl.selectedRow = -1;
            this.editCtrl.startEditing(e.key, true);
            this.focusCell();
            return;
        }

        const isRangeSelection = this.selectionCtrl.selectedCol === -2 || this.selectionCtrl.selectedRow === -2;

        // F2 - Start Editing
        if (e.key === 'F2') {
            e.preventDefault();
            if (isRangeSelection) return;

            // Fetch current value
            let currentVal = '';
            const r = this.selectionCtrl.selectedRow;
            const c = this.selectionCtrl.selectedCol;

            // Header logic ?
            if (r === -1 && c >= 0 && this.table?.headers) {
                currentVal = this.table.headers[c] || '';
            } else if (r >= 0 && c >= 0 && this.table?.rows && this.table.rows[r]) {
                currentVal = this.table.rows[r][c] || '';
            }

            this.editCtrl.startEditing(currentVal);
            this.focusCell();
            return;
        }

        if (!isControl && e.key.length === 1 && !isRangeSelection) {
            e.preventDefault();
            this.editCtrl.startEditing(e.key, true);
            this.focusCell();
            return;
        }

        if (isControl && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent('save-requested', { bubbles: true, composed: true }));
            return;
        }

        if (isControl && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this.clipboardCtrl.copyToClipboard();
            return;
        }

        if (isControl && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            this.clipboardCtrl.paste();
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.clipboardCtrl.deleteSelection();
            return;
        }

        // Nav
        const rowCount = this.table?.rows.length || 0;
        const colCount = this.table?.headers ? this.table.headers.length : this.table?.rows[0]?.length || 0;
        this.navCtrl.handleKeyDown(e, rowCount + 1, colCount); // +1 because we allow ghost row (rowCount)
        this.focusCell();
    };

    private _handleEditModeKey(e: KeyboardEvent) {
        e.stopPropagation();
        if (e.key === 'Enter') {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

                const selection = getEditSelection(this.shadowRoot);
                const element = e.target as HTMLElement;
                insertLineBreakAtSelection(selection, element);
                return;
            }

            e.preventDefault();
            this._commitEdit(e);

            if (!e.shiftKey) {
                this.selectionCtrl.selectionAnchorRow = -1;
                this.selectionCtrl.selectionAnchorCol = -1;
            }
            // Simple logic: controller doesn't handle nav fully inside component yet?
            // Delegate nav
            // We can just call navCtrl manually
            // But we need to check shift for Enter?
            // NavCtrl.handleKeyDown handles Enter
            const rowCount = this.table?.rows.length || 0;
            const colCount = this.table?.headers ? this.table.headers.length : this.table?.rows[0]?.length || 0;
            this.navCtrl.handleKeyDown(e, rowCount + 1, colCount);
            this.focusCell(); // Focus new cell

            // Sync anchor
            if (!e.shiftKey) {
                this.selectionCtrl.selectionAnchorRow = this.selectionCtrl.selectedRow;
                this.selectionCtrl.selectionAnchorCol = this.selectionCtrl.selectedCol;
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this._commitEdit(e);

            if (!e.shiftKey) {
                this.selectionCtrl.selectionAnchorRow = -1;
                this.selectionCtrl.selectionAnchorCol = -1;
            }
            const colCount = this.table?.headers ? this.table.headers.length : this.table?.rows[0]?.length || 0;

            // Delegate Tab wrapping to NavigationController
            this.navCtrl.handleTabWrap(e.shiftKey, colCount);
            this.focusCell();

            if (!e.shiftKey) {
                this.selectionCtrl.selectionAnchorRow = this.selectionCtrl.selectedRow;
                this.selectionCtrl.selectionAnchorCol = this.selectionCtrl.selectedCol;
            }
        } else if (e.key === 'Backspace') {
            // Handle Backspace at ZWS + BR boundary specially
            const selection = getEditSelection(this.shadowRoot);
            if (handleBackspaceAtZWS(selection)) {
                e.preventDefault();
                return;
            }
            // Let browser handle normal Backspace
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.editCtrl.cancelEditing();
            this.focusCell();
        }
    }

    /**
     * Commits the current edit if one is active.
     * Call this before changing cell selection to ensure edits are saved.
     */
    private async _commitCurrentEdit(): Promise<void> {
        if (this.editCtrl.isEditing && !this._isCommitting) {
            const editingCell = this.shadowRoot?.querySelector('.cell.editing') as HTMLElement | null;
            if (editingCell) {
                // Create a synthetic event with the editing cell as target
                const syntheticEvent = new FocusEvent('blur', { bubbles: true });
                Object.defineProperty(syntheticEvent, 'target', { value: editingCell, writable: false });
                await this._commitEdit(syntheticEvent);
            }
        }
    }

    private async _commitEdit(e: Event) {
        if (this._isCommitting) return;
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
            newValue = this._getDOMText(targetEl);

            // Normalize content (strip trailing newlines, handle empty content)
            newValue = normalizeEditContent(newValue, this.editCtrl.hasUserInsertedNewline);

            // In replacement mode (direct keyboard input), pendingEditValue is the authoritative value.
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

    // Existing Focus Listeners
    private _handleFocusIn = () => {
        (window as unknown as { activeSpreadsheetTable: SpreadsheetTable }).activeSpreadsheetTable = this;
    };

    private _handleBlur(e: FocusEvent) {
        if (e.relatedTarget && (e.target as Element).contains(e.relatedTarget as Node)) {
            return;
        }
        if (this.editCtrl.isEditing && !this._isCommitting) {
            this._commitEdit(e);
        }
    }

    private _handleContextMenu(e: MouseEvent, type: 'row' | 'col', index: number) {
        e.preventDefault();
        e.stopPropagation();
        this.contextMenu = { x: e.clientX, y: e.clientY, type: type, index: index };
        if (type === 'row') {
            this.selectionCtrl.selectCell(index, -2);
        } else {
            this.selectionCtrl.selectCell(-2, index);
        }
        this.focusCell();
    }

    private _closeContextMenu() {
        this.contextMenu = null;
    }

    private _dispatchAction(action: string, detail: Record<string, unknown>) {
        this.dispatchEvent(
            new CustomEvent(action, {
                detail: {
                    sheetIndex: this.sheetIndex,
                    tableIndex: this.tableIndex,
                    ...detail
                },
                bubbles: true,
                composed: true
            })
        );
        this._closeContextMenu();
    }

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
        // console.log('SpreadsheetTable connected', this.tableIndex);
        window.addEventListener('click', this._handleGlobalClick);

        // MouseMove/Up handled by SelectionController
        // Register focus tracker
        this.addEventListener('focusin', this._handleFocusIn);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // console.log('SpreadsheetTable disconnected', this.tableIndex);
        window.removeEventListener('click', this._handleGlobalClick);
    }

    private _handleGlobalClick = (e: MouseEvent) => {
        const path = e.composedPath();
        if (this.contextMenu) {
            // If click is inside context menu, do nothing (let menu handle it)
            // But context menu is usually fixed pos, often explicit close needed?
            // Actually, we usually want to close context menu on any outside click.
            // Check if click source is the context menu itself
            const isInside = path.some((el) => (el as HTMLElement).classList?.contains('context-menu'));
            if (!isInside) {
                this._closeContextMenu();
            }
        }
        if (this.filterCtrl.activeFilterMenu) {
            const isInside = path.some(
                (el) =>
                    (el as HTMLElement).tagName?.toLowerCase() === 'filter-menu' ||
                    (el as HTMLElement).classList?.contains('filter-icon')
            );
            if (!isInside) {
                this.filterCtrl.closeFilterMenu();
            }
        }
    };

    // ============================================================
    // Extracted Event Handlers - Reduce render() inline complexity
    // ============================================================

    /** Handle column header click */
    private _onColClick = (e: CustomEvent<{ col: number; shiftKey: boolean }>) => {
        this.selectionCtrl.selectCell(-2, e.detail.col, e.detail.shiftKey);
        this.focusCell();
    };

    /** Handle column header mousedown for drag selection */
    private _onColMousedown = (e: CustomEvent<{ col: number; shiftKey: boolean }>) => {
        this.selectionCtrl.startSelection(-2, e.detail.col, e.detail.shiftKey);
    };

    /** Handle column header double-click for editing */
    private _onColDblclick = (e: CustomEvent<{ col: number }>) => {
        const col = e.detail.col;
        const value = this.table?.headers?.[col] ?? String(col + 1);
        this.selectionCtrl.selectCell(-1, col);
        this.editCtrl.startEditing(value);
        this.focusCell();
    };

    /** Handle column context menu */
    private _onColContextMenu = (e: CustomEvent<{ type: string; index: number; x: number; y: number }>) => {
        this._handleContextMenu(
            {
                clientX: e.detail.x,
                clientY: e.detail.y,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as MouseEvent,
            'col',
            e.detail.index
        );
    };

    /** Handle column input event */
    private _onColInput = (e: CustomEvent<{ col: number; target: EventTarget | null }>) => {
        this._handleInput({ target: e.detail.target } as Event);
    };

    /** Handle column blur event */
    private _onColBlur = (e: CustomEvent<{ col: number; originalEvent: FocusEvent }>) => {
        this._handleBlur(e.detail.originalEvent);
    };

    /** Handle column keydown event */
    private _onColKeydown = (e: CustomEvent<{ col: number; originalEvent: KeyboardEvent }>) => {
        this._handleKeyDown(e.detail.originalEvent);
    };

    /** Handle filter icon click */
    private _onFilterClick = (e: CustomEvent<{ col: number; x: number; y: number }>) => {
        this.filterCtrl.toggleFilterMenu(
            {
                clientX: e.detail.x,
                clientY: e.detail.y,
                stopPropagation: () => {},
                target: {
                    getBoundingClientRect: () => ({
                        left: e.detail.x,
                        right: e.detail.x,
                        bottom: e.detail.y
                    })
                }
            } as unknown as MouseEvent,
            e.detail.col
        );
    };

    /** Handle column resize start */
    private _onResizeStart = (e: CustomEvent<{ col: number; x: number; width: number }>) => {
        this.resizeCtrl.startResize(
            { clientX: e.detail.x, preventDefault: () => {}, stopPropagation: () => {} } as MouseEvent,
            e.detail.col,
            e.detail.width
        );
    };

    /** Handle row header click */
    private _onRowClick = (e: CustomEvent<{ row: number; shiftKey: boolean }>) => {
        this.selectionCtrl.selectCell(e.detail.row, -2, e.detail.shiftKey);
        this.focusCell();
    };

    /** Handle row header mousedown for drag selection */
    private _onRowMousedown = (e: CustomEvent<{ row: number; shiftKey: boolean }>) => {
        this.selectionCtrl.startSelection(e.detail.row, -2, e.detail.shiftKey);
    };

    /** Handle row context menu */
    private _onRowContextMenu = (e: CustomEvent<{ type: string; index: number; x: number; y: number }>) => {
        this._handleContextMenu(
            {
                clientX: e.detail.x,
                clientY: e.detail.y,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as MouseEvent,
            'row',
            e.detail.index
        );
    };

    /** Handle row keydown event */
    private _onRowKeydown = (e: CustomEvent<{ row: number; col: number; originalEvent: KeyboardEvent }>) => {
        this._handleKeyDown(e.detail.originalEvent);
    };

    /** Handle data cell click */
    private _onCellClick = async (e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
        await this._commitCurrentEdit();
        this.selectionCtrl.selectCell(e.detail.row, e.detail.col, e.detail.shiftKey);
        this.focusCell();
    };

    /** Handle data cell mousedown for drag selection */
    private _onCellMousedown = (e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
        // Commit any pending edit before changing selection (click-away commit)
        if (this.editCtrl.isEditing) {
            // Editing cell is in View's shadow DOM, not Container's
            const view = this.shadowRoot?.querySelector('spreadsheet-table-view');
            const editingCell = view?.shadowRoot?.querySelector('.cell.editing') as HTMLElement | null;
            if (editingCell) {
                const syntheticEvent = new FocusEvent('blur', { bubbles: true });
                Object.defineProperty(syntheticEvent, 'target', { value: editingCell, writable: false });
                this._commitEdit(syntheticEvent);
            } else if (this.editCtrl.isReplacementMode && this.editCtrl.pendingEditValue !== null) {
                // Replacement mode without DOM update yet - directly apply pending value
                const row = this.selectionCtrl.selectedRow;
                const col = this.selectionCtrl.selectedCol;
                if (this.table && row >= 0 && col >= 0 && row < this.table.rows.length) {
                    this.table.rows[row][col] = this.editCtrl.pendingEditValue;
                    this.dispatchEvent(
                        new CustomEvent('cell-edit', {
                            detail: {
                                sheetIndex: this.sheetIndex,
                                tableIndex: this.tableIndex,
                                rowIndex: row,
                                colIndex: col,
                                newValue: this.editCtrl.pendingEditValue
                            },
                            bubbles: true,
                            composed: true
                        })
                    );
                    this.requestUpdate();
                }
                this.editCtrl.cancelEditing();
            }
        }

        if (e.detail.shiftKey) {
            this.selectionCtrl.selectCell(e.detail.row, e.detail.col, true);
        } else {
            this.selectionCtrl.startSelection(e.detail.row, e.detail.col);
        }
        this.focusCell();
    };

    /** Handle data cell double-click for editing */
    private _onCellDblclick = (e: CustomEvent<{ row: number; col: number }>) => {
        const { row, col } = e.detail;
        const value = this.table?.rows?.[row]?.[col] ?? '';
        this.selectionCtrl.selectCell(row, col);
        this.editCtrl.startEditing(value);
        this.focusCell();
    };

    /** Handle data cell input event */
    private _onCellInput = (e: CustomEvent<{ row: number; col: number; target: EventTarget | null }>) => {
        this._handleInput({ target: e.detail.target } as Event);
    };

    /** Handle data cell blur event */
    private _onCellBlur = (e: CustomEvent<{ row: number; col: number; originalEvent: FocusEvent }>) => {
        this._handleBlur(e.detail.originalEvent);
    };

    /** Handle data cell keydown event */
    private _onCellKeydown = (e: CustomEvent<{ row: number; col: number; originalEvent: KeyboardEvent }>) => {
        this._handleKeyDown(e.detail.originalEvent);
    };

    /** Handle data cell mousemove event for drag selection */
    private _onCellMousemove = (e: CustomEvent<{ row: number; col: number }>) => {
        // Update selection if currently selecting
        if (this.selectionCtrl.isSelecting) {
            this.selectionCtrl.selectCell(e.detail.row, e.detail.col, true);
        }
    };

    /** Handle corner cell click (select all) */
    private _onCornerClick = () => {
        this.selectionCtrl.selectCell(-2, -2);
        this.focusCell();
    };

    /** Handle context menu action from View */
    private _onMenuAction = (e: CustomEvent<{ action: string; type: string; index: number }>) => {
        const { action, type, index } = e.detail;
        if (action === 'insert') {
            if (type === 'row') {
                this._dispatchAction('insert-row', { rowIndex: index });
            } else {
                this._dispatchAction('column-insert', { colIndex: index });
            }
        } else if (action === 'delete') {
            if (type === 'row') {
                this._dispatchAction('row-delete', { rowIndex: index });
            } else {
                this._dispatchAction('column-delete', { colIndex: index });
            }
        }
        this.contextMenu = null;
    };

    /** Handle filter apply from View */
    private _onFilterApply = (e: CustomEvent) => {
        this.filterCtrl.handleFilterChange(e);
    };

    /** Handle filter close from View */
    private _onFilterClose = () => {
        this.filterCtrl.closeFilterMenu();
    };

    /** Handle metadata change from View */
    private _onMetadataChange = (e: CustomEvent<{ description: string }>) => {
        this._dispatchAction('metadata-update', { description: e.detail.description });
    };

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

    /**
     * Render the context menu and filter menu overlays.
     */
    private _renderMenus(): TemplateResult | typeof nothing {
        const contextMenuTemplate = this.contextMenu
            ? html`
                  <ss-context-menu
                      .x="${this.contextMenu.x}"
                      .y="${this.contextMenu.y}"
                      .menuType="${this.contextMenu.type}"
                      .index="${this.contextMenu.index}"
                      @ss-insert-row="${(e: CustomEvent<{ index: number }>) => {
                          this._dispatchAction('insert-row', { rowIndex: e.detail.index });
                          this.contextMenu = null;
                      }}"
                      @ss-delete-row="${(e: CustomEvent<{ index: number }>) => {
                          this._dispatchAction('row-delete', { rowIndex: e.detail.index });
                          this.contextMenu = null;
                      }}"
                      @ss-insert-col="${(e: CustomEvent<{ index: number }>) => {
                          this._dispatchAction('column-insert', { colIndex: e.detail.index });
                          this.contextMenu = null;
                      }}"
                      @ss-delete-col="${(e: CustomEvent<{ index: number }>) => {
                          this._dispatchAction('column-delete', { colIndex: e.detail.index });
                          this.contextMenu = null;
                      }}"
                      @ss-menu-close="${() => {
                          this.contextMenu = null;
                      }}"
                  ></ss-context-menu>
              `
            : nothing;

        const filterMenuTemplate = this.filterCtrl.activeFilterMenu
            ? html`
                  <filter-menu
                      style="position: fixed; left: ${this.filterCtrl.activeFilterMenu.x}px; top: ${this.filterCtrl
                          .activeFilterMenu.y}px; z-index: 2001;"
                      .columnName="${this.table?.headers?.[this.filterCtrl.activeFilterMenu.colIndex] || ''}"
                      .values="${this.filterCtrl.getUniqueValues(this.filterCtrl.activeFilterMenu.colIndex)}"
                      .hiddenValues="${((this.table?.metadata?.['visual'] as VisualMetadata)?.['filters'] || {})[
                          this.filterCtrl.activeFilterMenu.colIndex.toString()
                      ] || []}"
                      @sort="${(e: CustomEvent) => this.filterCtrl.handleSort(e)}"
                      @filter-change="${(e: CustomEvent) => this.filterCtrl.handleFilterChange(e)}"
                      @clear-filter="${(e: CustomEvent) => this.filterCtrl.handleClearFilter(e)}"
                  ></filter-menu>
              `
            : nothing;

        return html`${contextMenuTemplate}${filterMenuTemplate}`;
    }

    /**
     * Render the corner cell and all column headers.
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
        const isColMode = selRow === -2;

        return html`
            <!-- Corner -->
            <ss-corner-cell
                .isSelected="${selRow === -2 && selCol === -2}"
                @ss-corner-click="${() => {
                    this.selectionCtrl.selectCell(-2, -2);
                    this.focusCell();
                }}"
                @ss-corner-keydown="${(e: CustomEvent<{ originalEvent: KeyboardEvent }>) => {
                    this._handleKeyDown(e.detail.originalEvent);
                }}"
            ></ss-corner-cell>

            <!-- Column Headers -->
            ${table.headers
                ? table.headers.map((header, i) => {
                      const isActive = selRow === -1 && selCol === i;
                      const isInRange = (minR === -1 || isColMode) && i >= minC && i <= maxC;
                      const showActiveOutline = isActive && minC === maxC;

                      const visual = (table.metadata?.['visual'] as VisualMetadata) || {};
                      const filters = visual.filters || {};
                      const hiddenValues = filters[i.toString()] || [];
                      const isFiltered = hiddenValues.length > 0;

                      return html`
                          <ss-column-header
                              .col="${i}"
                              .value="${header}"
                              .isSelected="${(selRow === -2 && (selCol === i || isInRange)) ||
                              (selRow === -1 && selCol === i) ||
                              (selRow >= 0 && selCol === i && minR === maxR && minC === maxC)}"
                              .isInRange="${isInRange}"
                              .isEditing="${this.editCtrl.isEditing && isActive}"
                              .hasActiveFilter="${isFiltered}"
                              .showActiveOutline="${showActiveOutline}"
                              .width="${this.resizeCtrl.colWidths[i]}"
                              @ss-col-click="${this._onColClick}"
                              @ss-col-mousedown="${this._onColMousedown}"
                              @ss-col-dblclick="${this._onColDblclick}"
                              @ss-contextmenu="${this._onColContextMenu}"
                              @ss-col-input="${this._onColInput}"
                              @ss-col-blur="${this._onColBlur}"
                              @ss-col-keydown="${this._onColKeydown}"
                              @ss-filter-click="${this._onFilterClick}"
                              @ss-resize-start="${this._onResizeStart}"
                          ></ss-column-header>
                      `;
                  })
                : Array.from({ length: colCount }).map((_, i) => {
                      const isActive = selRow === -1 && selCol === i;
                      const isInRange = (minR === -1 || isColMode) && i >= minC && i <= maxC;
                      const showActiveOutline = isActive && minC === maxC;
                      return html`
                          <ss-column-header
                              .col="${i}"
                              .header="${i + 1}"
                              .isSelected="${(selRow === -2 && (selCol === i || isInRange)) ||
                              (selRow === -1 && selCol === i) ||
                              (selRow >= 0 && selCol === i && minR === maxR && minC === maxC)}"
                              .isEditing="${this.editCtrl.isEditing && isActive}"
                              .isActive="${showActiveOutline}"
                              .isInRange="${isInRange}"
                              .hasActiveFilter="${false}"
                              .width="${this.resizeCtrl.colWidths[i]}"
                              @ss-col-click="${() => {
                                  this.selectionCtrl.selectCell(-2, i);
                                  this.focusCell();
                              }}"
                              @ss-col-mousedown="${(e: CustomEvent<{ col: number; shiftKey: boolean }>) => {
                                  this.selectionCtrl.startSelection(-2, i, e.detail.shiftKey);
                              }}"
                              @ss-col-dblclick="${() => {
                                  this.selectionCtrl.selectCell(-1, i);
                                  this.editCtrl.startEditing(i + 1 + '');
                                  this.focusCell();
                              }}"
                              @ss-contextmenu="${(
                                  e: CustomEvent<{ type: string; index: number; x: number; y: number }>
                              ) => {
                                  this._handleContextMenu(
                                      {
                                          clientX: e.detail.x,
                                          clientY: e.detail.y,
                                          preventDefault: () => {},
                                          stopPropagation: () => {}
                                      } as MouseEvent,
                                      'col',
                                      i
                                  );
                              }}"
                              @ss-col-input="${(e: CustomEvent<{ col: number; target: EventTarget | null }>) => {
                                  this._handleInput({ target: e.detail.target } as Event);
                              }}"
                              @ss-col-blur="${(e: CustomEvent<{ col: number; originalEvent: FocusEvent }>) => {
                                  this._handleBlur(e.detail.originalEvent);
                              }}"
                              @ss-col-keydown="${(e: CustomEvent<{ col: number; originalEvent: KeyboardEvent }>) => {
                                  this._handleKeyDown(e.detail.originalEvent);
                              }}"
                              @ss-resize-start="${(e: CustomEvent<{ col: number; x: number; width: number }>) => {
                                  this.resizeCtrl.startResize(
                                      {
                                          clientX: e.detail.x,
                                          preventDefault: () => {},
                                          stopPropagation: () => {}
                                      } as MouseEvent,
                                      i,
                                      this.resizeCtrl.colWidths[i]
                                  );
                              }}"
                          ></ss-column-header>
                      `;
                  })}
        `;
    }

    /**
     * Render the ghost row (for adding new data) with row header and cells.
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
        const r = table.rows.length;
        const isGhostRowSelected =
            selCol === -2 && (selRow === r || ((minC === -1 || selCol === -2) && r >= minR && r <= maxR));

        return html`
            <ss-row-header
                .row="${r}"
                .isSelected="${isGhostRowSelected}"
                .isInRange="${false}"
                .isGhost="${true}"
                @ss-row-click="${this._onRowClick}"
                @ss-row-mousedown="${this._onRowMousedown}"
                @ss-row-keydown="${this._onRowKeydown}"
                @ss-contextmenu="${this._onRowContextMenu}"
            ></ss-row-header>

            ${Array.from({ length: colCount }).map((_, c) => {
                const isActive = r === selRow && c === selCol;
                const isEditingCell = this.editCtrl.isEditing && isActive;
                const rangeState = calculateCellRangeState(r, c, minR, maxR, minC, maxC);

                return html`
                    <ss-ghost-cell
                        .row="${r}"
                        .col="${c}"
                        .isEditing="${isEditingCell}"
                        .isSelected="${isActive}"
                        .isInRange="${rangeState.inRange}"
                        .isActive="${isActive}"
                        .rangeTop="${rangeState.topEdge}"
                        .rangeBottom="${rangeState.bottomEdge}"
                        .rangeLeft="${rangeState.leftEdge}"
                        .rangeRight="${rangeState.rightEdge}"
                        .editingHtml="${this._getEditingHtml(
                            isEditingCell && this.editCtrl.pendingEditValue !== null
                                ? this.editCtrl.pendingEditValue
                                : ''
                        )}"
                        @ss-cell-click="${async (e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
                            await this._commitCurrentEdit();
                            this.selectionCtrl.selectCell(e.detail.row, e.detail.col, e.detail.shiftKey);
                            this.focusCell();
                        }}"
                        @ss-cell-mousedown="${(e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
                            if (e.detail.shiftKey) this.selectionCtrl.selectCell(e.detail.row, e.detail.col, true);
                            else this.selectionCtrl.startSelection(e.detail.row, e.detail.col);
                            this.focusCell();
                        }}"
                        @ss-cell-dblclick="${() => {
                            this.selectionCtrl.selectCell(r, c);
                            this.editCtrl.startEditing('');
                            this.focusCell();
                        }}"
                        @ss-cell-input="${(
                            e: CustomEvent<{ row: number; col: number; target: EventTarget | null }>
                        ) => {
                            this._handleInput({ target: e.detail.target } as Event);
                        }}"
                        @ss-cell-blur="${(e: CustomEvent<{ row: number; col: number; originalEvent: FocusEvent }>) => {
                            this._handleBlur(e.detail.originalEvent);
                        }}"
                        @ss-cell-keydown="${(
                            e: CustomEvent<{ row: number; col: number; originalEvent: KeyboardEvent }>
                        ) => {
                            this._handleKeyDown(e.detail.originalEvent);
                        }}"
                    ></ss-ghost-cell>
                `;
            })}
        `;
    }

    /**
     * Render a single data row with its row header and cells.
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
                @ss-row-click="${this._onRowClick}"
                @ss-row-mousedown="${this._onRowMousedown}"
                @ss-contextmenu="${this._onRowContextMenu}"
                @ss-row-keydown="${this._onRowKeydown}"
            ></ss-row-header>

            <!-- Cells -->
            ${Array.from({ length: colCount }).map((_, c) => {
                const cell = row[c] !== undefined ? row[c] : '';
                const isActive = r === selRow && c === selCol;
                const rangeState = calculateCellRangeState(r, c, minR, maxR, minC, maxC);
                const isEditingCell = this.editCtrl.isEditing && isActive;
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
                        .value="${isEditingCell && this.editCtrl.pendingEditValue !== null
                            ? this.editCtrl.pendingEditValue
                            : cell}"
                        .renderedHtml="${this._renderMarkdown(displayValue)}"
                        .editingHtml="${this._getEditingHtml(
                            isEditingCell && this.editCtrl.pendingEditValue !== null
                                ? this.editCtrl.pendingEditValue
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
                        @ss-cell-click="${this._onCellClick}"
                        @ss-cell-mousedown="${this._onCellMousedown}"
                        @ss-cell-dblclick="${this._onCellDblclick}"
                        @ss-cell-input="${this._onCellInput}"
                        @ss-cell-blur="${this._onCellBlur}"
                        @ss-cell-keydown="${this._onCellKeydown}"
                    ></ss-data-cell>
                `;
            })}
        `;
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
                  selectedValues: new Set<string>()
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
                @view-cell-mousedown="${this._onCellMousedown}"
                @view-cell-click="${this._onCellClick}"
                @view-cell-dblclick="${this._onCellDblclick}"
                @view-cell-input="${this._onCellInput}"
                @view-cell-blur="${this._onCellBlur}"
                @view-cell-keydown="${this._onCellKeydown}"
                @view-cell-mousemove="${this._onCellMousemove}"
                @view-row-mousedown="${this._onRowMousedown}"
                @view-row-click="${this._onRowClick}"
                @view-row-contextmenu="${this._onRowContextMenu}"
                @view-row-keydown="${this._onRowKeydown}"
                @view-col-mousedown="${this._onColMousedown}"
                @view-col-click="${this._onColClick}"
                @view-col-dblclick="${this._onColDblclick}"
                @view-col-contextmenu="${this._onColContextMenu}"
                @view-col-input="${this._onColInput}"
                @view-col-blur="${this._onColBlur}"
                @view-col-keydown="${this._onColKeydown}"
                @view-corner-click="${this._onCornerClick}"
                @view-menu-action="${this._onMenuAction}"
                @view-insert-row="${(e: CustomEvent<{ index: number }>) => {
                    this._dispatchAction('insert-row', { rowIndex: e.detail.index });
                    this._closeContextMenu();
                }}"
                @view-delete-row="${(e: CustomEvent<{ index: number }>) => {
                    this._dispatchAction('row-delete', { rowIndex: e.detail.index });
                    this._closeContextMenu();
                }}"
                @view-insert-col="${(e: CustomEvent<{ index: number }>) => {
                    this._dispatchAction('column-insert', { colIndex: e.detail.index });
                    this._closeContextMenu();
                }}"
                @view-delete-col="${(e: CustomEvent<{ index: number }>) => {
                    this._dispatchAction('column-delete', { colIndex: e.detail.index });
                    this._closeContextMenu();
                }}"
                @view-filter-apply="${this._onFilterApply}"
                @view-filter-close="${this._onFilterClose}"
                @view-filter-click="${this._onFilterClick}"
                @view-resize-start="${this._onResizeStart}"
                @ss-metadata-change="${this._onMetadataChange}"
            ></spreadsheet-table-view>
        `;
    }

    private _getEditingHtml(text: string): string {
        return getEditingHtml(text);
    }

    private _getDOMText(node: Node, isRoot = false): string {
        return getDOMText(node, isRoot);
    }

    private _formatCellValue(value: string, format?: NumberFormat): string {
        return formatCellValue(value, format);
    }

    private _renderMarkdown(content: string): string {
        return renderMarkdown(content);
    }

    public handleToolbarAction(action: string) {
        this.toolbarCtrl.handleAction(action);
    }

    private _updateCell(r: number, c: number, value: string) {
        // Optimistic update
        if (this.table && this.table.rows[r]) {
            this.table.rows[r][c] = value;
            this.requestUpdate();
            this.dispatchEvent(
                new CustomEvent('cell-edit', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: this.tableIndex,
                        rowIndex: r,
                        colIndex: c,
                        newValue: value
                    },
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    // ---- Helper methods for ToolbarController ----

    getCellValue(row: number, col: number): string {
        return this.table?.rows[row]?.[col] || '';
    }

    updateCellValue(row: number, col: number, value: string): void {
        this._updateCell(row, col, value);
    }

    getEditModeValue(): string {
        return this.editCtrl.pendingEditValue || '';
    }

    setEditModeValue(value: string): void {
        this.editCtrl.setPendingValue(value);
    }
}
