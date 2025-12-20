import { ReactiveController } from 'lit';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import { getDOMText } from '../utils/spreadsheet-helpers';
import { normalizeEditContent, findEditingCell } from '../utils/edit-mode-helpers';

export class EventController implements ReactiveController {
    host: SpreadsheetTable;

    constructor(host: SpreadsheetTable) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {
        window.addEventListener('click', this.handleGlobalClick);
    }

    hostDisconnected() {
        window.removeEventListener('click', this.handleGlobalClick);
    }

    private handleGlobalClick = (e: MouseEvent) => {
        const path = e.composedPath();
        if (this.host.contextMenu) {
            // Check if click source is the context menu itself
            const isInside = path.some((el) => (el as HTMLElement).classList?.contains('context-menu'));
            if (!isInside) {
                this.closeContextMenu();
            }
        }
        if (this.host.filterCtrl.activeFilterMenu) {
            const isInside = path.some(
                (el) =>
                    (el as HTMLElement).tagName?.toLowerCase() === 'filter-menu' ||
                    (el as HTMLElement).classList?.contains('filter-icon')
            );
            if (!isInside) {
                this.host.filterCtrl.closeFilterMenu();
            }
        }
    };

    private closeContextMenu() {
        this.host.contextMenu = null;
    }

    private dispatchAction(action: string, detail: Record<string, unknown>) {
        this.host.dispatchEvent(
            new CustomEvent(action, {
                detail: {
                    sheetIndex: this.host.sheetIndex,
                    tableIndex: this.host.tableIndex,
                    ...detail
                },
                bubbles: true,
                composed: true
            })
        );
        this.closeContextMenu();
    }

    // ============================================================
    // Global Event Handlers (Bound in SpreadsheetTable)
    // ============================================================

    handleKeyDown = (e: KeyboardEvent) => {
        this.host.keyboardCtrl.handleKeyDown(e);
    };

    handleFocusOut = (e: FocusEvent) => {
        // Delegate to specific logic if needed, or remove listener if unused
        // Currently SpreadsheetTable had _handleFocusIn?
        // _handleBlur logic was removed?
        // Let's assume generic blur handling if any
    };

    handleMouseDown = (e: MouseEvent) => {
        // Global mousedown handling if needed
    };

    handleMouseUp = (e: MouseEvent) => {
        this.host.selectionCtrl.handleMouseUp(e);
    };

    handleMouseMove = (e: MouseEvent) => {
        this.host.selectionCtrl.handleMouseMove(e);
    };

    handleDblClick = (e: MouseEvent) => {
        // Global dblclick
    };

    handlePaste = (e: ClipboardEvent) => {
        this.host.keyboardCtrl.handlePaste(e);
    };

    handleCut = (e: ClipboardEvent) => {
        this.host.keyboardCtrl.handleCut(e);
    };

    handleCopy = (e: ClipboardEvent) => {
        this.host.keyboardCtrl.handleCopy(e);
    };

    // Public wrapper for context menu
    handleContextMenuGlobal = (e: MouseEvent) => {
        // Logic for global context menu if any
    };

    // Note: handleContextMenu is private helper currently.
    // SpreadsheetTable uses this.eventCtrl.handleContextMenu in connectedCallback.
    // We should expose it or rename it.
    // 'contextmenu' event listener expects a handler.

    // Changing private handleContextMenu to public arrow function
    handleContextMenu = (e: MouseEvent, type?: 'row' | 'col', index?: number) => {
        e.preventDefault();
        e.stopPropagation();

        // If called from global listener, type/index might be undefined
        // We need to determine if we clicked on something specific?
        // Or just show generic menu?
        // Original _handleContextMenu logic?

        // Use composed path to find row/col?
        // For now, if no type/index, return?
        if (!type || index === undefined) return;

        this.host.contextMenu = { x: e.clientX, y: e.clientY, type: type, index: index };
        if (type === 'row') {
            this.host.selectionCtrl.selectCell(index, -2);
        } else {
            this.host.selectionCtrl.selectCell(-2, index);
        }
        this.host.focusCell();
    };

    // ============================================================
    // Handler Implementations
    // ============================================================

    handleColClick = (e: CustomEvent<{ col: number; shiftKey: boolean }>) => {
        this.host.selectionCtrl.selectCell(-2, e.detail.col, e.detail.shiftKey);
        this.host.focusCell();
    };

    handleColMousedown = (e: CustomEvent<{ col: number; shiftKey: boolean }>) => {
        this.host.selectionCtrl.startSelection(-2, e.detail.col, e.detail.shiftKey);
    };

    handleColDblclick = (e: CustomEvent<{ col: number }>) => {
        const col = e.detail.col;
        const value = this.host.table?.headers?.[col] ?? String(col + 1);
        this.host.selectionCtrl.selectCell(-1, col);
        this.host.editCtrl.startEditing(value);
        this.host.focusCell();
    };

    handleColContextMenu = (e: CustomEvent<{ type: string; index: number; x: number; y: number }>) => {
        this.handleContextMenu(
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

    handleColInput = (e: CustomEvent<{ col: number; target: EventTarget | null }>) => {
        this.handleInput({ target: e.detail.target } as Event);
    };

    handleColBlur = (e: CustomEvent<{ col: number; originalEvent: FocusEvent }>) => {
        this.handleBlur(e.detail.originalEvent);
    };

    handleColKeydown = (e: CustomEvent<{ col: number; originalEvent: KeyboardEvent }>) => {
        this.host.keyboardCtrl.handleKeyDown(e.detail.originalEvent);
    };

    handleFilterClick = (e: CustomEvent<{ col: number; x: number; y: number }>) => {
        this.host.filterCtrl.toggleFilterMenu(
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

    handleResizeStart = (e: CustomEvent<{ col: number; x: number; width: number }>) => {
        this.host.resizeCtrl.startResize(
            { clientX: e.detail.x, preventDefault: () => {}, stopPropagation: () => {} } as MouseEvent,
            e.detail.col,
            e.detail.width
        );
    };

    handleRowClick = (e: CustomEvent<{ row: number; shiftKey: boolean }>) => {
        this.host.selectionCtrl.selectCell(e.detail.row, -2, e.detail.shiftKey);
        this.host.focusCell();
    };

    handleRowMousedown = (e: CustomEvent<{ row: number; shiftKey: boolean }>) => {
        this.host.selectionCtrl.startSelection(e.detail.row, -2, e.detail.shiftKey);
    };

    handleRowContextMenu = (e: CustomEvent<{ type: string; index: number; x: number; y: number }>) => {
        this.handleContextMenu(
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

    handleRowKeydown = (e: CustomEvent<{ row: number; col: number; originalEvent: KeyboardEvent }>) => {
        this.host.keyboardCtrl.handleKeyDown(e.detail.originalEvent);
    };

    handleCellClick = async (e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
        // Commit current edit if active
        // Logic from _commitCurrentEdit (moved/adapted)
        if (this.host.editCtrl.isEditing) {
            const syntheticEvent = new CustomEvent('commit', { bubbles: true, composed: true });
            await this.host.commitEdit(syntheticEvent);
            this.host.requestUpdate();
        }

        this.host.selectionCtrl.selectCell(e.detail.row, e.detail.col, e.detail.shiftKey);
        this.host.focusCell();
    };

    handleCellMousedown = (e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) => {
        // Commit any pending edit before changing selection (click-away commit)
        if (this.host.editCtrl.isEditing) {
            // Editing cell is in View's shadow DOM
            const view = this.host.shadowRoot?.querySelector('spreadsheet-table-view');
            const editingCell = view?.shadowRoot?.querySelector('.cell.editing') as HTMLElement | null;

            if (editingCell) {
                const syntheticEvent = new FocusEvent('blur', { bubbles: true });
                Object.defineProperty(syntheticEvent, 'target', { value: editingCell, writable: false });
                this.host.commitEdit(syntheticEvent);
            } else if (this.host.editCtrl.isReplacementMode && this.host.editCtrl.pendingEditValue !== null) {
                // Replacement mode without DOM update yet - directly apply pending value
                const row = this.host.selectionCtrl.selectedRow;
                const col = this.host.selectionCtrl.selectedCol;
                if (this.host.table && row >= 0 && col >= 0 && row < this.host.table.rows.length) {
                    this.host.table.rows[row][col] = this.host.editCtrl.pendingEditValue;
                    this.host.dispatchEvent(
                        new CustomEvent('cell-edit', {
                            detail: {
                                sheetIndex: this.host.sheetIndex,
                                tableIndex: this.host.tableIndex,
                                rowIndex: row,
                                colIndex: col,
                                newValue: this.host.editCtrl.pendingEditValue
                            },
                            bubbles: true,
                            composed: true
                        })
                    );
                    this.host.requestUpdate();
                }
                this.host.editCtrl.cancelEditing();
            }
        }

        if (e.detail.shiftKey) {
            this.host.selectionCtrl.selectCell(e.detail.row, e.detail.col, true);
        } else {
            this.host.selectionCtrl.startSelection(e.detail.row, e.detail.col);
        }
        this.host.focusCell();
    };

    handleCellDblclick = (e: CustomEvent<{ row: number; col: number }>) => {
        const { row, col } = e.detail;
        const value = this.host.table?.rows?.[row]?.[col] ?? '';
        this.host.selectionCtrl.selectCell(row, col);
        this.host.editCtrl.startEditing(value);
        this.host.focusCell();
    };

    handleCellInput = (e: CustomEvent<{ row: number; col: number; target: EventTarget | null }>) => {
        this.handleInput({ target: e.detail.target } as Event);
    };

    handleCellBlur = (e: CustomEvent<{ row: number; col: number; originalEvent: FocusEvent }>) => {
        this.handleBlur(e.detail.originalEvent);
    };

    handleCellKeydown = (e: CustomEvent<{ row: number; col: number; originalEvent: KeyboardEvent }>) => {
        this.host.keyboardCtrl.handleKeyDown(e.detail.originalEvent);
    };

    handleCellMousemove = (e: CustomEvent<{ row: number; col: number }>) => {
        if (this.host.selectionCtrl.isSelecting) {
            this.host.selectionCtrl.selectCell(e.detail.row, e.detail.col, true);
        }
    };

    handleCornerClick = () => {
        this.host.selectionCtrl.selectCell(-2, -2);
        this.host.focusCell();
    };

    handleCornerKeydown = (e: CustomEvent<{ originalEvent: KeyboardEvent }>) => {
        this.host.keyboardCtrl.handleKeyDown(e.detail.originalEvent);
    };

    handleMenuAction = (e: CustomEvent<{ action: string; type: string; index: number }>) => {
        const { action, type, index } = e.detail;
        if (action === 'insert') {
            if (type === 'row') {
                this.dispatchAction('insert-row', { rowIndex: index });
            } else {
                this.dispatchAction('column-insert', { colIndex: index });
            }
        } else if (action === 'delete') {
            if (type === 'row') {
                this.dispatchAction('row-delete', { rowIndex: index });
            } else {
                this.dispatchAction('column-delete', { colIndex: index });
            }
        }
        this.host.contextMenu = null;
    };

    handleFilterApply = (e: CustomEvent) => {
        this.host.filterCtrl.handleFilterChange(e);
    };

    handleFilterClose = () => {
        this.host.filterCtrl.closeFilterMenu();
    };

    handleMetadataChange = (e: CustomEvent<{ description: string }>) => {
        this.dispatchAction('metadata-update', { description: e.detail.description });
    };

    handleInsertRow = (e: CustomEvent<{ index: number }>) => {
        this.dispatchAction('insert-row', { rowIndex: e.detail.index });
    };

    handleDeleteRow = (e: CustomEvent<{ index: number }>) => {
        this.dispatchAction('row-delete', { rowIndex: e.detail.index });
    };

    handleInsertCol = (e: CustomEvent<{ index: number }>) => {
        this.dispatchAction('column-insert', { colIndex: e.detail.index });
    };

    handleDeleteCol = (e: CustomEvent<{ index: number }>) => {
        this.dispatchAction('column-delete', { colIndex: e.detail.index });
    };

    // Helper: Input
    private handleInput(e: Event) {
        const inputEvent = e as InputEvent;
        const target = e.target as HTMLElement;

        if (inputEvent.inputType === 'insertLineBreak') {
            this.host.editCtrl.hasUserInsertedNewline = true;
        }

        if (target && target.innerHTML) {
            const stripped = target.innerHTML
                .replace(/<br\s*\/?>/gi, '')
                .replace(/\u200B/g, '')
                .trim();
            if (stripped === '' && !this.host.editCtrl.hasUserInsertedNewline) {
                target.innerHTML = '';
            }
        }

        if (this.host.editCtrl.isReplacementMode && target) {
            this.host.editCtrl.pendingEditValue = getDOMText(target);
        }
    }

    // Helper: Blur
    private handleBlur(e: FocusEvent) {
        if (e.relatedTarget && (e.target as Element).contains(e.relatedTarget as Node)) {
            return;
        }
        if (this.host.editCtrl.isEditing) {
            this.host.commitEdit(e);
        }
    }
}
