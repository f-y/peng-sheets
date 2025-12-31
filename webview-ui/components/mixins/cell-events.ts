/**
 * Cell Events - Shared event utilities for spreadsheet cell components
 *
 * All cell components use these helpers to emit consistent custom events
 * that bubble up to the parent SpreadsheetTable component.
 */

// Event detail interfaces
export interface CellEventDetail {
    row: number;
    col: number;
}

export interface CellMouseEventDetail extends CellEventDetail {
    shiftKey: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    originalEvent?: MouseEvent; // For drag detection
}

export interface CellInputEventDetail extends CellEventDetail {
    target: EventTarget | null;
}

export interface CellKeyEventDetail extends CellEventDetail {
    originalEvent: KeyboardEvent;
}

export interface CellBlurEventDetail extends CellEventDetail {
    target: EventTarget | null;
    originalEvent: FocusEvent;
}

export interface ContextMenuEventDetail {
    type: 'row' | 'col' | 'cell';
    index: number;
    x: number;
    y: number;
}

export interface ResizeEventDetail {
    col: number;
    x: number;
    width: number;
}

export interface FilterEventDetail {
    col: number;
    x: number;
    y: number;
}

/**
 * Emit a custom event from a component with bubbling and composed
 */
export function emitCellEvent<T>(host: HTMLElement, eventName: string, detail: T): void {
    host.dispatchEvent(
        new CustomEvent<T>(eventName, {
            bubbles: true,
            composed: true,
            detail
        })
    );
}

// Pre-defined event emitters for common patterns

export function emitCellMousedown(host: HTMLElement, row: number, col: number, e: MouseEvent): void {
    emitCellEvent<CellMouseEventDetail>(host, 'ss-cell-mousedown', {
        row,
        col,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        originalEvent: e
    });
}

export function emitCellClick(host: HTMLElement, row: number, col: number, e: MouseEvent): void {
    emitCellEvent<CellMouseEventDetail>(host, 'ss-cell-click', {
        row,
        col,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey
    });
}

export function emitCellDblclick(host: HTMLElement, row: number, col: number): void {
    emitCellEvent<CellEventDetail>(host, 'ss-cell-dblclick', { row, col });
}

export function emitCellInput(host: HTMLElement, row: number, col: number, target: EventTarget | null): void {
    emitCellEvent<CellInputEventDetail>(host, 'ss-cell-input', {
        row,
        col,
        target
    });
}

export function emitCellBlur(
    host: HTMLElement,
    row: number,
    col: number,
    target: EventTarget | null,
    originalEvent: FocusEvent
): void {
    emitCellEvent<CellBlurEventDetail>(host, 'ss-cell-blur', {
        row,
        col,
        target,
        originalEvent
    });
}

export function emitCellKeydown(host: HTMLElement, row: number, col: number, e: KeyboardEvent): void {
    emitCellEvent<CellKeyEventDetail>(host, 'ss-cell-keydown', {
        row,
        col,
        originalEvent: e
    });
}

export function emitCellMousemove(host: HTMLElement, row: number, col: number): void {
    emitCellEvent<CellEventDetail>(host, 'ss-cell-mousemove', { row, col });
}

export function emitContextMenu(host: HTMLElement, type: 'row' | 'col', index: number, e: MouseEvent): void {
    e.preventDefault();
    emitCellEvent<ContextMenuEventDetail>(host, 'ss-contextmenu', {
        type,
        index,
        x: e.clientX,
        y: e.clientY
    });
}

export function emitFilterClick(host: HTMLElement, col: number, e: MouseEvent): void {
    e.stopPropagation();
    // Use the clicked element's bottom edge for menu positioning
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    emitCellEvent<FilterEventDetail>(host, 'ss-filter-click', {
        col,
        x: rect.left,
        y: rect.bottom
    });
}

export function emitResizeStart(host: HTMLElement, col: number, x: number, width: number): void {
    emitCellEvent<ResizeEventDetail>(host, 'ss-resize-start', {
        col,
        x,
        width
    });
}
