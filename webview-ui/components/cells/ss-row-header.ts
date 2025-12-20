/**
 * ss-row-header - A row header cell displaying the row number.
 *
 * Uses Light DOM rendering and emits custom events for parent handling.
 *
 * Events Emitted:
 * - ss-row-click: { row, shiftKey }
 * - ss-row-mousedown: { row, shiftKey }
 * - ss-row-keydown: { row, originalEvent }
 * - ss-contextmenu: { type: 'row', index, x, y }
 */
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { emitCellEvent, emitContextMenu, CellMouseEventDetail, CellKeyEventDetail } from '../mixins/cell-events';

@customElement('ss-row-header')
export class SSRowHeader extends LitElement {
    // Disable shadow DOM - render to light DOM
    protected createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.style.display = 'contents';
    }

    @property({ type: Number, reflect: true, attribute: 'data-row' }) row = 0;
    @property({ type: Boolean }) isSelected = false;
    @property({ type: Boolean }) isInRange = false;
    @property({ type: Boolean }) isGhost = false;

    private _onClick = (e: MouseEvent) => {
        emitCellEvent<CellMouseEventDetail>(this, 'ss-row-click', {
            row: this.row,
            col: -2, // Row selection mode
            shiftKey: e.shiftKey
        });
    };

    private _onMousedown = (e: MouseEvent) => {
        emitCellEvent<CellMouseEventDetail>(this, 'ss-row-mousedown', {
            row: this.row,
            col: -2,
            shiftKey: e.shiftKey
        });
    };

    private _onKeydown = (e: KeyboardEvent) => {
        emitCellEvent<CellKeyEventDetail>(this, 'ss-row-keydown', {
            row: this.row,
            col: -2,
            originalEvent: e
        });
    };

    private _onContextmenu = (e: MouseEvent) => {
        emitContextMenu(this, 'row', this.row, e);
    };

    render() {
        const classes = [
            'cell',
            'header-row',
            this.isSelected ? 'selected' : '',
            this.isInRange ? 'selected-range' : ''
        ]
            .filter(Boolean)
            .join(' ');

        return html`
            <div
                class="${classes}"
                data-row="${this.row}"
                tabindex="0"
                style="${this.isGhost ? 'opacity: 0.5;' : ''}"
                @click="${this._onClick}"
                @mousedown="${this._onMousedown}"
                @keydown="${this._onKeydown}"
                @contextmenu="${this._onContextmenu}"
            >
                ${this.isGhost ? '+' : this.row + 1}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-row-header': SSRowHeader;
    }
}
