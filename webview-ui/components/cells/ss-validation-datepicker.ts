/**
 * ss-validation-datepicker - Date picker button for Date validation.
 * Uses Light DOM for proper styling integration with parent.
 * Button is positioned relative to the previous sibling .cell div using position: fixed.
 *
 * Events Emitted:
 * - ss-datepicker-select: { value: string } - When a date is selected
 */
import { LitElement, html, nothing, unsafeCSS } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { SimpleDateFormatter } from '../../utils/date-formatter';
import datepickerStyles from '../../styles/validation-controls.css?inline';

@customElement('ss-validation-datepicker')
export class SSValidationDatepicker extends LitElement {
    static styles = unsafeCSS(datepickerStyles);

    // Use Light DOM
    protected createRenderRoot() {
        return this;
    }

    @property({ type: String }) value: string = '';
    @property({ type: String }) dateFormat: string = 'YYYY-MM-DD';

    @query('.validation-datepicker-trigger')
    private buttonElement!: HTMLButtonElement;

    private _resizeObserver: ResizeObserver | null = null;
    private _wrapperStyle = '';

    private _handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        const rawValue = input.value; // YYYY-MM-DD from native input

        const rawDate = input.value; // YYYY-MM-DD
        const date = SimpleDateFormatter.parseDate(rawDate, 'YYYY-MM-DD');
        if (date) {
            const formatted = SimpleDateFormatter.formatDate(date, this.dateFormat);
            this.dispatchEvent(
                new CustomEvent('ss-datepicker-select', {
                    detail: { value: formatted },
                    bubbles: true,
                    composed: true
                })
            );
        }
        this.requestUpdate();
    }

    connectedCallback() {
        super.connectedCallback();
        // Update position on scroll or resize
        this._updatePosition();
        window.addEventListener('scroll', this._updatePosition, true);
        window.addEventListener('resize', this._updatePosition);

        // Observe cell size changes
        this._resizeObserver = new ResizeObserver(() => this._updatePosition());
        const cell = this._getCellElement();
        if (cell) {
            this._resizeObserver.observe(cell);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('scroll', this._updatePosition, true);
        window.removeEventListener('resize', this._updatePosition);
        this._resizeObserver?.disconnect();
    }

    private _getCellElement(): HTMLElement | null {
        // The .cell div is the previous sibling within ss-data-cell parent
        const parent = this.parentElement;
        if (parent?.tagName === 'SS-DATA-CELL') {
            return parent.querySelector('.cell') as HTMLElement | null;
        }
        return this.previousElementSibling as HTMLElement | null;
    }

    private _updatePosition = () => {
        const cell = this._getCellElement();
        if (!cell) return;

        const container = this.closest('.table-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        // Calculate position relative to the container
        // Align to top of cell (with small offset) instead of center for multiline cells
        const top = cellRect.top - containerRect.top + container.scrollTop + 1;
        // Place button outside the cell, to the right
        const left = cellRect.right - containerRect.left + container.scrollLeft;

        const newStyle = `top: ${top}px; left: ${left}px;`;
        if (this._wrapperStyle !== newStyle) {
            this._wrapperStyle = newStyle;
            const wrapper = this.querySelector('.date-picker-wrapper') as HTMLElement;
            if (wrapper) {
                // Keep existing display style if any
                wrapper.style.top = `${top}px`;
                wrapper.style.left = `${left}px`;
            }
        }
    };

    updated() {
        // Ensure position is correct after render
        requestAnimationFrame(() => this._updatePosition());
    }

    render() {
        return html`
            <div class="date-picker-wrapper" style="${this._wrapperStyle}">
                <button class="validation-datepicker-trigger" tabindex="-1">📅</button>
                <input
                    type="date"
                    class="hidden-native-input"
                    .value="${this._toInputDate(this.value)}"
                    @input="${this._handleInput}"
                    title="Select Date"
                />
            </div>
        `;
    }

    private _toInputDate(value: string | undefined): string {
        if (!value) return '';
        const date = SimpleDateFormatter.parseDate(value, this.dateFormat);
        if (date) {
            return SimpleDateFormatter.formatDate(date, 'YYYY-MM-DD');
        }
        return '';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-validation-datepicker': SSValidationDatepicker;
    }
}
