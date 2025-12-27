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
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ss-validation-dropdown';
import './ss-validation-datepicker';
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
import { SimpleDateFormatter } from '../../utils/date-formatter';

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
    // New prop
    @property({ type: String }) dateFormat: string = 'YYYY-MM-DD';

    // Validation
    @property({ type: Object }) validationRule: ValidationRule | null = null;

    // Selection state classes
    @property({ type: String }) selectionClass = '';

    // Range border classes
    @property({ type: Boolean }) rangeTop = false;
    @property({ type: Boolean }) rangeBottom = false;
    @property({ type: Boolean }) rangeLeft = false;
    @property({ type: Boolean }) rangeRight = false;

    // Drag drop target indicator
    @property({ type: Boolean }) isCellDropTarget = false;

    // Draggable indicator (for move cursor)
    @property({ type: Boolean }) isDraggable = false;

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
                if (!this._validateDate(val)) {
                    return t('errorInvalidDate', this.dateFormat);
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
        // Validation check
        const validationError = this._getValidationError();
        const hasError = validationError !== null;

        // Dynamic classes
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
            hasError ? 'validation-error' : '',
            this.isCellDropTarget ? 'cell-drop-target' : '',
            this.isDraggable ? 'move-cursor' : ''
        ]
            .filter(Boolean)
            .join(' ');

        // Content determination
        let content = this.value;
        if (this.isEditing) {
            content = this.editingHtml || this.value;
        } else {
            // Apply date formatting if applicable
            if (this.validationRule?.type === 'date') {
                const formatted = this._getFormattedDate();
                if (formatted) {
                    content = formatted;
                } else if (this.renderedHtml) {
                    content = this.renderedHtml;
                }
            } else {
                content = this.renderedHtml || this.value;
            }
        }

        // Inline style for drop target (Light DOM doesn't inherit Shadow DOM CSS)
        const dropTargetStyle = this.isCellDropTarget
            ? 'border: 1px dashed #0078d7 !important; background-color: rgba(0, 120, 215, 0.1) !important;'
            : '';

        return html`
            <div
                class="${classes}"
                data-row="${this.row}"
                data-col="${this.col}"
                tabindex="${this.isActive ? 0 : -1}"
                style="text-align: ${this.align}; ${dropTargetStyle}"
                contenteditable="${this.isEditing ? 'true' : 'false'}"
                title="${hasError ? validationError || 'Invalid Value' : ''}"
                .innerHTML="${content}"
                @mousedown="${this._onMousedown}"
                @click="${this._onClick}"
                @dblclick="${this._onDblclick}"
                @input="${this._onInput}"
                @blur="${this._onBlur}"
                @keydown="${this._onKeydown}"
                @mousemove="${this._onMousemove}"
            ></div>
            ${this._renderValidationControl()}
        `;
    }

    private _validateDate(dateValue: string): boolean {
        if (!dateValue || dateValue.trim() === '') return true; // empty is valid unless required

        // Try parsing as YYYY-MM-DD
        if (SimpleDateFormatter.parseDate(dateValue, 'YYYY-MM-DD')) return true;

        // Try parsing as configured format
        if (SimpleDateFormatter.parseDate(dateValue, this.dateFormat)) return true;

        return false;
    }

    private _getFormattedDate(): string | null {
        if (!this.value) return null;

        // Try parsing as YYYY-MM-DD (native/standard)
        const date = SimpleDateFormatter.parseDate(this.value, 'YYYY-MM-DD');
        if (date) {
            return SimpleDateFormatter.formatDate(date, this.dateFormat);
        }

        // If already in target format, return as is (validation will pass if it parses)
        const dateConfig = SimpleDateFormatter.parseDate(this.value, this.dateFormat);
        if (dateConfig) {
            return this.value;
        }

        return null; // Could not parse, display raw value (which fallbacks to this.value in render)
    }

    private _renderValidationControl() {
        // Only show when single cell is selected/active and not editing
        // Hide when part of a range selection (multiple cells selected)
        if (!this.validationRule || this.isEditing || (!this.isSelected && !this.isActive)) {
            return nothing;
        }
        // Hide when this cell is part of a multi-cell range selection
        if (this.isInRange && this.isSelected) {
            return nothing;
        }

        if (this.validationRule.type === 'list' && this.validationRule.values) {
            return html`
                <ss-validation-dropdown
                    class="validation-control"
                    .values="${this.validationRule.values}"
                    .currentValue="${this.value}"
                    @ss-dropdown-select="${this._handleDropdownSelect}"
                ></ss-validation-dropdown>
            `;
        }

        // Datepicker
        if (this.validationRule.type === 'date') {
            return html`
                <ss-validation-datepicker
                    .value="${this.value}"
                    .dateFormat="${this.dateFormat}"
                    @ss-datepicker-select="${this._handleDateSelect}"
                ></ss-validation-datepicker>
            `;
        }

        return nothing;
    }

    private _handleDropdownSelect = (e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        // Emit cell input event with the selected value
        this.dispatchEvent(
            new CustomEvent('ss-validation-input', {
                detail: { row: this.row, col: this.col, value: e.detail.value },
                bubbles: true,
                composed: true
            })
        );
    };

    private _handleDateSelect = (e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        // Emit cell input event with the selected date
        this.dispatchEvent(
            new CustomEvent('ss-validation-input', {
                detail: { row: this.row, col: this.col, value: e.detail.value },
                bubbles: true,
                composed: true
            })
        );
    };
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-data-cell': SSDataCell;
    }
}
