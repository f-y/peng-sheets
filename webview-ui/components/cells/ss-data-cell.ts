/**
 * ss-data-cell - A single data cell in the spreadsheet grid.
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
 * - ss-cell-mousemove: { row, col }
 */
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    emitCellMousedown,
    emitCellClick,
    emitCellDblclick,
    emitCellInput,
    emitCellBlur,
    emitCellKeydown,
    emitCellMousemove
} from '../mixins/cell-events';
import { t } from '../../utils/i18n';

export interface ValidationRule {
    type: 'list' | 'date' | 'integer' | 'email' | 'url';
    values?: string[];
    min?: number;
    max?: number;
}

@customElement('ss-data-cell')
export class SSDataCell extends LitElement {
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
    @property({ type: String }) value = '';
    @property({ type: String }) renderedHtml = '';
    @property({ type: Boolean }) isEditing = false;
    @property({ type: Boolean }) isSelected = false;
    @property({ type: Boolean }) isInRange = false;
    @property({ type: Boolean }) isActive = false;
    @property({ type: Boolean }) wordWrap = true;
    @property({ type: String }) align = 'left';
    @property({ type: String }) editingHtml = '';

    // Validation
    @property({ type: Object }) validationRule: ValidationRule | null = null;

    // Selection state classes
    @property({ type: String }) selectionClass = '';

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

    private _onMousemove = () => {
        emitCellMousemove(this, this.row, this.col);
    };

    /**
     * Validate the current value against the validation rule.
     * Returns error message if invalid, null if valid.
     */
    private _getValidationError(): string | null {
        if (!this.validationRule || !this.value.trim()) return null;

        const val = this.value.trim();
        const rule = this.validationRule;

        switch (rule.type) {
            case 'list':
                if (rule.values && !rule.values.includes(val)) {
                    return t('errorMustBeOneOf', rule.values.join(', '));
                }
                break;
            case 'date':
                if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val))) {
                    return t('errorInvalidDate');
                }
                break;
            case 'integer': {
                const num = Number(val);
                if (!Number.isInteger(num)) {
                    return t('errorMustBeInteger');
                }
                if (rule.min !== undefined && num < rule.min) {
                    return t('errorMustBeMin', rule.min.toString());
                }
                if (rule.max !== undefined && num > rule.max) {
                    return t('errorMustBeMax', rule.max.toString());
                }
                break;
            }
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    return t('errorInvalidEmail');
                }
                break;
            case 'url':
                try {
                    new URL(val);
                } catch {
                    return t('errorInvalidUrl');
                }
                break;
        }
        return null;
    }

    render() {
        const validationError = this._getValidationError();
        const hasError = validationError !== null;

        const classes = [
            'cell',
            this.wordWrap ? 'word-wrap' : 'no-wrap',
            this.isEditing ? 'editing' : '',
            this.isSelected ? 'selected' : '',
            this.isInRange ? 'selected-range' : '',
            this.isActive && !this.isInRange ? 'active-cell' : 'active-cell-no-outline',
            this.selectionClass,
            this.rangeTop ? 'range-top' : '',
            this.rangeBottom ? 'range-bottom' : '',
            this.rangeLeft ? 'range-left' : '',
            this.rangeRight ? 'range-right' : '',
            hasError ? 'validation-error' : ''
        ]
            .filter(Boolean)
            .join(' ');

        return html`
            <div
                class="${classes}"
                data-row="${this.row}"
                data-col="${this.col}"
                tabindex="${this.isActive ? 0 : -1}"
                style="text-align: ${this.align}"
                contenteditable="${this.isEditing ? 'true' : 'false'}"
                title="${hasError ? validationError : ''}"
                .innerHTML="${this.isEditing ? this.editingHtml || this.value : this.renderedHtml || this.value}"
                @mousedown="${this._onMousedown}"
                @click="${this._onClick}"
                @dblclick="${this._onDblclick}"
                @input="${this._onInput}"
                @blur="${this._onBlur}"
                @keydown="${this._onKeydown}"
                @mousemove="${this._onMousemove}"
            ></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-data-cell': SSDataCell;
    }
}
