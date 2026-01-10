/**
 * Edit Mode Helpers - Utility functions for cell editing operations
 *
 * These functions extract pure DOM manipulation logic from SpreadsheetTable
 * to reduce coupling and improve testability.
 */

/**
 * Gets selection from either shadow root (if supported) or window.
 */
export function getSelection(shadowRoot: ShadowRoot | null): Selection | null {
    const root = shadowRoot as unknown as { getSelection: () => Selection | null };
    return root && root.getSelection ? root.getSelection() : window.getSelection();
}

/**
 * Inserts a line break at the current selection position.
 * Handles caret positioning after the break for continued typing.
 *
 * @returns true if the line break was successfully inserted
 */
export function insertLineBreakAtSelection(selection: Selection | null, element: HTMLElement): boolean {
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    const range = selection.getRangeAt(0);

    try {
        // Remove any existing phantom BR first
        const existingPhantom = element.querySelector('br[data-phantom]');
        if (existingPhantom) {
            existingPhantom.remove();
        }

        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);

        // Check if we are at the end of the cell
        let isAtEnd = !br.nextSibling;
        if (!isAtEnd && br.nextSibling?.nodeType === Node.TEXT_NODE) {
            const text = br.nextSibling.textContent || '';
            if (text.length === 0) {
                isAtEnd = true;
            }
        }

        // If at end, add a zero-width space for caret positioning
        // This allows the caret to be placed after the BR and enables deletion
        if (isAtEnd) {
            const zws = document.createTextNode('\u200B');
            br.parentNode?.appendChild(zws);
        }

        // Move caret after the real BR
        range.setStartAfter(br);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);

        return true;
    } catch (err) {
        console.warn('Alt+Enter logic failed:', err);
        return false;
    }
}

/**
 * Handles Backspace key at zero-width space + BR boundary.
 * When caret is in ZWS text node (used for caret positioning after BR),
 * deletes both the ZWS and preceding BR.
 *
 * @returns true if the backspace was handled (caller should preventDefault)
 */
export function handleBackspaceAtZWS(selection: Selection | null): boolean {
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    // Check if caret is in a ZWS text node (used for caret positioning after BR)
    if (node.nodeType !== Node.TEXT_NODE || node.textContent !== '\u200B' || range.startOffset !== 1) {
        return false;
    }

    // We're at the end of the ZWS - delete both ZWS and preceding BR
    const prevSibling = node.previousSibling;
    const parent = node.parentNode;

    // Remove the ZWS text node
    parent?.removeChild(node);

    // Remove the preceding BR if it exists
    if (prevSibling && prevSibling.nodeName === 'BR' && prevSibling.parentNode) {
        prevSibling.parentNode.removeChild(prevSibling);
    }

    // Move caret to end of remaining content
    if (parent) {
        const newRange = document.createRange();
        const lastChild = parent.lastChild;
        if (lastChild) {
            if (lastChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(lastChild, (lastChild.textContent || '').length);
            } else {
                newRange.setStartAfter(lastChild);
            }
        } else {
            newRange.setStart(parent, 0);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    return true;
}

/**
 * Handles deletion of selected content in contenteditable elements.
 * This is used for both Delete and Backspace keys when there is a text selection.
 *
 * Browser's native contenteditable handling may fail when selection spans
 * across <br> elements (newlines). This function explicitly calls
 * Range.deleteContents() to ensure proper deletion.
 *
 * @param selection - The current selection object
 * @returns true if content was deleted (caller should preventDefault)
 */
export function handleSelectionDeletion(selection: Selection | null): boolean {
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    const range = selection.getRangeAt(0);

    // Only handle non-collapsed selections (text is actually selected)
    if (range.collapsed) {
        return false;
    }

    // Delete the selected content explicitly
    range.deleteContents();

    // Collapse the selection to the start (where cursor should be after deletion)
    selection.collapseToStart();

    return true;
}

/**
 * Normalizes cell content by stripping trailing newlines and handling
 * empty content cases.
 *
 * @param content - The raw content extracted from the cell
 * @param hasUserInsertedNewline - Whether user explicitly inserted newlines via Option+Enter
 * @returns The normalized content string
 */
export function normalizeEditContent(content: string, hasUserInsertedNewline: boolean): string {
    let result = content;

    // contenteditable often adds trailing <br> elements for caret positioning.
    // This results in extra \n when extracting. We strip ALL trailing \n characters
    // because the editing DOM may have multiple BR elements (e.g., "a<br>" becomes "a\n\n").
    // User-significant trailing newlines are preserved via hasUserInsertedNewline flag.
    while (result.endsWith('\n')) {
        result = result.slice(0, -1);
    }

    // If the remaining content is ONLY newlines, treat it as empty.
    // UNLESS user explicitly inserted newlines via Option+Enter during this session.
    if (/^\n*$/.test(result) && !hasUserInsertedNewline) {
        result = '';
    }

    return result;
}

/**
 * Result of finding an editing cell.
 */
export interface EditCellResult {
    cell: HTMLElement;
    row: number;
    col: number;
}

/**
 * Finds the editing cell from an event target or shadow root.
 * Navigates up from cell-content to cell if needed.
 *
 * @returns EditCellResult with cell element and row/col, or null if not found
 */
export function findEditingCell(
    target: HTMLElement,
    shadowRoot: ShadowRoot | null,
    fallbackRow: number,
    fallbackCol: number
): EditCellResult | null {
    let cell = target;

    // Navigate from .cell-content to parent .cell if needed
    if (target.classList.contains('cell-content')) {
        cell = target.closest('.cell') as HTMLElement;
    }

    // If still not a cell, try to find the editing cell in shadow root
    if (!cell || !cell.classList || !cell.classList.contains('cell')) {
        const found = shadowRoot?.querySelector('.cell.editing');
        if (found) {
            cell = found as HTMLElement;
        } else {
            return null;
        }
    }

    // Parse row/col from data attributes, with fallback
    let row = parseInt(cell.dataset.row || '-10');
    let col = parseInt(cell.dataset.col || '-10');
    if (isNaN(row)) row = fallbackRow;
    if (isNaN(col)) col = fallbackCol;

    return { cell, row, col };
}

/**
 * Result of cell range state calculation.
 */
export interface CellRangeState {
    inRange: boolean;
    topEdge: boolean;
    bottomEdge: boolean;
    leftEdge: boolean;
    rightEdge: boolean;
}

/**
 * Calculates whether a cell is in the selection range and which edges it touches.
 *
 * @param row - Cell row index
 * @param col - Cell column index
 * @param minR - Minimum selected row
 * @param maxR - Maximum selected row
 * @param minC - Minimum selected column
 * @param maxC - Maximum selected column
 * @returns CellRangeState with inRange and edge flags
 */
export function calculateCellRangeState(
    row: number,
    col: number,
    minR: number,
    maxR: number,
    minC: number,
    maxC: number
): CellRangeState {
    if (minR === -1) {
        return { inRange: false, topEdge: false, bottomEdge: false, leftEdge: false, rightEdge: false };
    }

    const inRange = row >= minR && row <= maxR && col >= minC && col <= maxC;
    if (!inRange) {
        return { inRange: false, topEdge: false, bottomEdge: false, leftEdge: false, rightEdge: false };
    }

    return {
        inRange: true,
        topEdge: row === minR,
        bottomEdge: row === maxR,
        leftEdge: col === minC,
        rightEdge: col === maxC
    };
}
