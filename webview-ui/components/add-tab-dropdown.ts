import { html, LitElement, unsafeCSS, nothing, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../utils/i18n';
import styles from './styles/add-tab-dropdown.css?inline';

/**
 * Dropdown menu for adding new sheets or documents.
 *
 * @fires add-sheet - When "Add Sheet" option is clicked
 * @fires add-document - When "Add Document" option is clicked
 * @fires close - When menu should close (overlay click)
 */
@customElement('add-tab-dropdown')
export class AddTabDropdown extends LitElement {
    static styles = unsafeCSS(styles);

    /** Whether the dropdown is open */
    @property({ type: Boolean })
    open = false;

    /** X position of the dropdown */
    @property({ type: Number })
    x = 0;

    /** Y position of the dropdown */
    @property({ type: Number })
    y = 0;

    /** Adjusted X position after overflow check */
    @state()
    private _adjustedX: number | null = null;

    /** Adjusted Y position after overflow check */
    @state()
    private _adjustedY: number | null = null;

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);

        // Adjust position after render if menu opened or position changed
        if (this.open && (changedProperties.has('open') || changedProperties.has('x') || changedProperties.has('y'))) {
            this._adjustedX = null;
            this._adjustedY = null;
            setTimeout(() => {
                const menuEl = this.shadowRoot?.querySelector('.dropdown-menu') as HTMLElement;
                if (menuEl) {
                    const rect = menuEl.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    // Adjust X if menu extends beyond right edge
                    if (rect.right > viewportWidth) {
                        this._adjustedX = this.x - rect.width;
                    }

                    // Adjust Y if menu extends below viewport
                    if (rect.bottom > viewportHeight) {
                        this._adjustedY = this.y - rect.height;
                    }
                }
            }, 0);
        }

        // Reset adjusted position when closed
        if (!this.open && changedProperties.has('open')) {
            this._adjustedX = null;
            this._adjustedY = null;
        }
    }

    private _dispatchAction(action: string) {
        this.dispatchEvent(
            new CustomEvent(action, {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleOverlayClick() {
        this._dispatchAction('close');
    }

    render() {
        if (!this.open) return nothing;

        const displayX = this._adjustedX ?? this.x;
        const displayY = this._adjustedY ?? this.y;

        return html`
            <div class="dropdown-menu" style="top: ${displayY}px; left: ${displayX}px;">
                <div class="dropdown-item" @click="${() => this._dispatchAction('add-sheet')}">${t('addNewSheet')}</div>
                <div class="dropdown-item" @click="${() => this._dispatchAction('add-document')}">
                    ${t('addNewDocument')}
                </div>
            </div>
            <!-- Overlay to close menu on click outside -->
            <div class="overlay" @click="${this._handleOverlayClick}"></div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'add-tab-dropdown': AddTabDropdown;
    }
}
