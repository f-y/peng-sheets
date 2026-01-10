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
    @property({ type: Boolean }) hasValidation = false;
    @property({ type: String }) validationType = '';
    @property({ type: Boolean }) isDraggable = false;
    @property({ type: Boolean }) isDragging = false;
    @property({ type: Boolean }) isDropTarget = false;
    @property({ type: Boolean }) isDropTargetEnd = false;
    @property({ type: Boolean }) isFormula = false;

    // Copied range edge properties (for dashed border indicator)
    @property({ type: Boolean }) copyTop = false;
    @property({ type: Boolean }) copyLeft = false;
    @property({ type: Boolean }) copyRight = false;

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
            shiftKey: e.shiftKey,
            originalEvent: e
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
            this.showActiveOutline ? 'active-cell' : 'active-cell-no-outline',
            this.isDraggable ? 'draggable' : '',
            this.isDragging ? 'dragging' : '',
            this.isDropTarget ? 'drop-target' : ''
        ]
            .filter(Boolean)
            .join(' ');

        // Build copy range border style (per-edge dashed border)
        const copyBorderParts: string[] = [];
        if (this.copyTop) copyBorderParts.push('border-top: 1px dashed #0078d7 !important');
        if (this.copyLeft) copyBorderParts.push('border-left: 1px dashed #0078d7 !important');
        if (this.copyRight) copyBorderParts.push('border-right: 1px dashed #0078d7 !important');
        const copyBorderStyle = copyBorderParts.length > 0 ? copyBorderParts.join('; ') + ';' : '';

        // Build drop target style
        const dropTargetStyle = `${this.isDropTarget ? 'border-left: 3px solid var(--selection-color, #0078d7);' : ''}${this.isDropTargetEnd ? 'border-right: 3px solid var(--selection-color, #0078d7);' : ''}`;

        return html`
            <div
                class="${classes}"
                data-col="${this.col}"
                data-row="-1"
                tabindex="0"
                contenteditable="false"
                style="${dropTargetStyle}${copyBorderStyle}"
                @click="${this._onClick}"
                @mousedown="${this._onMousedown}"
                @dblclick="${this._onDblclick}"
                @contextmenu="${this._onContextmenu}"
                @input="${this._onInput}"
                @blur="${this._onBlur}"
                @keydown="${this._onKeydown}"
            >
                <span
                    class="cell-content ${this.hasValidation ? 'has-validation' : ''}"
                    contenteditable="${this.isEditing ? 'true' : 'false'}"
                    style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 0;"
                    title="${this.hasValidation ? `${this.value} (${this.validationType})` : this.value}"
                    @blur="${this._onBlur}"
                    .textContent="${live(this.value)}"
                ></span>
                ${this.isFormula
                ? html`<span class="formula-icon codicon codicon-symbol-operator" title="Formula column"></span>`
                : ''}
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
