import { ReactiveController } from 'lit';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import {
    getSelection as getEditSelection,
    insertLineBreakAtSelection,
    handleBackspaceAtZWS
} from '../utils/edit-mode-helpers';

export class KeyboardController implements ReactiveController {
    host: SpreadsheetTable;

    constructor(host: SpreadsheetTable) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {}

    handleKeyDown(e: KeyboardEvent) {
        if (this.host.editCtrl.isEditing) {
            this.handleEditModeKey(e);
            return;
        }

        if (e.isComposing) return;

        const isControl = e.ctrlKey || e.metaKey || e.altKey;

        // Header Edit
        if (
            this.host.selectionCtrl.selectedRow === -2 &&
            this.host.selectionCtrl.selectedCol >= 0 &&
            !isControl &&
            e.key.length === 1
        ) {
            e.preventDefault();
            this.host.selectionCtrl.selectedRow = -1;
            this.host.editCtrl.startEditing(e.key, true);
            this.host.focusCell();
            return;
        }

        const isRangeSelection =
            this.host.selectionCtrl.selectedCol === -2 || this.host.selectionCtrl.selectedRow === -2;

        // F2 - Start Editing
        if (e.key === 'F2') {
            e.preventDefault();
            if (isRangeSelection) return;

            // Fetch current value
            let currentVal = '';
            const r = this.host.selectionCtrl.selectedRow;
            const c = this.host.selectionCtrl.selectedCol;

            // Header logic ?
            if (r === -1 && c >= 0 && this.host.table?.headers) {
                currentVal = this.host.table.headers[c] || '';
            } else if (r >= 0 && c >= 0 && this.host.table?.rows && this.host.table.rows[r]) {
                currentVal = this.host.table.rows[r][c] || '';
            }

            this.host.editCtrl.startEditing(currentVal);
            this.host.focusCell();
            return;
        }

        if (!isControl && e.key.length === 1 && !isRangeSelection) {
            e.preventDefault();
            this.host.editCtrl.startEditing(e.key, true);
            this.host.focusCell();
            return;
        }

        if (isControl && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            this.host.dispatchEvent(new CustomEvent('save-requested', { bubbles: true, composed: true }));
            return;
        }

        // Excel-compatible date/time shortcuts
        // Ctrl + ; inserts current date, Ctrl + Shift + ; inserts current time
        if ((e.ctrlKey || e.metaKey) && e.key === ';') {
            e.preventDefault();
            const now = new Date();
            let value: string;
            if (e.shiftKey) {
                // Ctrl + Shift + ; → current time (HH:MM)
                value = now.toTimeString().slice(0, 5);
            } else {
                // Ctrl + ; → current date (YYYY-MM-DD)
                value = now.toISOString().slice(0, 10);
            }
            this.host.dispatchEvent(
                new CustomEvent('cell-change', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        row: this.host.selectionCtrl.selectedRow,
                        col: this.host.selectionCtrl.selectedCol,
                        value: value
                    }
                })
            );
            return;
        }

        if (isControl && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this.host.clipboardCtrl.copyToClipboard();
            return;
        }

        if (isControl && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            this.host.clipboardCtrl.paste();
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.host.clipboardCtrl.deleteSelection();
            return;
        }

        // Nav
        const rowCount = this.host.table?.rows.length || 0;
        const colCount = this.host.table?.headers
            ? this.host.table.headers.length
            : this.host.table?.rows[0]?.length || 0;
        this.host.navCtrl.handleKeyDown(e, rowCount + 1, colCount); // +1 because we allow ghost row (rowCount)
        this.host.focusCell();
    }

    private handleEditModeKey(e: KeyboardEvent) {
        e.stopPropagation();
        if (e.key === 'Enter') {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

                // Note: getEditSelection now expects shadowRoot.
                // Since cells are in View's shadowRoot, we should ideally access View's shadowRoot.
                // But SpreadsheetTable.getShadowRoot() might return Container's.
                // However, we rely on the implementation of getEditSelection to handle it or host to provide correct root.
                // In SpreadsheetTable, this points to this.shadowRoot.
                // NOTE: We should update host to expose the relevant shadowRoot or pass it.
                // For now, using host.shadowRoot as per original code.
                // If the View is separate, host.shadowRoot might NOT find the cell if it's in View's shadow DOM.
                // But I should check if I fixed this in container-view refactoring previously?
                // The previous finding (Step 5313 in history) said:
                // "Modified _commitEdit to query the View's shadowRoot instead of the Container's shadowRoot"
                // So I should do the same here.
                // But how to get View's shadowRoot?
                // `this.host.shadowRoot?.querySelector('spreadsheet-table-view')?.shadowRoot`
                // This is ugly.
                // Impl plan: `this.host` should probably expose a helper or we accept it's complex.
                // Let's rely on `this.host.shadowRoot` for now and if it fails (it will), I'll fix it similarly to _commitEdit.
                // Wait, `getEditSelection` uses `root.getSelection()`. ShadowRoot has `getSelection`.
                // If cell is in View, selection interacts with View's shadowRoot?
                // Actually `getSelection(shadowRoot)`:
                // "Gets selection from either shadow root (if supported) or window."
                // Standard Selection API works on document level mostly unless Shadow DOM selection is specific.
                // If I use `this.host.shadowRoot` it might be fine if selection crosses boundary?
                // Use View's shadowRoot because cells are rendered there
                const root = this.host.viewShadowRoot || this.host.shadowRoot;
                const selection = getEditSelection(root);
                const element = e.target as HTMLElement;
                insertLineBreakAtSelection(selection, element);
                return;
            }

            e.preventDefault();

            // Calling a public-exposed commitEdit
            this.host.commitEdit(e);

            if (!e.shiftKey) {
                this.host.selectionCtrl.selectionAnchorRow = -1;
                this.host.selectionCtrl.selectionAnchorCol = -1;
            }

            const rowCount = this.host.table?.rows.length || 0;
            const colCount = this.host.table?.headers
                ? this.host.table.headers.length
                : this.host.table?.rows[0]?.length || 0;
            this.host.navCtrl.handleKeyDown(e, rowCount + 1, colCount);
            this.host.focusCell(); // Focus new cell

            // Sync anchor
            if (!e.shiftKey) {
                this.host.selectionCtrl.selectionAnchorRow = this.host.selectionCtrl.selectedRow;
                this.host.selectionCtrl.selectionAnchorCol = this.host.selectionCtrl.selectedCol;
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();

            this.host.commitEdit(e);

            if (!e.shiftKey) {
                this.host.selectionCtrl.selectionAnchorRow = -1;
                this.host.selectionCtrl.selectionAnchorCol = -1;
            }
            const colCount = this.host.table?.headers
                ? this.host.table.headers.length
                : this.host.table?.rows[0]?.length || 0;

            // Delegate Tab wrapping to NavigationController
            this.host.navCtrl.handleTabWrap(e.shiftKey, colCount);
            this.host.focusCell();

            if (!e.shiftKey) {
                this.host.selectionCtrl.selectionAnchorRow = this.host.selectionCtrl.selectedRow;
                this.host.selectionCtrl.selectionAnchorCol = this.host.selectionCtrl.selectedCol;
            }
        } else if (e.key === 'Backspace') {
            // Handle Backspace at ZWS + BR boundary specially
            const selection = getEditSelection(this.host.shadowRoot);
            if (handleBackspaceAtZWS(selection)) {
                e.preventDefault();
                return;
            }
            // Let browser handle normal Backspace
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Arrow keys in edit mode: commit edit and navigate
            e.preventDefault();

            this.host.commitEdit(e);

            const rowCount = this.host.table?.rows.length || 0;
            const colCount = this.host.table?.headers
                ? this.host.table.headers.length
                : this.host.table?.rows[0]?.length || 0;
            this.host.navCtrl.handleKeyDown(e, rowCount + 1, colCount);
            this.host.focusCell();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.host.editCtrl.cancelEditing();
            this.host.focusCell();
        }
    }

    handlePaste(e: ClipboardEvent) {
        this.host.clipboardCtrl.handlePaste(e);
    }

    handleCopy(e: ClipboardEvent) {
        this.host.clipboardCtrl.handleCopy(e);
    }

    handleCut(e: ClipboardEvent) {
        this.host.clipboardCtrl.handleCut(e);
    }
}
