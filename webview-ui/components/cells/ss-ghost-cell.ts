/**
 * ss-ghost-cell - A ghost cell in the "add new row" row.
 *
 * Uses Light DOM rendering and emits custom events for parent handling.
 *
 * Events Emitted:
 * - ss-cell-mousedown: { row, col, shiftKey }
 * - ss-cell-click: { row, col, shiftKey }
 * - ss-cell-dblclick: { row, col }
 * - ss-cell-input: { row, col, target }
 * - ss-cell-blur: { row, col, target }
 * - ss-cell-keydown: { row, col, originalEvent }
 */
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    emitCellMousedown,
    emitCellClick,
    emitCellDblclick,
    emitCellInput,
    emitCellBlur,
    emitCellKeydown
} from '../mixins/cell-events';

@customElement('ss-ghost-cell')
export class SSGhostCell extends LitElement {
    // Disable shadow DOM - render to light DOM
    protected createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();
        this.style.display = 'contents';
    }

    @property({ type: Number, reflect: true, attribute: 'data-row' }) row = 0;
    @property({ type: Number, reflect: true, attribute: 'data-col' }) col = 0;
    @property({ type: Boolean }) isEditing = false;
    @property({ type: Boolean }) isSelected = false;
    @property({ type: Boolean }) isInRange = false;
    @property({ type: Boolean }) isActive = false;
    @property({ type: String }) align = 'left';
    @property({ type: String }) editingHtml = '';

    // Range border classes
    @property({ type: Boolean }) rangeTop = false;
    @property({ type: Boolean }) rangeBottom = false;
    @property({ type: Boolean }) rangeLeft = false;
    @property({ type: Boolean }) rangeRight = false;

    private _onMousedown = (e: MouseEvent) => {
        emitCellMousedown(this, this.row, this.col, e);
    };

    private _onClick = (e: MouseEvent) => {
        emitCellClick(this, this.row, this.col, e);
    };

    private _onDblclick = () => {
        emitCellDblclick(this, this.row, this.col);
    };

    private _onInput = (e: Event) => {
        emitCellInput(this, this.row, this.col, e.target);
    };

    private _onBlur = (e: FocusEvent) => {
        emitCellBlur(this, this.row, this.col, e.target, e);
    };

    private _onKeydown = (e: KeyboardEvent) => {
        emitCellKeydown(this, this.row, this.col, e);
    };

    render() {
        const classes = [
            'cell',
            this.isEditing ? 'editing' : '',
            this.isSelected ? 'selected' : '',
            this.isInRange ? 'selected-range' : '',
            this.isActive ? 'active-cell' : '',
            this.rangeTop ? 'range-top' : '',
            this.rangeBottom ? 'range-bottom' : '',
            this.rangeLeft ? 'range-left' : '',
            this.rangeRight ? 'range-right' : ''
        ]
            .filter(Boolean)
            .join(' ');

        return html`
            <div
                class="${classes}"
                data-row="${this.row}"
                data-col="${this.col}"
                tabindex="${this.isActive ? 0 : -1}"
                style="text-align: ${this.align}; opacity: 0.5;"
                contenteditable="${this.isEditing ? 'true' : 'false'}"
                .innerHTML="${this.editingHtml}"
                @mousedown="${this._onMousedown}"
                @click="${this._onClick}"
                @dblclick="${this._onDblclick}"
                @input="${this._onInput}"
                @blur="${this._onBlur}"
                @keydown="${this._onKeydown}"
            ></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-ghost-cell': SSGhostCell;
    }
}
