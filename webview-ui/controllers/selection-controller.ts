import { ReactiveController, ReactiveControllerHost } from 'lit';

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

    private _handleGlobalMouseMove = (e: MouseEvent) => {
        if (!this.isSelecting) return;

        const path = e.composedPath();
        const element = path.find((el) => (el as HTMLElement).classList?.contains('cell')) as HTMLElement;

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

    private _handleGlobalMouseUp = (e: MouseEvent) => {
        this.isSelecting = false;
        window.removeEventListener('mousemove', this._handleGlobalMouseMove);
        window.removeEventListener('mouseup', this._handleGlobalMouseUp);
        // host can verify focus if needed
        this.host.requestUpdate();
    };
}
