import { ReactiveController, ReactiveControllerHost } from 'lit';
import { SpreadsheetTable } from '../components/spreadsheet-table';

export class ResizeController implements ReactiveController {
    host: ReactiveControllerHost;

    colWidths: { [key: number]: number } = {};
    resizingCol: number = -1;
    resizeStartX: number = 0;
    resizeStartWidth: number = 0;

    constructor(host: ReactiveControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {
        this._cleanup();
    }

    setColumnWidths(widths: { [key: number]: number }) {
        this.colWidths = { ...widths };
        this.host.requestUpdate();
    }

    startResize(e: MouseEvent, colIndex: number, currentWidth: number) {
        e.preventDefault();
        e.stopPropagation();

        this.resizingCol = colIndex;
        this.resizeStartX = e.clientX;
        this.resizeStartWidth = currentWidth;

        document.addEventListener('mousemove', this._handleResize);
        document.addEventListener('mouseup', this._handleResizeEnd);
        document.body.style.cursor = 'col-resize';
    }

    private _handleResize = (e: MouseEvent) => {
        if (this.resizingCol === -1) return;

        const deltaX = e.clientX - this.resizeStartX;
        const newWidth = Math.max(50, this.resizeStartWidth + deltaX); // Min width 50px

        this.colWidths[this.resizingCol] = newWidth;
        this.host.requestUpdate();
    };

    private _handleResizeEnd = (_e: MouseEvent) => {
        if (this.resizingCol === -1) return;

        const finalWidth = this.colWidths[this.resizingCol];
        const host = this.host as unknown as SpreadsheetTable; // Cast to access custom properties
        const sheetIndex = host.sheetIndex;
        const tableIndex = host.tableIndex;

        // Dispatch event via Host
        (this.host as unknown as HTMLElement).dispatchEvent(
            new CustomEvent('column-resize', {
                detail: {
                    col: this.resizingCol,
                    width: finalWidth,
                    sheetIndex: sheetIndex,
                    tableIndex: tableIndex
                },
                bubbles: true,
                composed: true
            })
        );

        this._cleanup();
        this.resizingCol = -1;
        this.host.requestUpdate();
    };

    private _cleanup() {
        document.removeEventListener('mousemove', this._handleResize);
        document.removeEventListener('mouseup', this._handleResizeEnd);
        document.body.style.cursor = '';
    }
}
