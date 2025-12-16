import { marked } from 'marked';
import { html, css, LitElement, PropertyValues, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { provideVSCodeDesignSystem, vsCodeButton } from '@vscode/webview-ui-toolkit';
import { SelectionController } from '../controllers/selection-controller';
import { EditController } from '../controllers/edit-controller';
import { ResizeController } from '../controllers/resize-controller';
import { NavigationController } from '../controllers/navigation-controller';
import { t } from '../utils/i18n';

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
    static styles = css`
        :host {
            display: flex; /* Changed from block */
            flex-direction: column;
            width: 100%;
            height: 100%;
            margin-bottom: 0;
            --header-bg: var(--vscode-sideBar-background); /* Strong opaque background */
            --border-color: var(--vscode-widget-border);
            --cell-padding: 0.25rem;
            --selection-color: #217346;
            box-sizing: border-box;
            overflow: hidden; /* Prevent host overflow */
        }

        *,
        *:before,
        *:after {
            box-sizing: inherit;
        }

        .table-container {
            flex: 1; /* Fill remaining space below metadata */
            overflow: auto;
            width: 100%; /* Fill width */
            height: 100%; /* Ensure it fills flex item */
            border: 1px solid var(--border-color);
            position: relative;
        }

        .grid {
            display: grid;
            transform-style: preserve-3d; /* Enable 3D transform context */
            /* Grid columns will be set dynamically in style */
        }

        .cell {
            padding: var(--cell-padding);
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            white-space: nowrap;
            overflow: hidden;
            min-height: 20px;
            line-height: 20px;
            outline: none;
            background-color: var(--vscode-editor-background);
            cursor: default;
            user-select: none; /* Prevent text selection in nav mode */
            position: relative; /* Ensure z-index participation */
            z-index: 1;
        }

        .cell.selected {
            outline: 2px solid var(--selection-color);
            outline-offset: -2px; /* Draw inside to prevent clipping at edges */
            z-index: 100;
        }

        .cell.selected-row-cell {
            border-top: 2px solid var(--selection-color);
            border-bottom: 2px solid var(--selection-color);
            background-color: rgba(33, 115, 70, 0.05);
            z-index: 90;
        }
        .cell.selected-row-cell.first {
            border-left: 2px solid var(--selection-color);
        }
        .cell.selected-row-cell.last {
            border-right: 2px solid var(--selection-color);
        }

        .cell.selected-col-cell {
            border-left: 2px solid var(--selection-color);
            border-right: 2px solid var(--selection-color);
            background-color: rgba(33, 115, 70, 0.05);
            z-index: 90;
        }
        .cell.selected-col-cell.first {
            border-top: 2px solid var(--selection-color);
        }
        .cell.selected-col-cell.last {
            border-bottom: 2px solid var(--selection-color);
        }
        .cell.selected-all-cell {
            background-color: rgba(33, 115, 70, 0.05); /* Just background */
            z-index: 90;
        }
        .cell.selected-all-cell.first-row {
            border-top: 2px solid var(--selection-color);
        }
        .cell.selected-all-cell.last-row {
            border-bottom: 2px solid var(--selection-color);
        }
        .cell.selected-all-cell.first-col {
            border-left: 2px solid var(--selection-color);
        }
        .cell.selected-all-cell.last-col {
            border-right: 2px solid var(--selection-color);
        }

        .cell.selected:focus {
            outline: 2px solid var(--selection-color);
            outline-offset: -2px;
        }

        .cell.editing {
            z-index: 101;
            background-color: var(--vscode-input-background, #fff);
            color: var(--vscode-input-foreground);
            outline: 2px solid var(--selection-color);
            outline-offset: -2px;
            user-select: text;
            cursor: text;
            white-space: break-spaces; /* Allow newlines and render trailing breaks */
            word-break: break-word;
            overflow: visible; /* Expand to show content */
        }

        .cell:focus {
            /* Remove default browser focus ring, use .selected instead manually */
            outline: none;
        }

        /* Headers */
        .cell.header-col {
            background-color: var(--header-bg);
            font-weight: normal;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 1000;
            transform: translateZ(10px); /* Force GPU layer on top */
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            padding: 0; /* Minimal padding */
            outline-offset: -2px; /* Ensure outline doesn't overflow */
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cell.header-col.selected {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
            outline: none;
        }
        .cell.header-row.selected {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
            outline: none;
        }
        .cell.header-row.selected-range {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
        }
        .cell.header-col.selected-range {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
        }

        .header-row {
            background-color: var(--header-bg);
            text-align: center;
            font-weight: normal;
            color: var(--vscode-descriptionForeground);
            position: sticky;
            left: 0;
            z-index: 1002;
            transform: translateZ(15px); /* Higher than Col */
            user-select: none;
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            outline-offset: -2px;
        }

        .header-row.selected {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
            outline: none;
        }

        /* Corner Cell */
        .header-corner {
            z-index: 1005;
            transform: translateZ(20px); /* Highest priority */
            position: sticky;
            top: 0;
            left: 0;
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            text-align: center;
            color: var(--header-bg);
            user-select: none;
            outline-offset: -2px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .metadata-input-title {
            font-size: 1.17em; /* h3 size */
            font-weight: bold;
            width: 100%;
            margin: 1rem 0 0.5rem 0;
            box-sizing: border-box;
            border: 1px solid var(--border-color); /* Transparent? */
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            padding: 4px;
        }

        .metadata-input-desc {
            width: 100%;
            margin: 0 0 1rem 0;
            box-sizing: border-box;
            border: 1px solid var(--border-color);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            padding: 4px;
        }

        .metadata-container {
            margin-bottom: 0;
        }

        .metadata-desc {
            min-height: 1.5em; /* Ensure clickable even if empty */
            margin: 0;
            padding: 8px;
            transition:
                margin 0.2s,
                min-height 0.2s;
        }

        .metadata-desc.empty {
            margin: 0;
            padding: 0;
            height: 0;
            min-height: 0;
            overflow: hidden;
            opacity: 0;
            transition:
                opacity 0.2s,
                min-height 0.2s,
                padding 0.2s,
                margin 0.2s;
        }
        .metadata-container:hover .metadata-desc.empty {
            min-height: 2em;
            margin: 0;
            padding: 4px;
            opacity: 1;
        }
        .metadata-desc.empty:hover {
            opacity: 1;
            background: rgba(0, 0, 0, 0.02);
        }

        .context-menu {
            position: fixed;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 2000;
            min-width: 150px;
            padding: 4px 0;
        }

        .context-menu-item {
            padding: 6px 12px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            color: var(--vscode-foreground);
        }

        .context-menu-item:hover {
            background: var(--vscode-list-hoverBackground);
            color: var(--vscode-list-hoverForeground);
        }
        .col-resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 5px;
            height: 100%;
            cursor: col-resize;
            z-index: 20;
        }
        .col-resize-handle:hover {
            background-color: var(--selection-color);
        }
        .cell.selected-range {
            background-color: rgba(0, 120, 215, 0.1);
        }
        /* Perimeter Borders for Selection Range */
        .cell.range-top {
            border-top: 2px solid var(--selection-color);
        }
        .cell.range-bottom {
            border-bottom: 2px solid var(--selection-color);
        }
        .cell.range-left {
            border-left: 2px solid var(--selection-color);
        }
        .cell.range-right {
            border-right: 2px solid var(--selection-color);
        }

        .cell.active-cell {
            outline: 2px solid var(--selection-color);
            outline-offset: -2px;
            z-index: 101; /* Above range borders if overlap? */
        }

        .cell.active-cell-no-outline {
            outline: none !important;
            z-index: 101;
        }
    `;

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
            const visual = (this.table.metadata as Record<string, any>)?.visual;
            if (visual && visual.column_widths) {
                if (Array.isArray(visual.column_widths)) {
                    const widths: any = {};
                    visual.column_widths.forEach((w: number, i: number) => (widths[i] = w));
                    this.resizeCtrl.setColumnWidths(widths);
                } else {
                    this.resizeCtrl.setColumnWidths(visual.column_widths);
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

    private _setCaretPosition(root: Node, offset: number) {
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

    updated(_changedProperties: PropertyValues) {
        if (this._restoreCaretPos !== null) {
            const cell = this.shadowRoot?.querySelector('.cell.editing');
            if (cell) {
                // Removed firstChild check, _setCaretPosition handles it
                try {
                    (cell as HTMLElement).focus(); // Ensure focus
                    this._setCaretPosition(cell, this._restoreCaretPos);
                } catch (e) {
                    console.warn('Failed to restore caret:', e);
                }
            }
            this._restoreCaretPos = null;
            this._shouldFocusCell = false; // Prevent focus override
        }

        // Focus Retention Logic
        if (this._shouldFocusCell) {
            this._focusSelectedCell();
            this._shouldFocusCell = false;
            this._wasFocusedBeforeUpdate = false;
        } else if (this._wasFocusedBeforeUpdate) {
            this._focusSelectedCell();
            this._wasFocusedBeforeUpdate = false;
        }
    }

    private _focusSelectedCell(preserveSelection = false) {
        const selRow = this.selectionCtrl.selectedRow;
        const selCol = this.selectionCtrl.selectedCol;

        if (selRow >= -2 && selCol >= -2) {
            let selector = `.cell[data-row="${selRow}"][data-col="${selCol}"]`;

            if (selRow === -2 && selCol === -2) {
                selector = `.cell.header-corner`;
            } else if (selCol === -2) {
                selector = `.cell.header-row[data-row="${selRow}"]`;
            } else if (selRow === -2) {
                selector = `.cell.header-col[data-col="${selCol}"]`;
            }

            const cell = this.shadowRoot?.querySelector(selector) as HTMLElement;
            if (cell) {
                if (this.editCtrl.isEditing && (selRow === -1 || selRow === -2 || selCol === -2)) {
                    const contentSpan = cell.querySelector('.cell-content') as HTMLElement;
                    if (contentSpan) {
                        // Update text FIRST (so we select the new nodes)
                        if (this.editCtrl.pendingEditValue !== null) {
                            contentSpan.innerText = this.editCtrl.pendingEditValue;
                            this.editCtrl.pendingEditValue = null;
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

                    if (this.editCtrl.isEditing) {
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

    private _handleInput(e: Event) {
        const target = e.target as HTMLElement;
        this.editCtrl.setPendingValue(target.innerText);
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
            this.editCtrl.startEditing(e.key);
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
            this.editCtrl.startEditing(e.key);
            this.focusCell();
            return;
        }

        if (isControl && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            this._copyToClipboard();
            return;
        }

        if (isControl && (e.key === 'v' || e.key === 'V')) {
            e.preventDefault();
            this._handlePaste();
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this._deleteSelection();
            return;
        }

        // Nav
        const rowCount = this.table?.rows.length || 0;
        const colCount = this.table?.headers ? this.table.headers.length : this.table?.rows[0]?.length || 0;
        this.navCtrl.handleKeyDown(e, rowCount + 1, colCount); // +1 because we allow ghost row (rowCount)
        this.focusCell();
    };

    private async _handlePaste() {
        if (!this.table) return;
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            const rows = text.split(/\r?\n/).map((line) => line.split('\t'));

            let startRow = this.selectionCtrl.selectedRow;
            let startCol = this.selectionCtrl.selectedCol;

            if (this.selectionCtrl.selectedRow === -1 || this.selectionCtrl.selectedCol === -1) {
                return;
            }

            if (this.selectionCtrl.selectedRow === -2) {
                startRow = 0;
            }
            if (this.selectionCtrl.selectedCol === -2) {
                startRow = this.selectionCtrl.selectedRow;
                startCol = 0;
            }
            if (
                this.selectionCtrl.selectionAnchorRow !== -1 &&
                this.selectionCtrl.selectedRow !== -2 &&
                this.selectionCtrl.selectedCol !== -2
            ) {
                startRow = Math.min(this.selectionCtrl.selectionAnchorRow, this.selectionCtrl.selectedRow);
                startCol = Math.min(this.selectionCtrl.selectionAnchorCol, this.selectionCtrl.selectedCol);
            }

            if (this.selectionCtrl.selectedRow >= (this.table?.rows.length || 0)) {
                startRow = this.table?.rows.length || 0;
                startCol = 0;
            }

            this._dispatchAction('paste-cells', {
                startRow: startRow,
                startCol: startCol,
                data: rows
            });
        } catch (err) {
            console.error('Paste failed', err);
        }
    }

    private async _copyToClipboard() {
        if (!this.table) return;

        let minR = -100,
            maxR = -100,
            minC = -100,
            maxC = -100;
        const numCols = this.table?.headers?.length || 0;
        const numRows = this.table.rows.length;

        const anchorRow = this.selectionCtrl.selectionAnchorRow;
        const anchorCol = this.selectionCtrl.selectionAnchorCol;
        const selRow = this.selectionCtrl.selectedRow;
        const selCol = this.selectionCtrl.selectedCol;

        if (anchorRow !== -1 && anchorCol !== -1) {
            if (selCol === -2 || anchorCol === -2) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = 0;
                maxC = numCols - 1;
            } else if (selRow === -2 || anchorRow === -2) {
                minR = 0;
                maxR = numRows - 1;
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            } else {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            }
        } else if (selRow !== -2 && selCol !== -2) {
            minR = maxR = selRow;
            minC = maxC = selCol;
        }

        if (minR < -1 || minC < -1) return;

        const effectiveMinR = Math.max(0, minR);
        const effectiveMaxR = Math.min(numRows - 1, maxR);
        const effectiveMinC = Math.max(0, minC);
        const effectiveMaxC = Math.min(numCols - 1, maxC);

        const rows: string[] = [];
        for (let r = effectiveMinR; r <= effectiveMaxR; r++) {
            const rowData: string[] = [];
            for (let c = effectiveMinC; c <= effectiveMaxC; c++) {
                const cellVal = this.table.rows[r][c] || '';
                rowData.push(cellVal);
            }
            rows.push(rowData.join('\t'));
        }

        const text = rows.join('\n');
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) { }
    }

    private _handleEditModeKey(e: KeyboardEvent) {
        e.stopPropagation();
        if (e.key === 'Enter') {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                console.log('Alt+Enter logic triggered'); // Debug log
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

                // Logic-First Approach:
                // 1. Calculate caret position
                // 2. Modify string state
                // 3. Request Update
                // 4. Restore caret in updated()

                const root = this.shadowRoot as any;
                const selection = root && root.getSelection ? root.getSelection() : window.getSelection();

                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const element = e.target as HTMLElement;

                    try {
                        // Direct DOM Manipulation for Simplicity (retains focus/caret)
                        range.deleteContents();
                        const br = document.createElement('br');
                        range.insertNode(br);

                        // If we are at the end of the cell, we need a "phantom" BR 
                        // so that the first BR is considered "real" content by browsers and our strip logic.
                        // Browsers often ignore a trailing BR in contenteditable.
                        let isAtEnd = !br.nextSibling;
                        if (!isAtEnd && br.nextSibling?.nodeType === Node.TEXT_NODE) {
                            // Check if it's an empty text node (result of split)
                            const text = br.nextSibling.textContent || '';
                            if (text.length === 0) {
                                isAtEnd = true;
                            }
                        }

                        if (isAtEnd) {
                            const phantomBr = document.createElement('br');
                            // Insert after the first br
                            br.parentNode?.appendChild(phantomBr);
                        }

                        // Move caret AFTER the inserted BR (but before the phantom one if it exists)
                        range.setStartAfter(br);
                        range.collapse(true);

                        selection.removeAllRanges();
                        selection.addRange(range);

                        // Sync state but DO NOT re-render (avoids caret jumping)
                        // We trust the DOM is now the source of truth
                        const newVal = element.innerText;
                        this.editCtrl.setPendingValue(newVal);
                    } catch (err) {
                        console.warn('Alt+Enter logic failed:', err);
                    }
                } else {
                    // console.warn('Alt+Enter: No selection found');
                }
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

            // Manual Tab Logic (Wrap)
            if (e.shiftKey) {
                if (this.selectionCtrl.selectedCol === 0) {
                    // Move to prev row logic
                    // We can use navCtrl if we teach it wrapping.
                    // For now keeping local logic using selectionCtrl.selectCell
                    let r = this.selectionCtrl.selectedRow - 1;
                    const c = colCount - 1;
                    // clamp
                    if (r < -1) r = -1;
                    this.selectionCtrl.selectCell(r, c);
                } else {
                    this.selectionCtrl.selectCell(this.selectionCtrl.selectedRow, this.selectionCtrl.selectedCol - 1);
                }
            } else {
                if (this.selectionCtrl.selectedCol === colCount - 1) {
                    this.selectionCtrl.selectCell(this.selectionCtrl.selectedRow + 1, 0); // Wrap next row
                } else {
                    this.selectionCtrl.selectCell(this.selectionCtrl.selectedRow, this.selectionCtrl.selectedCol + 1);
                }
            }
            this.focusCell();

            if (!e.shiftKey) {
                this.selectionCtrl.selectionAnchorRow = this.selectionCtrl.selectedRow;
                this.selectionCtrl.selectionAnchorCol = this.selectionCtrl.selectedCol;
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.editCtrl.cancelEditing();
            this.focusCell();
        }
    }

    private async _commitEdit(e: Event) {
        if (this._isCommitting) return;
        this._isCommitting = true;

        try {
            const target = e.target as HTMLElement;
            let cell = target;
            if (target.classList.contains('cell-content')) {
                cell = target.closest('.cell') as HTMLElement;
            }

            if (!cell || !cell.classList || !cell.classList.contains('cell')) {
                const found = this.shadowRoot?.querySelector('.cell.editing');
                if (found) cell = found as HTMLElement;
                else return;
            }

            const contentSpan = cell.querySelector('.cell-content') as HTMLElement;
            let newValue = '';

            // PRIORITIZE DOM CONTENT for WYSIWYG correctness during edit
            // innerText can be inconsistent across browsers or with specific CSS (pre-wrap).
            // We use a custom extractor to ensure <br> is always \n and text is preserved.
            if (contentSpan) {
                newValue = this._getDOMText(contentSpan);
            } else {
                newValue = this._getDOMText(cell);
            }

            // contenteditable often adds a trailing <br> for caret positioning (or _getEditingHtml adds one).
            // This results in an extra \n when extracting. We strip one trailing \n to match WYSIWYG.
            if (newValue.endsWith('\n')) {
                newValue = newValue.slice(0, -1);
            }

            let editRow = parseInt(cell.dataset.row || '-10');
            let editCol = parseInt(cell.dataset.col || '-10');
            if (isNaN(editRow)) editRow = this.selectionCtrl.selectedRow;
            if (isNaN(editCol)) editCol = this.selectionCtrl.selectedCol;

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
                    const width = this.table.headers ? this.table.headers.length : this.table.rows[0]?.length || 0;
                    const newRow = new Array(width).fill('');
                    if (editCol < width) newRow[editCol] = newValue;
                    this.table.rows.push(newRow);
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

    private _handleBlur(e: FocusEvent) {
        if (e.relatedTarget && (e.target as Element).contains(e.relatedTarget as Node)) {
            return;
        }
        if (this.editCtrl.isEditing && !this._isCommitting) {
            this._commitEdit(e);
        }
    }

    private _deleteSelection() {
        if (!this.table) return;

        const rowCount = this.table.rows.length;
        const colCount = this.table.headers ? this.table.headers.length : this.table.rows[0]?.length || 0;

        const anchorRow = this.selectionCtrl.selectionAnchorRow;
        const anchorCol = this.selectionCtrl.selectionAnchorCol;
        const selRow = this.selectionCtrl.selectedRow;
        const selCol = this.selectionCtrl.selectedCol;

        let minR = selRow,
            maxR = selRow,
            minC = selCol,
            maxC = selCol;

        if (anchorRow !== -1 && anchorCol !== -1) {
            if (selCol === -2 || anchorCol === -2) {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
            } else if (selRow === -2 || anchorRow === -2) {
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            } else {
                minR = Math.min(anchorRow, selRow);
                maxR = Math.max(anchorRow, selRow);
                minC = Math.min(anchorCol, selCol);
                maxC = Math.max(anchorCol, selCol);
            }
        }

        const triggerUpdate = () => this.requestUpdate();

        if (selRow === -2 && selCol === -2) {
            // Clear All
            this.dispatchEvent(
                new CustomEvent('range-edit', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: this.tableIndex,
                        startRow: 0,
                        endRow: rowCount - 1,
                        startCol: 0,
                        endCol: colCount - 1,
                        newValue: ''
                    },
                    bubbles: true,
                    composed: true
                })
            );
        } else if (selCol === -2) {
            // Row Delete
            const effectiveMaxR = Math.min(maxR, rowCount - 1);
            if (effectiveMaxR < minR) return;

            // Optimistic Update: Remove rows from model
            // Iterate backwards to avoid index shift if we spliced one by one
            // We are dispatching one by one, so we should slice.
            // But wait, if we dispatch row-delete for index R, does backend handle it?
            // If we delete R+1 then R, indices are stable.
            // Loop is r-- (backwards).

            for (let r = effectiveMaxR; r >= minR; r--) {
                this.table.rows.splice(r, 1);
                this.dispatchEvent(
                    new CustomEvent('row-delete', {
                        detail: { sheetIndex: this.sheetIndex, tableIndex: this.tableIndex, rowIndex: r },
                        bubbles: true,
                        composed: true
                    })
                );
            }
            triggerUpdate();
        } else if (selRow === -2) {
            // Column Clear
            for (let c = minC; c <= maxC; c++) {
                // Optimistic: Clear column data
                this.table.rows.forEach((row) => {
                    if (c < row.length) row[c] = '';
                });

                this.dispatchEvent(
                    new CustomEvent('column-clear', {
                        detail: { sheetIndex: this.sheetIndex, tableIndex: this.tableIndex, colIndex: c },
                        bubbles: true,
                        composed: true
                    })
                );
            }
            triggerUpdate();
        } else if (minR >= 0 && minC >= 0) {
            // Range Clear
            // Optimistic
            for (let r = minR; r <= maxR; r++) {
                if (r < this.table.rows.length) {
                    for (let c = minC; c <= maxC; c++) {
                        if (c < this.table.rows[r].length) {
                            this.table.rows[r][c] = '';
                        }
                    }
                }
            }

            this.dispatchEvent(
                new CustomEvent('range-edit', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: this.tableIndex,
                        startRow: minR,
                        endRow: maxR,
                        startCol: minC,
                        endCol: maxC,
                        newValue: ''
                    },
                    bubbles: true,
                    composed: true
                })
            );
            triggerUpdate();
        }
    }

    private async _handleMetadataClick(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.table) return;

        this.editCtrl.pendingDescription = this.table.description || '';
        this.editCtrl.editingMetadata = true;
        this.requestUpdate();
        await this.updateComplete;
        await new Promise((r) => requestAnimationFrame(r));
        const input = this.shadowRoot?.querySelector('.metadata-input-desc') as HTMLTextAreaElement;
        if (input) {
            input.focus();
            input.select();
        }
    }

    private _handleMetadataKeydown(e: KeyboardEvent) {
        if (e.isComposing) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this.editCtrl.editingMetadata = false;
            this.requestUpdate();
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._commitMetadata();
        }
    }

    private _commitMetadata(e?: FocusEvent) {
        if (!this.editCtrl.editingMetadata) return;

        if (e && e.relatedTarget) {
            const target = e.relatedTarget as HTMLElement;
            if (target.classList.contains('metadata-input-desc')) return;
        }

        this.editCtrl.editingMetadata = false;
        this.requestUpdate();

        const currentDesc = this.table?.description || '';
        if (this.editCtrl.pendingDescription !== currentDesc) {
            this.dispatchEvent(
                new CustomEvent('metadata-edit', {
                    detail: {
                        sheetIndex: this.sheetIndex,
                        tableIndex: this.tableIndex,
                        name: this.table?.name || '',
                        description: this.editCtrl.pendingDescription
                    },
                    bubbles: true,
                    composed: true
                })
            );
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

    private _dispatchAction(action: string, detail: any) {
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
        if (this.contextMenu) {
            this._closeContextMenu();
        }
    };

    render() {
        if (!this.table) return html``;
        const table = this.table;
        const numCols = table.headers ? table.headers.length : table.rows.length > 0 ? table.rows[0].length : 0;

        // Calculate ranges for class logic
        let minR = -1,
            maxR = -1,
            minC = -1,
            maxC = -1;
        const selRow = this.selectionCtrl.selectedRow;
        const selCol = this.selectionCtrl.selectedCol;
        const ancRow = this.selectionCtrl.selectionAnchorRow;
        const ancCol = this.selectionCtrl.selectionAnchorCol;

        if (ancRow !== -1 && ancCol !== -1) {
            if (selCol === -2 || ancCol === -2) {
                minR = Math.min(ancRow, selRow);
                maxR = Math.max(ancRow, selRow);
                minC = 0;
                maxC = numCols - 1;
            } else if (selRow === -2 || ancRow === -2) {
                minR = 0;
                maxR = (table.rows.length || 1) - 1;
                minC = Math.min(ancCol, selCol);
                maxC = Math.max(ancCol, selCol);
            } else {
                minR = Math.min(ancRow, selRow);
                maxR = Math.max(ancRow, selRow);
                minC = Math.min(ancCol, selCol);
                maxC = Math.max(ancCol, selCol);
            }
        }

        const colCount = Math.max(table.headers?.length || 0, table.rows[0]?.length || 0);

        return html`
            <div class="metadata-container">
                ${this.editCtrl.editingMetadata
                ? html`
                          <textarea
                              class="metadata-input-desc"
                              .value="${table.description || ''}"
                              placeholder="${t('description')}"
                              @input="${(e: Event) =>
                        (this.editCtrl.pendingDescription = (e.target as HTMLInputElement).value)}"
                              @keydown="${this._handleMetadataKeydown}"
                              @blur="${this._commitMetadata}"
                              rows="2"
                          ></textarea>
                      `
                : html`
                          <p
                              class="metadata-desc ${!table.description ? 'empty' : ''}"
                              @click="${this._handleMetadataClick}"
                              style="color: var(--vscode-descriptionForeground); cursor: pointer; border: 1px dashed transparent;"
                          >
                              ${table.description ||
                    html`<span style="opacity: 0.5; font-size: 0.9em;">${t('addDescription')}</span>`}
                          </p>
                      `}
            </div>

            <div class="table-container">
                <div class="grid" style="grid-template-columns: ${this._getColumnTemplate(colCount)};">
                    <!-- Corner -->
                    <div
                        class="cell header-corner"
                        @click="${() => {
                this.selectionCtrl.selectCell(-2, -2);
                this.focusCell();
            }}"
                    ></div>

                    <!-- Column Headers -->
                    ${table.headers
                ? table.headers.map((header, i) => {
                    const isActive = selRow === -1 && selCol === i;
                    const isColMode = selRow === -2;
                    const isInRange = (minR === -1 || isColMode) && i >= minC && i <= maxC;
                    const showActiveOutline = isActive && minC === maxC;
                    return html`
                                  <div
                                      class="cell header-col ${(selRow === -2 && (selCol === i || isInRange)) ||
                            (selRow === -1 && selCol === i)
                            ? 'selected'
                            : ''} ${this.editCtrl.isEditing && isActive
                                ? 'editing'
                                : ''} ${showActiveOutline
                                    ? 'active-cell'
                                    : 'active-cell-no-outline'} ${isInRange ? 'selected-range' : ''}"
                                      data-col="${i}"
                                      data-row="-1"
                                      tabindex="0"
                                      contenteditable="false"
                                      @click="${(e: MouseEvent) => {
                            this.selectionCtrl.selectCell(-2, i);
                            this.focusCell();
                        }}"
                                      @mousedown="${(e: MouseEvent) => this.selectionCtrl.startSelection(-2, i)}"
                                      @dblclick="${(e: MouseEvent) => {
                            this.selectionCtrl.selectCell(-1, i);
                            this.editCtrl.startEditing(header);
                            this.focusCell();
                        }}"
                                      @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'col', i)}"
                                      @input="${this._handleInput}"
                                      @blur="${this._handleBlur}"
                                      @keydown="${this._handleKeyDown}"
                                  >
                                      <span
                                          class="cell-content"
                                          contenteditable="${this.editCtrl.isEditing && isActive ? 'true' : 'false'}"
                                          style="display:inline-block; min-width: 10px; padding: 2px;"
                                          @blur="${this._handleBlur}"
                                          .textContent="${live(header)}"
                                      ></span>
                                      <div
                                          class="col-resize-handle"
                                          contenteditable="false"
                                          @mousedown="${(e: MouseEvent) =>
                            this.resizeCtrl.startResize(e, i, this.resizeCtrl.colWidths[i])}"
                                          @dblclick="${(e: Event) => e.stopPropagation()}"
                                      ></div>
                                  </div>
                              `;
                })
                : Array.from({ length: colCount }).map((_, i) => {
                    const isActive = selRow === -1 && selCol === i;
                    const isColMode = selRow === -2;
                    const isInRange = (minR === -1 || isColMode) && i >= minC && i <= maxC;
                    const showActiveOutline = isActive && minC === maxC;
                    return html`
                                  <div
                                      class="cell header-col ${(selRow === -2 && (selCol === i || isInRange)) ||
                            (selRow === -1 && selCol === i)
                            ? 'selected'
                            : ''} ${this.editCtrl.isEditing && isActive
                                ? 'editing'
                                : ''} ${showActiveOutline
                                    ? 'active-cell'
                                    : 'active-cell-no-outline'} ${isInRange ? 'selected-range' : ''}"
                                      data-col="${i}"
                                      data-row="-1"
                                      tabindex="0"
                                      contenteditable="false"
                                      @click="${() => {
                            this.selectionCtrl.selectCell(-2, i);
                            this.focusCell();
                        }}"
                                      @mousedown="${() => this.selectionCtrl.startSelection(-2, i)}"
                                      @dblclick="${() => {
                            this.selectionCtrl.selectCell(-1, i);
                            this.editCtrl.startEditing(i + 1 + '');
                            this.focusCell();
                        }}"
                                      @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'col', i)}"
                                      @input="${this._handleInput}"
                                      @blur="${this._handleBlur}"
                                      @keydown="${this._handleKeyDown}"
                                  >
                                      <span
                                          class="cell-content"
                                          contenteditable="${this.editCtrl.isEditing && isActive ? 'true' : 'false'}"
                                          style="display:inline-block; min-width: 10px; padding: 2px;"
                                          @blur="${this._handleBlur}"
                                          .textContent="${live(i + 1 + '')}"
                                      ></span>
                                      <div
                                          class="col-resize-handle"
                                          contenteditable="false"
                                          @mousedown="${(e: MouseEvent) =>
                            this.resizeCtrl.startResize(e, i, this.resizeCtrl.colWidths[i])}"
                                          @dblclick="${(e: Event) => e.stopPropagation()}"
                                      ></div>
                                  </div>
                              `;
                })}

                    <!-- Rows -->
                    ${table.rows.map(
                    (row, r) => html`
                            <!-- Row Header -->
                            <div
                                class="cell header-row ${(selCol === -2 &&
                            (selRow === r || ((minC === -1 || selCol === -2) && r >= minR && r <= maxR))) ||
                            (selCol === -1 && selRow === r)
                            ? 'selected'
                            : ''} ${(minC === -1 || selCol === -2) && r >= minR && r <= maxR
                                ? 'selected-range'
                                : ''}"
                                data-row="${r}"
                                tabindex="0"
                                @click="${() => {
                            this.selectionCtrl.selectCell(r, -2);
                            this.focusCell();
                        }}"
                                @mousedown="${() => this.selectionCtrl.startSelection(r, -2)}"
                                @keydown="${this._handleKeyDown}"
                                @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'row', r)}"
                            >
                                ${r + 1}
                            </div>

                            <!-- Cells -->
                            ${Array.from({ length: colCount }).map((_, c) => {
                            const cell = row[c] !== undefined ? row[c] : '';
                            const isSelected = selRow === r && selCol === c;

                            const isActive = r === selRow && c === selCol;

                            // Range Logic
                            let inRange = false;
                            let leftEdge = false,
                                rightEdge = false,
                                topEdge = false,
                                bottomEdge = false;

                            if (minR !== -1) {
                                if (r >= minR && r <= maxR && c >= minC && c <= maxC) {
                                    inRange = true;
                                    // Determine edges
                                    if (r === minR) topEdge = true;
                                    if (r === maxR) bottomEdge = true;
                                    if (c === minC) leftEdge = true;
                                    if (c === maxC) rightEdge = true;
                                }
                            }

                            const isEditingCell = this.editCtrl.isEditing && isActive;
                            const isRangeSelection = minR !== maxR || minC !== maxC;
                            const activeClass = isActive
                                ? isRangeSelection
                                    ? 'active-cell-no-outline'
                                    : 'active-cell'
                                : '';

                            return html`
                                    <div
                                        class="cell ${isSelected ? 'selected' : ''} ${inRange
                                    ? 'selected-range'
                                    : ''} ${isEditingCell ? 'editing' : ''} ${topEdge
                                        ? 'range-top'
                                        : ''} ${bottomEdge ? 'range-bottom' : ''} ${leftEdge
                                            ? 'range-left'
                                            : ''} ${rightEdge ? 'range-right' : ''} ${activeClass}"
                                        data-row="${r}"
                                        data-col="${c}"
                                        tabindex="${isActive ? 0 : -1}"
                                        contenteditable="${isEditingCell ? 'true' : 'false'}"
                                        @click="${(e: MouseEvent) => {
                                    if (e.shiftKey) this.selectionCtrl.selectCell(r, c, true);
                                    else this.selectionCtrl.selectCell(r, c);
                                    this.focusCell();
                                }}"
                                        @mousedown="${(e: MouseEvent) => {
                                    if (e.shiftKey) this.selectionCtrl.selectCell(r, c, true);
                                    else this.selectionCtrl.startSelection(r, c);
                                    this.focusCell();
                                }}"
                                        @dblclick="${(_: MouseEvent) => {
                                    this.selectionCtrl.selectCell(r, c);
                                    this.editCtrl.startEditing(cell);
                                    this.focusCell();
                                }}"
                                        @input="${this._handleInput}"
                                        @blur="${this._handleBlur}"
                                        @keydown="${this._handleKeyDown}"
                                        .innerHTML="${isEditingCell
                                    ? live(
                                        this._getEditingHtml(
                                            this.editCtrl.pendingEditValue !== null
                                                ? this.editCtrl.pendingEditValue
                                                : cell
                                        )
                                    )
                                    : this._renderMarkdown(cell)}"
                                    ></div>
                                `;
                        })}
                        `
                )}

                    <!-- Ghost Row -->
                    ${(() => {
                // Render one extra row
                const r = table.rows.length;

                return html`
                            <div
                                class="cell header-row ${selCol === -2 &&
                        (selRow === r || ((minC === -1 || selCol === -2) && r >= minR && r <= maxR))
                        ? 'selected'
                        : ''}"
                                data-row="${r}"
                                tabindex="0"
                                @click="${(_: MouseEvent) => {
                        this.selectionCtrl.selectCell(r, -2);
                        this.focusCell();
                    }}"
                                @mousedown="${(_: MouseEvent) => this.selectionCtrl.startSelection(r, -2)}"
                                @keydown="${this._handleKeyDown}"
                                @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, 'row', r)}"
                                style="opacity: 0.5;"
                            >
                                +
                            </div>

                            ${Array.from({ length: colCount }).map((_, c) => {
                        const isActive = r === selRow && c === selCol;
                        const isEditingCell = this.editCtrl.isEditing && isActive;

                        let inRange = false;
                        let topEdge = false,
                            bottomEdge = false,
                            leftEdge = false,
                            rightEdge = false;
                        if (minR !== -1) {
                            if (r >= minR && r <= maxR && c >= minC && c <= maxC) {
                                inRange = true;
                                if (r === minR) topEdge = true;
                                if (r === maxR) bottomEdge = true;
                                if (r === maxR && r === table.rows.length) bottomEdge = true; // explicitly ghost row is usually last
                                if (c === minC) leftEdge = true;
                                if (c === maxC) rightEdge = true;
                            }
                        }

                        return html`
                                    <div
                                        class="cell ${isActive ? 'selected' : ''} ${inRange
                                ? 'selected-range'
                                : ''} ${isEditingCell ? 'editing' : ''} ${topEdge
                                    ? 'range-top'
                                    : ''} ${bottomEdge ? 'range-bottom' : ''} ${leftEdge
                                        ? 'range-left'
                                        : ''} ${rightEdge ? 'range-right' : ''} ${isActive ? 'active-cell' : ''}"
                                        data-row="${r}"
                                        data-col="${c}"
                                        tabindex="${isActive ? 0 : -1}"
                                        contenteditable="${isEditingCell ? 'true' : 'false'}"
                                        @click="${(e: MouseEvent) => {
                                if (e.shiftKey) this.selectionCtrl.selectCell(r, c, true);
                                else this.selectionCtrl.selectCell(r, c);
                                this.focusCell();
                            }}"
                                        @mousedown="${(e: MouseEvent) => {
                                if (e.shiftKey) this.selectionCtrl.selectCell(r, c, true);
                                else this.selectionCtrl.startSelection(r, c);
                                this.focusCell();
                            }}"
                                        @dblclick="${(_: MouseEvent) => {
                                this.selectionCtrl.selectCell(r, c);
                                this.editCtrl.startEditing('');
                                this.focusCell();
                            }}"
                                        @input="${this._handleInput}"
                                        @blur="${this._handleBlur}"
                                        @keydown="${this._handleKeyDown}"
                                        .textContent="${isEditingCell
                                ? live(
                                    this.editCtrl.pendingEditValue !== null
                                        ? this.editCtrl.pendingEditValue
                                        : ''
                                )
                                : nothing}"
                                        .innerHTML="${!isEditingCell ? this._renderMarkdown('') : nothing}"
                                        style="opacity: 0.5;"
                                    ></div>
                                `;
                    })}
                        `;
            })()}
                </div>
            </div>

            <!-- Context Menu -->
            ${this.contextMenu
                ? html`
                      <div class="context-menu" style="top: ${this.contextMenu.y}px; left: ${this.contextMenu.x}px">
                          ${this.contextMenu.type === 'row'
                        ? html`
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('insert-row', {
                                        rowIndex: this.contextMenu.index
                                    });
                                }
                            }}"
                                    >
                                        ${t('insertRowAbove')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('insert-row', {
                                        rowIndex: this.contextMenu.index + 1
                                    });
                                }
                            }}"
                                    >
                                        ${t('insertRowBelow')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('row-delete', {
                                        rowIndex: this.contextMenu.index
                                    });
                                }
                            }}"
                                    >
                                        ${t('deleteRow')}
                                    </div>
                                `
                        : html`
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('insert-column', {
                                        colIndex: this.contextMenu.index
                                    });
                                }
                            }}"
                                    >
                                        ${t('insertColLeft')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('insert-column', {
                                        colIndex: this.contextMenu.index + 1
                                    });
                                }
                            }}"
                                    >
                                        ${t('insertColRight')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        @click="${() => {
                                if (this.contextMenu) {
                                    this._dispatchAction('column-delete', {
                                        colIndex: this.contextMenu.index
                                    });
                                }
                            }}"
                                    >
                                        ${t('deleteCol')}
                                    </div>
                                `}
                      </div>
                  `
                : ''}
        `;
    }

    private _handleFocusIn = () => {
        (window as any).activeSpreadsheetTable = this;
    };

    private _getEditingHtml(text: string) {
        if (!text) return '';
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        // Replace all newlines with <br>
        // And if it ends with newline, append an extra <br> so the cursor can move there.
        return escaped.split('\n').join('<br>') + (text.endsWith('\n') ? '<br>' : '');
    }

    private _getDOMText(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        if (node.nodeName === 'BR') {
            return '\n';
        }
        let text = '';
        node.childNodes.forEach(child => {
            text += this._getDOMText(child);
        });
        return text;
    }

    private _renderMarkdown(content: string): string {
        if (!content) return '';
        // Use parseInline to avoid <p> tags and enable GFM line breaks
        let html = marked.parseInline(content, { breaks: true }) as string;

        // Browsers collapse literal newlines in innerHTML unless white-space: pre is used.
        // We enforce <br> for every newline to be safe.
        // marked with breaks:true handles most, but parseInline might differ.
        html = html.replace(/\n/g, '<br>');

        // If the content ends with a <br>, browsers often collapse it (visually ignore the last line break).
        // We append an extra <br> so the previous one renders as a blank line.
        if (html.endsWith('<br>')) {
            html += '<br>';
        }
        return html;
    }

    public handleToolbarAction(action: string) {
        if (!this.editCtrl.isEditing) {
            // Non-edit mode: Apply to selection
            const r = this.selectionCtrl.selectedRow;
            const c = this.selectionCtrl.selectedCol;
            if (r >= 0 && c >= 0 && this.table && this.table.rows[r]) {
                const cellValue = this.table.rows[r][c] || '';
                const newValue = this._applyFormat(cellValue, action);
                if (newValue !== cellValue) {
                    this._updateCell(r, c, newValue);
                }
            }
            return;
        }

        // Edit mode: Apply to active element (contenteditable)
        const currentVal = this.editCtrl.pendingEditValue || '';
        const newValue = this._applyFormat(currentVal, action);
        this.editCtrl.setPendingValue(newValue);
    }

    private _applyFormat(text: string, action: string): string {
        // Simple toggle logic (naive)
        if (action === 'bold') {
            if (text.startsWith('**') && text.endsWith('**')) {
                return text.substring(2, text.length - 2);
            }
            return `**${text}**`;
        }
        if (action === 'italic') {
            if (text.startsWith('*') && text.endsWith('*')) {
                return text.substring(1, text.length - 1);
            }
            return `*${text}*`;
        }
        if (action === 'strikethrough') {
            if (text.startsWith('~~') && text.endsWith('~~')) {
                return text.substring(2, text.length - 2);
            }
            return `~~${text}~~`;
        }
        if (action === 'underline') {
            if (text.startsWith('<u>') && text.endsWith('</u>')) {
                return text.substring(3, text.length - 4);
            }
            return `<u>${text}</u>`;
        }
        return text;
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
}
