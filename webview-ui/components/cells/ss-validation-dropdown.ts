/**
 * ss-validation-dropdown - Dropdown button for List validation.
 * Uses Light DOM for proper styling integration with parent.
 * Button is positioned relative to the previous sibling .cell div using position: fixed.
 *
 * Events Emitted:
 * - ss-dropdown-select: { value: string } - When a value is selected
 */
import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isRealEnterKey } from '../../utils/keyboard-utils';

@customElement('ss-validation-dropdown')
export class SSValidationDropdown extends LitElement {
    // Use Light DOM
    protected createRenderRoot() {
        return this;
    }

    @property({ type: Array }) values: string[] = [];
    @property({ type: String }) currentValue = '';

    @state() private _isOpen = false;
    @state() private _buttonStyle = '';
    @state() private _menuStyle = '';

    private _resizeObserver: ResizeObserver | null = null;

    private _handleTriggerClick = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        this._isOpen = !this._isOpen;
        if (this._isOpen) {
            this._updateMenuPosition();
        }
    };

    private _handleTriggerKeydown = (e: KeyboardEvent) => {
        if (isRealEnterKey(e) || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this._isOpen = !this._isOpen;
            if (this._isOpen) {
                this._updateMenuPosition();
            }
        }
    };

    private _handleOptionClick = (value: string, e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        this.dispatchEvent(
            new CustomEvent('ss-dropdown-select', {
                detail: { value },
                bubbles: true,
                composed: true
            })
        );
        this._isOpen = false;
    };

    private _handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this._isOpen) {
            e.stopPropagation();
            this._isOpen = false;
        }
    };

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('keydown', this._handleKeydown);
        document.addEventListener('click', this._handleOutsideClick);

        // Update position on scroll or resize
        this._updateButtonPosition();
        window.addEventListener('scroll', this._updateButtonPosition, true);
        window.addEventListener('resize', this._updateButtonPosition);

        // Observe cell size changes
        this._resizeObserver = new ResizeObserver(() => this._updateButtonPosition());
        const cell = this._getCellElement();
        if (cell) {
            this._resizeObserver.observe(cell);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this._handleKeydown);
        document.removeEventListener('click', this._handleOutsideClick);
        window.removeEventListener('scroll', this._updateButtonPosition, true);
        window.removeEventListener('resize', this._updateButtonPosition);
        this._resizeObserver?.disconnect();
    }

    private _handleOutsideClick = (e: Event) => {
        if (this._isOpen && !this.contains(e.target as Node)) {
            this._isOpen = false;
            this.requestUpdate();
        }
    };

    private _getCellElement(): HTMLElement | null {
        // The .cell div is the previous sibling within ss-data-cell parent
        const parent = this.parentElement;
        if (parent?.tagName === 'SS-DATA-CELL') {
            return parent.querySelector('.cell') as HTMLElement | null;
        }
        // Fallback: previous sibling
        return this.previousElementSibling as HTMLElement | null;
    }

    private _updateButtonPosition = () => {
        const cell = this._getCellElement();
        if (!cell) return;

        // Find parent container to calculate relative offset
        // We need to position relative to .table-container which has overflow: auto
        const container = this.closest('.table-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        // Calculate position relative to the container
        // scrollTop is needed because containerRect.top is viewport relative,
        // cellRect.top is also viewport relative, but we want position inside scrollable area
        // Formula: relativeTop = (cellTop - containerTop) + scrollTop
        // With position: absolute inside .table-container, top:0 is the top of scrollable content area.
        // Align to top of cell (with small offset) instead of center for multiline cells
        const top = cellRect.top - containerRect.top + container.scrollTop + 2;
        // Place button outside the cell, to the right
        const left = cellRect.right - containerRect.left + container.scrollLeft;

        const newStyle = `top: ${top}px; left: ${left}px;`;
        // Only update if style changed to avoid loops
        if (this._buttonStyle !== newStyle) {
            this._buttonStyle = newStyle;
            // Directly update the button element to avoid re-render loop
            const button = this.querySelector('.validation-dropdown-trigger') as HTMLElement;
            if (button) {
                button.style.cssText = newStyle;
            }
        }
    };

    private _updateMenuPosition = () => {
        const button = this.querySelector('.validation-dropdown-trigger') as HTMLElement;
        if (!button) return;

        // Since button is absolute positioned relative to container,
        // we can use its offset properties to position the menu directly below it.
        const top = button.offsetTop + button.offsetHeight + 2;
        const left = button.offsetLeft;

        this._menuStyle = `top: ${top}px; left: ${left}px;`;
    };

    private _hasInitialized = false;

    updated(_changedProperties: Map<string, unknown>) {
        super.updated(_changedProperties);
        // Only run once after first render
        if (!this._hasInitialized) {
            this._hasInitialized = true;
            requestAnimationFrame(() => this._updateButtonPosition());
        }
    }

    render() {
        return html`
            <button
                class="validation-dropdown-trigger"
                style="${this._buttonStyle}"
                @click="${this._handleTriggerClick}"
                @keydown="${this._handleTriggerKeydown}"
                @mousedown="${(e: Event) => e.stopPropagation()}"
                aria-haspopup="listbox"
                aria-expanded="${this._isOpen}"
            >
                ▼
            </button>
            ${this._isOpen
                ? html`
                      <div class="validation-dropdown-menu" style="${this._menuStyle}" role="listbox">
                          ${this.values.map(
                              (value) => html`
                                  <div
                                      class="validation-dropdown-option ${value === this.currentValue
                                          ? 'selected'
                                          : ''}"
                                      role="option"
                                      aria-selected="${value === this.currentValue}"
                                      @click="${(e: Event) => this._handleOptionClick(value, e)}"
                                      @mousedown="${(e: Event) => e.stopPropagation()}"
                                  >
                                      ${value}
                                  </div>
                              `
                          )}
                      </div>
                  `
                : nothing}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-validation-dropdown': SSValidationDropdown;
    }
}
