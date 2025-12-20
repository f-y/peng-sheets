import { ReactiveController, ReactiveControllerHost } from 'lit';

/** Range boundaries for cell selection */
export interface SelectionRange {
    minR: number;
    maxR: number;
    minC: number;
    maxC: number;
}

export class SelectionController implements ReactiveController {
    host: ReactiveControllerHost;

    selectedRow: number = 0;
    selectedCol: number = 0;
    selectionAnchorRow: number = -1;
    selectionAnchorCol: number = -1;
    isSelecting: boolean = false;

    constructor(host: ReactiveControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}

    hostDisconnected() {
        // cleanup listeners if any
        window.removeEventListener('mousemove', this._handleGlobalMouseMove);
        window.removeEventListener('mouseup', this._handleGlobalMouseUp);
    }

    reset() {
        this.selectedRow = 0;
        this.selectedCol = 0;
        this.selectionAnchorRow = -1;
        this.selectionAnchorCol = -1;
        this.isSelecting = false;
        this.host.requestUpdate();
    }

    selectCell(rowIndex: number, colIndex: number, extend: boolean = false) {
        if (extend && this.selectionAnchorRow !== -1) {
            this.selectedRow = rowIndex;
            this.selectedCol = colIndex;
        } else {
            this.selectionAnchorRow = rowIndex;
            this.selectionAnchorCol = colIndex;
            this.selectedRow = rowIndex;
            this.selectedCol = colIndex;
        }
        this.host.requestUpdate();
    }

    startSelection(rowIndex: number, colIndex: number, extend: boolean = false) {
        this.selectCell(rowIndex, colIndex, extend);
        this.isSelecting = true;

        window.addEventListener('mousemove', this._handleGlobalMouseMove);
        window.addEventListener('mouseup', this._handleGlobalMouseUp);
    }

    handleMouseMove = (e: MouseEvent) => {
        this._handleGlobalMouseMove(e);
    };

    handleMouseUp = (e: MouseEvent) => {
        this._handleGlobalMouseUp(e);
    };

    private _handleGlobalMouseMove = (e: MouseEvent) => {
        if (!this.isSelecting) return;

        const path = e.composedPath();
        const element = path.find((el: EventTarget) => (el as HTMLElement).classList?.contains('cell')) as HTMLElement;

        if (element) {
            const r = parseInt(element.getAttribute('data-row') || '-100');
            const c = parseInt(element.getAttribute('data-col') || '-100');

            if (r !== -100) {
                this._updateSelectionDrag(r, c);
            }
        }
    };

    private _updateSelectionDrag(r: number, c: number) {
        // Logic for Header Dragging
        if (this.selectionAnchorCol === -2) {
            // Row Mode: Update selectedRow
            if (r !== -1 && r !== this.selectedRow) {
                this.selectedRow = r;
                this.host.requestUpdate();
            }
        } else if (this.selectionAnchorRow === -2) {
            // Col Mode: Update selectedCol
            if (c !== -1 && c !== this.selectedCol && r === -1) {
                this.selectedCol = c;
                this.host.requestUpdate();
            } else if (c !== -1 && c !== this.selectedCol) {
                // Dragging over body cells while in Col Mode -> update Col
                this.selectedCol = c;
                this.host.requestUpdate();
            }
        } else {
            // Normal Range Mode
            if (r !== -1 && c !== -1) {
                // Ignore headers
                if (r !== this.selectedRow || c !== this.selectedCol) {
                    this.selectedRow = r;
                    this.selectedCol = c;
                    this.host.requestUpdate();
                }
            }
        }
    }

    private _handleGlobalMouseUp = (_e: MouseEvent) => {
        this.isSelecting = false;
        window.removeEventListener('mousemove', this._handleGlobalMouseMove);
        window.removeEventListener('mouseup', this._handleGlobalMouseUp);
        // host can verify focus if needed
        this.host.requestUpdate();
    };

    /**
     * Calculate the selection range boundaries based on current selection state.
     * @param numRows - Total number of data rows
     * @param numCols - Total number of columns
     * @returns SelectionRange with minR, maxR, minC, maxC
     */
    getSelectionRange(numRows: number, numCols: number): SelectionRange {
        // Full table selection (corner click)
        if (this.selectedRow === -2 && this.selectedCol === -2) {
            return {
                minR: 0,
                maxR: Math.max(0, numRows - 1),
                minC: 0,
                maxC: Math.max(0, numCols - 1)
            };
        }

        // No anchor means no range selection
        if (this.selectionAnchorRow === -1 || this.selectionAnchorCol === -1) {
            return { minR: -1, maxR: -1, minC: -1, maxC: -1 };
        }

        // Row selection mode
        if (this.selectedCol === -2 || this.selectionAnchorCol === -2) {
            return {
                minR: Math.min(this.selectionAnchorRow, this.selectedRow),
                maxR: Math.max(this.selectionAnchorRow, this.selectedRow),
                minC: 0,
                maxC: Math.max(0, numCols - 1)
            };
        }

        // Column selection mode
        if (this.selectedRow === -2 || this.selectionAnchorRow === -2) {
            return {
                minR: 0,
                maxR: Math.max(0, numRows - 1),
                minC: Math.min(this.selectionAnchorCol, this.selectedCol),
                maxC: Math.max(this.selectionAnchorCol, this.selectedCol)
            };
        }

        // Regular cell range selection
        return {
            minR: Math.min(this.selectionAnchorRow, this.selectedRow),
            maxR: Math.max(this.selectionAnchorRow, this.selectedRow),
            minC: Math.min(this.selectionAnchorCol, this.selectedCol),
            maxC: Math.max(this.selectionAnchorCol, this.selectedCol)
        };
    }
}
