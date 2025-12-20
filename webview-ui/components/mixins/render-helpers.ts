/**
 * RenderHelpers Mixin - Event handler factory methods for SpreadsheetTable render templates.
 * Extracts common inline event handlers to improve render() method readability.
 */
import { LitElement } from 'lit';

// Type for the host component that uses this mixin
interface SpreadsheetTableHost extends LitElement {
    selectionCtrl: {
        selectCell: (row: number, col: number, shiftKey?: boolean) => void;
        startSelection: (row: number, col: number, shiftKey?: boolean) => void;
    };
    editCtrl: {
        startEditing: (value: string) => void;
    };
    filterCtrl: {
        toggleFilterMenu: (event: unknown, col: number) => void;
    };
    resizeCtrl: {
        startResize: (event: MouseEvent, col: number, width: number) => void;
    };
    focusCell: () => void;
    _handleContextMenu: (event: MouseEvent, type: string, index: number) => void;
    _handleInput: (event: Event) => void;
    _handleBlur: (event: FocusEvent) => void;
    _handleKeyDown: (event: KeyboardEvent) => void;
    _dispatchAction: (action: string, detail: Record<string, unknown>) => void;
}

type Constructor<T = object> = new (...args: unknown[]) => T;

/**
 * Adds render helper methods for common event handlers.
 */
export function RenderHelpersMixin<TBase extends Constructor<LitElement>>(Base: TBase) {
    return class RenderHelpers extends Base {
        /**
         * Handle column header click event
         */
        protected _onColClick(e: CustomEvent<{ col: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.selectCell(-2, e.detail.col, e.detail.shiftKey);
            host.focusCell();
        }

        /**
         * Handle column header mousedown for range selection
         */
        protected _onColMousedown(e: CustomEvent<{ col: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.startSelection(-2, e.detail.col, e.detail.shiftKey);
        }

        /**
         * Handle column header double-click for editing
         */
        protected _onColDblclick(e: CustomEvent<{ col: number }>, value: string) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.selectCell(-1, e.detail.col);
            host.editCtrl.startEditing(value);
            host.focusCell();
        }

        /**
         * Handle context menu events from column headers
         */
        protected _onColContextMenu(e: CustomEvent<{ type: string; index: number; x: number; y: number }>) {
            const host = this as unknown as SpreadsheetTableHost;
            const mockEvent = {
                clientX: e.detail.x,
                clientY: e.detail.y,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as MouseEvent;
            host._handleContextMenu(mockEvent, 'col', e.detail.index);
        }

        /**
         * Handle input events from editable headers
         */
        protected _onColInput(e: CustomEvent<{ col: number; target: EventTarget | null }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host._handleInput({ target: e.detail.target } as Event);
        }

        /**
         * Handle blur events from editable headers
         */
        protected _onColBlur(e: CustomEvent<{ col: number; originalEvent: FocusEvent }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host._handleBlur(e.detail.originalEvent);
        }

        /**
         * Handle keydown events from editable headers
         */
        protected _onColKeydown(e: CustomEvent<{ col: number; originalEvent: KeyboardEvent }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host._handleKeyDown(e.detail.originalEvent);
        }

        /**
         * Handle filter icon click
         */
        protected _onFilterClick(e: CustomEvent<{ col: number; x: number; y: number }>) {
            const host = this as unknown as SpreadsheetTableHost;
            const mockEvent = {
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
            } as unknown as MouseEvent;
            host.filterCtrl.toggleFilterMenu(mockEvent, e.detail.col);
        }

        /**
         * Handle column resize start
         */
        protected _onResizeStart(e: CustomEvent<{ col: number; x: number; width: number }>) {
            const host = this as unknown as SpreadsheetTableHost;
            const mockEvent = {
                clientX: e.detail.x,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as MouseEvent;
            host.resizeCtrl.startResize(mockEvent, e.detail.col, e.detail.width);
        }

        /**
         * Handle row header click
         */
        protected _onRowClick(e: CustomEvent<{ row: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.selectCell(e.detail.row, -2, e.detail.shiftKey);
            host.focusCell();
        }

        /**
         * Handle row header mousedown for range selection
         */
        protected _onRowMousedown(e: CustomEvent<{ row: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.startSelection(e.detail.row, -2, e.detail.shiftKey);
        }

        /**
         * Handle row context menu
         */
        protected _onRowContextMenu(e: CustomEvent<{ type: string; index: number; x: number; y: number }>) {
            const host = this as unknown as SpreadsheetTableHost;
            const mockEvent = {
                clientX: e.detail.x,
                clientY: e.detail.y,
                preventDefault: () => {},
                stopPropagation: () => {}
            } as MouseEvent;
            host._handleContextMenu(mockEvent, 'row', e.detail.index);
        }

        /**
         * Handle data cell click
         */
        protected _onCellClick(e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.selectCell(e.detail.row, e.detail.col, e.detail.shiftKey);
            host.focusCell();
        }

        /**
         * Handle data cell mousedown for range selection
         */
        protected _onCellMousedown(e: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.startSelection(e.detail.row, e.detail.col, e.detail.shiftKey);
        }

        /**
         * Handle data cell double-click for editing
         */
        protected _onCellDblclick(e: CustomEvent<{ row: number; col: number }>, value: string) {
            const host = this as unknown as SpreadsheetTableHost;
            host.selectionCtrl.selectCell(e.detail.row, e.detail.col);
            host.editCtrl.startEditing(value);
            host.focusCell();
        }
    };
}
