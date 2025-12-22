import { ReactiveController, ReactiveControllerHost } from 'lit';

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

    hostConnected() { }
    hostDisconnected() {
        this._cleanup();
    }

    setColumnWidths(widths: { [key: number]: number }) {
        this.colWidths = { ...widths };
        this.host.requestUpdate();
    }

    startResize(e: MouseEvent, index: number, currentDomWidth: number) {
        e.preventDefault();
        e.stopPropagation();
        this.resizingCol = index;
        this.resizeStartX = e.clientX;
        this.resizeStartWidth = currentDomWidth || 100;

        document.addEventListener('mousemove', this._handleMouseMove);
        document.addEventListener('mouseup', this._handleMouseUp);
        this.host.requestUpdate();
    }

    private _handleMouseMove = (e: MouseEvent) => {
        if (this.resizingCol === -1) return;
        const diff = e.clientX - this.resizeStartX;
        const newWidth = Math.max(30, this.resizeStartWidth + diff); // Min width 30

        this.colWidths = { ...this.colWidths, [this.resizingCol]: newWidth };
        this.host.requestUpdate();
    };

    private _handleMouseUp = (_e: MouseEvent) => {
        if (this.resizingCol === -1) return;

        const finalWidth = this.colWidths[this.resizingCol];
        const host = this.host as any; // Cast to access custom properties
        const sheetIndex = host.sheetIndex;
        const tableIndex = host.tableIndex;

        // Dispatch event via Host
        (this.host as HTMLElement).dispatchEvent(
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
        document.removeEventListener('mousemove', this._handleMouseMove);
        document.removeEventListener('mouseup', this._handleMouseUp);
    }
}
