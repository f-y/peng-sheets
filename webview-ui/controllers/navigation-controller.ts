import { ReactiveController, ReactiveControllerHost } from 'lit';
import { SelectionController } from './selection-controller';
import { SpreadsheetTable } from '../components/spreadsheet-table';

export class NavigationController implements ReactiveController {
    host: ReactiveControllerHost;
    selectionCtrl: SelectionController;

    constructor(host: ReactiveControllerHost, selectionCtrl: SelectionController) {
        this.host = host;
        this.selectionCtrl = selectionCtrl;
        host.addController(this);
    }

    hostConnected() { }
    hostDisconnected() { }

    handleKeyDown(e: KeyboardEvent, maxRows: number, maxCols: number) {
        if (e.isComposing) return;

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        // Simple nav logic moved here
        let dr = 0;
        let dc = 0;
        let extend = shift; // Default extension behavior based on Shift

        switch (e.key) {
            case 'ArrowUp':
                dr = -1;
                break;
            case 'ArrowDown':
                dr = 1;
                break;
            case 'ArrowLeft':
                dc = -1;
                break;
            case 'ArrowRight':
                dc = 1;
                break;
            case 'Tab':
                dc = shift ? -1 : 1;
                extend = false; // Tab should never extend selection
                e.preventDefault();
                break; // Tab cycle
            case 'Enter':
                dr = shift ? -1 : 1;
                extend = false; // Enter should never extend selection
                e.preventDefault();
                break; // Enter cycle
            default:
                return; // Not nav key
        }

        if (dr !== 0 || dc !== 0) {
            e.preventDefault();
            this._moveSelection(dr, dc, extend, maxRows, maxCols, ctrl);
        }
    }

    private _moveSelection(dr: number, dc: number, split: boolean, maxRows: number, maxCols: number, jump: boolean) {
        // Implementation delegates to selectionCtrl
        let r = this.selectionCtrl.selectedRow;
        let c = this.selectionCtrl.selectedCol;

        if (jump) {
            // Ctrl + Arrow logic (Edge jump)
            // Simplified for now: standard + 1
            r += dr;
            c += dc;
        } else {
            if (dr !== 0) {
                r = (this.host as SpreadsheetTable).getNextVisibleRowIndex(r, dr);
            } else {
                r += dr;
            }
            c += dc;
        }

        // Clamp
        r = Math.max(0, Math.min(r, maxRows - 1));
        c = Math.max(0, Math.min(c, maxCols - 1));

        // If split (Shift) true, extend selection
        // In Excel, Shift+Arrow extends.
        // In our selection-controller, selectCell has 'extend' param
        this.selectionCtrl.selectCell(r, c, split);

        // Request scroll into view (Host responsibility via callback?)
        // Or controller can trigger updated host checks
        // For now, assume host reacts to selection change
    }
}
