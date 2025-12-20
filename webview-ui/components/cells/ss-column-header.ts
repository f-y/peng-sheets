/**
 * ss-column-header - A column header cell displaying the column name.
 *
 * Uses Light DOM rendering and emits custom events for parent handling.
 *
 * Events Emitted:
 * - ss-col-click: { col, shiftKey }
 * - ss-col-mousedown: { col, shiftKey }
 * - ss-col-dblclick: { col }
 * - ss-col-input: { col, target }
 * - ss-col-blur: { col, target }
 * - ss-col-keydown: { col, originalEvent }
 * - ss-contextmenu: { type: 'col', index, x, y }
 * - ss-filter-click: { col, x, y }
 * - ss-resize-start: { col, x, width }
 */
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import {
    emitCellEvent,
    emitContextMenu,
    emitFilterClick,
    emitResizeStart,
    CellMouseEventDetail,
    CellEventDetail
} from '../mixins/cell-events';

@customElement('ss-column-header')
export class SSColumnHeader extends LitElement {
    // Disable shadow DOM - render to light DOM
    protected createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.style.display = 'contents';
    }

    @property({ type: Number, reflect: true, attribute: 'data-col' }) col = 0;
    @property({ type: String }) value = '';
    @property({ type: Boolean }) isSelected = false;
    @property({ type: Boolean }) isInRange = false;
    @property({ type: Boolean }) isEditing = false;
    @property({ type: Boolean }) hasActiveFilter = false;
    @property({ type: Boolean }) showActiveOutline = false;
    @property({ type: Number }) width = 100;

    private _onClick = (e: MouseEvent) => {
        emitCellEvent<CellMouseEventDetail>(this, 'ss-col-click', {
            row: -2, // Column selection mode
            col: this.col,
            shiftKey: e.shiftKey
        });
    };

    private _onMousedown = (e: MouseEvent) => {
        emitCellEvent<CellMouseEventDetail>(this, 'ss-col-mousedown', {
            row: -2,
            col: this.col,
            shiftKey: e.shiftKey
        });
    };

    private _onDblclick = () => {
        emitCellEvent<CellEventDetail>(this, 'ss-col-dblclick', {
            row: -1, // Header edit mode
            col: this.col
        });
    };

    private _onInput = (e: Event) => {
        emitCellEvent(this, 'ss-col-input', {
            col: this.col,
            target: e.target
        });
    };

    private _onBlur = (e: FocusEvent) => {
        emitCellEvent(this, 'ss-col-blur', {
            col: this.col,
            target: e.target,
            originalEvent: e
        });
    };

    private _onKeydown = (e: KeyboardEvent) => {
        emitCellEvent(this, 'ss-col-keydown', {
            col: this.col,
            originalEvent: e
        });
    };

    private _onContextmenu = (e: MouseEvent) => {
        emitContextMenu(this, 'col', this.col, e);
    };

    private _onFilterClick = (e: MouseEvent) => {
        emitFilterClick(this, this.col, e);
    };

    private _onResizeStart = (e: MouseEvent) => {
        e.stopPropagation();
        emitResizeStart(this, this.col, e.clientX, this.width);
    };

    private _stopPropagation = (e: Event) => {
        e.stopPropagation();
    };

    render() {
        const classes = [
            'cell',
            'header-col',
            this.isSelected ? 'selected' : '',
            this.isInRange ? 'selected-range' : '',
            this.isEditing ? 'editing' : '',
            this.showActiveOutline ? 'active-cell' : 'active-cell-no-outline'
        ]
            .filter(Boolean)
            .join(' ');

        return html`
            <div
                class="${classes}"
                data-col="${this.col}"
                data-row="-1"
                tabindex="0"
                contenteditable="false"
                @click="${this._onClick}"
                @mousedown="${this._onMousedown}"
                @dblclick="${this._onDblclick}"
                @contextmenu="${this._onContextmenu}"
                @input="${this._onInput}"
                @blur="${this._onBlur}"
                @keydown="${this._onKeydown}"
            >
                <span
                    class="cell-content"
                    contenteditable="${this.isEditing ? 'true' : 'false'}"
                    style="display:inline-block; min-width: 10px; padding: 2px;"
                    @blur="${this._onBlur}"
                    .textContent="${live(this.value)}"
                ></span>
                <span
                    class="filter-icon codicon codicon-filter ${this.hasActiveFilter ? 'active' : ''}"
                    @click="${this._onFilterClick}"
                    @mousedown="${this._stopPropagation}"
                ></span>
                <div
                    class="col-resize-handle"
                    contenteditable="false"
                    @mousedown="${this._onResizeStart}"
                    @dblclick="${this._stopPropagation}"
                ></div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-column-header': SSColumnHeader;
    }
}
