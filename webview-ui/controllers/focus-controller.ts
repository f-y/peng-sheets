/**
 * FocusController - Manages cell focus and caret positioning for SpreadsheetTable
 *
 * Dependencies are injected via callbacks to keep the controller loosely coupled.
 */

export interface FocusControllerDependencies {
    /** Get the shadow root for DOM queries */
    getShadowRoot: () => ShadowRoot | null;
    /** Get the currently selected row (-2 = corner, -1 = ghost, 0+ = data row) */
    getSelectedRow: () => number;
    /** Get the currently selected column (-2 = row header, 0+ = data col) */
    getSelectedCol: () => number;
    /** Check if the table is in edit mode */
    isEditing: () => boolean;
    /** Get and clear the pending edit value */
    getPendingEditValue: () => string | null;
    /** Clear the pending edit value */
    clearPendingEditValue: () => void;
}

export class FocusController {
    private deps: FocusControllerDependencies;

    constructor(deps: FocusControllerDependencies) {
        this.deps = deps;
    }

    /**
     * Sets the caret position within a DOM node.
     * Walks the DOM tree to find the correct position for the caret.
     */
    setCaretPosition(root: Node, offset: number): void {
        const range = document.createRange();
        const sel = window.getSelection();
        let currentOffset = 0;
        let found = false;

        const walk = (node: Node) => {
            if (found) return;
            if (node.nodeType === Node.TEXT_NODE) {
                const len = node.nodeValue?.length || 0;
                if (currentOffset + len >= offset) {
                    range.setStart(node, offset - currentOffset);
                    range.collapse(true);
                    found = true;
                    return;
                }
                currentOffset += len;
            } else if (node.nodeName === 'BR') {
                if (currentOffset === offset) {
                    range.setStartBefore(node);
                    range.collapse(true);
                    found = true;
                    return;
                }
                currentOffset += 1;
            } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                    walk(node.childNodes[i]);
                    if (found) return;
                }
            }
        };

        walk(root);

        if (!found) {
            range.selectNodeContents(root);
            range.collapse(false);
        }

        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    /**
     * Focuses the currently selected cell in the spreadsheet.
     * Handles different cell types (corner, row header, column header, data cells).
     *
     * @param preserveSelection - If true, preserves the current text selection
     */
    focusSelectedCell(preserveSelection = false): void {
        const selRow = this.deps.getSelectedRow();
        const selCol = this.deps.getSelectedCol();

        if (selRow >= -2 && selCol >= -2) {
            let selector = `.cell[data-row="${selRow}"][data-col="${selCol}"]`;

            if (selRow === -2 && selCol === -2) {
                selector = `.cell.header-corner`;
            } else if (selCol === -2) {
                selector = `.cell.header-row[data-row="${selRow}"]`;
            } else if (selRow === -2) {
                selector = `.cell.header-col[data-col="${selCol}"]`;
            }

            const shadowRoot = this.deps.getShadowRoot();
            const cell = shadowRoot?.querySelector(selector) as HTMLElement;
            if (cell) {
                const isEditing = this.deps.isEditing();

                if (isEditing && (selRow === -1 || selRow === -2 || selCol === -2)) {
                    const contentSpan = cell.querySelector('.cell-content') as HTMLElement;
                    if (contentSpan) {
                        // Update text FIRST (so we select the new nodes)
                        const pendingValue = this.deps.getPendingEditValue();
                        if (pendingValue !== null) {
                            contentSpan.innerText = pendingValue;
                            this.deps.clearPendingEditValue();
                        }

                        contentSpan.focus();
                        const range = document.createRange();
                        range.selectNodeContents(contentSpan);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        return;
                    }
                }

                cell.focus();

                if (!preserveSelection) {
                    const range = document.createRange();

                    if (isEditing) {
                        range.selectNodeContents(cell);
                        range.collapse(false);
                    } else {
                        const textNode = Array.from(cell.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
                        if (textNode) {
                            range.selectNodeContents(textNode);
                            range.collapse(false);
                        } else {
                            range.selectNodeContents(cell);
                            range.collapse(true);
                        }
                    }

                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }
        }
    }
}
